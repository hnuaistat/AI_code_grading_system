# 📦 프로젝트 매니페스트 (완전 가이드)

> Jupyter Notebook 자동 채점 시스템 - 완전하고 체계적인 개발 환경

---

## 🎯 프로젝트 개요

**목표:** 대학 수업에서 학생들이 제출한 Jupyter Notebook(.ipynb) 파일을 자동으로 채점하는 웹 기반 시스템

**주요 기능:**
- ✅ 정답/학생 제출물 비교 채점
- ✅ GPT-4o 기반 AI 채점
- ✅ 항목별 부분점수 부여
- ✅ 한국어 피드백 생성
- ✅ Excel 다운로드
- ✅ JWT 기반 보안

---

## 📚 문서 가이드

### 🚀 시작 문서
| 문서 | 용도 | 읽어야 할 사람 |
|------|------|----------------|
| **QUICK_START.md** | 5분 안에 시작 | 모두 (필독!) |
| **README.md** | 프로젝트 소개 | 새로운 사용자 |
| **USAGE_GUIDE.md** | 전체 화면 미리보기 | UI/기능 이해 |

### 🤖 에이전트 문서
| 문서 | 용도 | 읽어야 할 사람 |
|------|------|----------------|
| **AGENTS.md** | 에이전트 상세 설명 | 개발팀 |
| **AGENTS_QUICK_REFERENCE.md** | 빠른 참고 | 요청할 때마다 |
| **TEAM_STRUCTURE.md** | 팀 구조 및 협업 | 팀장/PM |

### 📖 기타 문서
| 문서 | 용도 |
|------|------|
| **examples/README.md** | 테스트 파일 설명 |

---

## 📂 전체 프로젝트 구조

```
ipynb-grading-system/
│
├── 📄 문서
│   ├── QUICK_START.md              ← 여기서 시작! ⭐
│   ├── README.md                   - 프로젝트 개요
│   ├── USAGE_GUIDE.md              - UI 스크린샷/가이드
│   ├── AGENTS.md                   - 에이전트 상세 정보
│   ├── AGENTS_QUICK_REFERENCE.md   - 에이전트 빠른 참고
│   ├── TEAM_STRUCTURE.md           - 팀 구조
│   └── PROJECT_MANIFEST.md         - 이 파일 📄
│
├── 🔨 백엔드
│   ├── main.py                     FastAPI 앱 (담당: 백엔드 엔지니어)
│   ├── auth.py                     JWT 인증 (담당: 인증 엔지니어)
│   ├── schemas.py                  데이터 모델 (담당: 백엔드 엔지니어)
│   ├── requirements.txt            의존성 (담당: DevOps)
│   ├── .env.example                환경변수 (담당: DevOps)
│   │
│   └── services/
│       ├── notebook_service.py     노트북 처리 (담당: 노트북 엔지니어)
│       ├── grading_service.py      채점 로직 (담당: 백엔드 + AI 채점)
│       └── llm_service.py          GPT 통합 (담당: AI 채점 엔지니어)
│
├── 🎨 프론트엔드
│   ├── package.json                npm 설정 (담당: DevOps)
│   │
│   └── src/
│       ├── App.jsx                 라우팅 (담당: 프론트엔드)
│       ├── index.js, index.css      진입점 (담당: 프론트엔드)
│       │
│       ├── pages/
│       │   ├── LoginPage.jsx        로그인 (담당: 프론트엔드)
│       │   ├── UploadPage.jsx       파일 업로드 (담당: 프론트엔드)
│       │   └── DashboardPage.jsx    채점 대시보드 (담당: 프론트엔드)
│       │
│       ├── components/
│       │   ├── StepIndicator.jsx    진행 단계 (담당: 프론트엔드)
│       │   ├── FileDropzone.jsx     드래그&드롭 (담당: 프론트엔드)
│       │   ├── ResultTable.jsx      채점표 (담당: 프론트엔드)
│       │   └── StudentDetailModal.jsx 상세 보기 (담당: 프론트엔드)
│       │
│       └── services/
│           └── api.js              API 클라이언트 (담당: 프론트엔드)
│
├── 📦 테스트 파일
│   ├── examples/
│   │   ├── answer.ipynb            정답 예시
│   │   ├── 20210001_홍길동.ipynb   학생 1 예시
│   │   ├── 20210002_김영희.ipynb   학생 2 예시
│   │   ├── rubric.json             채점 기준 예시
│   │   ├── create_test_zip.py      ZIP 생성 스크립트
│   │   └── README.md               테스트 파일 가이드
│
└── 🚀 배포 (향후)
    ├── Dockerfile                  (담당: DevOps)
    └── docker-compose.yml          (담당: DevOps)
```

