# ⚡ 빠른 시작 가이드

> QUICK_START.md + RUN_NOW.md를 통합한 문서입니다 (2026-07 갱신).

## 1️⃣ 준비 사항

```bash
python --version   # 3.9 이상
node --version     # 16 이상
```

## 2️⃣ 백엔드 실행 (터미널 1)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**backend/.env 필수 항목:**

```env
SECRET_KEY=아무-의미-없는-긴-랜덤-문자열
FIREWORKS_API_KEY=fw-...        # 또는 OPENAI_API_KEY
# 시드 계정 (DB가 비어 있을 때 기본 계정 자동 생성용 — 선택)
SEED_ADMIN_PASSWORD=...
SEED_PROFESSOR_PASSWORD=...
```

✅ 성공: `Uvicorn running on http://127.0.0.1:8000`

## 3️⃣ 프론트엔드 실행 (터미널 2)

```bash
cd frontend
npm install     # 처음 한 번만
npm start
```

✅ 브라우저가 자동으로 http://localhost:3000 을 엽니다.

## 4️⃣ 로그인

- 계정 정보는 프로젝트 루트의 **CREDENTIALS.md** 참고 (git 미추적 파일)
- 계정이 없으면 회원가입으로 생성

## 5️⃣ 채점 흐름

1. **새 채점**: 과목·세부 항목 선택 → 정답 노트북(.ipynb) + 학생 제출물(ZIP) 업로드
2. **AI 루브릭 생성** → 루브릭 확인/수정 → **채점 실행**
3. 대시보드에서 실시간 진행률 확인 (채점 완료 시 브라우저 알림 — 설정에서 켜기)
4. 결과: 학생별 점수 테이블, 통계 대시보드(원점수/100점 환산), Excel 다운로드
5. **채점 비교**: 다른 AI로 재채점 후 세션 2~4개를 나란히 비교

테스트용 샘플 파일: `examples/` 폴더 (`python create_test_zip.py`로 생성)

## 🔌 포트 정보

| 서비스 | 주소 |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |

## 🆘 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| 포트 3000 이미 사용 중 | 기존 프로세스 종료 또는 `PORT=3001 npm start` |
| `uvicorn: command not found` | `pip install -r requirements.txt` 재실행 |
| API 키 오류 | `backend/.env`의 키 확인 후 백엔드 재시작 |
| 로그인 5회 실패 잠금 | 5분 후 재시도 (무차별 대입 방지 기능) |

## 📚 더 보기

- 상세 사용법: [USAGE_GUIDE.md](USAGE_GUIDE.md)
- 프론트엔드 구조: [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)
- 루브릭 작성 기준: [RUBRIC_GUIDELINE.md](RUBRIC_GUIDELINE.md)
- 채점 LLM 설정: [grading_LLM.md](grading_LLM.md)
