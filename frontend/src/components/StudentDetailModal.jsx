import React, { useState, useEffect } from 'react';
import { gradingAPI } from '../services/api';
import { useAuth } from '../App';

function NotebookPanel({ student }) {
  return (
    <div style={nb.panel}>
      <div style={nb.panelHeader}>
        <span style={nb.panelTitle}>📓 학생 노트북</span>
        <span style={nb.panelSub}>{student.filename}</span>
      </div>
      <div style={nb.body}>
        {student.problems.map(problem => (
          <div key={problem.problem_id} style={nb.problemSection}>
            {problem.preamble_cells && problem.preamble_cells.length > 0 && (() => {
              let codeIdx = 0;
              return problem.preamble_cells.map((cell, idx) => {
                if (cell.cell_type === 'markdown') {
                  return <div key={`pre-${idx}`} style={nb.markdownCell}><pre style={nb.markdownText}>{cell.source}</pre></div>;
                }
                codeIdx++;
                return (
                  <div key={`pre-${idx}`} style={nb.cell}>
                    <div style={nb.cellIn}>
                      <span style={nb.cellLabel}>In [{codeIdx}]:</span>
                      <pre style={nb.code}>{cell.source || '(빈 셀)'}</pre>
                    </div>
                    {cell.outputs && cell.outputs.length > 0 && (
                      <div style={nb.cellOut}>
                        <span style={nb.cellOutLabel}>Out:</span>
                        <div style={nb.output}>{cell.outputs.map((o, oi) => (
                          <React.Fragment key={oi}>
                            {o.output_type === 'error'
                              ? <pre style={nb.errorText}>{o.text}</pre>
                              : o.text && <pre style={nb.outputText}>{o.text}</pre>}
                            {o.image && <img src={`data:image/png;base64,${o.image}`} alt="output" style={nb.outputImage} />}
                          </React.Fragment>
                        ))}</div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            <div style={nb.problemBadge}>
              문제 {problem.problem_id}
            </div>

            {problem.problem_description && (
              <div style={nb.problemDesc}>
                {problem.problem_description}
              </div>
            )}

            {problem.code_cells && problem.code_cells.length > 0 ? (() => {
              let codeIdx = 0;
              return problem.code_cells.map((cell, idx) => {
                if (cell.cell_type === 'markdown') {
                  if (cell.is_student_answer) {
                    return (
                      <div key={idx} style={nb.answerCell}>
                        <div style={nb.answerLabel}>📝 학생 답변</div>
                        <pre style={nb.answerText}>{cell.source}</pre>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} style={nb.markdownCell}>
                      <pre style={nb.markdownText}>{cell.source}</pre>
                    </div>
                  );
                }
                codeIdx++;
                return (
                  <div key={idx} style={nb.cell}>
                    <div style={nb.cellIn}>
                      <span style={nb.cellLabel}>In [{codeIdx}]:</span>
                      <pre style={nb.code}>{cell.source || '(빈 셀)'}</pre>
                    </div>
                    {cell.outputs && cell.outputs.length > 0 && (
                      <div style={nb.cellOut}>
                        <span style={nb.cellOutLabel}>Out:</span>
                        <div style={nb.output}>
                          {cell.outputs.map((o, oi) => (
                            <React.Fragment key={oi}>
                              {o.output_type === 'error'
                                ? <pre style={nb.errorText}>{o.text}</pre>
                                : o.text && <pre style={nb.outputText}>{o.text}</pre>}
                              {o.image && <img src={`data:image/png;base64,${o.image}`} alt="output" style={nb.outputImage} />}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })() : (
              <div style={nb.empty}>제출된 코드가 없습니다</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemCard({ problem, sessionId, studentFilename, canEdit, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draftPartial, setDraftPartial] = useState(
    (problem.partial_scores || []).map(ps => ({ score: ps.score, reason: ps.reason || '' }))
  );
  const [draftScore, setDraftScore] = useState(problem.obtained_score);
  const [draftFeedback, setDraftFeedback] = useState(problem.professor_feedback || '');

  const hasPartials = problem.partial_scores && problem.partial_scores.length > 0;

  const pRatio = problem.full_score > 0 ? problem.obtained_score / problem.full_score : 0;
  const isFullScore = pRatio >= 1.0;
  const isZero = problem.obtained_score === 0;
  const statusColor = isFullScore ? '#059669' : isZero ? '#dc2626' : '#d97706';
  const statusBg = isFullScore ? '#f0fdf4' : isZero ? '#fef2f2' : '#fffbeb';
  const statusBorder = isFullScore ? '#bbf7d0' : isZero ? '#fecaca' : '#fde68a';

  const handleStartEdit = () => {
    setDraftPartial((problem.partial_scores || []).map(ps => ({ score: ps.score, reason: ps.reason || '' })));
    setDraftScore(problem.obtained_score);
    setDraftFeedback(problem.professor_feedback || '');
    setError('');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        student_filename: studentFilename,
        problem_id: problem.problem_id,
        professor_feedback: draftFeedback,
      };
      if (hasPartials) {
        payload.partial_scores = draftPartial.map((d, i) => ({
          item: problem.partial_scores[i].item,
          max_score: problem.partial_scores[i].max_score,
          score: parseFloat(d.score) || 0,
          reason: d.reason,
        }));
      } else {
        payload.obtained_score = parseFloat(draftScore) || 0;
      }
      const res = await gradingAPI.reviseProblem(sessionId, payload);
      onUpdated && onUpdated(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...fb.problem, borderColor: problem.has_ai_error ? '#fde68a' : statusBorder, borderLeftWidth: 4, borderLeftColor: problem.has_ai_error ? '#f59e0b' : statusColor }}>
      <div style={{ ...fb.problemHeader, background: problem.has_ai_error ? '#fef3c7' : statusBg, borderBottomColor: problem.has_ai_error ? '#fde68a' : statusBorder }}>
        <span style={fb.problemTitle}>
          문제 {problem.problem_id}
          {problem.is_revised && <span style={fb.revisedBadge}>✏️ 수정됨</span>}
          {problem.has_ai_error && <span style={fb.aiErrorBadge}>⚠️ AI 채점 오류</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...fb.problemScore, color: statusColor }}>
            {problem.obtained_score.toFixed(2)} / {problem.full_score}점
          </span>
          {canEdit && !editing && (
            <button style={fb.editBtn} onClick={handleStartEdit}>✏️ 수정</button>
          )}
        </div>
      </div>

      {problem.evaluation_guideline && (
        <div style={fb.problemDescription}>📌 {problem.evaluation_guideline}</div>
      )}
      <div style={fb.progressBar}>
        <div style={{ ...fb.progressFill, width: `${pRatio * 100}%`, background: statusColor }} />
      </div>

      <div style={fb.criteriaList}>
        {hasPartials ? (
          problem.partial_scores.map((ps, i) => {
            const scoreColor = ps.score === ps.max_score ? '#059669' : ps.score > 0 ? '#d97706' : '#dc2626';
            return (
              <div key={i} style={fb.criterion}>
                <div style={fb.criterionTop}>
                  <span style={fb.criterionItem}>{ps.item}</span>
                  {editing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max={ps.max_score}
                        value={draftPartial[i]?.score ?? 0}
                        onChange={e => {
                          const next = [...draftPartial];
                          next[i] = { ...next[i], score: e.target.value };
                          setDraftPartial(next);
                        }}
                        style={fb.scoreInput}
                      />
                      <span style={{ fontSize: 13, color: '#64748b' }}>/ {ps.max_score}점</span>
                    </div>
                  ) : (
                    <span style={{ ...fb.criterionScore, color: scoreColor }}>
                      {ps.score.toFixed(2)} / {ps.max_score}점
                    </span>
                  )}
                </div>
                {editing ? (
                  <textarea
                    value={draftPartial[i]?.reason ?? ''}
                    onChange={e => {
                      const next = [...draftPartial];
                      next[i] = { ...next[i], reason: e.target.value };
                      setDraftPartial(next);
                    }}
                    style={fb.reasonInput}
                    rows={2}
                    placeholder="채점 사유"
                  />
                ) : (
                  ps.reason && <p style={fb.reason}>{ps.reason}</p>
                )}
              </div>
            );
          })
        ) : (
          editing && (
            <div style={fb.criterion}>
              <div style={fb.criterionTop}>
                <span style={fb.criterionItem}>총점 직접 수정</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max={problem.full_score}
                    value={draftScore}
                    onChange={e => setDraftScore(e.target.value)}
                    style={fb.scoreInput}
                  />
                  <span style={{ fontSize: 13, color: '#64748b' }}>/ {problem.full_score}점</span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {problem.ai_feedback && (
        <div style={fb.aiFeedback}>
          <p style={fb.aiFeedbackLabel}>💡 AI 종합 피드백</p>
          <p style={fb.aiFeedbackText}>{problem.ai_feedback}</p>
        </div>
      )}

      {editing ? (
        <div style={fb.profFeedback}>
          <p style={fb.profFeedbackLabel}>👨‍🏫 교수 코멘트</p>
          <textarea
            value={draftFeedback}
            onChange={e => setDraftFeedback(e.target.value)}
            placeholder="교수님의 코멘트를 입력하세요"
            style={fb.profFeedbackInput}
            rows={3}
          />
        </div>
      ) : (
        problem.professor_feedback && (
          <div style={fb.profFeedback}>
            <p style={fb.profFeedbackLabel}>👨‍🏫 교수 코멘트</p>
            <p style={fb.profFeedbackText}>{problem.professor_feedback}</p>
          </div>
        )
      )}

      {editing && (
        <div style={fb.editActions}>
          {error && <span style={fb.editError}>{error}</span>}
          <button style={fb.cancelBtn} onClick={handleCancel} disabled={saving}>취소</button>
          <button style={fb.confirmBtn} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '✓ 확인'}
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackPanel({ student, sessionId, onStudentUpdate }) {
  const { user } = useAuth();
  const canEdit = user && (user.role === 'professor' || user.role === 'admin');
  const ratio = student.max_total_score > 0
    ? (student.total_score / student.max_total_score * 100).toFixed(1)
    : 0;

  const handleProblemUpdated = (res) => {
    if (!onStudentUpdate) return;
    const updatedProblems = student.problems.map(p =>
      String(p.problem_id) === String(res.updated_problem.problem_id) ? res.updated_problem : p
    );
    onStudentUpdate({
      ...student,
      total_score: res.updated_total_score,
      problems: updatedProblems,
    });
  };

  return (
    <div style={fb.panel}>
      <div style={fb.panelHeader}>
        <span style={fb.panelTitle}>🤖 AI 채점 결과 {canEdit && <span style={fb.editableTag}>편집 가능</span>}</span>
        <div style={fb.scoreBox}>
          <span style={fb.scoreNum}>{student.total_score.toFixed(2)}</span>
          <span style={fb.scoreDen}>/{student.max_total_score}</span>
          <span style={fb.scorePct}>{ratio}%</span>
        </div>
      </div>

      {student.error && <div style={fb.errorBox}>⚠️ {student.error}</div>}

      <div style={fb.body}>
        {student.problems.map(problem => (
          <ProblemCard
            key={problem.problem_id}
            problem={problem}
            sessionId={sessionId}
            studentFilename={student.filename}
            canEdit={canEdit}
            onUpdated={handleProblemUpdated}
          />
        ))}
      </div>
    </div>
  );
}

export default function StudentDetailModal({ student, sessionId, onClose, onStudentUpdate }) {
  const [currentStudent, setCurrentStudent] = useState(student);
  const [fullStudent, setFullStudent] = useState(null);
  const [cellsLoading, setCellsLoading] = useState(true);
  const [cellsError, setCellsError] = useState('');

  useEffect(() => {
    setCellsLoading(true);
    setCellsError('');
    gradingAPI.getStudentDetail(sessionId, student.filename)
      .then(res => setFullStudent(res.data))
      .catch(() => setCellsError('노트북 데이터를 불러올 수 없습니다'))
      .finally(() => setCellsLoading(false));
  }, [sessionId, student.filename]);

  const handleStudentUpdate = (updated) => {
    setCurrentStudent(updated);
    onStudentUpdate && onStudentUpdate(updated);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.container} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.studentName}>{currentStudent.student_id}</div>
            <div style={s.studentFile}>{currentStudent.filename}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕ 닫기</button>
        </div>

        {/* Split body */}
        <div style={s.body}>
          {cellsLoading ? (
            <div style={s.notebookLoading}>노트북 로딩 중...</div>
          ) : cellsError ? (
            <div style={s.notebookError}>{cellsError}</div>
          ) : (
            <NotebookPanel student={fullStudent} />
          )}
          <div style={s.divider} />
          <FeedbackPanel
            student={currentStudent}
            sessionId={sessionId}
            onStudentUpdate={handleStudentUpdate}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Overlay / Container ── */
const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.65)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  container: {
    background: '#f8fafc', borderRadius: 16,
    width: '100%', maxWidth: 1400,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '16px 28px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: 12 },
  studentName: { fontSize: 20, fontWeight: 700, color: '#1e293b' },
  studentFile: { fontSize: 13, color: '#94a3b8' },
  closeBtn: {
    background: 'none', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
    fontSize: 14, color: '#64748b', fontWeight: 500,
  },
  body: {
    display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0,
  },
  divider: {
    width: 1, background: '#e2e8f0', flexShrink: 0,
  },
  notebookLoading: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#1e1e2e', color: '#6c7086', fontSize: 14,
  },
  notebookError: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#1e1e2e', color: '#f38ba8', fontSize: 14,
  },
};

/* ── Notebook panel (left) ── */
const nb = {
  panel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: '#1e1e2e',
  },
  panelHeader: {
    padding: '14px 20px', background: '#181825',
    borderBottom: '1px solid #313244',
    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
  },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#cdd6f4' },
  panelSub: { fontSize: 12, color: '#6c7086' },
  body: { overflowY: 'auto', flex: 1, padding: '16px' },
  problemSection: { marginBottom: 24 },
  problemBadge: {
    display: 'flex', alignItems: 'center', gap: 10,
    fontSize: 13, fontWeight: 700, color: '#89b4fa',
    marginBottom: 10, paddingLeft: 4,
  },
  problemDesc: {
    background: '#2d2d3a', border: '1px solid #404050', borderRadius: 6,
    padding: '10px 12px', marginBottom: 12, fontSize: 12,
    color: '#a6e3a1', lineHeight: 1.6, whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  cell: {
    border: '1px solid #313244', borderRadius: 8,
    marginBottom: 10, overflow: 'hidden',
  },
  cellIn: { background: '#181825', padding: '10px 14px' },
  cellLabel: { fontSize: 11, color: '#6c7086', display: 'block', marginBottom: 6 },
  code: {
    margin: 0, fontSize: 13, fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    color: '#cdd6f4', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  },
  cellOut: { background: '#1e1e2e', borderTop: '1px solid #313244', padding: '8px 14px' },
  cellOutLabel: { fontSize: 11, color: '#6c7086', display: 'block', marginBottom: 4 },
  output: {},
  outputText: {
    margin: 0, fontSize: 13, fontFamily: 'monospace',
    color: '#a6e3a1', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  },
  outputImage: {
    maxWidth: '100%', borderRadius: 4, marginTop: 4,
    background: '#fff',
  },
  errorText: {
    margin: 0, fontSize: 13, fontFamily: 'monospace',
    color: '#f38ba8', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    background: '#302030', borderRadius: 4, padding: '8px 10px',
    borderLeft: '3px solid #f38ba8',
  },
  markdownCell: {
    border: '1px solid #45475a', borderRadius: 8,
    marginBottom: 10, overflow: 'hidden',
    background: '#2a2a3d',
  },
  markdownText: {
    margin: 0, padding: '10px 14px',
    fontSize: 13, fontFamily: 'inherit',
    color: '#f5c2e7', lineHeight: 1.7,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  answerCell: {
    border: '1px solid #74c7ec', borderRadius: 8,
    marginBottom: 10, overflow: 'hidden',
    background: '#1e3a5f',
  },
  answerLabel: {
    fontSize: 11, fontWeight: 700, color: '#74c7ec',
    background: '#1e293b', padding: '6px 14px',
    borderBottom: '1px solid #314056', letterSpacing: 0.5,
  },
  answerText: {
    margin: 0, padding: '10px 14px',
    fontSize: 13, fontFamily: 'inherit',
    color: '#cdd6f4', lineHeight: 1.7,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  empty: {
    fontSize: 13, color: '#6c7086', padding: '20px',
    textAlign: 'center', fontStyle: 'italic',
  },
};

/* ── Feedback panel (right) ── */
const fb = {
  panel: {
    width: 500, flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: '#fff',
  },
  panelHeader: {
    padding: '14px 20px', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexShrink: 0,
  },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b' },
  scoreBox: { display: 'flex', alignItems: 'baseline', gap: 4 },
  scoreNum: { fontSize: 24, fontWeight: 700, color: '#1e293b' },
  scoreDen: { fontSize: 14, color: '#94a3b8' },
  scorePct: {
    fontSize: 12, color: '#fff', background: '#2563eb',
    borderRadius: 20, padding: '2px 8px', marginLeft: 6, fontWeight: 600,
  },
  errorBox: {
    margin: '12px 20px 0', background: '#fef2f2',
    border: '1px solid #fecaca', color: '#dc2626',
    borderRadius: 8, padding: '10px 14px', fontSize: 13,
  },
  body: {
    overflowY: 'auto', flex: 1, padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  problem: {
    border: '1px solid #e2e8f0', borderRadius: 12,
    overflow: 'visible',
  },
  problemHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    borderRadius: '12px 12px 0 0',
  },
  problemTitle: { fontWeight: 700, fontSize: 15, color: '#1e293b' },
  problemScore: { fontWeight: 700, fontSize: 15 },
  problemDescription: {
    padding: '12px 16px', background: '#f0f9ff',
    borderBottom: '1px solid #e2e8f0', fontSize: 13,
    color: '#1e293b', lineHeight: 1.6,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  progressBar: {
    height: 4, background: '#e2e8f0', margin: '0 16px 12px',
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99, transition: 'width 0.3s' },
  criteriaList: { padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 },
  criterion: {
    background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
    border: '1px solid #f1f5f9',
  },
  criterionTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 10, marginBottom: 6,
  },
  criterionItem: { fontWeight: 600, fontSize: 13, color: '#374151', flex: 1, wordBreak: 'break-word' },
  criterionScore: { fontWeight: 700, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' },
  reason: {
    fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  aiFeedback: {
    margin: '0 16px 14px', background: '#eff6ff', borderRadius: 10, padding: '14px 16px',
    border: '1px solid #dbeafe',
  },
  aiFeedbackLabel: { fontSize: 12, fontWeight: 700, color: '#2563eb', margin: '0 0 8px' },
  aiFeedbackText: {
    fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  profFeedback: {
    margin: '0 16px 14px', background: '#fef9c3', borderRadius: 10, padding: '14px 16px',
    border: '1px solid #fde047',
  },
  profFeedbackLabel: { fontSize: 12, fontWeight: 700, color: '#a16207', margin: '0 0 8px' },
  profFeedbackText: {
    fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  },
  profFeedbackInput: {
    width: '100%', padding: '8px 10px', border: '1.5px solid #fde047',
    borderRadius: 6, fontSize: 13, outline: 'none', resize: 'vertical',
    fontFamily: 'inherit', boxSizing: 'border-box', background: '#fffbeb',
  },
  editBtn: {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 500,
  },
  editableTag: {
    fontSize: 10, background: '#dcfce7', color: '#15803d',
    borderRadius: 4, padding: '2px 6px', marginLeft: 6, fontWeight: 600,
  },
  revisedBadge: {
    fontSize: 11, background: '#fef3c7', color: '#a16207',
    borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 600,
  },
  aiErrorBadge: {
    fontSize: 11, background: 'rgba(255, 140, 0, 0.18)', color: '#b45309',
    borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 600,
    border: '1px solid rgba(255, 140, 0, 0.45)',
  },
  scoreInput: {
    width: 60, padding: '4px 6px', border: '1.5px solid #cbd5e1',
    borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none',
  },
  reasonInput: {
    width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1',
    borderRadius: 6, fontSize: 13, outline: 'none', resize: 'vertical',
    fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 6,
  },
  editActions: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
    padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
  },
  editError: { fontSize: 12, color: '#dc2626', flex: 1 },
  cancelBtn: {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
    padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#475569',
  },
  confirmBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
};
