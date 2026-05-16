# 채점 모델 라인업

## 현재 사용 중인 모델 (`llm_service.py` > `AVAILABLE_MODELS`)

### Fireworks (외부 오픈소스)

| 라벨 | 모델 ID | 특징 | 추론 제어 |
|------|---------|------|-----------|
| kimi-k2.6 | `fireworks/accounts/fireworks/models/kimi-k2p6` | 코딩·에이전트 특화, multimodal | `thinking: {type: disabled}` |
| glm-5.1 | `fireworks/accounts/fireworks/models/glm-5p1` | 754B MoE, 코딩 강점, 비쌈 | `thinking: {type: disabled}` |
| qwen3.6-plus | `fireworks/accounts/fireworks/models/qwen3p6-plus` | Alibaba 플래그십, 한국어 강점 | `enable_thinking: false` |

---

## 비활성화된 모델 (주석 처리, 필요 시 해제)

### OpenAI

| 라벨 | 모델 ID | 특징 |
|------|---------|------|
| gpt-4o-mini | `openai/gpt-4o-mini` | 빠르고 저렴, 안정적 |
| gpt-4o | `openai/gpt-4o` | 고성능, 비용 높음 |
| gpt-4.1-mini | `openai/gpt-4.1-mini` | 최신 경량 모델 |

---

## 제거된 모델

| 라벨 | 이유 |
|------|------|
| `deepseek-v4-pro` | 추론 모델 — "We are asked to evaluate..." 자연어 응답, JSON 파싱 오류 |
| `deepseek-v3p2` | Fireworks serverless 종료 (404 에러) |
| `kimi-k2-instruct`, `kimi-k2.6` (구버전) | JSON 지시 미준수, parse error, no longer served |
| `qwen3.5-35b-a3b` | API Timeout, 응답 속도 너무 느림 |

---

## 채점 모델 선택 기준

- **추론(Thinking) 모델** → 채점에 비추천 (느리고 비싸고, JSON 파싱 오류 가능)
- **일반 LLM** → 채점 권장 (빠르고, JSON 포맷 응답 안정적)
- **추론 제어 가능 모델** → `thinking` 파라미터로 비활성화 후 사용 가능
- **한국어 과제 채점** → Qwen 계열이 유리
- **코딩 과제** → Kimi, GLM, DeepSeek 계열이 유리
