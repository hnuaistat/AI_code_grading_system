# 과목 단위 협업(조교 초대) 기능 설계

> 아직 구현 전 — 설계 문서. 나중에 "docs/collaborator-invite-design.md 대로 구현해줘"라고 요청하면 됨.
>
> 줄 번호는 `30ee7e01`(설정 화면 개인정보 수정) 기준. 코드가 바뀌면 어긋날 수 있으니
> 라우트는 줄 번호가 아니라 데코레이터 문자열로 찾을 것.

## Context

실사용자(교수)로부터 나온 요청: 조교가 채점한 결과를 압축파일 등으로 전달받아 교수 본인 계정에 "업로드"해서 볼 수 있게 해달라는 것. 하지만 현재 시스템은 채점 결과를 다시 업로드해 반영하는 import 기능이 전혀 없고, 파일 기반 이관 방식은 (1) 조교가 재채점하면 즉시 어긋나는 동기화 문제, (2) 소유권 이전 시 조교 쪽 이력이 사라지는 문제, (3) "파일 왕복"이라는 번거로움 자체가 없어지지 않는 문제가 있음.

대안으로 **과목(Subject) 단위 공유/초대** 방식을 채택. 교수가 과목을 만들고 조교를 초대하면, 파일 이동 없이 같은 데이터(과목의 모든 채점 세션)를 양쪽이 실시간으로 보고 조작할 수 있음. 사용자와 논의해 다음 네 가지로 확정:
- 공유 범위: **과목 단위** (세션 단위 아님)
- 초대 방식: **기존 가입자를 아이디/이메일로 검색해 추가** (이메일 발송 인프라 불필요)
- 권한: **협업자도 채점/수정/재채점 가능** (읽기 전용 아님)
- **초대는 일방적으로 즉시 반영되지 않고, 초대받은 사람이 수락(accept)/거절(deny)해야 함** — 본인 동의 없이 남의 계정이 과목에 묶이는 걸 방지. 수락 전까지는 "대기 중" 상태로 초대한 사람 쪽에만 보이고, 초대받은 사람의 과목 목록에는 나타나지 않음.

코드 조사 결과, `role` enum에는 이미 `"ta"`가 정의돼 있고 AdminPage UI에도 이미 선택지와 색상까지 있으나 어떤 권한 로직에서도 실사용되지 않는 죽은 코드였음. 반면 소유권 검사는 전체 코드베이스에서 `Subject.user_id == current_user["id"]` / `GradingSessionDB.user_id == current_user["id"]` 패턴이 반복되는 이진 구조. 이번 작업은 이 패턴을 "소유자 OR 과목 협업자"로 확장하는 것이 핵심이며, `role` 값 자체와는 독립적으로 설계한다 (조교 역할이 아니어도 다른 교수의 과목에 협업자로 초대될 수 있어야 자연스러움 — 예: 같은 과목을 여러 교수가 나눠 가르치는 경우).

## 데이터 모델 변경

`backend/models.py`에 다대다 협업 테이블 신설. 현재 import 줄에 `UniqueConstraint`가
없으므로 (`from sqlalchemy import Column, Integer, ...`) **함께 추가해야 한다** — 빠뜨리면
`NameError`로 서버가 뜨지 않는다.

새 테이블은 startup의 `models.Base.metadata.create_all`(main.py:176)이 자동 생성한다.
`_migrate_add_columns`는 기존 테이블에 컬럼을 더하는 용도라 여기엔 손댈 필요 없다.

```python
class SubjectCollaborator(Base):
    __tablename__ = "subject_collaborators"
    __table_args__ = (UniqueConstraint("subject_id", "user_id", name="uq_subject_collaborator"),)

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # "pending" | "accepted" | "declined"
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    subject = relationship("Subject", back_populates="collaborators")
    user = relationship("User", foreign_keys=[user_id])
```

`Subject`에 `collaborators = relationship("SubjectCollaborator", back_populates="subject", cascade="all, delete-orphan")` 추가.

권한 레벨 컬럼은 만들지 않음 (현재 요구사항은 "채점 가능" 단일 등급). 나중에 "보기 전용" 같은 세분화가 필요해지면 `permission` 컬럼을 추가하는 방식으로 확장.

**초대 상태(status) 흐름**: 소유자가 초대 → `status="pending"` 레코드 생성 → 초대받은 사람이 수락하면 `status="accepted"` (+ `responded_at` 기록), 거절하면 `status="declined"`. **접근 권한 검사(`_can_access_subject`, `_accessible_subject_ids`)는 반드시 `status="accepted"`인 레코드만 인정한다** — pending/declined 상태로는 과목에 접근 불가.

## 백엔드 변경

**공용 헬퍼 추가** (`main.py`, 기존 라우트들 위쪽에 위치):