---

## 🤖 6개 에이전트 팀

```
┌──────────────────────────────────────────────────────┐
│              개발팀 구성 (6명)                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔘 DevOps 아키텍트                                 │
│     └─ 프로젝트 구조, 배포, 환경 설정              │
│                                                      │
│  🔘 백엔드 엔지니어                                 │
│     └─ FastAPI, REST API, 비동기 처리             │
│                                                      │
│  🔘 노트북 처리 엔지니어                            │
│     └─ .ipynb 파싱, ZIP 추출, 셀 실행            │
│                                                      │
│  🔘 AI 채점 엔지니어                               │
│     └─ GPT-4o 프롬프트, 채점 로직, 피드백       │
│                                                      │
│  🔘 인증/보안 엔지니어                             │
│     └─ JWT, 로그인, 권한 관리                     │
│                                                      │
│  🔘 프론트엔드 엔지니어                            │
│     └─ React, UI/UX, 대시보드                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 에이전트별 담당 영역

| 에이전트 | 담당 파일 | 기술 스택 |
|---------|---------|---------|
| DevOps | requirements.txt, .env, 루트 | Python, Shell, Docker |
| 백엔드 | main.py, schemas.py | FastAPI, Pydantic |
| 노트북 | notebook_service.py | nbformat, zipfile |
| AI 채점 | llm_service.py | OpenAI API, JSON |
| 인증 | auth.py | JWT, bcrypt |
| 프론트엔드 | src/** | React, JSX, CSS |

---

## 🚀 빠른 시작 (5분)

### 1단계: 준비
```bash
# 기본 도구 확인
python --version  # 3.9+
node --version    # 16+
npm --version     # 7+
```

### 2단계: 백엔드 실행 (터미널 1)
```bash
cd backend
cp .env.example .env
# .env에 OPENAI_API_KEY 추가
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3단계: 프론트엔드 실행 (터미널 2)
```bash
cd frontend
npm install
npm start
# http://localhost:3000 자동으로 열림
```

### 4단계: 로그인
```
아이디: professor
비밀번호: secret
```

### 5단계: 테스트
```bash
cd examples
python create_test_zip.py
# answer.ipynb, students.zip, rubric.json으로 채점
```

---

## 📋 에이전트에게 요청하는 방법

### 기본 문법
```
@에이전트명: 요청 내용
```

### 예시 1: 단일 에이전트
```
@backend-engineer:
새로운 API 엔드포인트 /grading/retry 추가

요구사항:
- 특정 학생만 재채점
- 기존 결과는 유지
- 새로운 점수만 반영
```

### 예시 2: 다중 에이전트
```
@backend-engineer + @frontend-engineer:
실시간 채점 상태 업데이트 (WebSocket)

백엔드:
- SSE 또는 WebSocket 엔드포인트

프론트엔드:
- 실시간 진행률 표시
```

### 예시 3: 긴급 요청
```
🚨 @frontend-engineer:
로그인 버튼 작동 안 함 - 즉시 수정
```

---

## 🎯 전체 워크플로우

```
1. 사용자 요청
         ↓
2. DevOps 구조 검토
         ↓
3. 백엔드 API 설계
         ↓
4. 노트북 처리 구현
         ↓
5. AI 채점 로직 추가
         ↓
6. 인증 보안 강화
         ↓
7. 프론트엔드 UI 개발
         ↓
8. 통합 테스트
         ↓
9. 배포 (DevOps)
         ↓
✅ 완료
```

---

## 📊 핵심 기능 구현 현황

