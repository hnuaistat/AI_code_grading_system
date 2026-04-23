# 프론트엔드 개발자 가이드

## 📁 프로젝트 구조

```
frontend/
├── public/
│   ├── index.html          👈 메인 HTML (제목, 언어 설정 가능)
│   └── favicon.ico
├── src/
│   ├── index.js            (React 진입점, 수정 금지)
│   ├── index.css           👈 글로벌 CSS (수정 가능)
│   ├── App.jsx             (라우팅, 인증 로직, 수정 금지)
│   ├── pages/              📄 페이지 컴포넌트들
│   │   ├── LoginPage.jsx    👈 로그인 페이지
│   │   ├── RegisterPage.jsx 👈 회원가입 페이지
│   │   ├── UploadPage.jsx   👈 채점 파일 업로드
│   │   ├── DashboardPage.jsx 👈 채점 결과 대시보드
│   │   └── HistoryPage.jsx  👈 채점 이력
│   ├── components/         🧩 재사용 가능한 컴포넌트
│   │   ├── ResultTable.jsx   (결과 테이블)
│   │   ├── StudentDetailModal.jsx (학생 상세 정보)
│   │   ├── StatsDashboard.jsx (통계 대시보드)
│   │   ├── FileDropzone.jsx  (파일 드래그-앤-드롭)
│   │   └── StepIndicator.jsx (진행도 표시)
│   └── services/
│       └── api.js          (백엔드 API 통신, 수정 금지)
├── package.json            (패키지 관리, 수정 금지)
└── .env                    (환경 변수 설정, 수정 금지)
```

---

## 🎨 수정 가능한 파일

### 1. **index.html** - 메인 페이지 설정
```html
<!-- public/index.html -->
<title>Jupyter 자동 채점 시스템</title>  <!-- 👈 제목 변경 가능 -->
<html lang="ko">  <!-- 👈 언어 변경 가능 -->
```

**수정 가능:**
- `<title>` - 브라우저 탭 제목
- `<meta>` 태그 - SEO, 설명
- 로고, 파비콘 경로

**수정 금지:**
- `<div id="root"></div>` - React 마운트 지점

---

### 2. **index.css** - 전역 스타일
```css
/* src/index.css */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;  /* 👈 배경색 변경 가능 */
  color: #1e293b;       /* 👈 기본 텍스트 색 변경 가능 */
}
```

**수정 가능:**
- 배경색, 텍스트 색
- 폰트 변경
- 전역 CSS 변수 추가
- 테마 색상 정의

**권장사항:**
```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #10b981;
  --danger-color: #ef4444;
  --border-color: #e2e8f0;
}
```

---

### 3. **페이지 (Pages)** - 각 페이지 레이아웃
각 페이지는 `styles` 객체로 인라인 스타일 정의:

```jsx
// src/pages/LoginPage.jsx 예시
const styles = {
  container: { ... },
  card: { ... },
  input: { ... },
  button: { ... }
};

// 이렇게 수정 가능:
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',  // 👈 변경 가능
  },
  // ...
};
```

**수정 가능:**
- 스타일 객체의 CSS 속성
- 레이아웃, 패딩, 마진, 색상

**수정 금지:**
- JSX 구조 (HTML 레이아웃)
- 함수 로직
- API 호출 관련 코드

---

### 4. **컴포넌트 (Components)** - 재사용 가능한 UI

#### ResultTable.jsx - 채점 결과 표
```jsx
// 수정 가능: 테이블 스타일, 컬럼 색상 등
const tableStyle = {
  borderCollapse: 'collapse',
  width: '100%',
  border: '1px solid #e2e8f0',
  // 색상 변경 가능
};
```

#### StudentDetailModal.jsx - 학생 상세정보 팝업
```jsx
// 수정 가능: 모달 배경색, 버튼 색상, 폰트 등
const modalStyle = {
  backgroundColor: '#ffffff',  // 👈 변경 가능
  borderRadius: '8px',
};
```

#### StatsDashboard.jsx - 통계 대시보드
```jsx
// 수정 가능: 카드 배경, 텍스트 색, 그래프 색상 등
```

#### FileDropzone.jsx - 파일 드래그 영역
```jsx
// 수정 가능: 드롭존 배경색, 테두리, 아이콘 등
```

