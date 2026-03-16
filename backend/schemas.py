from pydantic import BaseModel
from typing import Optional, List, Any


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class PartialScoreCriterion(BaseModel):
    item: str
    score: float


class Problem(BaseModel):
    problem_id: int
    full_score: float
    partial_score_criteria: List[PartialScoreCriterion]


class GradingCriteria(BaseModel):
    problems: List[Problem]


class PartialScoreResult(BaseModel):
    item: str
    max_score: float
    score: float
    reason: str


class NotebookCellOutput(BaseModel):
    output_type: str
    text: str


class NotebookCell(BaseModel):
    source: str
    outputs: List[NotebookCellOutput] = []


class ProblemResult(BaseModel):
    problem_id: int
    full_score: float
    obtained_score: float
    output_match: bool
    partial_scores: List[PartialScoreResult]
    ai_feedback: Optional[str] = None
    code_cells: List[NotebookCell] = []


class StudentResult(BaseModel):
    filename: str
    student_id: str
    total_score: float
    max_total_score: float
    problems: List[ProblemResult]
    error: Optional[str] = None


class GradingSession(BaseModel):
    session_id: str
    status: str  # "pending", "running", "completed", "error"
    progress: float  # 0-100
    current_student: Optional[str] = None
    total_students: int
    processed_students: int
    results: List[StudentResult]
    error: Optional[str] = None
