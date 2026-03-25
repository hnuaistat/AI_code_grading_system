import json
import zipfile
import tempfile
import os
import re
import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
from typing import List, Dict, Any, Optional, Tuple


def extract_notebooks_from_zip(zip_bytes: bytes) -> List[Tuple[str, bytes]]:
    """ZIP에서 모든 .ipynb 파일 추출. (filename, content_bytes) 리스트 반환."""
    result = []
    with zipfile.ZipFile(__import__('io').BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            # Decode filename (handle encoding issues)
            try:
                name = info.filename.encode('cp437').decode('utf-8')
            except Exception:
                name = info.filename
            if name.endswith('.ipynb') and not name.startswith('__MACOSX'):
                content = zf.read(info.filename)
                # Use just the basename
                basename = os.path.basename(name)
                result.append((basename, content))
    return result


def parse_notebook(content: bytes) -> nbformat.NotebookNode:
    """ipynb 바이트를 파싱하여 노트북 객체 반환."""
    nb_str = content.decode('utf-8', errors='replace')
    return nbformat.reads(nb_str, as_version=4)


def extract_cell_outputs(nb: nbformat.NotebookNode) -> List[Dict[str, Any]]:
    """각 코드 셀의 출력값 추출."""
    cell_outputs = []
    for i, cell in enumerate(nb.cells):
        if cell.cell_type == 'code':
            outputs = []
            for output in cell.get('outputs', []):
                output_type = output.get('output_type', '')
                if output_type == 'stream':
                    outputs.append({
                        'type': 'stream',
                        'name': output.get('name', ''),
                        'text': ''.join(output.get('text', []))
                    })
                elif output_type in ('display_data', 'execute_result'):
                    data = output.get('data', {})
                    text_repr = data.get('text/plain', '')
                    if isinstance(text_repr, list):
                        text_repr = ''.join(text_repr)
                    outputs.append({
                        'type': output_type,
                        'text': text_repr
                    })
                elif output_type == 'error':
                    outputs.append({
                        'type': 'error',
                        'ename': output.get('ename', ''),
                        'evalue': output.get('evalue', '')
                    })
            cell_outputs.append({
                'cell_index': i,
                'source': cell.source,
                'outputs': outputs
            })
    return cell_outputs


def execute_notebook(nb: nbformat.NotebookNode, timeout: int = 60) -> Tuple[nbformat.NotebookNode, Optional[str]]:
    """노트북을 실행하고 실행된 노트북과 에러 메시지 반환."""
    ep = ExecutePreprocessor(timeout=timeout, kernel_name='python3')
    try:
        ep.preprocess(nb)
        return nb, None
    except Exception as e:
        return nb, str(e)


def extract_code_cells(nb: nbformat.NotebookNode) -> List[Dict[str, Any]]:
    """코드 셀 소스만 추출 (문제별 분리 없이 전체)."""
    cells = []
    for i, cell in enumerate(nb.cells):
        if cell.cell_type == 'code':
            src = cell.source if isinstance(cell.source, str) else ''.join(cell.source)
            if src.strip():
                cells.append({'index': i, 'source': src})
    return cells


def parse_student_id_from_filename(filename: str) -> str:
    """파일명에서 학번/이름 파싱. 예: '20210001_홍길동.ipynb' → '20210001_홍길동'"""
    name = os.path.splitext(filename)[0]
    return name


def _get_source(cell) -> str:
    """셀 source를 항상 문자열로 반환 (list 또는 str 모두 처리)."""
    src = cell.source
    return src if isinstance(src, str) else ''.join(src)


def split_notebook_by_problems(nb: nbformat.NotebookNode) -> Dict[int, Dict[str, Any]]:
    """
    마크다운 셀의 문제 마커로 문제별 셀 분리 + 문제 설명 추출.

    전략:
    - ## Q1. / ## 문제1 처럼 레벨2+ 헤더에 문제 번호가 있으면 그것만 사용.
      이 경우 레벨1 헤더(# ...)는 섹션 구분자로 처리하여 current_problem을 리셋.
      → # **문제1**, # 데이터 로드 등의 섹션 제목이 문제 코드로 오인되는 것을 방지.
    - 레벨2+ 마커가 없으면 모든 레벨에서 문제 번호 탐색 (기존 동작 폴백).

    반환: {problem_id: {'description': 문제설명, 'cells': [cell_dict, ...]}}
    """
    PROBLEM_RE = re.compile(r'(?:Q|문제|Problem|question)\s*[:#.]?\s*(\d+)', re.IGNORECASE)
    LEVEL1_RE = re.compile(r'^#(?!#)')   # # 으로 시작하되 ## 는 아닌 것
    LEVEL2_RE = re.compile(r'^#{2,}')   # ## 이상

    # 레벨2+ 헤더에 문제 마커가 있는지 먼저 확인
    has_level2_markers = False
    for cell in nb.cells:
        if cell.cell_type != 'markdown':
            continue
        src = _get_source(cell)
        first_line = src.strip().split('\n')[0]
        if LEVEL2_RE.match(first_line) and PROBLEM_RE.search(first_line):
            has_level2_markers = True
            break

    problems: Dict[int, Dict[str, Any]] = {}
    current_problem = 0
    problem_cells: List[Dict[str, Any]] = []
    problem_description = ""

    for cell in nb.cells:
        if cell.cell_type == 'markdown':
            src = _get_source(cell)
            first_line = src.strip().split('\n')[0]

            if has_level2_markers:
                # 레벨1 헤더 → 섹션 구분자: 현재 문제 저장 후 리셋
                if LEVEL1_RE.match(first_line):
                    if current_problem > 0:
                        problems[current_problem] = {
                            'description': problem_description,
                            'cells': problem_cells
                        }
                        problem_cells = []
                        problem_description = ""
                        current_problem = 0
                    continue

                # 레벨2+ 헤더에서만 문제 번호 추출
                if LEVEL2_RE.match(first_line):
                    m = PROBLEM_RE.search(first_line)
                    if m:
                        if current_problem > 0:
                            problems[current_problem] = {
                                'description': problem_description,
                                'cells': problem_cells
                            }
                        current_problem = int(m.group(1))
                        problem_cells = []
                        problem_description = src.strip()
            else:
                # 폴백: 모든 레벨에서 문제 번호 탐색
                m = PROBLEM_RE.search(src)
                if m:
                    if current_problem > 0:
                        problems[current_problem] = {
                            'description': problem_description,
                            'cells': problem_cells
                        }
                    current_problem = int(m.group(1))
                    problem_cells = []
                    problem_description = src.strip()
            continue

        if cell.cell_type == 'code':
            src = _get_source(cell)
            if src.strip() and current_problem > 0:
                problem_cells.append({
                    'source': src,
                    'outputs': cell.get('outputs', [])
                })

    if current_problem > 0 and problem_cells:
        problems[current_problem] = {
            'description': problem_description,
            'cells': problem_cells
        }

    return problems
