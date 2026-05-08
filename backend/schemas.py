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
    requires_code: bool = True  # 코드 필수 여부 (기본값: True)


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
    image: Optional[str] = None  # base64 인코딩된 이미지 (image/png)


class NotebookCell(BaseModel):
    source: str
    outputs: List[NotebookCellOutput] = []
    cell_type: str = "code"
    is_student_answer: bool = False  # **[...]** 형식의 학생 답변 셀 여부


class ProblemResult(BaseModel):
    problem_id: Union[int, str]
    full_score: float
    obtained_score: float
    output_match: bool
    partial_scores: List[PartialScoreResult]
    ai_feedback: Optional[str] = None
    code_cells: List[NotebookCell] = []
    preamble_cells: List[NotebookCell] = []
    problem_description: Optional[str] = None
    professor_feedback: Optional[str] = None
    is_revised: bool = False
    revised_at: Optional[str] = None
    has_ai_error: bool = False  # AI 채점 오류 여부


class StudentResult(BaseModel):
    filename: str
    student_id: str
    student_name: Optional[str] = None  # 노트북의 "# 이름" 셀에서 추출
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


class ProblemRevisionRequest(BaseModel):
    """교수의 점수/피드백 수정 요청"""
    student_filename: str
    problem_id: Union[int, str]
    obtained_score: Optional[float] = None
    professor_feedback: Optional[str] = None
    partial_scores: Optional[List[PartialScoreResult]] = None


class RevisionLogItem(BaseModel):
    id: int
    student_filename: str
    problem_id: str
    field_name: str
    partial_score_index: Optional[int] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    revised_by_username: Optional[str] = None
    revised_at: str
