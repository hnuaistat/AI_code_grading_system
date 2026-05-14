import os
import json
import asyncio
import traceback
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import httpx
from openai import AsyncOpenAI
import openai
import json5
from schemas import PartialScoreCriterion


class APIQuotaError(Exception):
    """OpenAI API 사용량 초과 시 발생하는 예외"""
    pass


DEFAULT_MODEL = "openai/gpt-4o-mini"

# 사용 가능한 모델 목록 (provider/model_id 형식)
AVAILABLE_MODELS = [
    {"id": "openai/gpt-4o-mini", "label": "gpt-4o-mini", "provider": "openai"},
    {"id": "openai/gpt-4o", "label": "gpt-4o", "provider": "openai"},
    {"id": "openai/gpt-4.1-mini", "label": "gpt-4.1-mini", "provider": "openai"},
    {"id": "fireworks/accounts/fireworks/models/deepseek-v3p2", "label": "deepseek-v3.2", "provider": "fireworks"},
]


def parse_model_id(model: Optional[str]) -> Tuple[str, str]:
    """'openai/gpt-4o-mini' → ('openai', 'gpt-4o-mini'). prefix 없으면 openai로 간주."""
    model = (model or DEFAULT_MODEL).strip()
    if "/" not in model:
        return "openai", model
    provider, _, model_name = model.partition("/")
    return provider.lower(), model_name


def get_openai_client() -> AsyncOpenAI:
    """기본 OpenAI 클라이언트 (이전 호환성용)."""
    return _build_client(
        api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        base_url=(os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip(),
    )


def get_llm_client(model: str) -> Tuple[AsyncOpenAI, str]:
    """
    모델 ID('openai/...' 또는 'fireworks/...')를 받아서
    적절한 provider 클라이언트와 실제 모델명을 반환.
    Fireworks도 OpenAI 호환 API를 제공하므로 AsyncOpenAI 클라이언트 재사용.
    """
    provider, model_name = parse_model_id(model)
    if provider == "fireworks":
        api_key = os.getenv("FIREWORKS_API_KEY", "").strip()
        base_url = (os.getenv("FIREWORKS_BASE_URL") or "https://api.fireworks.ai/inference/v1").strip()
        if not api_key:
            raise RuntimeError("FIREWORKS_API_KEY 환경변수가 설정되지 않았습니다")
        print(f"[Fireworks] base_url={base_url!r} | model_name={model_name!r} | key_set={bool(api_key)}")
        return _build_client(api_key=api_key, base_url=base_url), model_name
    # default: openai
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다")
    return _build_client(api_key=api_key, base_url=base_url), model_name


def _build_client(api_key: str, base_url: str) -> AsyncOpenAI:
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(180.0, connect=30.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
    )
    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        http_client=http_client,
        timeout=180.0,
        max_retries=2,
    )


async def _call_with_retry(coro_fn, max_retries: int = 5):
    """RateLimitError 발생 시 exponential backoff으로 재시도."""
    delay = 10
    for attempt in range(max_retries + 1):
        try:
            return await coro_fn()
        except openai.RateLimitError as e:
            if attempt == max_retries:
                print(f"[Retry] 최대 재시도 횟수 초과. 포기합니다.")
                raise APIQuotaError(str(e))
            print(f"[Retry] RateLimitError 발생 (시도 {attempt + 1}/{max_retries}). {delay}초 후 재시도...")
            await asyncio.sleep(delay)
            delay *= 2
        except Exception as e:
            print(f"[ERROR] LLM API 호출 실패 (시도 {attempt + 1}): {type(e).__name__}: {e}")
            raise


def _load_rubric_guide() -> str:
    """루브릭 생성 가이드 파일을 읽어 반환."""
    guide_path = Path(__file__).resolve().parent.parent / "rubric_generation_guide.md"
    if guide_path.exists():
        return guide_path.read_text(encoding="utf-8")
    return ""