```python
def _accessible_subject_ids(user_id: int, db: Session):
    owned = db.query(models.Subject.id).filter(models.Subject.user_id == user_id)
    shared = db.query(models.SubjectCollaborator.subject_id).filter(
        models.SubjectCollaborator.user_id == user_id,
        models.SubjectCollaborator.status == "accepted",
    )
    return owned.union(shared)

def _can_access_subject(subject: models.Subject, user_id: int, db: Session) -> bool:
    if subject.user_id == user_id:
        return True
    return db.query(models.SubjectCollaborator).filter(
        models.SubjectCollaborator.subject_id == subject.id,
        models.SubjectCollaborator.user_id == user_id,
        models.SubjectCollaborator.status == "accepted",
    ).first() is not None
```

**기존 라우트 수정** — 반복되는 `Subject.user_id == current_user["id"]` 단독 필터를 `_accessible_subject_ids` 서브쿼리로 교체:
- `GET /subjects` (main.py:524) — 목록에 공유받은 과목도 포함
- `GET /subjects/{subject_id}`(567), `POST /subjects/{subject_id}/items`(594), `PUT /subjects/{subject_id}`(615), `PUT/DELETE /subjects/{subject_id}/items/{item_id}`(643/671) — 조회 후 `_can_access_subject`로 검사. 단, 과목 자체의 이름/코드 수정과 삭제는 소유자만 가능하도록 유지하고, "항목(items) 추가/채점 관련 조작"만 협업자에게 허용 — 이 구분은 라우트별로 소유자 전용 여부를 명시해 아래 표로 정리.

| 라우트 | 협업자 허용 여부 |
|---|---|
| `GET /subjects`, `GET /subjects/{id}` | 허용 (조회) |
| `POST /subjects/{id}/items` (세부 항목 추가) | 허용 |
| `PUT /subjects/{id}` (과목명/코드 수정) | 소유자만 |
| `PUT/DELETE /subjects/{id}/items/{item_id}` | 허용 |
| `POST /grading/start` (해당 subject_id로 채점 시작) | 허용 |
| `GET /grading/history` | 소유 세션 + 협업 과목의 세션 모두 표시 |
| `GET /grading/session/{id}/results` (1656) | 소유자 or 협업자 or admin — **현재 소유권 검사가 아예 없다.** 세션 ID만 알면 아무나 남의 채점 결과를 읽을 수 있으므로 이번에 함께 잠근다 |
| `GET /grading/session/{id}/download` (2090) | 소유자 or 협업자 or admin — 소유자+admin 검사는 이미 있음(2105). 협업자 조건만 추가 |
| `PATCH /grading/session/{id}/revise`(1926), `/subject-item`(1547) | 소유자 or 협업자 or admin |
| `POST /grading/session/{id}/regrade` (1586) | 소유자 or 협업자 or admin |
| `POST /grading/session/{id}/upload-preview`(2615), `/upload-apply`(2657) | 소유자 or 협업자 or admin — 엑셀 왕복 점수 수정(`5cf8488d`). `revise`와 같은 성격의 점수 변경이라 동일 취급 |
| `POST /grading/session/{id}/cancel`(1676), `DELETE /grading/session/{id}`(1715) | 소유자 or admin만 (파괴적 동작은 협업자 제외, 보수적으로 시작) |

**신규 엔드포인트** (`main.py`, Subjects 섹션 하단에 추가):

```
GET    /subjects/{subject_id}/collaborators            # 협업자 목록 (소유자만, status 무관 전체 표시)
POST   /subjects/{subject_id}/collaborators             # {identifier} 로 검색 후 초대 생성 (소유자만) → status="pending"
DELETE /subjects/{subject_id}/collaborators/{user_id}   # 제거/초대 취소 (소유자만)

GET    /me/invitations                                  # 내가 받은 초대 중 status="pending" 목록 (본인 것만)
POST   /me/invitations/{collaborator_id}/accept          # 수락 → status="accepted", responded_at 기록
POST   /me/invitations/{collaborator_id}/decline         # 거절 → status="declined", responded_at 기록
```

`POST /subjects/{id}/collaborators`는 대상 유저를 `models.User`에서 `username == X or email == X`로 조회 → 없으면 404 "사용자를 찾을 수 없습니다" → 이미 소유자 본인이면 400 → 이미 `pending`/`accepted` 레코드가 있으면 400 "이미 초대되었거나 참여 중인 사용자입니다" (단, `declined`였던 경우는 재초대 허용 — 기존 행의 status를 다시 "pending"으로 되돌리고 `responded_at`을 초기화).

`/me/invitations/*` 엔드포인트는 `current_user["id"] == collaborator.user_id`인지 반드시 검사 (본인에게 온 초대만 응답 가능).

