import sys
import io
import json
import re

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# markdown_parser 로직을 여기에 복사
def parse_markdown_problems(markdown_text: str):
    """
    마크다운 형식의 문제 설명을 JSON 루브릭으로 변환합니다.
    """
    problems = []

    # 정규식 수정: "총점:" 뒤에 공백이 여러 개 있을 수 있음
    problem_pattern = r'^## (Q\d+)\.\s+(.+?)\s*\(\s*총점\s*:\s*(\d+(?:\.\d+)?)\s*점\)'

    lines = markdown_text.split('\n')
    current_problem = None
    current_content = []

    for line in lines:
        match = re.match(problem_pattern, line)
        if match:
            if current_problem:
                problem = _parse_problem_content(current_problem, current_content)
                if problem:
                    problems.append(problem)

            problem_id = match.group(1)
            description = match.group(2).strip()
            full_score = float(match.group(3))

            current_problem = {
                "problem_id": problem_id,
                "description": description,
                "full_score": full_score
            }
            current_content = []
        else:
            if current_problem is not None:
                current_content.append(line)

    if current_problem:
        problem = _parse_problem_content(current_problem, current_content)
        if problem:
            problems.append(problem)

    return problems


def _parse_problem_content(problem_header, content_lines):
    """문제 내용(세부 조건)을 파싱하여 partial과 evaluation을 분리합니다."""

    partial_criteria = []
    evaluation_items = []

    for line in content_lines:
        line = line.strip()

        if not line:
            continue

        if line.startswith('-'):
            item_text = line[1:].strip()
        elif re.match(r'^\d+\.\s+', line):
            item_text = re.sub(r'^\d+\.\s+', '', line)
        else:
            continue

        score_match = re.search(r'\((\d+(?:\.\d+)?)\s*점\)|\[(\d+(?:\.\d+)?)\s*점\]', item_text)

        if score_match:
            score = float(score_match.group(1) or score_match.group(2))
            clean_item = re.sub(r'\s*\((\d+(?:\.\d+)?)\s*점\)|\s*\[(\d+(?:\.\d+)?)\s*점\]', '', item_text).strip()

            partial_criteria.append({
                "item": clean_item,
                "score": score
            })
        else:
            evaluation_items.append(item_text)

    guideline_text = problem_header["description"]
    if evaluation_items:
        eval_section = "\n".join([f"- {item}" for item in evaluation_items])
        guideline_text += f"\n\n다음 조건을 만족해야 합니다:\n{eval_section}"

    partial_total = sum(c["score"] for c in partial_criteria)

    if partial_total > problem_header["full_score"]:
        raise ValueError(
            f"{problem_header['problem_id']}: "
            f"partial 합계({partial_total}) > full_score({problem_header['full_score']})"
        )

    return {
        "problem_id": problem_header["problem_id"],
        "full_score": problem_header["full_score"],
        "evaluation_guideline": guideline_text,
        "partial_score_criteria": partial_criteria
    }


# 원본 마크다운 (앞서 추출한 것)
markdown_text = """## Q1. 다음 조건에 따라 결측치를 탐색하시오. (총점 : 4점)
1. 데이터프레임 data에서 하나 이상의 결측치가 존재하는 변수(column) 를 모두 찾으시오.
2. 각 변수별로 결측치가 몇 개인지 출력하시오.

## Q2. 다음 조건에 따라 `age` 변수의 결측치를 처리하시오. (총점 : 5점)
1. 먼저, 원본 데이터프레임 data를 복사하여 data1이라는 새로운 데이터프레임을 생성하시오. (원본 데이터 손상 방지 목적)
2. data1에서 `target` 값이 1인 경우에는 해당 그룹의 `age` 평균으로, 0인 경우에는 해당 그룹의 `age` 평균으로 각각 결측치를 대체하시오.
3. 결측치 대체는 반드시 data1 데이터프레임을 직접 수정하는 방식으로 수행하시오.
4. data1의 `age` 변수에 남아 있는 결측치의 개수를 출력하시오.

## Q3. 앞에서 결측치를 대체한 데이터프레임 data1에서 `chol`를 기준으로 오름차순 정렬하시오. (총점 : 4점)
- 정렬된 결과는 data_sorted라는 새로운 변수에 저장하시오.
- 정렬 결과의 상위 5개 행을 출력하시오."""

print("=" * 80)
print("마크다운 파서 실행 결과")
print("=" * 80)

problems = parse_markdown_problems(markdown_text)

print(f"\n총 문제 개수: {len(problems)}\n")

for i, problem in enumerate(problems, 1):
    print(f"\n{'='*80}")
    print(f"문제 #{i}: {problem['problem_id']}")
    print(f"{'='*80}")
    print(f"전체 점수: {problem['full_score']}점")

    print(f"\n📋 평가 가이드라인:")
    print(problem['evaluation_guideline'])

    print(f"\n📊 부분 점수 항목 ({len(problem['partial_score_criteria'])}개):")
    if problem['partial_score_criteria']:
        for c in problem['partial_score_criteria']:
            print(f"  ✓ {c['item']}: {c['score']}점")
    else:
        print("  ⚠️  (없음 - 모두 evaluation_guideline에 포함됨)")

    print(f"\n📝 JSON:")
    print(json.dumps(problem, indent=2, ensure_ascii=False))
