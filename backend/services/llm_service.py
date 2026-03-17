import os
import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from openai import AsyncOpenAI
from schemas import PartialScoreCriterion


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url
    )


def _mock_grade(student_code: str, answer_code: str, criteria, problem_id: int):
    """
    TEST_MODE용 모의 채점.
    학생 코드와 정답 코드의 유사도를 비교하여 점수를 산출합니다.
    """
    results = []
    # 학생 코드의 키워드 기반 유사도 계산
    answer_tokens = set(answer_code.split())
    student_tokens = set(student_code.split()) if student_code.strip() else set()

    if not student_tokens:
        similarity = 0.0
    else:
        overlap = answer_tokens & student_tokens
        similarity = len(overlap) / max(len(answer_tokens), 1)

    # 코드 해시로 학생마다 약간 다른 점수 부여
    code_hash = int(hashlib.md5(student_code.encode()).hexdigest()[:8], 16)
    variation = (code_hash % 20 - 10) / 100.0  # -0.10 ~ +0.10

    for c in criteria:
        if not student_code.strip():
            results.append({
                "item": c.item,
                "max_score": c.score,
                "score": 0,
                "reason": "코드가 제출되지 않았습니다."
            })
            continue

        # 유사도 기반 점수 (60~100% 범위)
        base_ratio = min(max(similarity + variation, 0.3), 1.0)
        score = round(c.score * base_ratio, 2)  # 소수점 2자리까지 계산
        score = round(min(score, c.score), 2)   # 최종 반올림

        # 유사도에 따른 피드백 생성
        if base_ratio >= 0.85:
            feedback = f"[문제 {problem_id}] 정답과 매우 유사한 풀이입니다. {c.item} 항목을 잘 구현했습니다."
        elif base_ratio >= 0.6:
            feedback = f"[문제 {problem_id}] 기본적인 구현은 되어 있으나, {c.item} 항목에서 일부 개선이 필요합니다."
        else:
            feedback = f"[문제 {problem_id}] {c.item} 항목의 핵심 개념이 부족합니다. 정답 코드를 참고하여 학습하세요."

        results.append({
            "item": c.item,
            "max_score": c.score,
            "score": score,
            "reason": feedback
        })

    total = sum(r["score"] for r in results)
    max_total = sum(r["max_score"] for r in results)
    overall = f"[모의 채점] 문제 {problem_id}: {total:.1f}/{max_total}점. 코드 유사도 {similarity:.0%} 기반 평가입니다."
    return results, overall


async def grade_with_ai(
    student_code: str,
    answer_code: str,
    criteria: List[PartialScoreCriterion],
    problem_id: int
) -> Tuple[List[Dict[str, Any]], str]:
    """
    AI로 학생 코드를 채점합니다.
    - TEST_MODE=true: 코드 유사도 기반 모의 채점 (API 키 불필요)
    - TEST_MODE=false: OpenAI GPT-4o 실제 채점
    """
    # ── TEST_MODE 확인 ──
    test_mode = os.getenv("TEST_MODE", "false").lower() == "true"
    if test_mode:
        print(f"  [TEST_MODE] 문제 {problem_id} 모의 채점 중... (학생 코드 {len(student_code)}자)")
        return _mock_grade(student_code, answer_code, criteria, problem_id)

    # ── 실제 OpenAI 호출 ──
    client = get_openai_client()

    criteria_text = "\n".join([
        f"- {c.item}: 최대 {c.score}점"
        for c in criteria
    ])

    system_prompt = """당신은 대학 프로그래밍 과목의 채점 전문가입니다.
학생의 코드를 분석하여 각 채점 항목에 대해 점수와 상세한 피드백을 제공해주세요.
반드시 JSON 형식으로만 응답하세요."""

    user_prompt = f"""[문제 {problem_id}] 채점을 수행하세요.

## 정답 코드
```python
{answer_code[:2000]}
```

## 학생 코드
```python
{student_code[:2000]}
```

## 채점 기준
{criteria_text}

다음 JSON 형식으로 각 채점 항목을 평가하세요:
{{
  "results": [
    {{
      "item": "채점 항목명",
      "max_score": 최대점수(숫자),
      "score": 획득점수(숫자),
      "reason": "점수 부여 이유 및 상세 피드백 (한국어로 작성)"
    }}
  ],
  "overall_feedback": "전체적인 코드 품질 및 개선 제안"
}}

채점 시 유의사항:
- 부분점수를 적극 활용하세요
- 학생이 노력한 부분을 인정하세요
- 오류가 있더라도 로직이 맞으면 부분점수를 주세요
- 피드백은 구체적이고 교육적으로 작성하세요"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        results = data.get("results", [])
        overall = data.get("overall_feedback", "")

        # Map results back to criteria
        graded = []
        for c in criteria:
            found = next((r for r in results if r.get("item") == c.item), None)
            if found:
                graded.append({
                    "item": c.item,
                    "max_score": c.score,
                    "score": min(float(found.get("score", 0)), c.score),
                    "reason": found.get("reason", "")
                })
            else:
                graded.append({
                    "item": c.item,
                    "max_score": c.score,
                    "score": 0,
                    "reason": "채점 항목을 찾을 수 없습니다"
                })

        return graded, overall
    except Exception as e:
        return [
            {
                "item": c.item,
                "max_score": c.score,
                "score": 0,
                "reason": f"AI 채점 오류: {str(e)}"
            }
            for c in criteria
        ], f"AI 채점 중 오류 발생: {str(e)}"
