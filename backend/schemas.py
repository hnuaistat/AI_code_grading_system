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
    name: str
    role: str = "professor"          # 1단계 가입 유형: professor | ta
    school: Optional[str] = None      # 선택
    department: Optional[str] = None  # 선택
    phone: Optional[str] = None       # 선택 — 알림 수신 동의 시에만 저장

    # 2단계 약관 동의 (필수 2 / 선택 1)
    agree_terms: bool = False
    agree_privacy: bool = False
    agree_notify: bool = False


class ProfileCompleteRequest(BaseModel):
    """기존 계정용 프로필 보완 — 팝업에서 이름 + 미동의 약관을 함께 받는다."""
    name: str
    school: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    agree_terms: bool = False
    agree_privacy: bool = False
    agree_notify: bool = False


class UpdateEmailRequest(BaseModel):
    email: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


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


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


class SubjectItemUpdate(BaseModel):
    name: str


class SessionSubjectItemUpdate(BaseModel):
    """채점 완료된 세션의 세부 항목 변경 (이름으로 찾거나 없으면 생성, 빈 문자열이면 해제)"""
    subject_item_name: str = ""


class RegradeRequest(BaseModel):
    """저장된 입력(루브릭+정답+학생 데이터)으로 다른 모델 재채점"""
    grading_model: str


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
    keywords: Optional[List[str]] = None


class DecomposeRequest(BaseModel):
    item: str
    problem_context: Optional[str] = None


class DecomposedItem(BaseModel):
    item: str
    keywords: List[str] = []


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
    has_partial_score: bool = False  # 부분점수 항목 포함 여부 (0 < score < max_score)


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


# ── 엑셀 왕복 수정 (다운로드 → 수정 → 업로드 → 반영) ────────────────────────

class ExcelRevisionChange(BaseModel):
    """엑셀에서 감지된 변경 1건 (미리보기 표시 단위)"""
    row_key: str
    excel_row: int
    student_index: int
    student_filename: str
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    problem_id: str
    partial_score_index: int          # -1 = 세부 항목이 없는 문제의 전체 점수
    item_name: Optional[str] = None
    field: str                        # "score" | "professor_feedback"
    old_value: Optional[str] = None   # DB의 현재값
    new_value: Optional[str] = None
    max_score: Optional[float] = None


class ExcelRevisionError(BaseModel):
    """반영할 수 없는 행. 해당 행만 제외하고 나머지는 반영한다."""
    excel_row: int
    row_key: Optional[str] = None
    message: str


class ExcelPreviewResponse(BaseModel):
    preview_id: str
    session_id: str
    is_stale: bool = False            # 다운로드 이후 웹에서 점수가 바뀜
    changes: List[ExcelRevisionChange] = []
    errors: List[ExcelRevisionError] = []
    warnings: List[str] = []
    affected_students: int = 0
    affected_problems: int = 0
    expires_at: str


class ExcelApplyRequest(BaseModel):
    preview_id: str


class ExcelApplyResponse(BaseModel):
    success: bool
    revisions_count: int
    affected_students: int
