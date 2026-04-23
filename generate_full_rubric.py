import sys
import io
import json
import re

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# markdown_parser 로직
def parse_markdown_problems(markdown_text: str):
    """마크다운 형식의 문제 설명을 JSON 루브릭으로 변환합니다."""
    problems = []
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
    """문제 내용을 파싱하여 partial과 evaluation을 분리합니다."""
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
            partial_criteria.append({"item": clean_item, "score": score})
        else:
            evaluation_items.append(item_text)

    guideline_text = problem_header["description"]
    if evaluation_items:
        eval_section = "\n".join([f"- {item}" for item in evaluation_items])
        guideline_text += f"\n\n다음 조건을 만족해야 합니다:\n{eval_section}"

    return {
        "problem_id": problem_header["problem_id"],
        "full_score": problem_header["full_score"],
        "evaluation_guideline": guideline_text,
        "partial_score_criteria": partial_criteria,
        "scoring_mode": "additive"
    }


# 전체 마크다운 추출
notebook_path = r"examples/(기말고사)이름_학번_sol_포맷변경_총점.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

markdown_cells = []
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'markdown':
        source = cell['source'] if isinstance(cell['source'], str) else ''.join(cell['source'])
        if source.strip().startswith('## Q'):
            markdown_cells.append(source)

full_markdown = "\n\n".join(markdown_cells)

# 파싱
print("=" * 80)
print("마크다운 파서 - 전체 루브릭 생성")
print("=" * 80)

parsed_problems = parse_markdown_problems(full_markdown)

# GradingCriteria 형식으로 변환
grading_criteria = {
    "problems": parsed_problems,
    "global_evaluation_guideline": "모든 문항 공통: 학생의 코드에서 런타임 에러가 발생하는 경우, 해당 문항은 0점 처리하세요. 에러 없이 정상 실행되고 요구되는 시각화 및 결과값을 출력한다면 구현 방식에 관계없이 만점을 부여합니다.",
    "exam_title": "데이터 분석 기말고사"
}

print(f"\n✅ 총 {len(parsed_problems)}개 문제 파싱 완료\n")

# 결과 요약
total_score = sum(p['full_score'] for p in parsed_problems)
print(f"📊 채점 루브릭 요약")
print(f"시험 제목: {grading_criteria['exam_title']}")
print(f"총 배점: {total_score}점\n")

for i, problem in enumerate(parsed_problems, 1):
    partial_sum = sum(c['score'] for c in problem['partial_score_criteria'])
    status = "✅" if problem['partial_score_criteria'] else "⚠️"
    print(f"[{i}] {problem['problem_id']:3s} | 배점: {problem['full_score']:4.1f}점 | 부분점수: {len(problem['partial_score_criteria']):2d}개 ({partial_sum:4.1f}점) {status}")

# JSON 저장
with open(r"examples/rubric_from_parser.json", 'w', encoding='utf-8') as f:
    json.dump(grading_criteria, f, indent=2, ensure_ascii=False)

print(f"\n{'='*80}")
print(f"✅ 루브릭이 저장되었습니다: examples/rubric_from_parser.json")
print(f"{'='*80}\n")

# 전체 JSON 미리보기
print("📝 전체 JSON 구조 (첫 번째 문제만):")
print(json.dumps(grading_criteria['problems'][0], indent=2, ensure_ascii=False))
