import os
import json
import uuid
import asyncio
import io
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import (
    FastAPI, Depends, HTTPException, status, UploadFile, File,
    Form, BackgroundTasks
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()

import models
from database import engine, SessionLocal, get_db
from auth import (
    authenticate_user, create_access_token, get_current_user,
    get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, require_admin
)
from schemas import (
    Token, LoginRequest, RegisterRequest, GradingCriteria, GradingSession,
    StudentResult, SubjectCreate, SubjectResponse, HistorySessionItem, SubjectItemCreate,
    ProblemRevisionRequest, RevisionLogItem
)
from services.notebook_service import (
    extract_notebooks_from_zip, parse_student_id_from_filename,
    parse_notebook, split_notebook_by_problems
)
from services.grading_service import grade_student_notebook
from services.llm_service import APIQuotaError, generate_rubric_with_ai

app = FastAPI(title="Jupyter Notebook 자동 채점 시스템", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory active sessions
grading_sessions: Dict[str, GradingSession] = {}


# ─── Startup ───────────────────────────────────────────────────────────────────

def seed_database():
    """Create default users and subjects if they don't exist."""
    db = SessionLocal()
    try:
        seed_users = [
            {
                "username": "admin",
                "email": "admin@univ.ac.kr",
                "password": "admin123123",
                "role": "admin",
                "subjects": [],
            },
            {
                "username": "professor",
                "email": "professor@univ.ac.kr",
                "password": "secret",
                "role": "professor",
                "subjects": [("알고리즘", "CS101"), ("자료구조", "CS102")],
            },
            {
                "username": "prof_kim",
                "email": "kim.prof@univ.ac.kr",
                "password": "Kim2024#",
                "role": "professor",
                "subjects": [("데이터베이스", "DB201"), ("운영체제", "OS202")],
            },
        ]
        for u in seed_users:
            existing = db.query(models.User).filter(models.User.username == u["username"]).first()
            if not existing:
                user = models.User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                )
                db.add(user)
                db.flush()
                for name, code in u["subjects"]:
                    db.add(models.Subject(name=name, code=code, user_id=user.id))
        db.commit()

        # 기본 시스템 설정 시드
        default_settings = {
            "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
            "llm_model": "gpt-4o-mini",
            "base_system_prompt": "",
            "max_upload_size_mb": "50",
        }
        for key, value in default_settings.items():
            existing = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
            if not existing:
                db.add(models.SystemSetting(key=key, value=value))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
async def startup():
    try:
        models.Base.metadata.create_all(bind=engine)
        seed_database()
    except Exception as e:
        print(f"Warning: Database initialization failed: {str(e)}")
        print("App will continue running, but with empty database.")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/openai-test")
async def debug_openai_test():
    import httpx
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    results = {
        "api_key_set": bool(api_key),
        "api_key_prefix": api_key[:8] if api_key else "",
        "base_url": base_url,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            results["httpx_status"] = r.status_code
            results["httpx_body"] = r.text[:300]
    except Exception as e:
        results["httpx_error"] = f"{type(e).__name__}: {str(e)}"
    return results


# ─── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=Token)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=token, token_type="bearer")


@app.post("/auth/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == request.username).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다")
    if db.query(models.User).filter(models.User.email == request.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다")

    user = models.User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role="professor",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "회원가입이 완료되었습니다", "username": user.username}


@app.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return current_user


# ─── Subjects ──────────────────────────────────────────────────────────────────

@app.get("/subjects")
async def list_subjects(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    subjects = (
        db.query(models.Subject)
        .filter(models.Subject.user_id == current_user["id"])
        .order_by(models.Subject.created_at)
        .all()
    )
    result = []
    for s in subjects:
        count = db.query(models.GradingSessionDB).filter(
            models.GradingSessionDB.subject_id == s.id
        ).count()
        items = [{"id": item.id, "name": item.name, "created_at": item.created_at.isoformat()} for item in s.items]
        result.append({
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "session_count": count,
            "items": items,
            "created_at": s.created_at.isoformat(),
        })
    return result


@app.post("/subjects")
async def create_subject(
    body: SubjectCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subject = models.Subject(
        name=body.name,
        code=body.code,
        user_id=current_user["id"],
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return {"id": subject.id, "name": subject.name, "code": subject.code, "session_count": 0,
            "items": [], "created_at": subject.created_at.isoformat()}


@app.get("/subjects/{subject_id}")
async def get_subject(
    subject_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subject = db.query(models.Subject).filter(
        models.Subject.id == subject_id,
        models.Subject.user_id == current_user["id"]
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="과목을 찾을 수 없습니다")

    items = [{"id": item.id, "name": item.name, "created_at": item.created_at.isoformat()} for item in subject.items]
    count = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.subject_id == subject.id
    ).count()
    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "session_count": count,
        "items": items,
        "created_at": subject.created_at.isoformat(),
    }


@app.post("/subjects/{subject_id}/items")
async def create_subject_item(
    subject_id: int,
    body: SubjectItemCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subject = db.query(models.Subject).filter(
        models.Subject.id == subject_id,
        models.Subject.user_id == current_user["id"]
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="과목을 찾을 수 없습니다")

    item = models.SubjectItem(subject_id=subject_id, name=body.name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name, "created_at": item.created_at.isoformat()}


@app.delete("/subjects/{subject_id}/items/{item_id}")
async def delete_subject_item(
    subject_id: int,
    item_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subject = db.query(models.Subject).filter(
        models.Subject.id == subject_id,
        models.Subject.user_id == current_user["id"]
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="과목을 찾을 수 없습니다")

    item = db.query(models.SubjectItem).filter(
        models.SubjectItem.id == item_id,
        models.SubjectItem.subject_id == subject_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다")

    db.delete(item)
    db.commit()
    return {"message": "항목이 삭제되었습니다"}


# ─── Rubric Generation ────────────────────────────────────────────────────────

@app.post("/grading/generate-rubric")
async def generate_rubric(
    answer_notebook: UploadFile = File(...),
    total_score: float = Form(100.0),
    exam_title: str = Form(""),
    current_user=Depends(get_current_user),
):
    """정답 노트북을 분석하여 루브릭 JSON을 자동 생성합니다."""
    answer_bytes = await answer_notebook.read()

    try:
        nb = parse_notebook(answer_bytes)
        problems = split_notebook_by_problems(nb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"노트북 파싱 오류: {str(e)}")

    if not problems:
        raise HTTPException(status_code=400, detail="노트북에서 문제를 찾을 수 없습니다. 마크다운 셀에 Q1, Q2 등의 문제 마커가 필요합니다.")

    try:
        rubric = await generate_rubric_with_ai(
            answer_problems=problems,
            total_score=total_score,
            exam_title=exam_title,
        )
        return rubric
    except APIQuotaError:
        raise HTTPException(status_code=429, detail="OpenAI API 사용량이 초과되었습니다.")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"루브릭 생성 실패: {str(e)}")


# ─── Grading ───────────────────────────────────────────────────────────────────

@app.post("/grading/start")
async def start_grading(
    background_tasks: BackgroundTasks,
    answer_notebook: UploadFile = File(...),
    student_zip: UploadFile = File(...),
    criteria_file: UploadFile = File(...),
    subject_id: Optional[int] = Form(None),
    subject_item_id: Optional[int] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer_bytes = await answer_notebook.read()
    student_bytes = await student_zip.read()
    criteria_bytes = await criteria_file.read()

    try:
        criteria_data = json.loads(criteria_bytes.decode('utf-8'))
        criteria = GradingCriteria(**criteria_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"채점 기준 파일 파싱 오류: {str(e)}")

    try:
        filename = student_zip.filename or ""
        if filename.lower().endswith('.ipynb'):
            student_notebooks = [(filename, student_bytes)]
        else:
            student_notebooks = extract_notebooks_from_zip(student_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"학생 제출물 처리 오류: {str(e)}")

    if not student_notebooks:
        raise HTTPException(status_code=400, detail="제출물에서 .ipynb 파일을 찾을 수 없습니다")

    session_id = str(uuid.uuid4())
    session = GradingSession(
        session_id=session_id,
        status="pending",
        progress=0.0,
        total_students=len(student_notebooks),
        processed_students=0,
        results=[]
    )
    grading_sessions[session_id] = session

    # Persist initial record to DB
    db_record = models.GradingSessionDB(
        id=session_id,
        subject_id=subject_id,
        subject_item_id=subject_item_id,
        user_id=current_user["id"],
        status="running",
        total_students=len(student_notebooks),
        processed_students=0,
    )
    db.add(db_record)
    db.commit()

    background_tasks.add_task(
        run_grading_session,
        session_id, answer_bytes, student_notebooks, criteria,
        subject_id, current_user["id"]
    )

    return {"session_id": session_id, "total_students": len(student_notebooks)}


def _extract_student_info(nb_content: bytes) -> tuple[str, str]:
    """노트북 첫 셀에서 '# 학번 :'과 '# 이름 :' 추출. (학번, 이름) 튜플 반환."""
    try:
        from services.notebook_service import parse_notebook
        nb = parse_notebook(nb_content)
        if nb.cells:
            src = nb.cells[0].source if isinstance(nb.cells[0].source, str) else ''.join(nb.cells[0].source)
            student_id, name = "", ""
            for line in src.split('\n'):
                line_stripped = line.strip().lstrip('#').strip()
                if line_stripped.startswith('학번'):
                    student_id = line_stripped.split(':', 1)[-1].strip()
                elif line_stripped.startswith('이름'):
                    name = line_stripped.split(':', 1)[-1].strip()
            return student_id, name
    except Exception:
        pass
    return "", ""


async def run_grading_session(
    session_id: str,
    answer_bytes: bytes,
    student_notebooks: list,
    criteria: GradingCriteria,
    subject_id: Optional[int] = None,
    user_id: Optional[int] = None,
):
    session = grading_sessions[session_id]
    session.status = "running"
    total = len(student_notebooks)

    quota_exceeded = False
    session_total_tokens = 0
    for i, (filename, content) in enumerate(student_notebooks):
        session.current_student = filename
        try:
            problem_results, error, student_tokens = await grade_student_notebook(
                student_nb_content=content,
                answer_nb_content=answer_bytes,
                criteria=criteria,
                execute=False
            )
            total_score = sum(p.obtained_score for p in problem_results)
            max_total = sum(p.full_score for p in problem_results)

            # 노트북에서 학번/이름 추출
            nb_student_id, nb_student_name = _extract_student_info(content)

            student_result = StudentResult(
                filename=filename,
                student_id=nb_student_id or parse_student_id_from_filename(filename),
                student_name=nb_student_name,
                total_score=total_score,
                max_total_score=max_total,
                problems=problem_results,
                error=error
            )
            session.results.append(student_result)
            session_total_tokens += student_tokens
        except APIQuotaError:
            quota_exceeded = True
            session.processed_students = i
            session.progress = (i / total) * 100
            break
        except Exception as e:
            nb_student_id, nb_student_name = _extract_student_info(content)
            session.results.append(StudentResult(
                filename=filename,
                student_id=nb_student_id or parse_student_id_from_filename(filename),
                student_name=nb_student_name,
                total_score=0,
                max_total_score=sum(p.full_score for p in criteria.problems),
                problems=[],
                error=str(e)
            ))

        session.processed_students = i + 1
        session.progress = ((i + 1) / total) * 100

    if quota_exceeded:
        session.status = "quota_exceeded"
        session.current_student = None
        session.error = "OpenAI API 사용량이 초과되었습니다. API를 충전한 후 이어서 채점하세요."
    else:
        session.status = "completed"
        session.progress = 100.0
        session.current_student = None

    # Persist to DB
    db = SessionLocal()
    try:
        results_data = [r.model_dump() for r in session.results]
        db_record = db.query(models.GradingSessionDB).filter(
            models.GradingSessionDB.id == session_id
        ).first()
        if db_record:
            db_record.status = session.status
            db_record.progress = session.progress
            db_record.processed_students = session.processed_students
            db_record.results_json = json.dumps(results_data, ensure_ascii=False)
            db_record.error = session.error
            db_record.tokens_used = (db_record.tokens_used or 0) + session_total_tokens
            if not quota_exceeded:
                db_record.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@app.post("/grading/resume/{session_id}")
async def resume_grading(
    session_id: str,
    background_tasks: BackgroundTasks,
    answer_notebook: UploadFile = File(...),
    student_zip: UploadFile = File(...),
    criteria_file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_record = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.id == session_id
    ).first()
    if not db_record or db_record.status != "quota_exceeded":
        raise HTTPException(status_code=400, detail="이어서 채점할 수 없는 세션입니다 (quota_exceeded 상태가 아님)")

    answer_bytes = await answer_notebook.read()
    student_bytes = await student_zip.read()
    criteria_bytes = await criteria_file.read()

    try:
        criteria_data = json.loads(criteria_bytes.decode('utf-8'))
        criteria = GradingCriteria(**criteria_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"채점 기준 파일 파싱 오류: {str(e)}")

    try:
        filename = student_zip.filename or ""
        if filename.lower().endswith('.ipynb'):
            all_notebooks = [(filename, student_bytes)]
        else:
            all_notebooks = extract_notebooks_from_zip(student_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"학생 제출물 처리 오류: {str(e)}")

    # 이미 채점된 학생 파일명 수집
    already_done = set()
    if db_record.results_json:
        try:
            already_done = {r['filename'] for r in json.loads(db_record.results_json)}
        except Exception:
            pass

    remaining = [(f, c) for f, c in all_notebooks if f not in already_done]
    if not remaining:
        raise HTTPException(status_code=400, detail="이어서 채점할 학생이 없습니다 (모두 완료됨)")

    # 기존 결과 복원 후 세션 갱신
    existing_results = []
    if db_record.results_json:
        try:
            existing_results = [StudentResult(**r) for r in json.loads(db_record.results_json)]
        except Exception:
            pass

    new_total = len(existing_results) + len(remaining)
    session = GradingSession(
        session_id=session_id,
        status="running",
        progress=db_record.progress,
        total_students=new_total,
        processed_students=len(existing_results),
        results=existing_results,
        error=None,
    )
    grading_sessions[session_id] = session

    db_record.status = "running"
    db_record.total_students = new_total
    db_record.error = None
    db.commit()

    background_tasks.add_task(
        run_grading_session,
        session_id, answer_bytes, remaining, criteria,
        db_record.subject_id, current_user["id"]
    )

    return {"session_id": session_id, "remaining_students": len(remaining)}


@app.get("/grading/session/{session_id}")
async def get_session(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check in-memory first (active sessions)
    session = grading_sessions.get(session_id)
    if session:
        return session

    # Load from DB (past sessions after restart)
    db_record = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.id == session_id
    ).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    results = []
    if db_record.results_json:
        try:
            results = [StudentResult(**r) for r in json.loads(db_record.results_json)]
        except Exception:
            pass

    return GradingSession(
        session_id=session_id,
        status=db_record.status,
        progress=100.0 if db_record.status == "completed" else db_record.progress,
        total_students=db_record.total_students,
        processed_students=db_record.processed_students,
        results=results,
        error=db_record.error,
    )


@app.get("/grading/history")
async def get_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = (
        db.query(models.GradingSessionDB)
        .filter(models.GradingSessionDB.user_id == current_user["id"])
        .order_by(models.GradingSessionDB.created_at.desc())
        .all()
    )
    result = []
    for r in records:
        subject_item_name = None
        if r.subject_item_id:
            subject_item = db.query(models.SubjectItem).filter(
                models.SubjectItem.id == r.subject_item_id
            ).first()
            subject_item_name = subject_item.name if subject_item else None

        result.append({
            "session_id": r.id,
            "subject_id": r.subject_id,
            "subject_name": r.subject.name if r.subject else None,
            "subject_code": r.subject.code if r.subject else None,
            "subject_item_id": r.subject_item_id,
            "subject_item_name": subject_item_name,
            "status": r.status,
            "total_students": r.total_students,
            "processed_students": r.processed_students,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
    return result


@app.get("/grading/session/{session_id}/results")
async def get_results(session_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    session = grading_sessions.get(session_id)
    if session:
        if session.status != "completed":
            raise HTTPException(status_code=400, detail="채점이 아직 완료되지 않았습니다")
        return session.results

    db_record = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.id == session_id
    ).first()
    if not db_record or db_record.status != "completed":
        raise HTTPException(status_code=400, detail="채점이 완료되지 않았습니다")

    results = []
    if db_record.results_json:
        results = [StudentResult(**r) for r in json.loads(db_record.results_json)]
    return results


@app.patch("/grading/session/{session_id}/revise")
async def revise_problem_score(
    session_id: str,
    revision: ProblemRevisionRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """교수가 점수 또는 코멘트를 수정. 이력은 자동 기록됨."""
    # 1. 권한 확인 (교수 또는 관리자만)
    if current_user.get("role") not in ("professor", "admin"):
        raise HTTPException(status_code=403, detail="교수 권한이 필요합니다")

    # 2. DB 세션 가져오기
    db_record = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.id == session_id
    ).first()
    if not db_record or not db_record.results_json:
        raise HTTPException(status_code=404, detail="채점 세션을 찾을 수 없습니다")

    # 3. 세션 소유자 확인 (해당 강의 교수만)
    if db_record.user_id and db_record.user_id != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="해당 채점 세션의 수정 권한이 없습니다")

    # 4. 결과 파싱 후 해당 학생/문제 찾기
    results = json.loads(db_record.results_json)
    target_student = None
    target_problem = None
    for student in results:
        if student.get("filename") == revision.student_filename:
            target_student = student
            for p in student.get("problems", []):
                if str(p.get("problem_id")) == str(revision.problem_id):
                    target_problem = p
                    break
            break

    if not target_student or not target_problem:
        raise HTTPException(status_code=404, detail="해당 학생/문제를 찾을 수 없습니다")

    full_score = float(target_problem.get("full_score", 0))
    revision_logs = []

    # 5-A. partial_scores 수정 (각 세부 항목)
    if revision.partial_scores is not None:
        existing_partials = target_problem.get("partial_scores", [])
        for i, new_ps in enumerate(revision.partial_scores):
            if i >= len(existing_partials):
                continue
            old_ps = existing_partials[i]
            max_score = float(old_ps.get("max_score", 0))
            new_score = float(new_ps.score)

            # 점수 범위 검증: 0 ~ max_score
            if new_score < 0 or new_score > max_score:
                raise HTTPException(
                    status_code=400,
                    detail=f"세부 점수는 0 ~ {max_score}점 범위여야 합니다 (입력값: {new_score})"
                )

            # 점수 변경 시 이력 기록
            if old_ps.get("score") != new_score:
                revision_logs.append(models.ProblemRevisionLog(
                    session_id=session_id,
                    student_filename=revision.student_filename,
                    problem_id=str(revision.problem_id),
                    field_name="partial_score",
                    partial_score_index=i,
                    old_value=str(old_ps.get("score")),
                    new_value=str(new_score),
                    revised_by=current_user["id"],
                ))
                existing_partials[i]["score"] = new_score

            # 사유 변경 시 이력 기록
            if new_ps.reason and old_ps.get("reason") != new_ps.reason:
                revision_logs.append(models.ProblemRevisionLog(
                    session_id=session_id,
                    student_filename=revision.student_filename,
                    problem_id=str(revision.problem_id),
                    field_name="partial_reason",
                    partial_score_index=i,
                    old_value=old_ps.get("reason"),
                    new_value=new_ps.reason,
                    revised_by=current_user["id"],
                ))
                existing_partials[i]["reason"] = new_ps.reason

        # 세부 항목 합계로 obtained_score 자동 재계산
        target_problem["obtained_score"] = round(sum(p.get("score", 0) for p in existing_partials), 2)

    # 5-B. obtained_score 직접 수정 (세부 항목이 없는 경우만)
    elif revision.obtained_score is not None:
        if not target_problem.get("partial_scores"):
            new_score = float(revision.obtained_score)
            if new_score < 0 or new_score > full_score:
                raise HTTPException(
                    status_code=400,
                    detail=f"점수는 0 ~ {full_score}점 범위여야 합니다 (입력값: {new_score})"
                )
            old_score = target_problem.get("obtained_score")
            if old_score != new_score:
                revision_logs.append(models.ProblemRevisionLog(
                    session_id=session_id,
                    student_filename=revision.student_filename,
                    problem_id=str(revision.problem_id),
                    field_name="obtained_score",
                    old_value=str(old_score),
                    new_value=str(new_score),
                    revised_by=current_user["id"],
                ))
                target_problem["obtained_score"] = new_score
        else:
            raise HTTPException(
                status_code=400,
                detail="세부 항목이 있는 문제는 obtained_score를 직접 수정할 수 없습니다 (partial_scores를 수정하세요)"
            )

    # 5-C. 교수 코멘트 수정
    if revision.professor_feedback is not None:
        old_feedback = target_problem.get("professor_feedback")
        if old_feedback != revision.professor_feedback:
            revision_logs.append(models.ProblemRevisionLog(
                session_id=session_id,
                student_filename=revision.student_filename,
                problem_id=str(revision.problem_id),
                field_name="professor_feedback",
                old_value=old_feedback,
                new_value=revision.professor_feedback,
                revised_by=current_user["id"],
            ))
            target_problem["professor_feedback"] = revision.professor_feedback

    # 6. 수정 표시 + 학생 총점 재계산
    if revision_logs:
        target_problem["is_revised"] = True
        target_problem["revised_at"] = datetime.utcnow().isoformat()
        target_student["total_score"] = round(
            sum(p.get("obtained_score", 0) for p in target_student.get("problems", [])), 2
        )

        # 7. DB 저장
        db_record.results_json = json.dumps(results, ensure_ascii=False)
        for log in revision_logs:
            db.add(log)
        db.commit()

    return {
        "success": True,
        "revisions_count": len(revision_logs),
        "updated_problem": target_problem,
        "updated_total_score": target_student["total_score"]
    }


@app.get("/grading/session/{session_id}/revisions")
async def get_revision_logs(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """수정 이력 조회"""
    db_record = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.id == session_id
    ).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    logs = db.query(models.ProblemRevisionLog).filter(
        models.ProblemRevisionLog.session_id == session_id
    ).order_by(models.ProblemRevisionLog.revised_at.desc()).all()

    result = []
    for log in logs:
        user = db.query(models.User).filter(models.User.id == log.revised_by).first()
        result.append({
            "id": log.id,
            "student_filename": log.student_filename,
            "problem_id": log.problem_id,
            "field_name": log.field_name,
            "partial_score_index": log.partial_score_index,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "revised_by_username": user.username if user else None,
            "revised_at": log.revised_at.isoformat(),
        })
    return result


@app.get("/grading/session/{session_id}/download")
async def download_excel(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = grading_sessions.get(session_id)
    results = []
    if session and session.status == "completed":
        results = session.results
    else:
        db_record = db.query(models.GradingSessionDB).filter(
            models.GradingSessionDB.id == session_id
        ).first()
        if not db_record or db_record.status != "completed":
            raise HTTPException(status_code=400, detail="채점이 완료되지 않았습니다")
        if db_record.results_json:
            results = [StudentResult(**r) for r in json.loads(db_record.results_json)]

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from services.notebook_service import parse_notebook

    def extract_name_and_id(nb_content: bytes):
        """노트북 첫 번째 셀에서 학번/이름 추출. 예: '# 학번 :20222500\n# 이름 :배대환'"""
        try:
            nb = parse_notebook(nb_content)
            if nb.cells:
                src = nb.cells[0].source if isinstance(nb.cells[0].source, str) else ''.join(nb.cells[0].source)
                student_id, name = "", ""
                for line in src.split('\n'):
                    line = line.strip().lstrip('#').strip()
                    if line.startswith('학번'):
                        student_id = line.split(':', 1)[-1].strip()
                    elif line.startswith('이름'):
                        name = line.split(':', 1)[-1].strip()
                return student_id, name
        except Exception:
            pass
        return "", ""


    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "채점결과"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    all_problem_ids = []
    if results:
        for r in results:
            for p in r.problems:
                if p.problem_id not in all_problem_ids:
                    all_problem_ids.append(p.problem_id)
    all_problem_ids.sort()

    # 헤더: 학번, 이름, 문제별 점수, 총점, 순위
    headers = ["학번", "이름"]
    for pid in all_problem_ids:
        problem = next((p for r in results for p in r.problems if p.problem_id == pid), None)
        max_s = problem.full_score if problem else 0
        # pid가 이미 "Q1" 형식이면 그대로, 아니면 앞에 Q 추가
        pid_str = str(pid) if str(pid).startswith('Q') else f"Q{pid}"
        headers.append(f"{pid_str} ({max_s}점)")
    headers.extend(["총점", "순위"])

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

    # 총점 기준 순위 계산
    score_list = [(i, s.total_score) for i, s in enumerate(results)]
    score_list.sort(key=lambda x: x[1], reverse=True)
    rank_map = {}
    for rank, (i, score) in enumerate(score_list, 1):
        # 동점 처리
        if rank > 1 and score == score_list[rank - 2][1]:
            rank_map[i] = rank_map[score_list[rank - 2][0]]
        else:
            rank_map[i] = rank

    for row_idx, (orig_idx, student) in enumerate([(i, s) for i, s in enumerate(results)], 2):
        ws.cell(row=row_idx, column=1, value=student.student_id)
        ws.cell(row=row_idx, column=2, value=student.student_name or "")
        col = 3
        for pid in all_problem_ids:
            p = next((p for p in student.problems if p.problem_id == pid), None)
            ws.cell(row=row_idx, column=col, value=p.obtained_score if p else 0)
            col += 1
        ws.cell(row=row_idx, column=col, value=student.total_score)
        ws.cell(row=row_idx, column=col + 1, value=rank_map[orig_idx])
        for c in range(1, len(headers) + 1):
            ws.cell(row=row_idx, column=c).border = thin_border
            ws.cell(row=row_idx, column=c).alignment = center_align

    # 열 너비 자동 조정
    for col in range(1, len(headers) + 1):
        max_len = max(
            len(str(ws.cell(row=r, column=col).value or ""))
            for r in range(1, len(results) + 2)
        )
        ws.column_dimensions[get_column_letter(col)].width = max(max_len + 4, 12)

    # 학번, 이름 열(A, B) 고정
    ws.freeze_panes = "C2"

    ws2 = wb.create_sheet("상세채점")
    detail_headers = ["학번", "이름", "문제", "채점항목", "최대점수", "획득점수", "피드백"]
    for col, h in enumerate(detail_headers, 1):
        cell = ws2.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

    row = 2
    for student in results:
        for problem in student.problems:
            for ps in problem.partial_scores:
                ws2.cell(row=row, column=1, value=student.student_id)
                ws2.cell(row=row, column=2, value=student.student_name or "")
                ws2.cell(row=row, column=3, value=f"Q{problem.problem_id}")
                ws2.cell(row=row, column=4, value=ps.item)
                ws2.cell(row=row, column=5, value=ps.max_score)
                ws2.cell(row=row, column=6, value=ps.score)
                ws2.cell(row=row, column=7, value=ps.reason)
                for c in range(1, 8):
                    ws2.cell(row=row, column=c).border = thin_border
                row += 1

    for col in range(1, 8):
        max_len = max(
            len(str(ws2.cell(r2, col).value or "")) for r2 in range(1, row)
        )
        ws2.column_dimensions[get_column_letter(col)].width = min(max_len + 4, 60)

    ws2.freeze_panes = "C2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=grading_results_{session_id[:8]}.xlsx"}
    )



@app.post("/rubric/parse-notebook")
async def parse_notebook_rubric(file: UploadFile = File(...)):
    """
    노트북 파일(.ipynb)의 마크다운 셀에서 문제를 읽어 JSON 루브릭으로 변환합니다.

    입력: .ipynb 파일
    - 마크다운 셀에 다음 형식으로 문제 작성:
      ## Q1. 문제 설명 (총점: 4점)
      1. 세부 조건 (1점)
      2. 세부 조건 (점수 표기 없음)

    파싱 결과: evaluation_guideline과 partial_score_criteria로 분류
    """
    try:
        from services.notebook_service import parse_notebook, extract_markdown_cells
        from utils.markdown_parser import parse_markdown_problems

        content = await file.read()
        nb = parse_notebook(content)
        markdown_text = extract_markdown_cells(nb)

        if not markdown_text.strip():
            raise ValueError("노트북에 마크다운 셀이 없거나 비어있습니다.")

        problems, global_guideline = parse_markdown_problems(markdown_text)

        exam_title = file.filename.replace(".ipynb", "").replace("_", " ")

        return {
            "exam_title": exam_title,
            "global_evaluation_guideline": global_guideline,
            "problems": problems
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파싱 오류: {str(e)}")


@app.post("/rubric/parse-markdown")
async def parse_markdown_rubric(file: UploadFile = File(...)):
    """
    마크다운 파일(.md)을 JSON 루브릭으로 변환합니다.

    입력 형식:
    ## Q1. 문제 설명 (총점: 4점)
    1. 세부 조건 (1점)
    2. 세부 조건 (점수 표기 없음)
    """
    try:
        from utils.markdown_parser import parse_markdown_problems

        content = await file.read()
        markdown_text = content.decode('utf-8')

        problems, global_guideline = parse_markdown_problems(markdown_text)

        return {
            "success": True,
            "filename": file.filename,
            "count": len(problems),
            "global_evaluation_guideline": global_guideline,
            "problems": problems
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파싱 오류: {str(e)}")


@app.post("/rubric/parse-markdown-text")
async def parse_markdown_text(text: str):
    """
    마크다운 텍스트를 JSON 루브릭으로 변환합니다. (텍스트 직접 입력)
    """
    try:
        from utils.markdown_parser import parse_markdown_problems

        problems, global_guideline = parse_markdown_problems(text)

        return {
            "success": True,
            "count": len(problems),
            "global_evaluation_guideline": global_guideline,
            "problems": problems
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파싱 오류: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── Admin ────────────────────────────────────────────────────────────────────

@app.get("/admin/stats")
async def admin_stats(
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """시스템 전체 통계."""
    from sqlalchemy import func

    total_users = db.query(models.User).count()
    total_sessions = db.query(models.GradingSessionDB).count()
    completed_sessions = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.status == "completed"
    ).count()
    running_sessions = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.status == "running"
    ).count()

    total_students_graded = db.query(func.sum(models.GradingSessionDB.processed_students)).scalar() or 0
    total_tokens_used = db.query(func.sum(models.GradingSessionDB.tokens_used)).scalar() or 0

    # 최근 7일 세션 수
    from datetime import datetime, timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sessions = db.query(models.GradingSessionDB).filter(
        models.GradingSessionDB.created_at >= week_ago
    ).count()

    # 사용자별 통계
    user_stats = []
    users = db.query(models.User).all()
    for u in users:
        session_count = db.query(models.GradingSessionDB).filter(
            models.GradingSessionDB.user_id == u.id
        ).count()
        subject_count = db.query(models.Subject).filter(
            models.Subject.user_id == u.id
        ).count()
        user_stats.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "sessions": session_count,
            "subjects": subject_count,
        })

    return {
        "total_users": total_users,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "running_sessions": running_sessions,
        "total_students_graded": total_students_graded,
        "total_tokens_used": total_tokens_used,
        "recent_sessions_7d": recent_sessions,
        "user_stats": user_stats,
    }


@app.get("/admin/users")
async def admin_list_users(
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """전체 사용자 목록."""
    users = db.query(models.User).order_by(models.User.created_at).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else "",
        }
        for u in users
    ]


@app.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    body: dict,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """사용자 역할 변경 / 비밀번호 초기화."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if "role" in body:
        if body["role"] not in ("admin", "professor", "ta", "student"):
            raise HTTPException(status_code=400, detail="유효하지 않은 역할입니다")
        user.role = body["role"]

    if "password" in body:
        if len(body["password"]) < 6:
            raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다")
        user.hashed_password = get_password_hash(body["password"])

    db.commit()
    return {"message": "사용자 정보가 업데이트되었습니다"}


@app.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """사용자 삭제."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="관리자 계정은 삭제할 수 없습니다")

    db.delete(user)
    db.commit()
    return {"message": "사용자가 삭제되었습니다"}


@app.get("/admin/settings")
async def admin_get_settings(
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """시스템 설정 조회."""
    settings = db.query(models.SystemSetting).all()
    result = {}
    for s in settings:
        # API 키는 마스킹하여 반환
        if "api_key" in s.key and s.value:
            masked = s.value[:8] + "..." + s.value[-4:] if len(s.value) > 12 else "***"
            result[s.key] = masked
        else:
            result[s.key] = s.value
    return result


@app.put("/admin/settings")
async def admin_update_settings(
    body: dict,
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """시스템 설정 업데이트."""
    allowed_keys = {"openai_api_key", "llm_model", "base_system_prompt", "max_upload_size_mb"}
    for key, value in body.items():
        if key not in allowed_keys:
            continue
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(models.SystemSetting(key=key, value=str(value)))

        # API 키가 변경되면 환경변수도 업데이트
        if key == "openai_api_key" and value:
            os.environ["OPENAI_API_KEY"] = str(value)

    db.commit()
    return {"message": "설정이 저장되었습니다"}


@app.get("/admin/sessions")
async def admin_list_sessions(
    admin=Depends(require_admin),
    db: Session = Depends(get_db)
):
    """전체 채점 세션 목록 (모든 사용자)."""
    records = (
        db.query(models.GradingSessionDB)
        .order_by(models.GradingSessionDB.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for r in records:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        result.append({
            "session_id": r.id,
            "username": user.username if user else "unknown",
            "subject_name": r.subject.name if r.subject else None,
            "status": r.status,
            "total_students": r.total_students,
            "processed_students": r.processed_students,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
    return result
