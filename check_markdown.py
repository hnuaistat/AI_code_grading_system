import json
import sys
import io

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 파일 읽기
notebook_path = r"examples/(기말고사)이름_학번_sol_포맷변경_총점.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# "## Q" 패턴이 있는 마크다운 셀 찾기
markdown_count = 0
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'markdown':
        source = cell['source'] if isinstance(cell['source'], str) else ''.join(cell['source'])

        # "## Q" 로 시작하는 셀만 출력
        if source.strip().startswith('## Q'):
            print(f"\n{'='*80}")
            print(f"문제 셀 #{markdown_count + 1} (인덱스: {i})")
            print('='*80)
            print(source[:1500])
            markdown_count += 1
            if markdown_count >= 3:
                break
