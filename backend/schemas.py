from pydantic import BaseModel
from typing import Optional, List, Any, Union


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class SubjectItemResponse(BaseModel):
    id: int
    name: str
    created_at: str


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None


class SubjectResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    session_count: int = 0
    items: List[SubjectItemResponse] = []
    created_at: str


class SubjectItemCreate(BaseModel):
    name: str


class HistorySessionItem(BaseModel):
    session_id: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_item_id: Optional[int] = None
    subject_item_name: Optional[str] = None
    status: str
    total_students: int
    processed_students: int
    created_at: str
    completed_at: Optional[str] = None


class PartialScoreCriterion(BaseModel):
    item: str
    score: float


class Problem(BaseModel):
    problem_id: Union[int, str]
    full_score: float
    partial_score_criteria: List[PartialScoreCriterion]
    evaluation_guideline: Optional[str] = None


class GradingCriteria(BaseModel):
    problems: List[Problem]
    global_evaluation_guideline: Optional[str] = None
    exam_title: Optional[str] = None


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
    problem_id: Union[int, str]
    full_score: float
    obtained_score: float
    output_match: bool
    partial_scores: List[PartialScoreResult]
    ai_feedback: Optional[str] = None
    code_cells: List[NotebookCell] = []
    problem_description: Optional[str] = None


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
