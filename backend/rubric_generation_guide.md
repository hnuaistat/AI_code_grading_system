# 루브릭 작성 가이드라인

AI 채점을 위한 루브릭은 **구체성**이 가장 중요합니다. AI가 학생의 코드나 실행 결과에서 직접 찾을 수 있어야 합니다.

---

## 📋 JSON 출력 형식

반드시 아래 구조를 따라 루브릭을 생성하세요:

```json
{
    "exam_title": "시험 제목",
    "global_evaluation_guideline": "모든 문항에 공통 적용되는 채점 원칙",
    "problems": [
        {
            "problem_id": "Q1",
            "full_score": 배점,
            "evaluation_guideline": "이 문항의 핵심 요구사항 한 문장 요약",
            "partial_score_criteria": [
                {"item": "구체적인 채점 항목 설명", "score": 점수}
            ]
        }
    ]
}
```

---

## 🎯 핵심 원칙

### 1️⃣ **구체적인 파라미터명 명시**

❌ **나쁜 예:**
```json
"item": "그래프 크기를 설정할 것"
"item": "적절한 색상을 사용할 것"
"item": "필요한 파라미터를 설정할 것"
```
→ AI가 뭘 찾아야 하는지 모호함

✅ **좋은 예:**
```json
"item": "plt.figure(figsize=(8, 5))로 그래프 크기 설정"
"item": "color='pink' 파라미터로 색상 설정"
"item": "bins=15, alpha=0.5, edgecolor='navy' 파라미터 설정"
```
→ AI가 코드에서 직접 찾을 수 있음

---

### 2️⃣ **코드 문법 수준으로 작성**

❌ **나쁜 예:**
```json
"item": "seaborn을 불러오기"
"item": "1행 2열로 그래프 배치"
"item": "흰색 스타일 적용"
```

✅ **좋은 예:**
```json
"item": "import seaborn as sns로 seaborn 라이브러리 불러오기"
"item": "plt.subplots(1, 2) 또는 fig, axes = plt.subplots(1, 2) 사용"
"item": "sns.set_theme(style='white') 또는 sns.set_style('white') 설정"
```

---

### 3️⃣ **함수명 + 파라미터 명시**

❌ **나쁜 예:**
```json
"item": "히스토그램으로 그래프 표시"
"item": "밀도 추정선 추가"
```

✅ **좋은 예:**
```json
"item": "plt.hist() 또는 sns.histplot()으로 히스토그램 그리기"
"item": "kde=True 파라미터로 밀도 추정선 추가"
```

---

## 📝 작성 규칙

### 0. 문제 설명(Markdown) 파싱 규칙 (최우선 적용)

문항의 `[문제 설명]` 텍스트에 교수님이 설정한 배점이나 세부 조건이 있다면 **반드시 100% 반영**해야 합니다.
- **총점 파싱:** 문제 제목이나 설명 끝에 `(총점: N점)` 또는 `[총점: N점]` 형태가 있다면, 해당 문항의 `full_score`를 그 점수로 설정하세요.
- **부분 점수(Partial) 할당:** `- 조건 A (1점)` 처럼 설명의 문장이나 글머리 기호 맨 끝에 점수가 명시된 항목은 추출하여 `partial_score_criteria` 배열에 개별 항목으로 넣고, 명시된 배점을 `score`에 할당하세요.
- **일반 평가(Evaluation) 추출:** 끝에 점수 표기가 없는 조건(예: `- matplotlib 라이브러리 사용`)은 `evaluation_guideline`에 핵심 요구사항으로 통합하여 요약하세요.

---

### 1. global_evaluation_guideline (전체 공통 기준)

모든 문항에 적용되는 원칙을 작성합니다.

**예시:**
```
모든 문항 공통: 학생의 코드에서 런타임 에러(Exception)가 발생하는 경우,
해당 문항은 부분 점수 없이 무조건 0점 처리하세요. 에러 없이 정상 실행되고
요구되는 결과값을 출력한다면 구현 방식에 관계없이 만점을 부여합니다.
```

