import React from 'react';

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
            <div style={nb.problemBadge}>
              문제 {problem.problem_id}
              <span style={{
                ...nb.matchBadge,
                background: problem.output_match ? '#dcfce7' : '#fef9c3',
                color: problem.output_match ? '#16a34a' : '#b45309',
              }}>
                {problem.output_match ? '✓ 출력 일치' : '△ 출력 불일치'}
              </span>
            </div>

            {problem.code_cells && problem.code_cells.length > 0 ? (
              problem.code_cells.map((cell, idx) => (
                <div key={idx} style={nb.cell}>
                  <div style={nb.cellIn}>
                    <span style={nb.cellLabel}>In [{idx + 1}]:</span>
                    <pre style={nb.code}>{cell.source || '(빈 셀)'}</pre>
                  </div>
                  {cell.outputs && cell.outputs.length > 0 && (
                    <div style={nb.cellOut}>
                      <span style={nb.cellOutLabel}>Out:</span>
                      <div style={nb.output}>
                        {cell.outputs.map((o, oi) => (
                          <pre key={oi} style={nb.outputText}>{o.text}</pre>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={nb.empty}>제출된 코드가 없습니다</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackPanel({ student }) {
  const ratio = student.max_total_score > 0
    ? (student.total_score / student.max_total_score * 100).toFixed(1)
    : 0;

  return (
    <div style={fb.panel}>
      <div style={fb.panelHeader}>
        <span style={fb.panelTitle}>🤖 AI 채점 결과</span>
        <div style={fb.scoreBox}>
          <span style={fb.scoreNum}>{student.total_score.toFixed(2)}</span>
          <span style={fb.scoreDen}>/{student.max_total_score}</span>
          <span style={fb.scorePct}>{ratio}%</span>
        </div>
      </div>

      {student.error && (
        <div style={fb.errorBox}>⚠️ {student.error}</div>
      )}

      <div style={fb.body}>
        {student.problems.map(problem => {
          const pRatio = problem.full_score > 0
            ? problem.obtained_score / problem.full_score
            : 0;
          const barColor = pRatio >= 0.8 ? '#059669' : pRatio >= 0.5 ? '#d97706' : '#dc2626';

          return (
            <div key={problem.problem_id} style={fb.problem}>
              <div style={fb.problemHeader}>
                <span style={fb.problemTitle}>문제 {problem.problem_id}</span>
                <span style={{ ...fb.problemScore, color: barColor }}>
                  {problem.obtained_score.toFixed(2)} / {problem.full_score}점
                </span>
              </div>
              <div style={fb.progressBar}>
                <div style={{ ...fb.progressFill, width: `${pRatio * 100}%`, background: barColor }} />
              </div>

              <div style={fb.criteriaList}>
                {problem.partial_scores.map((ps, i) => {
                  const scoreColor = ps.score === ps.max_score ? '#059669'
                    : ps.score > 0 ? '#d97706' : '#dc2626';
                  return (
                    <div key={i} style={fb.criterion}>
                      <div style={fb.criterionTop}>
                        <span style={fb.criterionItem}>{ps.item}</span>
                        <span style={{ ...fb.criterionScore, color: scoreColor }}>
                          {ps.score.toFixed(2)} / {ps.max_score}점
                        </span>
                      </div>
                      {ps.reason && <p style={fb.reason}>{ps.reason}</p>}
                    </div>
                  );
                })}
              </div>

              {problem.ai_feedback && (
                <div style={fb.aiFeedback}>
                  <p style={fb.aiFeedbackLabel}>💡 종합 피드백</p>
                  <p style={fb.aiFeedbackText}>{problem.ai_feedback}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentDetailModal({ student, onClose }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.container} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.studentName}>{student.student_id}</div>
            <div style={s.studentFile}>{student.filename}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕ 닫기</button>
        </div>

        {/* Split body */}
        <div style={s.body}>
          <NotebookPanel student={student} />
          <div style={s.divider} />
          <FeedbackPanel student={student} />
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
  matchBadge: {
    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
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
  empty: {
    fontSize: 13, color: '#6c7086', padding: '20px',
    textAlign: 'center', fontStyle: 'italic',
  },
};

/* ── Feedback panel (right) ── */
const fb = {
  panel: {
    width: 420, flexShrink: 0,
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
  body: { overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  problem: { border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  problemHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
  },
  problemTitle: { fontWeight: 700, fontSize: 15, color: '#1e293b' },
  problemScore: { fontWeight: 700, fontSize: 15 },
  progressBar: {
    height: 4, background: '#e2e8f0', margin: '0 16px 12px',
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99, transition: 'width 0.3s' },
  criteriaList: { padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  criterion: { background: '#f8fafc', borderRadius: 8, padding: '10px 12px' },
  criterionTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  criterionItem: { fontWeight: 600, fontSize: 13, color: '#374151' },
  criterionScore: { fontWeight: 700, fontSize: 13 },
  reason: { fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: 0 },
  aiFeedback: { margin: '0 16px 14px', background: '#eff6ff', borderRadius: 8, padding: '10px 12px' },
  aiFeedbackLabel: { fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 5 },
  aiFeedbackText: { fontSize: 12, color: '#374151', lineHeight: 1.7, margin: 0 },
};
