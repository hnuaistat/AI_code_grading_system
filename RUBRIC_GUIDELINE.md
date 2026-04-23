# 루브릭 작성 가이드라인

AI 채점을 위한 루브릭은 **구체성**이 가장 중요합니다. AI가 학생의 코드나 실행 결과에서 직접 찾을 수 있어야 합니다.

---

## ⚠️ 필수 요구사항

### partial_score_criteria가 공백이면?

**partial_score_criteria 배열이 비어있으면:**
- 자동으로 **AI가 전체 배점을 자율적으로 판단하고 해설**합니다
- 세부 항목으로 채점하지 않고, 출력 결과에 기반하여 점수를 부여합니다

**따라서:**
- ✅ 세부 채점 기준이 있으면: partial_score_criteria에 항목을 추가하세요
- ✅ 세부 기준이 없으면: partial_score_criteria를 비워두세요 (명시적으로 AI 자율 항목 추가할 필요 없음)

### 남은 배점(Remaining Score)이란?

**정의:** 명시된 partial_score_criteria의 점수 합계가 full_score보다 작을 때, 그 차이

**예시:**
```json
{
    "problem_id": "Q4",
    "full_score": 10,
    "partial_score_criteria": [
        {"item": "데이터 타입 변환", "score": 3},
        {"item": "조건문 활용", "score": 3}
    ]
}
```
→ 명시 항목 합계: 3 + 3 = 6점
→ **남은 배점: 10 - 6 = 4점**

### 남은 배점은 누가, 어떻게 처리하나?

**AI가 자동으로 판단합니다:**

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

이 가이드라인을 따르면 AI 채점 정확도가 크게 향상됩니다! 📈
