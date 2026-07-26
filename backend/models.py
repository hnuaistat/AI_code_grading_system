from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="professor")
    created_at = Column(DateTime, default=datetime.utcnow)

    # 프로필 — 기존 계정 호환을 위해 nullable. 전원 입력 완료 후 NOT NULL 전환 가능
    name = Column(String(50), nullable=True)
    school = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)

    # 동의 이력 — 분쟁 시 동의 사실 입증 책임이 운영자에게 있으므로 시각을 남긴다.
    # NULL = 미동의. notify는 선택 항목이라 NULL이 정상 상태
    terms_agreed_at = Column(DateTime, nullable=True)
    privacy_agreed_at = Column(DateTime, nullable=True)
    notify_agreed_at = Column(DateTime, nullable=True)

    # 프로필 보완 팝업 "나중에 하기" 시각. 7일 경과 시 재노출
    profile_prompt_dismissed_at = Column(DateTime, nullable=True)

    subjects = relationship("Subject", back_populates="owner", cascade="all, delete-orphan")
    sessions = relationship("GradingSessionDB", back_populates="user")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="subjects")
    sessions = relationship("GradingSessionDB", back_populates="subject")
    items = relationship("SubjectItem", back_populates="subject", cascade="all, delete-orphan")
    collaborators = relationship(
        "SubjectCollaborator", back_populates="subject", cascade="all, delete-orphan"
    )


class SubjectCollaborator(Base):
    """과목 공동 작업자. 초대받은 사람이 수락해야 실제 접근 권한이 생긴다.

    권한 등급 컬럼은 두지 않는다 — 현재 요구사항은 "채점 가능" 단일 등급이고,
    세분화가 필요해지면 permission 컬럼을 더하는 방식으로 확장한다.
    """
    __tablename__ = "subject_collaborators"
    __table_args__ = (UniqueConstraint("subject_id", "user_id", name="uq_subject_collaborator"),)

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending | accepted | declined
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    subject = relationship("Subject", back_populates="collaborators")
    user = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])


class SubjectItem(Base):
    __tablename__ = "subject_items"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="items")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GradingSessionDB(Base):
    __tablename__ = "grading_sessions_db"

    id = Column(String(36), primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    subject_item_id = Column(Integer, ForeignKey("subject_items.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="pending")
    progress = Column(Float, default=0.0)
    total_students = Column(Integer, default=0)
    processed_students = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    results_json = Column(Text, nullable=True)
    tokens_used = Column(Integer, default=0)
    grading_model = Column(String(200), nullable=True)  # 채점에 사용된 모델 (예: openai/gpt-4o-mini)
    criteria_json = Column(Text, nullable=True)          # 재채점용: 채점 시작 시 루브릭 원본
    answer_problems_json = Column(Text, nullable=True)   # 재채점용: 문항별 정답 데이터 (이미지 제외)
    regraded_from = Column(String(36), nullable=True)    # 재채점 원본 세션 id (루트 세션 기준)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    subject = relationship("Subject", back_populates="sessions")


class ProblemRevisionLog(Base):
    """교수의 점수/코멘트 수정 이력 추적"""
    __tablename__ = "problem_revision_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("grading_sessions_db.id"), nullable=False, index=True)
    student_filename = Column(String(255), nullable=False)
    problem_id = Column(String(50), nullable=False)
    field_name = Column(String(50), nullable=False)  # "obtained_score", "professor_feedback", "partial_score"
    partial_score_index = Column(Integer, nullable=True)  # partial_scores 수정 시 인덱스
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    revised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    revised_at = Column(DateTime, default=datetime.utcnow)
