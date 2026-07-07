# 🤖 개발팀 에이전트 시스템

이 프로젝트는 6개의 전문화된 에이전트로 구성되어 있습니다. 각 에이전트는 자신의 영역만 담당하며, 협업합니다.

---

## 👥 에이전트 디렉토리

### 1️⃣ DevOps 아키텍트 (Architecture & Deployment)
**색상:** 🔘 회색 | **언어:** Python, Shell | **모델:** Sonnet

**책임:**
- 프로젝트 구조 설계
- 환경 변수 (.env) 관리
- 의존성 관리 (requirements.txt, package.json)
- API 제공자 전환 (OpenAI ↔ Emergent)
- Docker/배포 설정

**담당 파일:**
- `backend/requirements.txt`
- `backend/.env.example`
- `frontend/package.json`
- `docker-compose.yml` (향후)
- 프로젝트 루트 설정 파일

**요청 방법:**
```
@devops-architect: 환경 변수 추가 필요
@devops-architect: Docker 이미지 생성해줘
```

---

### 2️⃣ 백엔드 엔지니어 (FastAPI & APIs)
**색상:** 🔘 파란색 | **언어:** Python | **모델:** Sonnet

**책임:**
- FastAPI 앱 구조 및 라우팅
- REST API 엔드포인트 설계
- 비동기 처리 (BackgroundTasks)
- 에러 처리 및 유효성 검사
- API 문서 생성

**담당 파일:**
- `backend/main.py`
- `backend/schemas.py`
- 새로운 라우트 추가

**요청 방법:**
```
@backend-engineer: 새로운 엔드포인트 /grading/stats 추가해줘
@backend-engineer: 에러 처리 개선해줘
```

---

### 3️⃣ 노트북 처리 엔지니어 (Notebook Execution)
**색상:** 🔘 노란색 | **언어:** Python | **모델:** Sonnet

**책임:**
- `.ipynb` 파일 파싱 및 검증
- ZIP 파일 추출 및 처리
- 노트북 셀 실행 (nbclient)
- 코드/마크다운 셀 분리
- 출력값 추출 및 비교

**담당 파일:**
- `backend/services/notebook_service.py`
- 노트북 관련 로직

**요청 방법:**
```
@notebook-engineer: 문제별 셀 분리 개선해줘
@notebook-engineer: 실행 시간 초과 처리 추가해줘
```

---

### 4️⃣ AI 채점 엔지니어 (GPT-4o Integration)
**색상:** 🔘 빨간색 | **언어:** Python | **모델:** Sonnet

**책임:**
- GPT 프롬프트 설계
- 채점 로직 구현
- 부분점수 판정
- 피드백 생성
- JSON 파싱 및 유효성 검사

**담당 파일:**
- `backend/services/llm_service.py`
- AI 관련 모든 로직

**요청 방법:**
```
@ai-grading-engineer: GPT 프롬프트 개선해줘
@ai-grading-engineer: 채점 결과 신뢰도 올려줘
```

---

### 5️⃣ 인증 보안 엔지니어 (JWT & Security)
**색상:** 🔘 보라색 | **언어:** Python | **모델:** Sonnet

**책임:**
- JWT 토큰 발급/검증
- bcrypt 비밀번호 해싱
- 역할 기반 접근 제어 (RBAC)
- API 보안 미들웨어
- 로그아웃 및 토큰 갱신

**담당 파일:**
- `backend/auth.py`
- 모든 보안 관련 로직

**요청 방법:**
```
@auth-engineer: TA 역할 추가해줘
@auth-engineer: 토큰 만료 시간 연장해줘
```

---

### 6️⃣ 프론트엔드 엔지니어 (React Dashboard)
**색상:** 🔘 초록색 | **언어:** JavaScript/JSX | **모델:** Sonnet

**책임:**
- React 컴포넌트 설계
- UI/UX 구현 (밝은 테마)
- 상태 관리 (Context API)
- API 통신 (axios)
- 반응형 레이아웃

**담당 파일:**
- `frontend/src/**/*.jsx`
- `frontend/src/services/api.js`
- CSS 스타일

**요청 방법:**
```
@frontend-engineer: 다크 모드 추가해줘
@frontend-engineer: 모바일 반응형 개선해줘
```

---

## 🔄 협업 워크플로우

### 1단계: 요구사항 분석 (DevOps)
```
사용자 요청 → DevOps 아키텍트 검토
└─ 프로젝트 구조 확인
└─ 필요한 파일 목록화
└─ 다른 에이전트에 위임
```

### 2단계: API 설계 (백엔드)
```
DevOps 결정 → 백엔드 엔지니어 API 설계
└─ FastAPI 엔드포인트 추가
└─ 요청/응답 스키마 정의
└─ 노트북 엔지니어와 협력
```