| 기능 | 상태 | 담당자 | 파일 |
|------|------|--------|------|
| 파일 업로드 | ✅ | 프론트엔드 | UploadPage.jsx |
| 노트북 파싱 | ✅ | 노트북 엔지니어 | notebook_service.py |
| 출력값 비교 | ✅ | 백엔드 | grading_service.py |
| GPT 채점 | ✅ | AI 채점 | llm_service.py |
| JWT 로그인 | ✅ | 인증 | auth.py |
| 실시간 진행 | ✅ | 프론트엔드 | DashboardPage.jsx |
| Excel 내보내기 | ✅ | 백엔드 | main.py |
| 상세 피드백 | ✅ | 프론트엔드 | StudentDetailModal.jsx |

---

## 🔧 트러블슈팅

### 문제: 로그인 안 됨
```
→ .env 파일 OPENAI_API_KEY 확인
→ 백엔드 서버 재시작
```

### 문제: ZIP 파일 오류
```
→ examples/create_test_zip.py 실행
→ UTF-8 인코딩 확인
```

### 문제: GPT 응답 오류
```
→ OPENAI_API_KEY 유효성 확인
→ API 할당량 확인
```

더 많은 정보는 README.md 참고

---

## 📚 문서 읽기 순서

### 처음 시작할 때
1. **QUICK_START.md** ← 5분 안에 이해
2. **USAGE_GUIDE.md** ← UI 미리보기
3. **examples/README.md** ← 테스트 파일 준비

### 기능을 추가하려고 할 때
1. **AGENTS_QUICK_REFERENCE.md** ← 에이전트 찾기
2. **AGENTS.md** ← 상세 정보
3. 해당 에이전트에게 요청

### 전체 시스템을 이해하려고 할 때
1. **README.md** - 프로젝트 개요
2. **TEAM_STRUCTURE.md** - 팀 구조
3. **PROJECT_MANIFEST.md** - 이 문서 (완전 가이드)

---

## 🎓 학습 경로

### 기초 (1-2시간)
- [ ] QUICK_START.md 읽기
- [ ] 시스템 실행
- [ ] 샘플 파일로 테스트

### 중급 (3-4시간)
- [ ] USAGE_GUIDE.md로 모든 화면 이해
- [ ] 자신의 과제 파일 준비
- [ ] 첫 채점 실행

### 고급 (필요할 때)
- [ ] AGENTS.md 읽기
- [ ] 새 기능 요청
- [ ] 코드 분석

---

## 🚀 다음 단계

### 지금 할 수 있는 것
- ✅ QUICK_START.md 읽기
- ✅ 시스템 실행하기
- ✅ 샘플 파일로 테스트
- ✅ 자신의 과제 파일 준비

### 향후 추가 기능
- [ ] 데이터베이스 연동 (PostgreSQL)
- [ ] 채점 히스토리 저장
- [ ] 학생 계정 자체 조회
- [ ] WebSocket 실시간 업데이트
- [ ] PDF 내보내기
- [ ] 통계 그래프

---

## 📞 지원

### 문제가 생기면
1. README.md 또는 USAGE_GUIDE.md 확인
2. 관련 에이전트에게 문제 보고
3. 에이전트가 수정

### 기능을 추가하고 싶으면
1. AGENTS_QUICK_REFERENCE.md 확인
2. 적절한 에이전트 선택
3. 명확하게 요청

---

## 🎉 축하합니다!

**당신은 이제 완전히 기능하는 Jupyter Notebook 자동 채점 시스템을 보유했습니다!**

다음 단계: [QUICK_START.md](QUICK_START.md)를 읽고 시작하세요! 🚀

---

## 📝 최종 체크리스트

- [ ] Python 3.9+ 설치
- [ ] Node.js 16+ 설치
- [ ] QUICK_START.md 읽음
- [ ] 백엔드 실행
- [ ] 프론트엔드 실행
- [ ] 로그인 성공 (professor/secret)
- [ ] 샘플 파일로 채점 실행
- [ ] 결과 확인
- [ ] Excel 다운로드 성공
- [ ] AGENTS_QUICK_REFERENCE.md 북마크

모두 완료! 🎯 **준비 완료!** 🚀
