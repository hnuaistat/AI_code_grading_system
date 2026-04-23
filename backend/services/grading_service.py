import re
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from schemas import (
    GradingCriteria, Problem, StudentResult, ProblemResult,
    PartialScoreResult, NotebookCell, NotebookCellOutput, PartialScoreCriterion
)
from services.notebook_service import (
    extract_cell_outputs, extract_code_cells, parse_notebook,
    split_notebook_by_problems, execute_notebook
)
from services.llm_service import grade_with_ai, APIQuotaError


def strip_ansi(text: str) -> str:
    """ANSI 이스케이프 코드 제거."""
    return re.sub(r'\x1b\[[0-9;]*m', '', text)


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

    print(f"[DEBUG] 학생 문제 키: {list(student_problems.keys())}")
    for k, v in student_problems.items():
        cells = v.get('cells', [])
        code_preview = cells[0]['source'][:50] if cells else '(없음)'
        print(f"[DEBUG]   Q{k}: 셀 {len(cells)}개 | {code_preview}")

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
    total_tokens = 0
    # 첫 문제 이전 공통 셀 (# 데이터 불러오기 + 패키지 임포트 등)
    stu_preamble_cells = student_problems.get(0, {}).get('cells', [])
    is_first_problem = True

    for problem in criteria.problems:
        # 처리 전용 criteria 복사 (원본 수정 방지)
        working_criteria = list(problem.partial_score_criteria)

        # 배점 합계 계산
        criteria_sum = sum(c.score for c in working_criteria)
        remaining_score = problem.full_score - criteria_sum
        # 남은 배점이 있으면 AI 자율 평가 항목으로 추가 (집계에 반영되도록)
        if remaining_score > 0:
            working_criteria.append(PartialScoreCriterion(
                item="종합 코드 품질",
                score=remaining_score
            ))
        pid = problem.problem_id
        # "Q1", "문제1" 등 문자열 problem_id에서 숫자 추출하여 노트북 셀 조회
        pid_num = int(re.sub(r'\D', '', str(pid))) if not isinstance(pid, int) else pid

        ans_problem_data = answer_problems.get(pid_num, {})
        stu_problem_data = student_problems.get(pid_num, {})

        ans_cells = ans_problem_data.get('cells', []) if ans_problem_data else []
        stu_cells = stu_problem_data.get('cells', []) if stu_problem_data else []
        problem_description = ans_problem_data.get('description', '') if ans_problem_data else ""

        # 코드 셀만 추출 (마크다운 셀 제외) — AI 채점 및 출력 비교용
        ans_code_cells = [c for c in ans_cells if c.get('cell_type', 'code') == 'code']
        stu_code_cells = [c for c in stu_cells if c.get('cell_type', 'code') == 'code']

        ans_code = "\n\n".join(c['source'] for c in ans_code_cells) if ans_code_cells else ""
        stu_code = "\n\n".join(c['source'] for c in stu_code_cells) if stu_code_cells else ""

        # Output comparison (use stored outputs)
        ans_outputs_flat = []
        stu_outputs_flat = []
        for c in ans_code_cells:
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

        for c in stu_code_cells:
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

        # Build notebook cells for display (코드 + 마크다운 모두 포함)
        nb_cells = []
        nb_preamble = []
        if is_first_problem:
            for c in stu_preamble_cells:
                if c.get('cell_type') == 'markdown':
                    nb_preamble.append(NotebookCell(source=c['source'], outputs=[], cell_type='markdown'))  # type: ignore
                else:
                    cell_outputs = []
                    for o in c.get('outputs', []):
                        text = ""
                        image = None
                        otype = o.get('output_type', '')
                        if otype == 'stream':
                            t = o.get('text', '')
                            text = ''.join(t) if isinstance(t, list) else t
                        elif otype in ('execute_result', 'display_data'):
                            data = o.get('data', {})
                            t = data.get('text/plain', '')
                            text = ''.join(t) if isinstance(t, list) else t
                            img = data.get('image/png', '')
                            if img:
                                image = ''.join(img) if isinstance(img, list) else img
                        elif otype == 'error':
                            ename = o.get('ename', '')
                            evalue = o.get('evalue', '')
                            tb = o.get('traceback', [])
                            tb_text = strip_ansi('\n'.join(tb)) if tb else ''
                            text = f"{ename}: {evalue}\n{tb_text}" if tb_text else f"{ename}: {evalue}"
                        if text.strip() or image:
                            cell_outputs.append(NotebookCellOutput(
                                output_type=otype, text=text.strip(), image=image
                            ))
                    nb_preamble.append(NotebookCell(source=c['source'], outputs=cell_outputs, cell_type='code'))  # type: ignore
            is_first_problem = False
        for c in stu_cells:
            if c.get('cell_type', 'code') == 'markdown':
                nb_cells.append(NotebookCell(source=c['source'], outputs=[], cell_type='markdown'))  # type: ignore
            else:
                cell_outputs = []
                for o in c.get('outputs', []):
                    text = ""
                    image = None
                    otype = o.get('output_type', '')
                    if otype == 'stream':
                        t = o.get('text', '')
                        text = ''.join(t) if isinstance(t, list) else t
                    elif otype in ('execute_result', 'display_data'):
                        data = o.get('data', {})
                        t = data.get('text/plain', '')
                        text = ''.join(t) if isinstance(t, list) else t
                        img = data.get('image/png', '')
                        if img:
                            image = ''.join(img) if isinstance(img, list) else img
                    elif otype == 'error':
                        ename = o.get('ename', '')
                        evalue = o.get('evalue', '')
                        tb = o.get('traceback', [])
                        tb_text = strip_ansi('\n'.join(tb)) if tb else ''
                        text = f"{ename}: {evalue}\n{tb_text}" if tb_text else f"{ename}: {evalue}"
                    if text.strip() or image:
                        cell_outputs.append(NotebookCellOutput(
                            output_type=otype, text=text.strip(), image=image
                        ))
                nb_cells.append(NotebookCell(source=c['source'], outputs=cell_outputs, cell_type='code'))  # type: ignore

        # 학생 셀에서 에러 출력 수집 → LLM에 전달
        error_outputs = []
        for c in stu_code_cells:
            for o in c.get('outputs', []):
                if o.get('output_type') == 'error':
                    ename = o.get('ename', '')
                    evalue = o.get('evalue', '')
                    error_outputs.append(f"{ename}: {evalue}")
        execution_output_text = "\n".join(error_outputs) if error_outputs else None

        # AI grading
        ai_partial_scores = []
        ai_overall = ""
        no_code_reason = None
        if not stu_cells:
            no_code_reason = "문제 마커 없음 — 미제출 처리"
        elif not stu_code_cells:
            no_code_reason = "빈 코드 — 미제출 처리"

        # partial_score_criteria가 비어있거나 있으면 모두 AI 채점 시도
        if no_code_reason is None:
            await asyncio.sleep(1)
            try:
                ai_results, ai_overall, problem_tokens = await grade_with_ai(
                    student_code=stu_code,
                    answer_code=ans_code,
                    criteria=working_criteria,
                    problem_id=pid,
                    problem_description=problem.evaluation_guideline,
                    execution_output=execution_output_text,
                    global_evaluation_guideline=criteria.global_evaluation_guideline,
                    full_score=problem.full_score,
                    remaining_score=0  # 이미 working_criteria에 추가했으므로 중복 방지
                )
                total_tokens += problem_tokens
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
                for c in working_criteria:
                    ai_partial_scores.append(PartialScoreResult(
                        item=c.item,
                        max_score=c.score,
                        score=0,
                        reason=f"AI 채점 오류: {str(e)}"
                    ))
        else:
            reason = no_code_reason
            for c in working_criteria:
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
            obtained_score=max(0.0, min(obtained, problem.full_score)),
            output_match=output_match,
            partial_scores=ai_partial_scores,
            ai_feedback=ai_overall,
            code_cells=nb_cells,
            preamble_cells=nb_preamble,
            problem_description=problem_description
        ))

    return problem_results, execution_error, total_tokens
