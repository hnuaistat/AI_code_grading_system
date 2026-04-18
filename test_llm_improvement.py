"""
LLM 개선 로직 테스트
파서 결과 → LLM 개선 전/후 비교
"""
import sys
import io
import json
import asyncio

# stdout을 UTF-8로 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 파서 결과 샘플 (Q1: empty, Q6: with items)
sample_parser_output = {
    "problems": [
        # Q1: partial_score_criteria가 비어있음
        {
            "problem_id": "Q1",
            "full_score": 4.0,
            "evaluation_guideline": "다음 조건에 따라 결측치를 탐색하시오.\n\n다음 조건을 만족해야 합니다:\n- 데이터프레임 data에서 하나 이상의 결측치가 존재하는 변수를 모두 찾으시오.\n- 각 변수별로 결측치가 몇 개인지 출력하시오.",
            "partial_score_criteria": []
        },
        # Q6: 개선이 필요한 항목들이 있음
        {
            "problem_id": "Q6",
            "full_score": 5.0,
            "evaluation_guideline": "고객 데이터를 담고 있는 data2 데이터프레임의 분포를 확인하기 위해 히스토그램을 생성하시오.",
            "partial_score_criteria": [
                {
                    "item": "각 히스토그램 크기는 (8, 5)의 크기로 시각화할 것",
                    "score": 1.0
                },
                {
                    "item": "각 변수에 대해 bins는 15, 투명도는 0.5, edgecolor는 navy로 설정할 것",
                    "score": 1.0
                },
                {
                    "item": "Age는 색상 pink, Annual_Income은 blue, Spending_Score는 skyblue로 시각화할 것",
                    "score": 1.0
                }
            ]
        }
    ],
    "global_evaluation_guideline": "모든 문항 공통: 학생의 코드에서 런타임 에러가 발생하는 경우, 해당 문항은 0점 처리하세요.",
    "exam_title": "데이터 분석 기말고사"
}

async def test_improvement():
    """LLM 개선 함수 테스트"""
    from backend.utils.rubric_improver import improve_rubric_with_ai

    print("=" * 80)
    print("LLM 루브릭 개선 테스트")
    print("=" * 80)

    # 개선 전
    print("\n📊 개선 전 데이터:")
    print("-" * 80)

    print("\n[Q1] - partial_score_criteria가 비어있음:")
    q1_before = sample_parser_output["problems"][0]
    print(f"  평가 기준: {q1_before['evaluation_guideline'][:60]}...")
    print(f"  부분점수: {q1_before['partial_score_criteria']} (비어있음 ✓)")

    print("\n[Q6] - 개선 필요한 항목들:")
    q6_before = sample_parser_output["problems"][1]
    for i, c in enumerate(q6_before["partial_score_criteria"], 1):
        print(f"  {i}. {c['item']}")

    # 개선 실행
    print("\n" + "=" * 80)
    print("🔄 LLM 개선 중...")
    print("=" * 80)

    improved = await improve_rubric_with_ai(sample_parser_output)

    # 개선 후
    print("\n✅ 개선 완료!")
    print("=" * 80)

    print("\n[Q1 검증] - partial_score_criteria가 여전히 비어있어야 함:")
    q1_after = improved["problems"][0]
    print(f"  평가 기준: {q1_after['evaluation_guideline'][:60]}...")
    status = "✅ PASS" if q1_after['partial_score_criteria'] == [] else "❌ FAIL"
    print(f"  부분점수: {q1_after['partial_score_criteria']} {status}")

    print("\n[Q6 검증] - 항목들이 파라미터 문법으로 개선되어야 함:")
    q6_after = improved["problems"][1]
    print(f"  개수: {len(q6_after['partial_score_criteria'])}개 (개선 전과 같아야 함)")

    print("\n  개선 전 → 개선 후 비교:")
    for i, (before, after) in enumerate(zip(q6_before["partial_score_criteria"],
                                            q6_after["partial_score_criteria"]), 1):
        print(f"\n  {i}. 개선 전:")
        print(f"     {before['item']}")
        print(f"     개선 후:")
        print(f"     {after['item']}")

        # 변화 감지
        if before['item'] != after['item']:
            print(f"     ✅ 개선됨")
        else:
            print(f"     ⚠️ 변화 없음")

    # 최종 결과 JSON
    print("\n" + "=" * 80)
    print("📄 전체 결과 (JSON):")
    print("=" * 80)
    print(json.dumps(improved, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(test_improvement())
