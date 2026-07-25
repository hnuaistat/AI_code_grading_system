# CLAUDE.md

Jupyter 노트북(.ipynb) 자동 채점 시스템. 이 저장소에서 작업할 때 아래 규칙을 따른다.

## 구조

- `backend/` — FastAPI. `main.py`(라우트), `models.py`·`schemas.py`, `services/`(grading·llm·notebook), `utils/`
- `frontend/` — React 18 + CRA. `src/pages/`(화면), `src/components/`, `src/index.css`
- `docs/` — 가이드 및 설계 문서
- `scripts/` — 단발성 유틸리티

## 규칙

### 1. 프론트엔드 수정 후 UI/UX 점검

`frontend/` 아래 컴포넌트나 페이지를 **새로 만들거나 크게 수정한 뒤에는** `ui-ux-designer` 에이전트를 호출해 점검한다. 사용자가 따로 요청하지 않아도 실행한다.

- 대상: 레이아웃·표·폼·모달 변경, 새 화면 추가, 표시 요소가 눈에 띄게 달라지는 수정
- 제외: 오타 수정, 주석, 문자열 한 줄 변경 같은 사소한 수정
- 이유: 주 사용자가 교수·조교이고 표와 숫자를 반복 검토하는 작업이 많아, 정렬·대비·클릭 동선 결함이 실사용 부담으로 직결된다

### 2. 브랜치 — develop에서 작업, master로 반영

브랜치는 `develop`(작업)과 `master`(배포용 스냅샷) 이다. 

- 모든 커밋과 push는 **`develop`**에 한다. `master`에서 직접 작업하지 않는다.
- `master`는 develop을 머지해서 따라오게 한다. **사용자가 요청할 때만** 수행하고, 임의로 하지 않는다:

  ```bash
  git checkout master && git merge develop && git push origin master
  git checkout develop
  ```

- 머지 후에는 `develop`으로 돌아온 상태로 끝낸다.

### 3. 모델 변경 시 문서 동기화

채점에 쓰는 LLM 모델을 바꾸면 (`backend/services/llm_service.py` 등) `docs/grading_LLM.md`도 **같은 커밋에서** 함께 수정한다. 코드와 문서의 모델명이 어긋난 상태로 두지 않는다.

## 프론트엔드 스타일 관례

- 스타일은 **인라인 style 객체 + `src/index.css`**. Tailwind·CSS-in-JS·UI 라이브러리를 새로 도입하지 않는다.
- 아이콘은 `lucide-react`, 차트는 `recharts`를 쓴다. 같은 목적의 라이브러리를 추가하지 않는다.
- UI 문구는 한글. `word-break: keep-all`이 전역 적용되어 있다.