### 2. evaluation_guideline (문항별 요약)

해당 문항이 요구하는 핵심 과제를 **한 문장**으로 요약합니다.
- 정답 코드에서 최종 목적(무엇을 구현/출력해야 하는지)을 추출
- 구현 세부사항이 아닌 결과 목표 중심으로 작성

### 3. partial_score_criteria (부분 점수 항목) — 가장 중요

**두 가지 방식으로 구성할 수 있습니다:**

#### 📌 방식 1: 세부 채점 항목 명시 (시각화, 파라미터 세팅 등)

정답 코드에서 검증 가능한 개별 요소를 추출하여 항목별로 나눕니다.

```json
"partial_score_criteria": [
    {"item": "plt.figure(figsize=(8, 5))로 그래프 크기 설정", "score": 1},
    {"item": "bins=15, alpha=0.5, edgecolor='navy' 파라미터 설정", "score": 1},
    {"item": "color='pink' 파라미터로 색상 설정", "score": 1}, 
    {"item": "변수 누락", "score": 0.5}
]
```

**항목 작성 원칙:**
- 함수명을 반드시 명시: `plt.figure()`, `sns.histplot()`, `pd.merge()` 등
- 파라미터명과 값을 명시: `figsize=(8, 5)`, `bins=15`, `kde=True`
- 대체 표현 허용: 같은 결과를 내는 다른 방법이 있으면 "또는"으로 병기
  - 예: "plt.subplots(1, 2) 또는 fig, axes = plt.subplots(1, 2) 사용"
- 모호한 표현 금지: "적절하게", "올바르게", "정상적으로" 같은 단어 사용 금지

**이 방식을 선택하는 기준:**
- 시각화 문항 (matplotlib, seaborn 등)
- 특정 함수/파라미터 사용이 명확한 경우
- 구현 방법이 제한적인 경우

#### 📌 방식 2: 배열 비우기 (결과 기반 평가)

세부 항목을 명시하지 않으면, AI가 **출력 결과에 기반하여 자율적으로 점수를 부여**합니다.
감점시 왜 감점인지, 득점이면 왜 득점인지 채점 점수를 부여한 타당한 이유를 작성합니다. 

```json
"partial_score_criteria": []
```

**이 방식을 선택하는 기준:**
- 결측치 탐색, 데이터 정렬, 조건 필터링 등 결과값으로 정오를 판단할 수 있는 문항
- 구현 방법이 다양하여 특정 함수/파라미터를 강제할 수 없는 문항
- 문항 배점이 하나의 덩어리로 부여되는 것이 자연스러운 경우

⚠️ **중요: partial_score_criteria가 비어있으면 자동으로 AI 자율 평가로 처리됩니다**

---

### 4. 배점 규칙

- 소수점 배점 허용 (0.5 단위)
- **명시 항목의 점수 합계 < full_score인 경우:** AI가 나머지 배점을 자동으로 판단
  - 예: full_score=10, 명시 항목 합계=6 → 남은 4점은 AI가 코드 품질로 평가

---

## 📋 실제 작성 예시

### ❌ **개선 전 (모호함)**

```json
{
    "problem_id": "Q6",
    "full_score": 5,
    "partial_score_criteria": [
        {"item": "그래프 크기를 설정할 것", "score": 1},
        {"item": "한 셀에 그래프 하나씩", "score": 1},
        {"item": "필수 파라미터 설정", "score": 1},
        {"item": "올바른 색상 사용", "score": 1},
        {"item": "라벨 표시", "score": 1}
    ]
}
```
→ 각 항목이 모호해서 AI가 판단하기 어려움

---

### ✅ **개선 후 (명확함)**

