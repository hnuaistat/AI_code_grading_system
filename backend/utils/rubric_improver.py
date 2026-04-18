"""
마크다운 파서 결과를 RUBRIC_GUIDELINE에 따라 개선하는 모듈
"""
import json
from pathlib import Path
from typing import Dict, Any, List
import asyncio
import os
from openai import AsyncOpenAI


def _load_guideline() -> str:
    """루브릭 가이드라인 파일을 읽어 반환."""
    guide_path = Path(__file__).resolve().parent.parent.parent / "RUBRIC_GUIDELINE.md"
    if guide_path.exists():
        return guide_path.read_text(encoding="utf-8")
    return ""


async def improve_rubric_with_ai(
    parsed_rubric: Dict[str, Any]
) -> Dict[str, Any]:
    """
    마크다운 파서로 생성한 루브릭을 LLM으로 개선합니다.

    개선 내용:
    - 모호한 항목을 구체적으로 변환
    - 파라미터명을 코드 문법으로 명시 (alpha=0.5, figsize=(8,5) 등)
    - 함수명 추가 (plt.figure, sns.histplot 등)
    - RUBRIC_GUIDELINE.md 기반 개선
    """
    guideline = _load_guideline()

    system_prompt = f"""당신은 AI 채점용 루브릭 개선 전문가입니다.

## 중요: 이 규칙을 반드시 따르세요
{guideline}

## 당신의 역할:
마크다운 파서가 이미 분류한 항목들 안에서 **모호한 부분을 파라미터 형식으로 개선**하는 것입니다.

## 분류 이해:
- partial_score_criteria: 점수 표기 (N점)가 있는 항목들
- evaluation_guideline: 점수 표기가 없는 항목들
- **파서가 이미 정확히 분류했습니다. 신뢰하세요.**

## 개선 규칙:
1. **partial_score_criteria의 'item' 필드만 개선**
   - "투명도는 0.5" → "alpha=0.5"
   - "bins는 15" → "bins=15"
   - "색상 pink" → "color='pink'"
   - "figsize는 (8, 5)" → "figsize=(8, 5)"
   - 함수명 추가 (plt.hist, sns.histplot 등)

2. **evaluation_guideline은 절대 건드리지 마세요**
   - 텍스트 그대로 유지

3. **배열 구조 변경 금지**
   - partial_score_criteria 길이 변경 금지 ([] → [] 유지)
   - 항목 추가/삭제 금지

## 출력:
- JSON 구조 완벽히 유지
- 한국어 유지
- JSON만 출력
"""

    user_prompt = f"""파서가 이미 항목들을 분류했습니다.
partial_score_criteria의 'item' 필드에서 모호한 표현을 파라미터 문법으로 변경하세요.

절대 하지 말 것:
- evaluation_guideline 건드리기
- 배열 길이 변경하기
- 새로운 항목 추가하기

다음 루브릭을 개선하세요:

{json.dumps(parsed_rubric, indent=2, ensure_ascii=False)}

개선된 JSON을 반환하세요."""

    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        content = response.choices[0].message.content.strip()

        # JSON 파싱 (마크다운 코드블록 제거)
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[-1].strip() == "```":
                content = "\n".join(lines[1:-1])
            else:
                content = "\n".join(lines[1:])

        improved_rubric = json.loads(content)
        return improved_rubric

    except Exception as e:
        print(f"[WARNING] 루브릭 개선 실패: {str(e)}")
        # 개선 실패시 원본 반환
        return parsed_rubric


def improve_rubric_simple(parsed_rubric: Dict[str, Any]) -> Dict[str, Any]:
    """
    간단한 규칙 기반 루브릭 개선 (LLM 없이)
    """
    improved = json.loads(json.dumps(parsed_rubric))  # 깊은 복사

    # 각 문제의 partial_score_criteria 개선
    for problem in improved.get("problems", []):
        criteria_list = problem.get("partial_score_criteria", [])

        for criterion in criteria_list:
            item = criterion.get("item", "")

            # 개선 규칙 적용
            item = _improve_item_text(item, problem.get("problem_id", ""))
            criterion["item"] = item

    return improved


def _improve_item_text(text: str, problem_id: str = "") -> str:
    """
    항목 텍스트를 개선합니다.

    개선 규칙:
    - "설정할 것" → "파라미터=값으로 설정"
    - "조건을 만족" → 구체적 조건
    - 함수명 추가 등
    """

    # 이미 구체적인 경우는 그대로 둠
    if any(keyword in text for keyword in ["=", "(", "plt.", "sns.", "pd.", "np."]):
        return text

    # 모호한 표현 개선
    improvements = {
        "설정할 것": "설정",
        "조건을 만족": "조건 만족",
        "처리하시오": "처리",
        "표시할 것": "표시",
        "할 것": "",
    }

    result = text
    for old, new in improvements.items():
        result = result.replace(old, new)

    return result.strip()
