import re
from typing import Dict, List, Any


def parse_markdown_problems(markdown_text: str) -> tuple:
    """
    마크다운 형식의 문제 설명을 JSON 루브릭으로 변환합니다.

    입력 형식:
    # 전체 공통 채점 가이드라인 - 실행 결과 에러가 뜨면 0점 처리
    ## Q1. 문제 설명 (총점: 4점)
    1. 세부 조건 (1점)
    2. 세부 조건 (2점)
    3. 세부 조건 (점수 표기 없음)

    출력: (루브릭 딕셔너리 리스트, 전체 공통 채점 가이드라인 문자열)
    """
    problems = []
    global_evaluation_guideline = ""

    # "# 전체 공통 채점 가이드라인 - 내용" 파싱
    guideline_pattern = r'^#\s+전체\s*공통\s*채점\s*가이드라인\s*[-–—]\s*(.+)'

    # 문제 블록 분리: "## Q{N}. ..." 또는 "## 문제{N}. ..." ~ 다음 문제 또는 파일 끝까지
    problem_pattern = r'^##\s+(?:Q|문제)(\d+)\.\s*(.+?)\s*\(총점\s*:\s*(\d+(?:\.\d+)?)\s*점\)'

    lines = markdown_text.split('\n')
    current_problem = None
    current_content = []

    for line in lines:
        # 전체 공통 채점 가이드라인 추출
        guideline_match = re.match(guideline_pattern, line)
        if guideline_match:
            global_evaluation_guideline = guideline_match.group(1).strip()
            continue
        # 새 문제 시작
        match = re.match(problem_pattern, line)
        if match:
            # 이전 문제 저장
            if current_problem:
                problem = _parse_problem_content(current_problem, current_content)
                if problem:
                    problems.append(problem)

            # 새 문제 시작
            problem_id = f"Q{match.group(1)}"
            description = match.group(2).strip()
            full_score = float(match.group(3))

            current_problem = {
                "problem_id": problem_id,
                "description": description,
                "full_score": full_score
            }
            current_content = []
        else:
            # 문제 내용 누적
            if current_problem is not None:
                current_content.append(line)

    # 마지막 문제 저장
    if current_problem:
        problem = _parse_problem_content(current_problem, current_content)
        if problem:
            problems.append(problem)

    return problems, global_evaluation_guideline


def _parse_problem_content(problem_header: Dict, content_lines: List[str]) -> Dict[str, Any]:
    """문제 내용(세부 조건)을 파싱하여 partial과 evaluation을 분리합니다."""

    partial_criteria = []
    evaluation_items = []

    # 세부 조건 추출 (글머리 또는 번호로 시작하는 줄)
    for line in content_lines:
        line = line.strip()

        if not line:
            continue

        # 글머리(-) 또는 번호(1. 2. 등) 제거
        if line.startswith('-'):
            item_text = line[1:].strip()
        elif re.match(r'^\d+\.\s+', line):
            item_text = re.sub(r'^\d+\.\s+', '', line)
        else:
            continue

        # 점수 표기 확인: (N점) 또는 [N점]
        score_match = re.search(r'\((\d+(?:\.\d+)?)\s*점\)|\[(\d+(?:\.\d+)?)\s*점\]', item_text)

        if score_match:
            # 점수가 있으면 → partial_score_criteria
            score = float(score_match.group(1) or score_match.group(2))
            # 점수 표기 제거
            clean_item = re.sub(r'\s*\((\d+(?:\.\d+)?)\s*점\)|\s*\[(\d+(?:\.\d+)?)\s*점\]', '', item_text).strip()

            partial_criteria.append({
                "item": clean_item,
                "score": score
            })
        else:
            # 점수 없으면 → evaluation_guideline
            evaluation_items.append(item_text)

    # evaluation_guideline 조합
    guideline_text = problem_header["description"]
    if evaluation_items:
        eval_section = "\n".join([f"- {item}" for item in evaluation_items])
        guideline_text += f"\n\n다음 조건을 만족해야 합니다:\n{eval_section}"

    return {
        "problem_id": problem_header["problem_id"],
        "full_score": problem_header["full_score"],
        "evaluation_guideline": guideline_text,
        "partial_score_criteria": partial_criteria
    }


def test_parse():
    """테스트용 예시"""
    markdown = """## Q1. 주어진 데이터를 활용하여 전처리를 수행하시오. (총점: 4점)
1. 결측치를 중앙값으로 대체할 것 (1점)
2. 새로운 파생 변수 'age_group'을 생성할 것 (2점)
3. pandas의 내장 함수를 사용할 것

## Q6. 고객 데이터를 담고 있는 data2 데이터프레임에는 다음 세 개의 연속형 변수(Age, Annual_Income, Spending_Score)가 포함되어 있습니다. (총점: 5점)
- plt.figure(figsize=(8, 5))로 그래프 크기 설정 (1점)
- 각 변수에 대해 bins=15, alpha=0.5, edgecolor='navy' 파라미터 포함 (1점)
- Age는 색상 "pink", Annual_Income은 "blue", Spending_Score는 "skyblue"로 시각화할 것 (1점)
- 라벨을 설정할 것 (1점)
- 각 히스토그램을 별도의 Figure로 생성할 것 (1점)
"""

    problems = parse_markdown_problems(markdown)

    import json
    for p in problems:
        print(f"\n{p['problem_id']} ({p['full_score']}점)")
        print(f"Guideline: {p['evaluation_guideline'][:80]}...")
        print(f"Partial criteria: {len(p['partial_score_criteria'])}개")
        for c in p['partial_score_criteria']:
            print(f"  - {c['item']}: {c['score']}점")
        print("\n--- JSON ---")
        print(json.dumps(p, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    test_parse()