**schemas.py** 추가: `CollaboratorAdd(BaseModel): identifier: str`, `CollaboratorResponse(BaseModel): id, username, email, role, status, invited_by, created_at`, `InvitationResponse(BaseModel): id, subject_id, subject_name, subject_code, invited_by_username, created_at`.

## 프론트엔드 변경

- `frontend/src/services/api.js`의 `subjectAPI`에 `getCollaborators`, `addCollaborator`, `removeCollaborator` 3개 추가. 별도 `invitationAPI`로 `list`, `accept`, `decline` 3개 추가.
- `UploadPage.jsx`의 과목 선택 카드(`s.subjectCard`, 약 930번째 줄) 옆에 "👥 공유" 버튼 추가 → 클릭 시 협업자 목록(상태 배지: 대기중/수락됨) + 아이디/이메일 입력창이 있는 작은 패널/모달 표시. 기존 `editingSubject`, `showNewSubject` 폼과 동일한 인라인 패턴(`s.newSubjectForm`) 재사용.
- 협업자 관리 UI는 **과목 소유자에게만** 노출 (`selectedSubject.owner_id === user.id` 또는 백엔드가 내려주는 `is_owner` 플래그로 판단 — `GET /subjects` 응답에 `is_owner: bool` 필드 추가 필요).
- **초대 수락/거절 UI**: `AppLayout.jsx`(공통 사이드바/헤더)에 알림 아이콘 또는 배지 추가 — 로그인 시 `invitationAPI.list()`로 대기 중인 초대 확인, 있으면 배지 표시. 클릭 시 "OO 교수님이 'XX과목'에 초대했습니다 — 수락 / 거절" 형태의 작은 드롭다운/모달. 기존 알림 관련 코드(`services/notify.js`, SettingsPage의 알림 섹션)와 유사한 패턴이 있다면 참고. 수락하면 해당 과목이 즉시 과목 목록에 나타나야 하므로 수락 후 `subjectAPI.list()` 재조회.
- HistoryPage는 백엔드가 이미 공유 세션을 합쳐서 내려주므로 별도 변경 불필요. 다만 "내가 채점한 것"과 "공유받아 보이는 것"을 구분하고 싶다면 세션 응답에 `is_shared: bool` 정도만 추가 고려 (필수는 아님, 우선 없이 시작).

## 구현 순서

1. `models.py`: `UniqueConstraint` import 추가 + `SubjectCollaborator`(status 포함) + `Subject.collaborators` relationship
2. `schemas.py`: `CollaboratorAdd`, `CollaboratorResponse`, `InvitationResponse` 추가
3. `main.py`: `_accessible_subject_ids`, `_can_access_subject` 헬퍼 추가 (status="accepted" 필터 포함)
4. `main.py`: 위 표에 따라 기존 라우트 필터 교체 (과목 6곳 + 채점 세션 9곳). `results`는 검사 자체를 신설하는 것이므로 다른 라우트의 소유권 검사 패턴을 그대로 따를 것
5. `main.py`: 협업자 CRUD 엔드포인트 3개 + 초대 목록/수락/거절 엔드포인트 3개 신설
6. `services/api.js`: `subjectAPI`에 협업자 관련 함수 3개, `invitationAPI` 신설
7. `UploadPage.jsx`: 협업자 관리 UI(패널) 추가, `GET /subjects` 응답의 `is_owner` 반영
8. `AppLayout.jsx`: 초대 알림 배지 + 수락/거절 UI 추가

## 검증 방법

- 백엔드: 교수 A 계정으로 과목 생성 → 조교 B 계정을 아이디로 검색해 초대 생성 (`status="pending"`) → **이 시점에 B의 `GET /subjects`에는 과목이 보이지 않아야 함** → B가 `GET /me/invitations`로 초대 확인 후 `POST /me/invitations/{id}/accept` 호출 → 그제서야 B의 `GET /subjects`에 과목이 나타나고 `POST /grading/start`로 채점 가능한지 확인.
- 거절 케이스: 다른 초대를 B가 decline 처리 → 이후 `GET /subjects`, `POST /grading/start` 등 모든 접근이 여전히 막히는지 확인.
- B가 채점한 세션이 A의 `GET /grading/history`에도 나타나는지 확인 (진짜 공유가 되는지의 핵심 검증).
- 협업자가 아닌 제3의 계정 C로 같은 과목의 `results`/`download`/`upload-apply`를 호출했을 때 403/404로 막히는지 확인 (`results`는 이번에 처음 잠기는 것이므로 반드시 확인).
- 프론트: 실제로 브라우저에서 두 계정으로 로그인해 A가 B를 초대 → B 쪽에 알림 배지가 뜨는지 → B가 수락하면 과목이 나타나는지 → 채점 후 서로의 히스토리에 반영되는지 눈으로 확인.
