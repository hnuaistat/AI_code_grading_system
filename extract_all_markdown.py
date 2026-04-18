import sys
import io
import json

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 파일 읽기
notebook_path = r"examples/(기말고사)이름_학번_sol_포맷변경_총점.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# "## Q" 패턴이 있는 모든 마크다운 셀 추출
markdown_cells = []
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'markdown':
        source = cell['source'] if isinstance(cell['source'], str) else ''.join(cell['source'])
        if source.strip().startswith('## Q'):
            markdown_cells.append(source)

# 전체 마크다운 합치기
full_markdown = "\n\n".join(markdown_cells)

print("=" * 80)
print(f"전체 마크다운 셀 추출 ({len(markdown_cells)}개)")
print("=" * 80)
print("\n")
print(full_markdown)

print("\n\n" + "=" * 80)
print(f"총 {len(markdown_cells)}개의 문제가 있습니다!")
print("=" * 80)