async def generate_rubric_with_ai(
    answer_problems: Dict[int, Dict[str, Any]],
    total_score: float = 100.0,
    exam_title: str = "",
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    정답 노트북의 문제별 코드를 분석하여 루브릭 JSON을 자동 생성합니다.

    answer_problems: split_notebook_by_problems() 결과
        {problem_id: {'description': str, 'cells': [{'source': str, ...}]}}
    total_score: 시험 총점
    exam_title: 시험 제목
    """
    rubric_guide = _load_rubric_guide()

    # 문제별 정보 포맷팅
    problems_text = ""
    for pid in sorted(answer_problems.keys()):
        info = answer_problems[pid]
        desc = info.get("description", "")
        code_parts = []
        for cell in info.get("cells", []):
            src = cell.get("source", "")
            if src.strip():
                code_parts.append(src)
        code = "\n\n".join(code_parts)
        problems_text += f"\n\n### Q{pid}\n"
        if desc:
            problems_text += f"[문제 설명]\n{desc}\n\n"
        problems_text += f"[정답 코드]\n```python\n{code[:3000]}\n```\n"

    system_prompt = f"""당신은 대학교 프로그래밍 시험의 채점 루브릭을 설계하는 전문가입니다.

아래 가이드라인을 반드시 준수하여 루브릭을 생성하세요:

{rubric_guide}

## 추가 지시사항
- 반드시 위 가이드의 JSON 형식대로 출력하세요.
- JSON만 출력하세요. 마크다운 코드블록이나 설명 텍스트를 포함하지 마세요.
- problem_id는 "Q1", "Q2", ... 형태로 작성하세요.
- 각 문항의 partial_score_criteria 내 score 합계가 full_score와 정확히 일치해야 합니다.
- 시각화 문항(matplotlib, seaborn 등)은 반드시 유형 A(세부 항목)로 작성하세요.
- 데이터 처리/계산 문항은 유형 B(AI 자율) 또는 유형 A를 문항 특성에 맞게 선택하세요."""

    per_problem_score = round(total_score / max(len(answer_problems), 1), 2)

    user_prompt = f"""다음 시험의 루브릭을 생성해주세요.

시험 제목: {exam_title or "프로그래밍 시험"}
문제 수: {len(answer_problems)}개
총점: {total_score}점 (문항당 약 {per_problem_score}점 기준으로 배분하되, 문항 난이도에 따라 조정 가능)

{problems_text}

위 문제들의 정답 코드를 분석하여, 가이드라인에 맞는 루브릭 JSON을 생성하세요."""

    client, model_name = get_llm_client(model or DEFAULT_MODEL)

    try:
        response = await _call_with_retry(lambda: client.chat.completions.create(
            model=model_name,
            max_tokens=4096,
            temperature=0.5,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        ))

        content = response.choices[0].message.content.strip()

        # JSON 파싱 (마크다운 코드블록 제거)
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[-1].strip() == "```":
                content = "\n".join(lines[1:-1])
            else:
                content = "\n".join(lines[1:])

        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            content = content[start:end]
        else:
            print(f"[PARSE ERROR] JSON 없음 | model={model} | content={content[:300]!r}")

        # JSON 파싱 (json5는 줄바꿈, 단일따옴표 등 허용)
        try:
            rubric = json5.loads(content)
        except Exception as e:
            print(f"[JSON5 Parse Error] {e}")
            raise
        return rubric

    except APIQuotaError:
        raise
    except json.JSONDecodeError as e:
        raise ValueError(f"AI 응답 JSON 파싱 오류: {str(e)}\n응답 내용: {content[:500]}")
    except Exception as e:
        print(f"[ERROR] 루브릭 생성 오류:\n{traceback.format_exc()}")
        raise RuntimeError(f"루브릭 생성 중 오류: [{type(e).__name__}] {str(e)}")


async def grade_with_ai(
    student_code: str,
    answer_code: str,
    criteria: List[PartialScoreCriterion],
    problem_id: int,
    problem_description: Optional[str] = None,
    execution_output: Optional[str] = None,
    global_evaluation_guideline: Optional[str] = None,
    full_score: Optional[float] = None,
    remaining_score: Optional[float] = None,
    model: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], str, int]:
    """
    GPT-4o를 사용하여 채점 기준 기반 부분 점수 제도로 평가합니다.

    - 모범 답안과 실제 풀이가 달라도 논리가 타당하면 정답으로 인정
    - 다양한 구현 방식(List Comprehension, Map/Filter, For 루프 등) 모두 인정
    - partial_score_criteria가 비어있으면 AI가 전체 full_score를 자율적으로 판단
    - partial_score_criteria 합계 < full_score이면 남은 배점을 AI가 자동으로 판단
    """
    if not student_code.strip():
        if criteria:
            results = [
                {
                    "item": c.item,
                    "max_score": c.score,
                    "score": 0,
                    "reason": "제출된 코드가 없습니다."
                }
                for c in criteria
            ]
        else:
            results = [{
                "item": "종합 평가",
                "max_score": full_score or 0,
                "score": 0,
                "reason": "제출된 코드가 없습니다."
            }]
        return results, "코드가 제출되지 않았습니다.", 0, False

    # criteria가 비어있으면 full_score 기반으로 자율 평가 항목 생성
    if not criteria:
        if full_score is None:
            full_score = 10.0
        criteria = [PartialScoreCriterion(item="종합 평가", score=full_score)]

    # 루브릭을 문자열로 포맷팅
    rubric_text = "\n".join([
        f"- {c.item}: 최대 {c.score}점"
        for c in criteria
    ])

    # 실행 결과 (있으면 포함)
    execution_context = ""
    if execution_output:
        execution_context = f"\n\n## ⚠️ 코드 실행 에러 정보 (채점에 직접 반영 금지)\n```\n{execution_output}\n```\n⚠️ **CRITICAL**: reason에 \"오류/에러/실행/불가\" 같은 단어 절대 금지. reason은 코드 로직만 평가."

    # 전체 공통 가이드라인 (있으면 포함)
    global_guideline_text = ""
    if global_evaluation_guideline:
        global_guideline_text = f"\n\n## 전체 공통 채점 가이드라인 (모든 문항에 반드시 적용)\n{global_evaluation_guideline}"

    # 남은 배점 정보
    remaining_info = ""
    if remaining_score and remaining_score > 0:
        remaining_info = f"\n\n⚠️ **중요**: 아래 루브릭 항목들의 합계가 {full_score}점보다 작습니다. 아래 점수 항목 외에 **{remaining_score:.1f}점의 추가 배점**이 있으므로, 전체 코드 품질과 학생의 이해도를 종합적으로 평가하여 이 {remaining_score:.1f}점을 추가로 부여하세요."

    scoring_instruction = """2. **점수 부여 기준 (3단계)**:
   - ✅ **완전 충족** → **만점** (score = max_score)
   - ⚠️ **부분 충족** → **절반점수** (score = max_score * 0.5)
   - ❌ **불충족** → **0점**

   **핵심**: 요구사항의 모든 요소를 충족하면 만점, 일부만 충족하면 절반, 불충족하면 0점. 다른 항목의 오류로 이 항목을 감점하면 안 됨."""
    consistency_instruction = """**reason ↔ score 매핑 규칙 (CRITICAL)**:
- reason이 "A는 했지만 B는 안 함" 같은 부분 충족 표현 → score = max_score * 0.5 (반드시!)
- reason이 완전 충족 → score = max_score
- reason이 완전 불충족 → score = 0
- 해당 항목의 코드에 로직 오류 → score = 0"""

    system_prompt = f"""## 📋 응답 형식 (반드시 정확히 이것만 출력하세요)

{{
  "analysis": "학생 코드의 핵심 로직 분석 (1-2문장)",
  "rubric_scores": [
    {{"item": "조건 처리", "score": 5, "max_score": 5, "reason": "if-elif-else로 모든 경우를 올바르게 처리 (50-100자)"}},
    {{"item": "출력 형식", "score": 2.5, "max_score": 5, "reason": "지정된 형식으로 출력했으나 소수점 자리수가 부족 (50-100자)"}}
  ],
  "feedback": "개선점:\\n- 출력 포맷 조정\\n- 엣지 케이스 처리 추가\\n(125-150자 이내)",
  "total_score": 7.5
}}

⚠️ **절대 지켜야 할 규칙**:
- 응답의 첫 글자는 반드시 `{{` (다른 것 금지)
- 응답의 마지막 글자는 반드시 `}}` (완전해야 함)
- JSON만 출력 (마크다운 X, 설명 X, 자연어 X)
- 개행은 \\n으로만 표현 (실제 개행 금지)
- **reason**: 한글로 한두 문장, **50-100자 이내** (절대)
- **feedback**: 125-150자 이내 (개선점만, 2-3개)

---

## 🚫 절대 금지

❌ 자연어 설명 ("우선 분석하겠습니다", "다음과 같이...")
❌ 마크다운 ("```json...", "###...")

✅ 반드시: `{{`로 시작하는 JSON만

---

## 역할 및 채점 원칙

당신은 현업 시니어 개발자이자 꼼꼼한 컴퓨터공학 전공 조교입니다.
{global_guideline_text}{remaining_info}

**원칙**: 구현 방식이 다르면 다른 것 아님. 논리가 타당하고 요구사항을 충족하면 정답.

### 1. **점수 부여 기준 (3단계)**
{scoring_instruction}

### 2. **reason 작성 규칙** (50-100자 이내, 한두 문장)
**✅ 올바른 reason**:
- "cv2.threshold 올바르게 사용하여 이진화 구현" (만점)
- "원본·결과는 출력했으나 이진화 영상 누락" (부분점수)
- "np.bitwise_not은 1개 인자인데 2개 전달" (0점)

**❌ 금지된 reason**: "런타임 에러로 평가 불가" / "변수 미정의로 실행 불가"

**"부분 충족"으로 간주되는 reason 표현** (score = max_score * 0.5):
- "A는 했지만 B는 안 함" / "A는 있지만 B가 부족"
- "일부만 충족" / "요구사항 중 일부 누락"

### 3. **루브릭 요구사항 중심 평가**
- 항목명의 요구사항만 평가, 명시되지 않은 것으로 감점 금지
- 예: "1행 3열 출력" 요구사항에서 `plt.show()` 누락 금지

### 4. **해설과 점수의 일관성**
{consistency_instruction}

### 5. **에러와 채점의 독립성**
- **이 항목 자체의 로직 오류** → 0점
- **다른 항목의 오류** → 영향 주면 안 됨
- **런타임 에러** → feedback 개선점에만 작성

---

## 평가 절차: Analysis → Rubric Evaluation → Feedback"""

    # 문제별 평가 가이드라인
    guideline_text = ""
    if problem_description:
        guideline_text = f"\n\n## 이 문항의 평가 가이드라인\n{problem_description}"

    user_prompt = f"""[문제 {problem_id}] 다음 학생 코드를 평가해주세요.{guideline_text}

## 모범 답안 (참고 자료)
```python
{answer_code[:1500]}
```

## 학생 코드
```python
{student_code[:2000]}
```{execution_context}

## 채점 루브릭 (부분 점수 기준)
{rubric_text}

위의 평가 가이드라인과 루브릭에 기반하여 학생 코드를 평가하세요.
모범 답안의 구현 방식과 다르더라도, 문제를 올바르게 해결했고 기준들을 충족한다면 정답으로 인정하세요.

🚫 **최종 체크리스트**:
- ✅ reason: 50-100자 이내 (한두 문장)
- ✅ feedback: 125-150자 이내 (개선점만, 2-3개)
- ✅ JSON만 반환 (첫 글자 `{{`, 마지막 글자 `}}`)"""

    provider, actual_model_name = parse_model_id(model or DEFAULT_MODEL)
    client, model_name = get_llm_client(model or DEFAULT_MODEL)

    try:
        # OpenAI는 response_format 지원, Fireworks는 미지원
        api_params = {
            "model": model_name,
            "max_tokens": 4096,
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        if provider == "openai":
            api_params["response_format"] = {"type": "json_object"}

        response = await _call_with_retry(lambda: client.chat.completions.create(**api_params))

        content = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0

        print(f"[DEBUG] 응답 상태 | model={model} | problem={problem_id} | 길이={len(content) if content else 0}")

        if not content:
            print(f"[ERROR] 빈 응답 수신 (model={model}, problem={problem_id})")
            return [{"item": c.item, "max_score": c.score, "score": 0, "reason": "모델 빈 응답 오류"} for c in criteria], "모델이 응답을 생성하지 못했습니다", 0

        # JSON 파싱 (마크다운 코드블록 제거)
        content = content.strip()
        print(f"[DEBUG] 응답 시작 | first 100 chars: {content[:100]!r}")

        if content.startswith("```"):
            lines = content.split("\n")
            if lines[-1].strip() == "```":
                content = "\n".join(lines[1:-1])
            else:
                content = "\n".join(lines[1:])

        start = content.find("{")
        end = content.rfind("}") + 1
        print(f"[DEBUG] JSON 추출 | 시작위치={start}, 종료위치={end}, 포함됨={'{'in content}")

        if start != -1 and end > start:
            content = content[start:end]
        else:
            print(f"[PARSE ERROR] JSON 없음 | model={model} | problem={problem_id} | content={content[:500]!r}")

        # JSON 파싱 (json5는 줄바꿈, 특수문자 등 허용)
        try:
            data = json5.loads(content)
        except Exception as e:
            print(f"[JSON5 Parse Error] {e}")
            raise
        rubric_scores = data.get("rubric_scores", [])
        overall_feedback = data.get("feedback", "")

        # 루브릭 점수를 index 기반으로 매칭 (항목명 불일치 방지)
        graded = []
        forbidden_keywords = ["오류", "에러", "오류 발생", "실행", "런타임", "실행되지", "불가", "에러로", "오류로", "오류 때문", "실행 불가"]

        for i, c in enumerate(criteria):
            found = rubric_scores[i] if i < len(rubric_scores) else None
            if found:
                raw_score = float(found.get("score", 0))
                # 3단계 채점: 만점 / 절반 / 0점
                # - raw_score >= max_score * 0.75 → 만점
                # - raw_score >= max_score * 0.25 → 절반 (부분 충족)
                # - 그 외 → 0점
                if raw_score >= c.score * 0.75:
                    clamped_score = c.score
                elif raw_score >= c.score * 0.25:
                    clamped_score = round(c.score * 0.5, 2)
                else:
                    clamped_score = 0.0
                reason = found.get("reason", "")

                # 🔍 reason 검증: 실행 오류 언급 금지
                has_forbidden = any(kw in reason for kw in forbidden_keywords)
                if has_forbidden:
                    print(f"[WARNING] Problem {problem_id} 항목 '{c.item}': reason에 실행 오류 언급 감지")
                    print(f"  원본 reason: {reason}")
                    # 로직 기반 평가만 남기고 오류 관련 표현 제거 지시
                    # 사용자에게 알릴 수 있도록 로그에만 기록하고, reason은 그대로 유지
                    # (강화된 프롬프트로 인해 다음 실행부터는 개선될 것으로 기대)

                graded.append({
                    "item": c.item,
                    "max_score": c.score,
                    "score": clamped_score,
                    "reason": reason
                })
            else:
                graded.append({
                    "item": c.item,
                    "max_score": c.score,
                    "score": 0,
                    "reason": "채점 항목 누락"
                })

        return graded, overall_feedback, tokens_used, False

    except json.JSONDecodeError as e:
        print(f"\n[PARSE ERROR] JSONDecodeError | model={model} | problem={problem_id} | error={e}")
        print(f"[CONTENT_FULL] {content!r}\n")
        return [
            {
                "item": c.item,
                "max_score": c.score,
                "score": 0,
                "reason": f"AI 채점 오류: {str(e)}"
            }
            for c in criteria
        ], f"AI 채점 중 오류 발생: {str(e)}", 0, True

    except APIQuotaError:
        raise

    except Exception as e:
        print(f"[ERROR] grade_with_ai 실패 (model={model}):\n{traceback.format_exc()}")
        return [
            {
                "item": c.item,
                "max_score": c.score,
                "score": 0,
                "reason": f"AI 채점 오류: {str(e)}"
            }
            for c in criteria
        ], f"AI 채점 중 오류 발생: {str(e)}", 0, True