#### StepIndicator.jsx - 진행도 표시
```jsx
// 수정 가능: 스텝 색상, 아이콘, 텍스트 등
```

---

## 🚫 수정 금지 파일

### api.js - 백엔드 통신
```javascript
// src/services/api.js - 절대 수정 금지!
// 백엔드 API 엔드포인트를 정의합니다
const authAPI = {
  login: (username, password) => axios.post('/api/auth/login', ...),
  register: (username, password) => axios.post('/api/auth/register', ...),
};
```

### App.jsx - 라우팅 및 인증
```jsx
// src/App.jsx - 절대 수정 금지!
// - 페이지 라우팅 설정
// - 인증 로직 (로그인/로그아웃)
// - 토큰 관리
```

### 각 페이지의 로직 부분
```jsx
// 🚫 금지: 함수 로직, API 호출, 상태 관리
const handleSubmit = async (e) => { ... }  // 금지
const [user, setUser] = useState(null);    // 금지

// ✅ 가능: 스타일 객체
const styles = { ... }  // 가능
```

---

## 🎯 주요 수정 사례

### 1️⃣ 색상 테마 변경

**전역 색상 변경 (index.css):**
```css
body {
  background: linear-gradient(to bottom, #f0f4f8, #d9e2ec);
  color: #2d3748;
}
```

**개별 페이지 색상 (LoginPage.jsx):**
```jsx
const styles = {
  container: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  button: {
    backgroundColor: '#667eea',
    hover: '#5568d3',
  },
};
```

### 2️⃣ 폰트 변경

```css
/* index.css */
body {
  font-family: 'Noto Sans KR', -apple-system, sans-serif;
}
```

### 3️⃣ 버튼 스타일 변경

```jsx
const styles = {
  button: {
    padding: '12px 24px',
    backgroundColor: '#10b981',  // 초록색
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
};
```

### 4️⃣ 반응형 디자인 추가

```jsx
const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
};
```

---

## 📱 현재 페이지 목록

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 로그인 | `/login` | 평가자 로그인 |
| 회원가입 | `/register` | 새 평가자 계정 생성 |
| 채점 업로드 | `/upload` | 채점할 학생 코드 업로드 |
| 채점 대시보드 | `/dashboard/:sessionId` | 채점 결과 및 통계 |
| 채점 이력 | `/history` | 과거 채점 세션 목록 |

---

## 🔗 컴포넌트별 수정 가이드

### ResultTable - 테이블 커스터마이징
```jsx
// 수정 가능
const headerStyle = {
  backgroundColor: '#3b82f6',  // 헤더 배경색
  color: 'white',
  padding: '12px',
  fontWeight: 'bold',
};

const rowStyle = {
  borderBottom: '1px solid #e2e8f0',
  padding: '10px',
};

// 수정 금지
// - 테이블 데이터 출력 로직
// - API 데이터 처리
```

### StatsDashboard - 통계 카드 스타일
```jsx
const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  // 👈 색상, 패딩, 그림자 변경 가능
};
```

---

## 🚀 개발 프로세스

### 로컬 실행
```bash
cd frontend
npm install
npm start  # localhost:3000
```

### 파일 수정 후
1. 파일 저장 (Ctrl+S)
2. 브라우저 자동 새로고침 (HMR)
3. 변경사항 확인

### 빌드 (배포 전)
```bash
npm run build  # build/ 폴더 생성
```

---

## ❓ 자주 묻는 질문

**Q: 페이지 로직을 수정하고 싶어요**
A: 로직 수정은 불가합니다. 스타일만 변경하세요.

**Q: 새로운 페이지를 추가하고 싶어요**
A: App.jsx의 라우팅을 수정해야 하므로 백엔드 팀과 협력하세요.

**Q: API 응답 데이터 형식이 이상해요**
A: api.js 수정이 아니라 백엔드 팀에 보고하세요.

**Q: CSS 프레임워크(Bootstrap, Tailwind)를 추가하고 싶어요**
A: package.json 수정 필요하므로 팀과 상의 후 진행하세요.

---

## 📞 문의

- **스타일/CSS 문제**: 프론트엔드 담당자
- **페이지 구조/기능 추가**: 팀 리더와 상의
- **백엔드/API 문제**: 백엔드 팀
