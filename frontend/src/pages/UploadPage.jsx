import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../App';
import { gradingAPI, subjectAPI } from '../services/api';
import StepIndicator from '../components/StepIndicator';

// Number input의 화살표 제거
const style = document.createElement('style');
style.textContent = `
  input[type="number"] {
    -moz-appearance: textfield;
  }
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

const STEPS = ['파일 업로드', 'AI 루브릭 생성', '루브릭 확인/수정', '채점 실행'];

function DropZone({ label, icon, accept, onDrop, file }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept, multiple: false
  });
  return (
    <div {...getRootProps()} style={{
      ...dz.zone,
      borderColor: isDragActive ? '#2563eb' : file ? '#22c55e' : '#cbd5e1',
      background: isDragActive ? '#eff6ff' : file ? '#f0fdf4' : '#f8fafc',
    }}>
      <input {...getInputProps()} />
      <div style={dz.icon}>{file ? '✅' : icon}</div>
      <div style={dz.label}>{label}</div>
      {file
        ? <div style={dz.filename}>{file.name}</div>
        : <div style={dz.hint}>클릭하거나 파일을 드래그하세요</div>
      }
    </div>
  );
}

const dz = {
  zone: { border: '2px dashed', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  icon: { fontSize: 32, marginBottom: 8 },
  label: { fontWeight: 600, color: '#374151', marginBottom: 4 },
  hint: { fontSize: 13, color: '#94a3b8' },
  filename: { fontSize: 13, color: '#22c55e', fontWeight: 500, marginTop: 4 },
};

/* ── Rubric Editor Component ── */
function RubricEditor({ rubric, onChange }) {
  const [totalScoreEdit, setTotalScoreEdit] = useState(null);
  const [decomposeModal, setDecomposeModal] = useState(false);
  const [decomposeTarget, setDecomposeTarget] = useState(null);
  const [decomposeResult, setDecomposeResult] = useState([]);
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [decomposeError, setDecomposeError] = useState('');
  // 타이핑 중 keywords 문자열 임시 저장 (key: `${pIdx}-${cIdx}`)
  const [keywordsText, setKeywordsText] = useState({});

  const updateField = (field, value) => {
    if (field === 'total_score') {
      // 총점 변경 시, 문제별 배점을 비례적으로 조정
      const oldTotal = getTotalScore();
      if (oldTotal > 0 && value > 0) {
        const ratio = value / oldTotal;
        const problems = rubric.problems.map(p => ({
          ...p,
          full_score: Math.round(p.full_score * ratio * 100) / 100
        }));
        onChange({ ...rubric, problems });
      }
    } else {
      onChange({ ...rubric, [field]: value });
    }
  };

  const updateProblem = (idx, field, value) => {
    const problems = [...rubric.problems];
    problems[idx] = { ...problems[idx], [field]: value };
    // full_score 변경 시 자동 동기화
    if (field === 'full_score') {
      const criteria = problems[idx].partial_score_criteria;
      if (criteria.length === 1) {
        criteria[0] = { ...criteria[0], score: parseFloat(value) || 0 };
        problems[idx] = { ...problems[idx], partial_score_criteria: criteria };
      }
    }
    onChange({ ...rubric, problems });
  };

  const updateCriteria = (pIdx, cIdx, field, value) => {
    const problems = [...rubric.problems];
    const criteria = [...problems[pIdx].partial_score_criteria];
    criteria[cIdx] = { ...criteria[cIdx], [field]: value };
    problems[pIdx] = { ...problems[pIdx], partial_score_criteria: criteria };
    onChange({ ...rubric, problems });
  };

  const addCriteria = (pIdx) => {
    const problems = [...rubric.problems];
    const criteria = [...problems[pIdx].partial_score_criteria, { item: '', score: 1, keywords: [] }];
    problems[pIdx] = { ...problems[pIdx], partial_score_criteria: criteria };
    onChange({ ...rubric, problems });
  };

  const handleDecomposeItem = async (pIdx, cIdx) => {
    const criterion = rubric.problems[pIdx].partial_score_criteria[cIdx];
    if (!criterion.item.trim()) return;

    setDecomposeTarget({ pIdx, cIdx, originalScore: parseFloat(criterion.score) || 0 });
    setDecomposeResult([]);
    setDecomposeError('');
    setDecomposeModal(true);
    setDecomposeLoading(true);

    try {
      const problemContext = rubric.problems[pIdx].evaluation_guideline || '';
      const res = await gradingAPI.decomposeItem(criterion.item, problemContext);
      const items = res.data.decomposed_items.map(d => ({
        item: d.item,
        score: '',
        keywords: (d.keywords || []).join(', ')
      }));
      setDecomposeResult(items);
    } catch {
      setDecomposeError('분해 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setDecomposeLoading(false);
    }
  };

  const handleApplyDecomposition = () => {
    const { pIdx, cIdx } = decomposeTarget;
    const problems = [...rubric.problems];
    const criteria = [...problems[pIdx].partial_score_criteria];
    const newItems = decomposeResult.map(d => ({
      item: d.item,
      score: parseFloat(d.score) || 0,
      keywords: d.keywords.split(',').map(k => k.trim()).filter(k => k)
    }));
    criteria.splice(cIdx, 1, ...newItems);
    problems[pIdx] = { ...problems[pIdx], partial_score_criteria: criteria };
    onChange({ ...rubric, problems });
    setDecomposeModal(false);
    setDecomposeTarget(null);
    setDecomposeResult([]);
  };

  const closeDecomposeModal = () => {
    setDecomposeModal(false);
    setDecomposeTarget(null);
    setDecomposeResult([]);
    setDecomposeError('');
  };

  const removeCriteria = (pIdx, cIdx) => {
    const problems = [...rubric.problems];
    const criteria = problems[pIdx].partial_score_criteria.filter((_, i) => i !== cIdx);
    problems[pIdx] = { ...problems[pIdx], partial_score_criteria: criteria };
    onChange({ ...rubric, problems });
  };

  const addProblem = () => {
    const nextId = rubric.problems.length + 1;
    onChange({
      ...rubric,
      problems: [...rubric.problems, {
        problem_id: `Q${nextId}`,
        full_score: 5,
        evaluation_guideline: '',
        partial_score_criteria: [{ item: '출력에 따라 AI가 자율적으로 부여하고 해설을 하시오', score: 5, keywords: [] }]
      }]
    });
  };

  const removeProblem = (idx) => {
    onChange({ ...rubric, problems: rubric.problems.filter((_, i) => i !== idx) });
  };

  const getCriteriaSum = (criteria) => Math.round(criteria.reduce((sum, c) => sum + (parseFloat(c.score) || 0), 0) * 100) / 100;
  const getTotalScore = () => Math.round(rubric.problems.reduce((sum, p) => sum + (parseFloat(p.full_score) || 0), 0) * 100) / 100;

  return (
    <div style={re.wrapper}>
      {/* Header info */}
      <div style={re.section}>
        <label style={re.fieldLabel}>시험 제목</label>
        <input
          style={re.input}
          value={rubric.exam_title || ''}
          onChange={e => updateField('exam_title', e.target.value)}
          placeholder="시험 제목"
        />
      </div>

      <div style={re.section}>
        <label style={re.fieldLabel}>전체 공통 채점 가이드라인</label>
        <textarea
          style={re.textarea}
          value={rubric.global_evaluation_guideline || ''}
          onChange={e => updateField('global_evaluation_guideline', e.target.value)}
          placeholder="모든 문항에 공통 적용되는 채점 원칙"
          rows={3}
        />
      </div>

      <div style={re.totalBar}>
        <span style={re.totalLabel}>총점</span>
        <input
          style={re.totalScoreInput}
          type="number"
          step="0.25"
          value={totalScoreEdit !== null ? totalScoreEdit : getTotalScore()}
          onChange={e => setTotalScoreEdit(e.target.value)}
          onBlur={e => {
            const val = parseFloat(e.target.value) || 0;
            if (val > 0) updateField('total_score', val);
            setTotalScoreEdit(null);
          }}
          min="0"
        />
        <span style={re.scoreUnit}>점</span>
        <span style={re.totalCount}>{rubric.problems.length}문항</span>
      </div>

      {/* Problems */}
      {rubric.problems.map((problem, pIdx) => {
        const criteriaSum = getCriteriaSum(problem.partial_score_criteria);
        const mismatch = Math.abs(criteriaSum - (parseFloat(problem.full_score) || 0)) > 0.001;

        return (
          <div key={pIdx} style={re.problemCard}>
            <div style={re.problemHeader}>
              <div style={re.problemIdRow}>
                <input
                  style={re.problemIdInput}
                  value={problem.problem_id}
                  onChange={e => updateProblem(pIdx, 'problem_id', e.target.value)}
                />
                <div style={re.scoreInputGroup}>
                  <span style={re.scoreLabel}>배점</span>
                  <input
                    style={re.scoreInput}
                    type="number"
                    step="0.25"
                    min="0"
                    value={problem.full_score ?? 0}
                    onChange={e => updateProblem(pIdx, 'full_score', e.target.value)}
                    onBlur={e => updateProblem(pIdx, 'full_score', parseFloat(e.target.value) || 0)}
                  />
                  <span style={re.scoreUnit}>점</span>
                </div>
              </div>
              <button style={re.removeProblemBtn} onClick={() => removeProblem(pIdx)} title="문제 삭제">✕</button>
            </div>

            <div style={re.codeRequiredRow}>
              <label style={re.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={problem.requires_code !== false}
                  onChange={e => updateProblem(pIdx, 'requires_code', e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                코드 제출 필수
              </label>
              <span style={re.checkboxHint}>
                {problem.requires_code !== false ? '✓ 코드 필수' : '○ 마크다운만 가능'}
              </span>
            </div>

            <div style={re.fieldGroup}>
              <label style={re.smallLabel}>평가 가이드라인</label>
              <textarea
                style={re.smallTextarea}
                value={problem.evaluation_guideline || ''}
                onChange={e => updateProblem(pIdx, 'evaluation_guideline', e.target.value)}
                placeholder="이 문항의 핵심 요구사항"
                rows={2}
              />
            </div>

            <div style={re.criteriaSection}>
              <div style={re.criteriaHeader}>
                <span style={re.smallLabel}>부분 점수 항목</span>
                {mismatch && (
                  <span style={re.mismatchWarn}>
                    합계 {criteriaSum}점 (배점 {problem.full_score}점과 불일치)
                  </span>
                )}
              </div>

              {problem.partial_score_criteria.map((c, cIdx) => (
                <div key={cIdx} style={re.criteriaColumn}>
                  <div style={re.criteriaRow}>
                    <input
                      style={re.criteriaItemInput}
                      value={c.item}
                      onChange={e => updateCriteria(pIdx, cIdx, 'item', e.target.value)}
                      placeholder="채점 항목 설명"
                    />
                    <input
                      style={re.criteriaScoreInput}
                      type="number"
                      step="0.25"
                      min="0"
                      value={c.score ?? 0}
                      onChange={e => updateCriteria(pIdx, cIdx, 'score', e.target.value)}
                      onBlur={e => updateCriteria(pIdx, cIdx, 'score', parseFloat(e.target.value) || 0)}
                    />
                    <span style={re.scoreUnit}>점</span>
                    <button
                      style={{
                        ...re.decomposeBtn,
                        opacity: c.item.trim() ? 1 : 0.4,
                        cursor: c.item.trim() ? 'pointer' : 'default',
                      }}
                      onClick={() => c.item.trim() && handleDecomposeItem(pIdx, cIdx)}
                      title="동사 단위로 세분화"
                    >분해</button>
                    <button
                      style={re.removeCriteriaBtn}
                      onClick={() => removeCriteria(pIdx, cIdx)}
                      title="항목 삭제"
                    >✕</button>
                  </div>
                  <input
                    style={re.criteriaKeywordsInput}
                    placeholder="핵심단어 (쉼표로 구분)"
                    value={(() => {
                      const key = `${pIdx}-${cIdx}`;
                      if (key in keywordsText) return keywordsText[key];
                      return Array.isArray(c.keywords) ? c.keywords.join(', ') : '';
                    })()}
                    onChange={e => {
                      const key = `${pIdx}-${cIdx}`;
                      setKeywordsText(prev => ({ ...prev, [key]: e.target.value }));
                    }}
                    onBlur={e => {
                      const key = `${pIdx}-${cIdx}`;
                      const keywords = e.target.value
                        .split(',')
                        .map(k => k.trim())
                        .filter(k => k.length > 0);
                      updateCriteria(pIdx, cIdx, 'keywords', keywords);
                      setKeywordsText(prev => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      });
                    }}
                  />
                </div>
              ))}

              <button style={re.addCriteriaBtn} onClick={() => addCriteria(pIdx)}>
                + 항목 추가
              </button>
            </div>
          </div>
        );
      })}

      <button style={re.addProblemBtn} onClick={addProblem}>
        + 문제 추가
      </button>

      {/* 분해 모달 */}
      {decomposeModal && (
        <div style={re.modalOverlay} onClick={closeDecomposeModal}>
          <div style={re.modalBox} onClick={e => e.stopPropagation()}>
            <div style={re.modalHeader}>
              <span style={re.modalTitle}>동사 단위 세분화</span>
              <button style={re.modalCloseBtn} onClick={closeDecomposeModal}>✕</button>
            </div>

            {decomposeTarget && (
              <div style={re.modalOriginalScore}>
                원래 배점: <strong>{decomposeTarget.originalScore}점</strong>
                {' — '}세분화된 항목들의 배점 합계가 이 값을 초과할 수 없습니다.
              </div>
            )}

            {decomposeLoading && (
              <div style={re.modalLoading}>LLM이 항목을 분석 중...</div>
            )}

            {decomposeError && (
              <div style={re.modalError}>{decomposeError}</div>
            )}

            {!decomposeLoading && decomposeResult.length > 0 && (() => {
              const scoreSum = Math.round(decomposeResult.reduce((s, d) => s + (parseFloat(d.score) || 0), 0) * 100) / 100;
              const exceeded = decomposeTarget && scoreSum > decomposeTarget.originalScore + 0.001;
              return (
                <>
                  <div style={re.decomposeList}>
                    {decomposeResult.map((d, i) => (
                      <div key={i} style={re.decomposeItemCard}>
                        <div style={re.decomposeItemText}>{d.item}</div>
                        <div style={re.decomposeInputRow}>
                          <label style={re.decomposeLabel}>배점</label>
                          <input
                            style={re.decomposeScoreInput}
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="0"
                            value={d.score}
                            onChange={e => {
                              const next = [...decomposeResult];
                              next[i] = { ...next[i], score: e.target.value };
                              setDecomposeResult(next);
                            }}
                          />
                          <span style={re.scoreUnit}>점</span>
                          <label style={{ ...re.decomposeLabel, marginLeft: 12 }}>핵심단어</label>
                          <input
                            style={re.decomposeKeyInput}
                            placeholder="쉼표로 구분"
                            value={d.keywords}
                            onChange={e => {
                              const next = [...decomposeResult];
                              next[i] = { ...next[i], keywords: e.target.value };
                              setDecomposeResult(next);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...re.decomposeScoreSummary, color: exceeded ? '#dc2626' : '#059669' }}>
                    배점 합계: {scoreSum}점 / {decomposeTarget?.originalScore}점
                    {exceeded && ' — 원래 배점을 초과했습니다'}
                  </div>

                  <div style={re.modalFooter}>
                    <button style={re.modalCancelBtn} onClick={closeDecomposeModal}>취소</button>
                    <button
                      style={{ ...re.modalApplyBtn, opacity: exceeded ? 0.4 : 1, cursor: exceeded ? 'default' : 'pointer' }}
                      onClick={() => !exceeded && handleApplyDecomposition()}
                    >적용</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const re = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 16 },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  totalBar: {
    display: 'flex', alignItems: 'center', gap: 12, background: '#f0f9ff', borderRadius: 8,
    padding: '10px 16px', border: '1px solid #bae6fd',
  },
  totalLabel: { fontSize: 14, fontWeight: 600, color: '#0369a1' },
  totalScore: { fontSize: 20, fontWeight: 700, color: '#0369a1' },
  totalScoreInput: {
    padding: '6px 10px', border: '1.5px solid #bae6fd', borderRadius: 8, fontSize: 18,
    fontWeight: 700, width: 80, outline: 'none', color: '#0369a1', textAlign: 'center',
    background: '#fff',
  },
  totalCount: { fontSize: 13, color: '#0369a1', marginLeft: 'auto' },
  problemCard: {
    border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20,
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  problemHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  codeRequiredRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' },
  checkboxLabel: { fontSize: 14, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 },
  checkboxHint: { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  problemIdRow: { display: 'flex', alignItems: 'center', gap: 16 },
  problemIdInput: {
    padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 16,
    fontWeight: 700, width: 80, outline: 'none', color: '#2563eb',
  },
  scoreInputGroup: { display: 'flex', alignItems: 'center', gap: 6 },
  scoreLabel: { fontSize: 13, color: '#64748b', fontWeight: 500 },
  scoreInput: { padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 70, outline: 'none', textAlign: 'right' },
  scoreUnit: { fontSize: 13, color: '#64748b' },
  removeProblemBtn: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6,
    width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fieldGroup: { marginBottom: 12 },
  smallLabel: { fontSize: 13, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 },
  smallTextarea: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
    outline: 'none', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  criteriaSection: { marginTop: 4 },
  criteriaHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  mismatchWarn: { fontSize: 12, color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '2px 8px', borderRadius: 4 },
  criteriaColumn: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  criteriaRow: { display: 'flex', alignItems: 'center', gap: 8 },
  criteriaItemInput: {
    flex: 1, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none',
  },
  criteriaScoreInput: {
    padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 60,
    outline: 'none', textAlign: 'right',
  },
  criteriaKeywordsInput: {
    padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12,
    outline: 'none', background: '#f9fafb', fontStyle: 'italic', color: '#64748b',
  },
  removeCriteriaBtn: {
    background: 'none', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: 6,
    width: 26, height: 26, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  addCriteriaBtn: {
    background: 'none', border: '1px dashed #cbd5e1', color: '#64748b', borderRadius: 8,
    padding: '6px 14px', fontSize: 13, cursor: 'pointer', width: '100%', fontWeight: 500,
  },
  addProblemBtn: {
    background: '#f0f9ff', border: '2px dashed #93c5fd', color: '#2563eb', borderRadius: 12,
    padding: '14px', fontSize: 14, cursor: 'pointer', fontWeight: 600, width: '100%',
  },
  decomposeBtn: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: 6,
    padding: '4px 8px', fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    background: '#fff', borderRadius: 16, padding: 28, width: '90%', maxWidth: 620,
    maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  modalCloseBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1,
  },
  modalOriginalScore: {
    fontSize: 13, color: '#475569', background: '#f8fafc', borderRadius: 8,
    padding: '8px 12px', marginBottom: 16, border: '1px solid #e2e8f0',
  },
  modalLoading: {
    textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 14,
  },
  modalError: {
    background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8,
    fontSize: 13, border: '1px solid #fecaca',
  },
  decomposeList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 },
  decomposeItemCard: {
    border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', background: '#f8fafc',
  },
  decomposeItemText: { fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 },
  decomposeInputRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  decomposeLabel: { fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' },
  decomposeScoreInput: {
    padding: '5px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13,
    width: 60, outline: 'none', textAlign: 'right',
  },
  decomposeKeyInput: {
    flex: 1, padding: '5px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6,
    fontSize: 12, outline: 'none', minWidth: 100,
  },
  decomposeScoreSummary: {
    fontSize: 13, fontWeight: 600, textAlign: 'right', padding: '6px 0', marginBottom: 14,
  },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  modalCancelBtn: {
    padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    background: '#fff', color: '#64748b', fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  modalApplyBtn: {
    padding: '9px 20px', border: 'none', borderRadius: 8,
    background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600,
  },
};


/* ── Main Page ── */
export default function UploadPage() {
  const [step, setStep] = useState(0);
  const [answerFile, setAnswerFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [error, setError] = useState('');

  // Subject state
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  // 수정 state
  const [editingSubject, setEditingSubject] = useState(false);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSubjectLoading, setEditSubjectLoading] = useState(false);
  const [editItemMode, setEditItemMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemLoading, setEditItemLoading] = useState(false);

  // 채점 모델 선택 state
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    subjectAPI.list().then(res => {
      setSubjects(res.data);
      if (res.data.length > 0) setSelectedSubjectId(String(res.data[0].id));
    }).catch(() => { });

    gradingAPI.getAvailableModels().then(res => {
      setAvailableModels(res.data.models || []);
      setSelectedModel(res.data.default || '');
    }).catch(() => { });
  }, []);

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    setSubjectLoading(true);
    try {
      const res = await subjectAPI.create(newSubjectName.trim(), newSubjectCode.trim() || null);
      const created = res.data;
      setSubjects(prev => [...prev, created]);
      setSelectedSubjectId(String(created.id));
      setSelectedItemId('');
      setShowNewSubject(false);
      setNewSubjectName('');
      setNewSubjectCode('');
    } catch (err) {
      setError(err.response?.data?.detail || '과목 생성에 실패했습니다');
    } finally {
      setSubjectLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !selectedSubjectId) return;
    setItemLoading(true);
    try {
      const res = await subjectAPI.createItem(selectedSubjectId, newItemName.trim());
      setSubjects(prev => prev.map(s =>
        s.id === parseInt(selectedSubjectId)
          ? { ...s, items: [...(s.items || []), res.data] }
          : s
      ));
      setSelectedItemId(String(res.data.id));
      setShowNewItem(false);
      setNewItemName('');
    } catch (err) {
      setError(err.response?.data?.detail || '항목 생성에 실패했습니다');
    } finally {
      setItemLoading(false);
    }
  };

  const handleEditSubjectStart = () => {
    const sub = subjects.find(s => String(s.id) === selectedSubjectId);
    if (!sub) return;
    setEditSubjectName(sub.name);
    setEditSubjectCode(sub.code || '');
    setEditingSubject(true);
  };

  const handleEditSubjectSave = async () => {
    if (!editSubjectName.trim() || !selectedSubjectId) return;
    setEditSubjectLoading(true);
    try {
      const res = await subjectAPI.update(selectedSubjectId, editSubjectName.trim(), editSubjectCode.trim() || null);
      setSubjects(prev => prev.map(s => s.id === res.data.id ? { ...s, name: res.data.name, code: res.data.code } : s));
      setEditingSubject(false);
    } catch (err) {
      setError(err.response?.data?.detail || '과목 수정에 실패했습니다');
    } finally {
      setEditSubjectLoading(false);
    }
  };

  const handleEditItemStart = (item) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
  };

  const handleEditItemSave = async (itemId) => {
    if (!editItemName.trim() || !selectedSubjectId) return;
    setEditItemLoading(true);
    try {
      const res = await subjectAPI.updateItem(selectedSubjectId, itemId, editItemName.trim());
      setSubjects(prev => prev.map(s =>
        s.id === parseInt(selectedSubjectId)
          ? { ...s, items: s.items.map(it => it.id === itemId ? { ...it, name: res.data.name } : it) }
          : s
      ));
      setEditingItemId(null);
      setEditItemName('');
      // 수정 모드 유지 (다른 항목도 계속 수정 가능)
    } catch (err) {
      setError(err.response?.data?.detail || '항목 수정에 실패했습니다');
    } finally {
      setEditItemLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedSubjectId) return;
    try {
      await subjectAPI.deleteItem(selectedSubjectId, itemId);
      setSubjects(prev => prev.map(s =>
        s.id === parseInt(selectedSubjectId)
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      ));
      if (selectedItemId === String(itemId)) setSelectedItemId('');
    } catch (err) {
      setError(err.response?.data?.detail || '항목 삭제에 실패했습니다');
    }
  };

  /* Step 1: 노트북 파싱으로 루브릭 생성 */
  const handleGenerateRubric = async () => {
    if (!answerFile) {
      setError('정답 노트북을 업로드해주세요');
      return;
    }
    setError('');
    setLoading(true);
    setStep(1);
    try {
      const res = await gradingAPI.generateRubric(answerFile, 100.0, '');
      setRubric(res.data);
      setStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail || 'AI 루브릭 생성에 실패했습니다';
      setError(detail);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  /* Step 3: 채점 시작 */
  const handleStartGrading = async () => {
    if (!answerFile || !zipFile || !rubric) {
      setError('필요한 파일과 루브릭이 준비되지 않았습니다');
      return;
    }
    setError('');
    setGradingLoading(true);
    setStep(3);
    try {
      const criteriaBlob = new Blob([JSON.stringify(rubric, null, 2)], { type: 'application/json' });
      const criteriaFile = new File([criteriaBlob], 'rubric.json', { type: 'application/json' });

      const fd = new FormData();
      fd.append('answer_notebook', answerFile);
      fd.append('student_zip', zipFile);
      fd.append('criteria_file', criteriaFile);
      if (selectedSubjectId) fd.append('subject_id', selectedSubjectId);
      if (selectedItemId) fd.append('subject_item_id', selectedItemId);
      if (selectedModel) fd.append('grading_model', selectedModel);

      const res = await gradingAPI.startGrading(fd);
      navigate(`/dashboard/${res.data.session_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || '채점 시작에 실패했습니다');
      setStep(2);
    } finally {
      setGradingLoading(false);
    }
  };

  /* JSON 파일로 루브릭 업로드 (기존 방식 지원) */
  const handleRubricFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setRubric(data);
        setStep(2);
      } catch {
        setError('JSON 파일 파싱에 실패했습니다');
      }
    };
    reader.readAsText(file);
  };

  /* JSON 다운로드 */
  const handleDownloadRubric = () => {
    if (!rubric) return;
    const blob = new Blob([JSON.stringify(rubric, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rubric.exam_title || 'rubric'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filesReady = answerFile && zipFile;
  const selectedSubject = subjects.find(s => String(s.id) === selectedSubjectId);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 24 }}>📓</span>
          <span style={s.headerTitle}>Jupyter 자동 채점 시스템</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.historyBtn} onClick={() => navigate('/history')}>📚 채점 기록</button>
          <button style={s.revisionBtn} onClick={() => navigate('/revisions')}>📝 수정 로그</button>
          <span style={s.userName}>{user?.username} ({user?.role})</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        <StepIndicator steps={STEPS} current={step} />

        {/* ── Subject selector (항상 표시) ── */}
        <div style={s.subjectCard}>
          <div style={s.subjectRow}>
            <div style={s.subjectLeft}>
              <span style={s.subjectLabel}>📘 과목 선택</span>
              {subjects.length > 0 ? (
                <select
                  style={s.select}
                  value={selectedSubjectId}
                  onChange={e => {
                    if (e.target.value === '__new__') setShowNewSubject(true);
                    else { setSelectedSubjectId(e.target.value); setShowNewSubject(false); }
                  }}
                >
                  {subjects.map(sub => (
                    <option key={sub.id} value={String(sub.id)}>
                      {sub.code ? `[${sub.code}] ` : ''}{sub.name}
                    </option>
                  ))}
                  <option value="__new__">+ 새 과목 만들기</option>
                </select>
              ) : (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>과목이 없습니다</span>
              )}
              {!showNewSubject && (
                <button style={s.newSubjectBtn} onClick={() => setShowNewSubject(true)}>
                  + 새 과목
                </button>
              )}
            </div>
            {selectedSubject && !showNewSubject && !editingSubject && (
              <div style={s.subjectInfo}>
                <span style={s.subjectInfoName}>{selectedSubject.name}</span>
                {selectedSubject.code && <span style={s.subjectInfoCode}>{selectedSubject.code}</span>}
                <span style={s.subjectInfoCount}>채점 {selectedSubject.session_count}회</span>
                <button style={s.editSubjectBtn} onClick={handleEditSubjectStart} title="과목명 수정">✏️</button>
              </div>
            )}
          </div>

          {editingSubject && (
            <div style={s.newSubjectForm}>
              <input
                style={s.input}
                placeholder="과목명"
                value={editSubjectName}
                onChange={e => setEditSubjectName(e.target.value)}
              />
              <input
                style={s.input}
                placeholder="과목코드 (선택)"
                value={editSubjectCode}
                onChange={e => setEditSubjectCode(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={s.createBtn}
                  onClick={handleEditSubjectSave}
                  disabled={editSubjectLoading || !editSubjectName.trim()}
                >
                  {editSubjectLoading ? '저장 중...' : '저장'}
                </button>
                <button style={s.cancelBtn} onClick={() => setEditingSubject(false)}>취소</button>
              </div>
            </div>
          )}

          {showNewSubject && (
            <div style={s.newSubjectForm}>
              <input
                style={s.input}
                placeholder="과목명 (예: 알고리즘)"
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
              />
              <input
                style={s.input}
                placeholder="과목코드 (선택, 예: CS101)"
                value={newSubjectCode}
                onChange={e => setNewSubjectCode(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={s.createBtn}
                  onClick={handleCreateSubject}
                  disabled={subjectLoading || !newSubjectName.trim()}
                >
                  {subjectLoading ? '생성 중...' : '생성'}
                </button>
                <button style={s.cancelBtn} onClick={() => { setShowNewSubject(false); setNewSubjectName(''); setNewSubjectCode(''); }}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subject Items */}
        {selectedSubjectId && subjects.find(s2 => String(s2.id) === selectedSubjectId)?.items && (
          <div style={s.itemsCard}>
            <div style={s.itemsHeader}>
              <span style={s.itemsLabel}>📋 세부 항목 (과제, 중간고사, 기말고사 등)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!editingItemId && !showNewItem && (
                  <button
                    style={editItemMode ? s.editItemModeActiveBtn : s.editItemModeBtn}
                    onClick={() => { setEditItemMode(prev => !prev); setEditingItemId(null); }}
                  >
                    {editItemMode ? '✅ 수정 완료' : '✏️ 항목 수정'}
                  </button>
                )}
                {!editItemMode && !showNewItem && (
                  <button style={s.addItemBtn} onClick={() => setShowNewItem(true)}>
                    + 항목 추가
                  </button>
                )}
              </div>
            </div>

            {showNewItem && (
              <div style={s.newItemForm}>
                <input
                  style={s.input}
                  placeholder="항목명 (예: 중간고사)"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={s.createBtn}
                    onClick={handleCreateItem}
                    disabled={itemLoading || !newItemName.trim()}
                  >
                    {itemLoading ? '추가 중...' : '추가'}
                  </button>
                  <button style={s.cancelBtn} onClick={() => { setShowNewItem(false); setNewItemName(''); }}>
                    취소
                  </button>
                </div>
              </div>
            )}

            {editItemMode && (
              <div style={s.editItemBanner}>
                ✏️ 수정할 항목을 클릭하세요
              </div>
            )}

            {subjects.find(s2 => String(s2.id) === selectedSubjectId)?.items.length > 0 ? (
              <div style={s.itemsGrid}>
                {subjects.find(s2 => String(s2.id) === selectedSubjectId).items.map(item => (
                  editingItemId === item.id ? (
                    <div key={item.id} style={{ ...s.itemCard, borderColor: '#2563eb', background: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        style={{ ...s.input, fontSize: 12, padding: '4px 8px' }}
                        value={editItemName}
                        onChange={e => setEditItemName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditItemSave(item.id);
                          if (e.key === 'Escape') setEditingItemId(null);
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...s.createBtn, fontSize: 11, padding: '3px 8px', flex: 1 }}
                          onClick={() => handleEditItemSave(item.id)} disabled={editItemLoading || !editItemName.trim()}>
                          {editItemLoading ? '...' : '저장'}
                        </button>
                        <button style={{ ...s.cancelBtn, fontSize: 11, padding: '3px 6px' }}
                          onClick={() => setEditingItemId(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      style={{
                        ...s.itemCard,
                        borderColor: editItemMode
                          ? '#f59e0b'
                          : selectedItemId === String(item.id) ? '#a9ffbaff' : '#e2e8f0',
                        background: editItemMode
                          ? '#fffbeb'
                          : selectedItemId === String(item.id) ? '#eff6ff' : '#fff',
                        cursor: editItemMode ? 'pointer' : 'pointer',
                      }}
                      onClick={() => {
                        if (editItemMode) handleEditItemStart(item);
                        else setSelectedItemId(String(item.id));
                      }}
                    >
                      <div style={s.itemName}>{item.name}</div>
                      {!editItemMode && (
                        <button
                          style={s.itemDeleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                        >✕</button>
                      )}
                      {editItemMode && (
                        <span style={s.itemEditHint}>✏️</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            ) : (
              !showNewItem && <div style={s.empty}>항목이 없습니다</div>
            )}
          </div>
        )}

        {/* ── Step 0: 파일 업로드 ── */}
        {step === 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>파일 업로드</h2>
            <p style={s.cardDesc}>정답 노트북과 학생 제출물을 업로드해주세요</p>

            <div style={s.grid2}>
              <DropZone label="정답 노트북" icon="📝" accept={{ 'application/x-ipynb+json': ['.ipynb'] }}
                onDrop={([f]) => setAnswerFile(f)} file={answerFile} />
              <DropZone label="학생 제출물 (ZIP / ipynb)" icon="📦"
                accept={{ 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'], 'application/x-ipynb+json': ['.ipynb'] }}
                onDrop={([f]) => setZipFile(f)} file={zipFile} />
            </div>

            {error && <div style={s.error}>{error}</div>}

            <div style={s.actions}>
              <button
                style={s.secondaryBtn}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    if (e.target.files[0]) {
                      if (!zipFile) { setError('학생 제출물 파일을 먼저 업로드해주세요'); return; }
                      handleRubricFileUpload(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                기존 루브릭 JSON 불러오기
              </button>
              <button
                style={filesReady && !loading ? s.primaryBtn : { ...s.primaryBtn, opacity: 0.5, cursor: 'not-allowed' }}
                onClick={handleGenerateRubric}
                disabled={!filesReady || loading}
              >
                AI 루브릭 생성
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: AI 생성 중 ── */}
        {step === 1 && (
          <div style={s.card}>
            <div style={s.loadingBox}>
              <div style={s.spinner} />
              <h2 style={{ ...s.cardTitle, marginBottom: 8 }}>AI가 루브릭을 생성하고 있습니다</h2>
              <p style={s.cardDesc}>정답 노트북을 분석하여 채점 기준을 만들고 있습니다. 잠시만 기다려주세요...</p>
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>보통 30초~1분 정도 소요됩니다</p>
            </div>
          </div>
        )}

        {/* ── Step 2: 루브릭 확인/수정 ── */}
        {step === 2 && rubric && (
          <div style={s.card}>
            <div style={s.rubricHeader}>
              <div>
                <h2 style={s.cardTitle}>루브릭 확인 및 수정</h2>
                <p style={s.cardDesc}>AI가 생성한 루브릭을 확인하고, 필요시 수정하세요</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.outlineBtn} onClick={handleDownloadRubric}>
                  JSON 다운로드
                </button>
                <button style={s.outlineBtn} onClick={() => { setStep(0); setRubric(null); }}>
                  처음부터 다시
                </button>
              </div>
            </div>

            <RubricEditor rubric={rubric} onChange={setRubric} />

            {/* 채점 모델 선택 */}
            <div style={s.modelPickerCard}>
              <div style={s.modelPickerHeader}>
                <span style={s.modelPickerTitle}>🤖 채점 AI 모델 선택</span>
                <span style={s.modelPickerHint}>모델별로 채점 정확도와 속도가 다릅니다</span>
              </div>
              {availableModels.length === 0 ? (
                <div style={s.modelPickerEmpty}>사용 가능한 모델이 없습니다 (관리자 설정에서 API 키를 확인하세요)</div>
              ) : (
                <div style={s.modelPickerList}>
                  {availableModels.map(m => (
                    <label
                      key={m.id}
                      style={{
                        ...s.modelOption,
                        ...(selectedModel === m.id ? s.modelOptionSelected : {}),
                      }}
                    >
                      <input
                        type="radio"
                        name="grading-model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={() => setSelectedModel(m.id)}
                        style={{ marginRight: 10 }}
                      />
                      <span style={s.modelOptionLabel}>
                        <span style={s.modelProviderBadge(m.provider)}>{m.provider}</span>
                        {m.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ ...s.error, marginTop: 16 }}>{error}</div>}

            <div style={{ ...s.actions, marginTop: 24 }}>
              <button style={s.secondaryBtn} onClick={() => setStep(0)}>
                이전 단계
              </button>
              <button
                style={!gradingLoading ? s.primaryBtn : { ...s.primaryBtn, opacity: 0.5, cursor: 'not-allowed' }}
                onClick={handleStartGrading}
                disabled={gradingLoading}
              >
                {gradingLoading ? '채점 시작 중...' : '채점 시작'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: 채점 실행 중 ── */}
        {step === 3 && (
          <div style={s.card}>
            <div style={s.loadingBox}>
              <div style={s.spinner} />
              <h2 style={{ ...s.cardTitle, marginBottom: 8 }}>채점을 시작하고 있습니다</h2>
              <p style={s.cardDesc}>잠시 후 채점 현황 페이지로 이동합니다...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#e3cef4ff' },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '0 32px', height: 64, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#000000ff' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  historyBtn: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500,
  },
  revisionBtn: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#92400e', fontWeight: 500,
  },
  userName: { fontSize: 14, color: '#64748b' },
  logoutBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#64748b' },
  main: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },

  subjectCard: {
    background: '#fff', borderRadius: 12, padding: '18px 24px',
    marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
  },
  subjectRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  subjectLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  subjectLabel: { fontSize: 14, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' },
  select: { padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' },
  newSubjectBtn: { background: 'none', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  subjectInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  subjectInfoName: { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  subjectInfoCode: { fontSize: 12, background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '2px 8px', fontWeight: 600 },
  subjectInfoCount: { fontSize: 12, color: '#94a3b8' },
  newSubjectForm: { marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  createBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer', color: '#64748b' },

  itemsCard: {
    background: '#fff', borderRadius: 12, padding: '18px 24px',
    marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
  },
  itemsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  itemsLabel: { fontSize: 14, fontWeight: 700, color: '#1e293b' },
  addItemBtn: { background: 'none', border: '1px solid #059669', color: '#059669', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  newItemForm: { marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  itemsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 },
  itemCard: { border: '1.5px solid', borderRadius: 8, padding: '12px 10px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' },
  itemName: { fontSize: 13, fontWeight: 600, color: '#1e293b', textAlign: 'center', paddingRight: 20 },
  itemEditBtn: { position: 'absolute', top: 4, right: 26, background: 'none', border: 'none', color: '#94a3b8', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  itemDeleteBtn: { position: 'absolute', top: 4, right: 4, background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  itemEditHint: { position: 'absolute', top: 4, right: 4, fontSize: 11, color: '#f59e0b' },
  editSubjectBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px', color: '#94a3b8' },
  editItemModeBtn: { background: 'none', border: '1px solid #f59e0b', color: '#d97706', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  editItemModeActiveBtn: { background: '#fef3c7', border: '1px solid #f59e0b', color: '#d97706', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  editItemBanner: { fontSize: 12, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 12px', marginBottom: 10 },
  empty: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' },

  card: { background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 },
  cardDesc: { color: '#64748b', marginBottom: 24 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 },
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  primaryBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '13px 24px', fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  outlineBtn: { background: '#fff', color: '#2563eb', border: '1.5px solid #2563eb', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rubricHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },

  loadingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', textAlign: 'center' },
  spinner: {
    width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#2563eb',
    borderRadius: '50%', marginBottom: 24,
    animation: 'spin 1s linear infinite',
  },

  /* 채점 모델 선택 */
  modelPickerCard: {
    marginTop: 24, padding: '18px 20px',
    background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
  },
  modelPickerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, flexWrap: 'wrap', gap: 8,
  },
  modelPickerTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b' },
  modelPickerHint: { fontSize: 12, color: '#64748b' },
  modelPickerEmpty: { fontSize: 13, color: '#94a3b8', padding: '12px 0', textAlign: 'center' },
  modelPickerList: { display: 'flex', flexDirection: 'column', gap: 8 },
  modelOption: {
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  modelOptionSelected: {
    background: '#eff6ff', borderColor: '#2563eb',
  },
  modelOptionLabel: {
    fontSize: 14, color: '#1e293b', display: 'flex',
    alignItems: 'center', gap: 8, flex: 1,
  },
  modelProviderBadge: (provider) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
    background: provider === 'fireworks' ? '#fef3c7' : '#dbeafe',
    color: provider === 'fireworks' ? '#b45309' : '#1d4ed8',
    textTransform: 'uppercase', letterSpacing: 0.5,
  }),
};

/* Inject spinner animation */
if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const style = document.createElement('style');
  style.id = 'spinner-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
