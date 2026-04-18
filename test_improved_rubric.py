import sys
import io
import json
import re

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# markdown_parser 로직
def parse_markdown_problems(markdown_text: str):
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


# 개선 로직
def improve_rubric_simple(parsed_rubric):
    improved = json.loads(json.dumps(parsed_rubric))

    for problem in improved.get("problems", []):
        criteria_list = problem.get("partial_score_criteria", [])

        for criterion in criteria_list:
            item = criterion.get("item", "")
            item = _improve_item_text(item, problem.get("problem_id", ""))
            criterion["item"] = item

    return improved


def _improve_item_text(text: str, problem_id: str = "") -> str:
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

# 파싱 및 개선
print("=" * 80)
print("마크다운 파서 → 루브릭 개선")
print("=" * 80)

parsed_problems = parse_markdown_problems(full_markdown)

parsed_rubric = {
    "problems": parsed_problems,
    "global_evaluation_guideline": "모든 문항 공통: 학생의 코드에서 런타임 에러가 발생하는 경우, 해당 문항은 0점 처리하세요.",
    "exam_title": "데이터 분석 기말고사"
}

improved_rubric = improve_rubric_simple(parsed_rubric)

# 비교
print("\n📊 Q6 개선 전후 비교\n")
print("=" * 80)
print("개선 전:")
print("=" * 80)
for i, c in enumerate(parsed_rubric["problems"][5]["partial_score_criteria"], 1):
    print(f"{i}. {c['item']} ({c['score']}점)")

print("\n" + "=" * 80)
print("개선 후:")
print("=" * 80)
for i, c in enumerate(improved_rubric["problems"][5]["partial_score_criteria"], 1):
    print(f"{i}. {c['item']} ({c['score']}점)")

print("\n" + "=" * 80)
print("Q9 개선 전후 비교\n")
print("=" * 80)
print("개선 전:")
print("=" * 80)
for i, c in enumerate(parsed_rubric["problems"][7]["partial_score_criteria"], 1):
    print(f"{i}. {c['item']} ({c['score']}점)")

print("\n" + "=" * 80)
print("개선 후:")
print("=" * 80)
for i, c in enumerate(improved_rubric["problems"][7]["partial_score_criteria"], 1):
    print(f"{i}. {c['item']} ({c['score']}점)")

# 저장
with open(r"examples/rubric_improved.json", 'w', encoding='utf-8') as f:
    json.dump(improved_rubric, f, indent=2, ensure_ascii=False)

print(f"\n✅ 개선된 루브릭 저장: examples/rubric_improved.json")