```json
{
    "problem_id": "Q6",
    "full_score": 5,
    "partial_score_criteria": [
        {
            "item": "plt.figure(figsize=(8, 5))로 그래프 크기 설정",
            "score": 1
        },
        {
            "item": "3개 변수(Age, Annual_income, spending_score) 각각 별도 셀에서 히스토그램 출력",
            "score": 1
        },
        {
            "item": "bins=15, alpha=0.5, edgecolor='navy' 파라미터 설정",
            "score": 1
        },
        {
            "item": "각 변수에 맞는 올바른 색상(Age-pink, Annual_income-blue, spending_score-skyblue) 적용",
            "score": 1
        },
        {
            "item": "plt.xlabel(), plt.ylabel(), plt.title() 등으로 라벨 정상 표시",
            "score": 1
        }
    ]
}
```
→ 각 항목이 구체적이라 AI가 코드에서 정확히 찾을 수 있음

---

## 🔍 체크리스트: 루브릭 항목이 좋은가?

루브릭을 작성한 후 다음 질문에 답하세요:

1. **AI가 코드에서 직접 찾을 수 있는가?**
   - 함수명이 명시되어 있는가? (plt.figure, sns.histplot, ...)
   - 파라미터명이 명시되어 있는가? (figsize=, bins=, alpha=, ...)

2. **학생이 "어떻게 해야 한다"는 게 명확한가?**
   - "설정할 것" ❌ → "figsize=(8, 5)로 설정" ✅

3. **여러 표현을 수용하는가?**
   - `plt.hist()` 또는 `sns.histplot()` 둘 다 가능하면 **"또는"** 명시
   - `sns.set_theme(style='white')` 또는 `sns.set_style('white')` 둘 다 가능

4. **실행 결과로만 판단 불가능한가?**
   - "코드에 있어야 하는 것" → 코드 문법으로 명시
   - "결과에 나타나야 하는 것" → 결과 설명으로 작성

---

## 📝 자주 실수하는 패턴

| 항목 | 문제점 | 수정 |
|------|--------|------|
| "그래프 설정" | 뭘 설정? | "plt.figure(figsize=...)" |
| "적절한 색상" | 어떤 색? | "color='pink' 또는 '#FFC0CB'" |
| "조건 맞게" | 어떤 조건? | "bins=15, alpha=0.5, edgecolor='navy'" |
| "정상적으로" | 뭐가 정상? | "plt.xlabel(), plt.ylabel(), plt.title() 모두 있음" |
| "1행 2열" | 어떻게? | "plt.subplots(1, 2) 사용" |

---

## 💡 팁: 모호한 항목을 명확하게 바꾸기

**방법 1: 함수명 추가**
- "설정할 것" → "plt.figure()로 설정할 것"

**방법 2: 파라미터명 추가**
- "필수 옵션" → "bins=, alpha=, edgecolor= 파라미터 설정"

**방법 3: 예시 제시**
- "올바른 색상" → "색상 설정: Age-pink, Annual_income-blue, spending_score-skyblue"

**방법 4: 코드 스니펫 제시**
- "표현하기" → "import seaborn as sns (또는 import seaborn 후 as sns 별칭 사용)"

---

## 🚀 루브릭 작성 체크리스트

- [ ] 모호한 단어 제거 (설정, 할 것, 조건, 정상 등)
- [ ] 함수명 명시 (plt.figure, sns.histplot, ...)
- [ ] 파라미터명 명시 (figsize=, bins=, ...)
- [ ] 예시 또는 구체적 값 포함 (8, 5) 또는 pink)
- [ ] 대체 표현 허용 ("또는" 사용)
- [ ] AI가 코드에서 찾을 수 있나 확인

---

## 📊 생성 프로세스

1. **문제 노트북 파싱:** 각 문제(Q1, Q2, ...)의 지시문과 정답 코드를 추출
2. **채점 방식 결정:** 각 문항이 세부 항목 명시(방식 1)인지 자율 평가(방식 2)인지 판단
3. **정답 코드 분석:** 방식 1 문항은 정답 코드에서 핵심 함수·파라미터를 추출하여 항목화
4. **배점 분배:** 총점을 문항 수에 따라 분배하고, 세부 항목별 배점 할당
5. **JSON 생성:** 위 형식에 맞춰 최종 루브릭 JSON 출력

---

이 가이드라인을 따르면 AI 채점 정확도가 크게 향상됩니다! 📈
