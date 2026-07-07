# 🚀 에이전트 시스템 빠른 참고

## 6개의 전문 에이전트

```
┌─────────────────────────────────────────────────────────────┐
│                     개발팀 에이전트                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔘 DevOps         → 프로젝트 구조, 배포, 환경 설정       │
│  🔘 백엔드         → FastAPI, REST API, 비동기 처리      │
│  🔘 노트북 처리    → .ipynb 파싱, ZIP 추출, 셀 실행    │
│  🔘 AI 채점        → GPT 프롬프트, 채점 로직, 피드백   │
│  🔘 인증/보안      → JWT, 로그인, 권한 관리           │
│  🔘 프론트엔드     → React, UI/UX, 대시보드           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 누구에게 요청할지 결정하기

### 🔧 변경하려는 파일은?

**`backend/main.py`**
```
@backend-engineer: API 엔드포인트 추가/수정
```

**`backend/services/notebook_service.py`**
```
@notebook-engineer: 노트북 처리 로직
```

**`backend/services/llm_service.py`**
```
@ai-grading-engineer: GPT 채점 로직
```

**`backend/auth.py`**
```
@auth-engineer: 인증/보안 로직
```

**`frontend/src/pages/**`**
```
@frontend-engineer: UI 페이지
```

**`backend/requirements.txt`, `.env`, 구조**
```
@devops-architect: 환경 설정
```

---

## 요청 예시 모음

### 1️⃣ 백엔드 기능 추가
```
@backend-engineer:
새로운 엔드포인트 '/grading/export-pdf' 추가

요구사항:
- 채점 결과를 PDF로 내보내기
- 학생별 상세 피드백 포함
- A4 크기로 포맷
```

### 2️⃣ 노트북 처리 개선
```
@notebook-engineer:
문제 감지 개선

현재: "## 문제 N" 마크다운만 인식
요청: 정규식으로 더 많은 패턴 인식
- "### 문제 N"
- "Problem N:"
- "Q N:"
```

### 3️⃣ AI 채점 품질 향상
```
@ai-grading-engineer:
GPT 프롬프트 개선

목표: 부분점수 판정이 더 공정하고 일관성 있게
개선사항:
- 채점 기준 명확화
- Few-shot examples 추가
- JSON 구조 개선
```

### 4️⃣ 사용자 관리 추가
```
@auth-engineer:
사용자 관리 기능 추가

요구사항:
- 관리자가 사용자(교수/조교) 생성 가능
- 비밀번호 변경
- 로그인 시도 제한 (Brute force 방지)
```

### 5️⃣ UI 개선
```
@frontend-engineer:
대시보드 사용성 개선

변경사항:
- 다크 모드 토글 추가
- 학생 검색 기능 향상 (정규식 지원)
- 엑셀 다운로드 진행률 표시
- 오류 메시지 더 자세하게
```

### 6️⃣ Docker 배포
```
@devops-architect:
Docker 이미지 생성

요구사항:
- Dockerfile 작성 (backend)
- docker-compose.yml (backend + frontend)
- .dockerignore 설정
- 환경 변수 주입 방식
```

---

## 🔄 협업 요청

### 2개 에이전트가 협력
```
@backend-engineer + @frontend-engineer:
실시간 채점 상태 업데이트

백엔드:
- Server-Sent Events (SSE) 엔드포인트 구현
- 채점 진행 상황 실시간 전송

프론트엔드:
- EventSource로 연결
- 실시간으로 진행률 업데이트
```

### 3개 에이전트가 협력
```
@backend-engineer + @ai-grading-engineer + @frontend-engineer:
채점 재실행 기능

백엔드:
- 특정 학생 재채점 API

AI 채점:
- 이전 채점 결과 비교
- 점수 변경 사항 추적

프론트엔드:
- 재채점 버튼
- 변경 사항 하이라이트
```

---

## 📊 에이전트별 담당 파일

```
DevOps 🔘
├── backend/requirements.txt
├── backend/.env.example
├── frontend/package.json
├── docker-compose.yml
└── 프로젝트 구조

백엔드 🔘
├── backend/main.py
├── backend/schemas.py
└── 모든 라우트

노트북 🔘
└── backend/services/notebook_service.py

AI 채점 🔘
└── backend/services/llm_service.py

인증 🔘
└── backend/auth.py

프론트엔드 🔘
├── frontend/src/pages/**
├── frontend/src/components/**
├── frontend/src/services/api.js
└── frontend/src/index.css
```

---

## ✅ 요청 체크리스트

에이전트에게 요청할 때 확인하세요:

- [ ] 명확한 에이전트 지정 (@백엔드, @프론트엔드 등)
- [ ] 구체적인 요구사항 (무엇을 변경할지)
- [ ] 예상되는 결과 (어떤 동작을 기대하는지)
- [ ] 관련 파일 언급 (어느 파일을 수정할지)
- [ ] 우선순위 (급할 경우 표시)

### 좋은 예:
```
@backend-engineer:
/grading/stats 엔드포인트 추가

현재: stats 기능 없음
요청: 평균, 최고, 최저 점수 반환
파일: backend/main.py
응답 형식:
{
  "average": 75.5,
  "max": 100,
  "min": 45,
  "count": 12
}
```

### 나쁜 예:
```
기능 추가해줘
```

---

## 🎯 다음 단계

### 현재 상태
✅ 기본 시스템 완성
✅ 6개 에이전트 역할 정의
✅ 협업 시스템 설정

### 추가 가능한 기능들
```
[ ] 학생 계정 자체 채점 조회 (읽기 전용)
[ ] 채점 결과 이메일 자동 발송
[ ] 점수 분포 통계 그래프
[ ] 반복 채점 (최종 점수 평균)
[ ] 채점 기준 템플릿 저장소
[ ] 채점 히스토리 기록
[ ] 사용자 정의 피드백 템플릿
[ ] 대량 학생 기본 정보 임포트
```

이 중 원하는 기능이 있으면 요청하세요!

---

## 💬 요청 명령어 예시

```bash
# 단일 에이전트 요청
@backend-engineer: ...

# 여러 에이전트 협력
@backend-engineer + @ai-grading-engineer: ...

# 긴급 요청
🚨 @frontend-engineer: 긴급 버그 수정 - 로그인 버튼 작동 안 함

# 낮은 우선순위
@frontend-engineer (나중에 괜찮음): UI 색상 미세 조정
```

---

**준비 완료! 이제 에이전트들에게 작업을 할당할 수 있습니다.** 🚀

원하는 기능이 있으면 위 가이드를 참고해 요청하세요!