### 3단계: 노트북 처리 (노트북 엔지니어)
```
백엔드 요청 → 노트북 엔지니어 구현
└─ 파일 처리 로직
└─ 셀 추출 및 실행
└─ AI 채점 엔지니어에게 데이터 전달
```

### 4단계: AI 채점 (AI 채점 엔지니어)
```
노트북 데이터 → AI 채점 엔지니어
└─ GPT 프롬프트 생성
└─ 채점 로직 실행
└─ 피드백 생성
```

### 5단계: 보안 강화 (인증 엔지니어)
```
전체 API → 인증 엔지니어 보안 추가
└─ JWT 보호
└─ 역할 검사
└─ API 미들웨어
```

### 6단계: UI 구현 (프론트엔드 엔지니어)
```
백엔드 API 완성 → 프론트엔드 엔지니어
└─ 컴포넌트 개발
└─ API 연동
└─ 스타일 적용
```

---

## 📋 요청 양식

### 형식 1: 명확한 역할 지정
```
@{에이전트}: {작업 내용}

예:
@backend-engineer: /grading/analytics 엔드포인트 추가
상세: 평균 점수, 최고/최저 점수를 반환하는 API
```

### 형식 2: 자동 할당
```
{문제 설명만 제시}

예:
학생별 재채점 기능 추가

시스템이 자동으로 필요한 에이전트들을 할당합니다:
- 백엔드: API 재설계
- AI 채점: 점수 재계산 로직
- 프론트엔드: 재채점 버튼 추가
```

### 형식 3: 협업 지정
```
@backend-engineer + @frontend-engineer: {작업}

예:
@backend-engineer + @frontend-engineer:
실시간 채점 상태 업데이트 기능 (WebSocket)
```

---

## 🎯 에이전트 선택 가이드

| 요청 유형 | 에이전트 | 예시 |
|----------|---------|------|
| API 추가/수정 | @backend-engineer | `POST /grading/retry` |
| 파일 처리 | @notebook-engineer | ZIP 포함 폴더 지원 |
| GPT 채점 개선 | @ai-grading-engineer | 프롬프트 최적화 |
| 로그인/역할 | @auth-engineer | 학생 계정 추가 |
| UI 개선 | @frontend-engineer | 다크 모드 |
| 배포/설정 | @devops-architect | Docker 이미지 |
| 여러 영역 | 모두 지정 | 통합 기능 |

---

## 💬 에이전트와 대화하기

### 예시 1: 간단한 요청
```
@frontend-engineer: 대시보드에 "새로고침" 버튼 추가해줘
```

### 예시 2: 복잡한 요청 (여러 에이전트)
```
시스템 성능 최적화가 필요합니다:

@backend-engineer:
- 채점 API 캐싱 추가
- 대량 학생 처리 시 메모리 최적화

@notebook-engineer:
- 노트북 실행 시간 제한 추가
- 동시 실행 수 제한

@frontend-engineer:
- 진행률 바 부드럽게 애니메이션
- 대기 시간 메시지 개선
```

### 예시 3: 에이전트 간 조율
```
@backend-engineer + @ai-grading-engineer:
GPT 채점 결과를 캐싱하여 같은 코드에 대해
재채점할 때는 캐시된 결과 사용
```

---

## 🔒 에이전트 접근 권한

| 에이전트 | Read | Write | Edit | Bash |
|---------|------|-------|------|------|
| DevOps | ✅ | ✅ | ✅ | ✅ |
| 백엔드 | ✅ | ✅ | ✅ | ✅ |
| 노트북 | ✅ | ✅ | ✅ | ✅ |
| AI | ✅ | ✅ | ✅ | ❌ |
| 인증 | ✅ | ✅ | ✅ | ❌ |
| 프론트엔드 | ✅ | ✅ | ✅ | ❌ |

---

## 📞 자주 묻는 질문

### Q: 모든 에이전트에게 동시에 요청할 수 있나요?
**A:** 예, 가능합니다. 대신 작업 순서를 명시하면 좋습니다.

### Q: 에이전트가 범위를 벗어나서 작업하면?
**A:** 요청자(사용자)가 거절하거나 방향을 수정할 수 있습니다.

### Q: 새로운 에이전트 추가 가능한가요?
**A:** 네, 새로운 도메인(예: 데이터베이스)이 필요하면 추가 가능합니다.

### Q: 에이전트 간 충돌이 나면?
**A:** DevOps 아키텍트가 중재합니다.

---

## 🚀 시작하기

이제 에이전트에게 작업을 요청할 수 있습니다:

```
@backend-engineer: 학생 점수 통계 API 추가
@frontend-engineer: 통계 차트 컴포넌트 만들어줘
@ai-grading-engineer: 점수별 난이도 분석 추가
```

각 에이전트는 자신의 전문 영역에서 최고의 결과를 제공할 것입니다! 🎯
