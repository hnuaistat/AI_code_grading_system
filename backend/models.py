from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
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
