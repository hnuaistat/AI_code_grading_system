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
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    subject = relationship("Subject", back_populates="sessions")
