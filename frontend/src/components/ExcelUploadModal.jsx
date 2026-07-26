import React, { useState, useEffect } from 'react';
import FileDropzone from './FileDropzone';
import { gradingAPI } from '../services/api';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_PREVIEW_ROWS = 200;
const MAX_ERROR_ROWS = 20;

/**
 * 수정한 Excel을 올려 점수를 일괄 반영하는 모달.
 * 업로드 → 무엇이 바뀌는지 미리보기 → 교수가 확인 후 반영. (실수로 점수가 통째로 바뀌는 것을 막는다)
 */
export default function ExcelUploadModal({ sessionId, onClose, onApplied }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const handleDrop = (files) => {
    if (!files || !files.length) return;
    setFile(files[0]);
    setPreview(null);
    setError('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await gradingAPI.uploadExcelPreview(sessionId, file);
      setPreview(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || '파일을 읽지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!preview || !preview.changes.length) return;
    setApplying(true);
    setError('');
    try {
      const res = await gradingAPI.applyExcelRevision(sessionId, preview.preview_id);
      onApplied && onApplied(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || '반영에 실패했습니다');
      setApplying(false);
    }
  };

  const changes = preview?.changes || [];
  const errors = preview?.errors || [];
  const shown = changes.slice(0, MAX_PREVIEW_ROWS);

  // 검토 중이거나 반영 중일 때는 바깥 클릭/Esc로 닫지 않는다 (확인한 변경 목록이 통째로 날아간다)
  const canDismiss = !applying && !loading && !preview;

  const handleDismiss = () => {
    if (canDismiss) onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && canDismiss) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canDismiss, onClose]);

  return (
    <div style={s.overlay} onClick={handleDismiss}>
      <div style={s.container} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.titleWrap}>
            <div style={s.title}>📤 Excel로 점수 수정</div>
            <div style={s.step}>{preview ? '2단계 · 변경사항 확인' : '1단계 · 파일 선택'}</div>
          </div>
          <button
            style={applying ? s.closeBtnOff : s.closeBtn}
            onClick={onClose}
            disabled={applying}
          >
            ✕ 닫기
          </button>
        </div>

        <div style={s.body}>
          {/* 반영 실패 메시지는 본문 맨 위에 — 긴 표 아래에 두면 스크롤 밖으로 밀려 보이지 않는다 */}
          {error && <div style={s.errorMsg}>⚠️ {error}</div>}

          {!preview && (
            <>
              <div style={s.guide}>
                <div style={s.guideTitle}>「AI분석결과」 시트에서 수정해주세요</div>
                <ul style={s.guideList}>
                  <li><b>수정점수</b> 칸에 새 점수를 입력하세요. <b>비워두면 그대로</b> 유지됩니다.</li>
                  <li>0점을 주려면 <b>0</b> 을 입력하세요. (빈칸과 다릅니다)</li>
                  <li><b>교수코멘트</b>도 함께 수정할 수 있습니다. 지우려면 <b>-</b> 를 입력하세요.</li>
                  <li>행을 정렬하거나 지워도 괜찮습니다. 수식 대신 값을 입력해주세요.</li>
                </ul>
              </div>

              <FileDropzone
                label="수정한 Excel 파일 (.xlsx)"
                icon="📊"
                accept={{ [XLSX_MIME]: ['.xlsx'] }}
                onDrop={handleDrop}
                file={file}
              />

              {loading && (
                <div style={s.loadingBox}>
                  ⏳ 파일을 읽고 변경사항을 찾는 중입니다...
                </div>
              )}
            </>
          )}

          {preview && (
            <>
              {/* 덮어쓰기 경고가 가장 중요한 신호이므로 요약보다 먼저 보여준다 */}
              {preview.is_stale && (
                <div style={s.staleBanner}>
                  <div style={s.staleTitle}>⚠️ 이 파일을 받은 뒤 웹에서 점수가 수정되었습니다</div>
                  아래 <b>이전</b> 칸은 지금 저장되어 있는 점수입니다.
                  반영하면 웹에서 수정한 내용이 이 엑셀의 값으로 <b>덮어써집니다.</b>
                </div>
              )}

              {preview.warnings.map((w, i) => (
                <div key={i} style={s.warnBanner}>{w}</div>
              ))}

              {errors.length > 0 && (
                <div style={s.errorBox}>
                  <div style={s.errorTitle}>
                    ⛔ 읽을 수 없어 건너뛰는 행 {errors.length}건 — 나머지는 정상 반영됩니다
                  </div>
                  {errors.slice(0, MAX_ERROR_ROWS).map((e, i) => (
                    <div key={i} style={s.errorItem}>
                      <b>{e.excel_row}행</b> · {e.message}
                    </div>
                  ))}
                  {errors.length > MAX_ERROR_ROWS && (
                    <div style={s.errorMore}>
                      외 {errors.length - MAX_ERROR_ROWS}건이 더 있습니다 (모두 건너뜁니다)
                    </div>
                  )}
                </div>
              )}

              <div style={s.summary}>
                <div style={s.summaryItem}>
                  <span style={s.summaryLabel}>학생</span>
                  <span style={s.summaryValue}>{preview.affected_students}명</span>
                </div>
                <div style={s.summaryDivider} />
                <div style={s.summaryItem}>
                  <span style={s.summaryLabel}>문제</span>
                  <span style={s.summaryValue}>{preview.affected_problems}개</span>
                </div>
                <div style={s.summaryDivider} />
                <div style={s.summaryItem}>
                  <span style={s.summaryLabel}>변경</span>
                  <span style={{ ...s.summaryValue, color: '#2563eb' }}>{changes.length}건</span>
                </div>
              </div>

              {changes.length === 0 ? (
                <div style={s.empty}>
                  <div style={s.emptyIcon}>📄</div>
                  <div style={s.emptyTitle}>반영할 변경사항이 없습니다</div>
                  <div style={s.emptySub}>
                    「AI분석결과」 시트의 <b>수정점수</b> 칸이 모두 비어 있거나,
                    입력한 값이 현재 점수와 같습니다.<br />
                    값을 입력해 저장한 뒤 <b>다시 선택</b>으로 올려주세요.
                  </div>
                </div>
              ) : (
                <div style={s.tableWrap}>
                  <div style={s.tableScroll}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.thLeft}>학번</th>
                          <th style={s.thLeft}>이름</th>
                          <th style={s.thLeft}>문제</th>
                          <th style={s.thLeft}>채점항목</th>
                          <th style={s.thRight}>이전</th>
                          <th style={s.thCenter} aria-label="변경 방향" />
                          <th style={s.thRight}>변경 후</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((c, i) => {
                          const isScore = c.field === 'score';
                          // 점수 증감은 색과 함께 기호(▲/▼)로도 표시한다 (색만으로 구분하지 않기 위해)
                          const oldNum = parseFloat(c.old_value || 0);
                          const newNum = parseFloat(c.new_value || 0);
                          const up = isScore && newNum > oldNum;
                          const down = isScore && newNum < oldNum;
                          const diffColor = up ? '#047857' : down ? '#b91c1c' : '#1e293b';
                          return (
                            <tr key={i} style={i % 2 ? s.trAlt : undefined}>
                              <td style={s.tdNum}>{c.student_id || '-'}</td>
                              <td style={s.tdName} title={c.student_name || ''}>{c.student_name || '-'}</td>
                              <td style={s.tdLeft}>Q{c.problem_id}</td>
                              <td style={s.tdItem} title={c.item_name || ''}>
                                {isScore
                                  ? (c.item_name || '문제 전체 점수')
                                  : <span style={s.commentTag}>교수코멘트</span>}
                              </td>
                              <td style={isScore ? s.tdOldNum : s.tdOld} title={c.old_value || ''}>
                                {formatValue(c.old_value, isScore)}
                              </td>
                              <td style={{ ...s.tdArrow, color: isScore ? diffColor : '#64748b' }}>
                                {up ? '▲' : down ? '▼' : '→'}
                              </td>
                              <td
                                style={{ ...(isScore ? s.tdNewNum : s.tdNew), color: diffColor }}
                                title={c.new_value || ''}
                              >
                                {formatValue(c.new_value, isScore)}
                                {isScore && c.max_score != null && (
                                  <span style={s.maxScore}> / {c.max_score}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {changes.length > MAX_PREVIEW_ROWS && (
                    <div style={s.more}>
                      화면에는 상위 {MAX_PREVIEW_ROWS}건만 표시합니다 —
                      반영하면 <b>{changes.length}건 전부</b> 적용됩니다
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        <div style={s.footer}>
          {/* 되돌리기 어려운 동작이므로 버튼 옆에 결과를 한 줄로 다시 알린다 */}
          <div style={s.footerNote}>
            {preview && changes.length > 0 && (applying
              ? '점수를 저장하는 중입니다. 창을 닫지 마세요.'
              : `저장된 점수 ${changes.length}건을 엑셀 값으로 덮어씁니다.`)}
          </div>
          {!preview ? (
            <>
              <button style={s.ghostBtn} onClick={onClose} disabled={loading}>취소</button>
              <button
                style={!file || loading ? s.primaryBtnOff : s.primaryBtn}
                onClick={handlePreview}
                disabled={!file || loading}
              >
                {loading ? '읽는 중...' : '변경사항 확인'}
              </button>
            </>
          ) : (
            <>
              <button
                style={applying ? s.ghostBtnOff : s.ghostBtn}
                onClick={() => { setPreview(null); setFile(null); setError(''); }}
                disabled={applying}
              >
                다시 선택
              </button>
              <button
                style={!changes.length || applying ? s.applyBtnOff : s.applyBtn}
                onClick={handleApply}
                disabled={!changes.length || applying}
              >
                {applying ? '반영 중...' : `반영하기 (${changes.length}건)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatValue(value, isScore) {
  // 빈 점수를 '0'으로 적으면 실제 0점과 구분되지 않는다 — 미채점은 '—'로 표시한다
  if (value === null || value === undefined || value === '') {
    return <span style={s.emptyValue}>{isScore ? '—' : '(없음)'}</span>;
  }
  if (isScore) return Number(value);
  const text = String(value);
  return text.length > 40 ? text.slice(0, 40) + '…' : text;
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  container: {
    background: '#fff', borderRadius: 16,
    width: '100%', maxWidth: 900, maxHeight: '88vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  },
  header: {
    padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  titleWrap: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  title: { fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 },
  step: { fontSize: 12, fontWeight: 500, color: '#64748b' },
  closeBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 16px', cursor: 'pointer', fontSize: 14,
    color: '#64748b', fontWeight: 500, flexShrink: 0,
  },
  closeBtnOff: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 16px', cursor: 'not-allowed', fontSize: 14,
    color: '#cbd5e1', fontWeight: 500, flexShrink: 0,
  },
  body: { padding: 24, overflowY: 'auto', flex: 1, minHeight: 0 },
  guide: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: '16px 20px', marginBottom: 16,
  },
  guideTitle: { fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 8, lineHeight: 1.3 },
  guideList: {
    margin: 0, paddingLeft: 20, fontSize: 13, color: '#1e3a5f', lineHeight: 1.8,
  },
  loadingBox: {
    marginTop: 16, padding: '12px 16px', background: '#eff6ff',
    border: '1px solid #bfdbfe', borderRadius: 8,
    fontSize: 14, color: '#1e40af', fontWeight: 500, textAlign: 'center',
  },
  summary: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
    marginBottom: 16, padding: '12px 16px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 8,
  },
  summaryItem: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 12px' },
  summaryLabel: { fontSize: 12, fontWeight: 600, color: '#64748b' },
  summaryValue: {
    fontSize: 16, fontWeight: 700, color: '#1e293b',
    fontVariantNumeric: 'tabular-nums',
  },
  summaryDivider: { width: 1, height: 20, background: '#e2e8f0' },
  staleBanner: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#92400e',
    marginBottom: 12, lineHeight: 1.7,
  },
  staleTitle: { fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4, lineHeight: 1.4 },
  warnBanner: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, color: '#92400e',
    marginBottom: 8, lineHeight: 1.6,
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '12px 16px', marginBottom: 12,
  },
  errorTitle: { fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 8, lineHeight: 1.4 },
  errorItem: { fontSize: 13, color: '#991b1b', lineHeight: 1.7 },
  errorMore: { fontSize: 13, color: '#b91c1c', fontWeight: 600, lineHeight: 1.7, marginTop: 4 },
  errorMsg: {
    marginBottom: 16, padding: '12px 16px', background: '#fef2f2',
    border: '1px solid #fecaca', borderRadius: 8,
    fontSize: 14, color: '#b91c1c', fontWeight: 500, lineHeight: 1.6,
  },
  empty: {
    padding: '40px 24px', textAlign: 'center',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8, lineHeight: 1.3 },
  // 회색 배경 위 본문 — #64748b 로 대비 확보 (#94a3b8 은 4.5:1 미달)
  emptySub: { fontSize: 13, color: '#64748b', lineHeight: 1.7 },
  tableWrap: { border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' },
  // 컬럼이 많아 좁은 화면에서 잘린다 — 가로 스크롤은 표 안에서만 일어나게 한다
  tableScroll: { overflowX: 'auto', maxHeight: '46vh', overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thLeft: {
    background: '#f1f5f9', padding: '10px 12px', textAlign: 'left',
    fontWeight: 600, color: '#475569', fontSize: 12,
    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  },
  thRight: {
    background: '#f1f5f9', padding: '10px 12px', textAlign: 'right',
    fontWeight: 600, color: '#475569', fontSize: 12,
    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  },
  thCenter: {
    background: '#f1f5f9', padding: '10px 4px', width: 28,
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky', top: 0, zIndex: 1,
  },
  trAlt: { background: '#f8fafc' },
  tdLeft: {
    padding: '8px 12px', textAlign: 'left', color: '#334155',
    borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
  },
  // 학번은 자릿수 비교가 잦아 tabular-nums 로 세로를 맞춘다
  tdNum: {
    padding: '8px 12px', textAlign: 'left', color: '#334155',
    borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  tdName: {
    padding: '8px 12px', textAlign: 'left', color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdItem: {
    padding: '8px 12px', textAlign: 'left', color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdOld: {
    padding: '8px 12px', textAlign: 'right', color: '#64748b',
    borderBottom: '1px solid #f1f5f9',
    maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdOldNum: {
    padding: '8px 12px', textAlign: 'right', color: '#64748b',
    borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  tdArrow: {
    padding: '8px 4px', textAlign: 'center', fontSize: 12,
    borderBottom: '1px solid #f1f5f9',
  },
  tdNew: {
    padding: '8px 12px', textAlign: 'right', fontWeight: 700,
    borderBottom: '1px solid #f1f5f9',
    maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdNewNum: {
    padding: '8px 12px', textAlign: 'right', fontWeight: 700,
    borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  maxScore: { fontSize: 12, color: '#64748b', fontWeight: 400 },
  emptyValue: { color: '#94a3b8', fontWeight: 400 },
  commentTag: {
    fontSize: 12, color: '#6d28d9', background: '#f5f3ff',
    border: '1px solid #ddd6fe', borderRadius: 4, padding: '2px 8px',
  },
  more: {
    padding: '12px 16px', fontSize: 13, color: '#475569',
    background: '#f8fafc', borderTop: '1px solid #e2e8f0',
    textAlign: 'center', lineHeight: 1.6,
  },
  footer: {
    padding: '16px 24px', borderTop: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: 8, flexShrink: 0, flexWrap: 'wrap',
  },
  footerNote: {
    flex: 1, minWidth: 180, fontSize: 13, color: '#64748b', lineHeight: 1.5,
  },
  ghostBtn: {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600,
    color: '#475569', cursor: 'pointer',
  },
  ghostBtnOff: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600,
    color: '#cbd5e1', cursor: 'not-allowed',
  },
  primaryBtn: {
    background: '#2563eb', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 600,
    color: '#fff', cursor: 'pointer',
  },
  primaryBtnOff: {
    background: '#cbd5e1', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 600,
    color: '#fff', cursor: 'not-allowed',
  },
  // 되돌리기 어려운 확정 동작 — 확인 단계의 파란 버튼과 구분되도록 색을 달리한다
  applyBtn: {
    background: '#047857', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 700,
    color: '#fff', cursor: 'pointer',
  },
  applyBtnOff: {
    background: '#cbd5e1', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 700,
    color: '#fff', cursor: 'not-allowed',
  },
};
