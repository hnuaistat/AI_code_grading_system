import re
import json
from typing import List, Dict, Any, Optional, Tuple
from schemas import (
    GradingCriteria, Problem, StudentResult, ProblemResult,
    PartialScoreResult, NotebookCell, NotebookCellOutput
)
from services.notebook_service import (
    extract_cell_outputs, extract_code_cells, parse_notebook,
    split_notebook_by_problems, execute_notebook
)
from services.llm_service import grade_with_ai, APIQuotaError


def normalize_output(text: str) -> str:
    """출력값 정규화: 공백/줄바꿈 정리"""
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text


def compare_outputs(answer_outputs: List[Dict], student_outputs: List[Dict]) -> Tuple[bool, float]:
    """
    정답 출력 vs 학생 출력 비교.
    반환: (완전 일치 여부, 유사도 0-1)
    """
    if not answer_outputs and not student_outputs:
        return True, 1.0

    def get_text(outputs):
        texts = []
        for o in outputs:
            if o.get('type') == 'stream':
                texts.append(o.get('text', ''))
            elif o.get('type') in ('display_data', 'execute_result'):
                texts.append(o.get('text', ''))
        return normalize_output(' '.join(texts))

    ans_text = get_text(answer_outputs)
    stu_text = get_text(student_outputs)

    if ans_text == stu_text:
        return True, 1.0

    # Simple similarity: character overlap
    if not ans_text:
        return False, 0.0
    common = sum(1 for c in stu_text if c in ans_text)
    similarity = common / max(len(ans_text), len(stu_text))
    return False, similarity


async def grade_student_notebook(
    student_nb_content: bytes,
    answer_nb_content: bytes,
    criteria: GradingCriteria,
    execute: bool = False
) -> Tuple[List[ProblemResult], Optional[str]]:
    """
    단일 학생 노트북 채점.
    반환: (문제별 결과 리스트, 에러 메시지)
    """
    try:
        student_nb = parse_notebook(student_nb_content)
        answer_nb = parse_notebook(answer_nb_content)
    except Exception as e:
        return [], f"노트북 파싱 오류: {str(e)}"

    # Execute notebooks if requested
    execution_error = None
    if execute:
        try:
            student_nb, exec_err = execute_notebook(student_nb)
            if exec_err:
                execution_error = exec_err
        except Exception as e:
            execution_error = str(e)

    # Split by problems
    student_problems = split_notebook_by_problems(student_nb)
    answer_problems = split_notebook_by_problems(answer_nb)

    # Fallback: if no problem markers, treat all cells as problem 1
    if not student_problems:
        cells = extract_code_cells(student_nb)
        if cells:
            student_problems = {1: {'description': '', 'cells': [{'source': c['source'], 'outputs': []} for c in cells]}}

    if not answer_problems:
        cells = extract_code_cells(answer_nb)
        if cells:
            answer_problems = {1: {'description': '', 'cells': [{'source': c['source'], 'outputs': []} for c in cells]}}

    # Get answer outputs (pre-computed, not from execution)
    answer_cell_outputs = extract_cell_outputs(answer_nb)
    student_cell_outputs = extract_cell_outputs(student_nb)

    problem_results = []

    for problem in criteria.problems:
        pid = problem.problem_id
        # "Q1", "문제1" 등 문자열 problem_id에서 숫자 추출하여 노트북 셀 조회
        pid_num = int(re.sub(r'\D', '', str(pid))) if not isinstance(pid, int) else pid

        ans_problem_data = answer_problems.get(pid_num, {})
        stu_problem_data = student_problems.get(pid_num, {})

        ans_cells = ans_problem_data.get('cells', []) if ans_problem_data else []
        stu_cells = stu_problem_data.get('cells', []) if stu_problem_data else []
        problem_description = ans_problem_data.get('description', '') if ans_problem_data else ""

        ans_code = "\n\n".join(c['source'] for c in ans_cells) if ans_cells else ""
        stu_code = "\n\n".join(c['source'] for c in stu_cells) if stu_cells else ""

        # Output comparison (use stored outputs)
        # Match cells by problem index
        ans_outputs_flat = []
        stu_outputs_flat = []
        for c in ans_cells:
            for o in c.get('outputs', []):
                text = ""
                if o.get('output_type') == 'stream':
                    t = o.get('text', '')
                    text = ''.join(t) if isinstance(t, list) else t
                elif o.get('output_type') in ('execute_result', 'display_data'):
                    t = o.get('data', {}).get('text/plain', '')
                    text = ''.join(t) if isinstance(t, list) else t
                if text:
                    ans_outputs_flat.append({'type': o.get('output_type', ''), 'text': text})

        for c in stu_cells:
            for o in c.get('outputs', []):
                text = ""
                if o.get('output_type') == 'stream':
                    t = o.get('text', '')
                    text = ''.join(t) if isinstance(t, list) else t
                elif o.get('output_type') in ('execute_result', 'display_data'):
                    t = o.get('data', {}).get('text/plain', '')
                    text = ''.join(t) if isinstance(t, list) else t
                if text:
                    stu_outputs_flat.append({'type': o.get('output_type', ''), 'text': text})

        output_match, similarity = compare_outputs(ans_outputs_flat, stu_outputs_flat)

        # Build notebook cells for display
        nb_cells = []
        for c in stu_cells:
            cell_outputs = []
            for o in c.get('outputs', []):
                text = ""
                if o.get('output_type') == 'stream':
                    t = o.get('text', '')
                    text = ''.join(t) if isinstance(t, list) else t
                elif o.get('output_type') in ('execute_result', 'display_data'):
                    t = o.get('data', {}).get('text/plain', '')
                    text = ''.join(t) if isinstance(t, list) else t
                if text.strip():
                    cell_outputs.append(NotebookCellOutput(
                        output_type=o.get('output_type', ''), text=text.strip()
                    ))
            nb_cells.append(NotebookCell(source=c['source'], outputs=cell_outputs))  # type: ignore

        # AI grading
        ai_partial_scores = []
        ai_overall = ""
        no_code_reason = None
        if not stu_cells:
            no_code_reason = "문제 마커 없음 — 미제출 처리"
        elif not stu_code.strip():
            no_code_reason = "빈 코드 — 미제출 처리"

        if no_code_reason is None and problem.partial_score_criteria:
            try:
                ai_results, ai_overall = await grade_with_ai(
                    student_code=stu_code,
                    answer_code=ans_code,
                    criteria=problem.partial_score_criteria,
                    problem_id=pid,
                    problem_description=problem.evaluation_guideline,
                    global_evaluation_guideline=criteria.global_evaluation_guideline
                )
                for r in ai_results:
                    ai_partial_scores.append(PartialScoreResult(
                        item=r['item'],
                        max_score=r['max_score'],
                        score=r['score'],
                        reason=r['reason']
                    ))
            except APIQuotaError:
                raise
            except Exception as e:
                for c in problem.partial_score_criteria:
                    ai_partial_scores.append(PartialScoreResult(
                        item=c.item,
                        max_score=c.score,
                        score=0,
                        reason=f"AI 채점 오류: {str(e)}"
                    ))
        else:
            reason = no_code_reason or "채점 기준 없음"
            for c in problem.partial_score_criteria:
                ai_partial_scores.append(PartialScoreResult(
                    item=c.item,
                    max_score=c.score,
                    score=0,
                    reason=reason
                ))

        obtained = sum(ps.score for ps in ai_partial_scores)

        problem_results.append(ProblemResult(
            problem_id=pid,
            full_score=problem.full_score,
            obtained_score=min(obtained, problem.full_score),
            output_match=output_match,
            partial_scores=ai_partial_scores,
            ai_feedback=ai_overall,
            code_cells=nb_cells,
            problem_description=problem_description
        ))

    return problem_results, execution_error
