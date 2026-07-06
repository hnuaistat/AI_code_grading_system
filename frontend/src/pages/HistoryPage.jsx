import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { gradingAPI } from '../services/api';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit' });
}

function formatDuration(createdAt, completedAt) {
  if (!createdAt || !completedAt) return '-';
  const diffMs = new Date(completedAt) - new Date(createdAt);
  if (diffMs <= 0) return '-';
  const totalSec = Math.floor(diffMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
}

function StatusBadge({ status }) {
  const cfg = {
    completed:      { bg: '#dcfce7', color: '#16a34a', label: '완료' },
    running:        { bg: '#dbeafe', color: '#2563eb', label: '진행 중' },
    pending:        { bg: '#f1f5f9', color: '#64748b', label: '대기' },
    error:          { bg: '#fee2e2', color: '#dc2626', label: '오류' },
    cancelled:      { bg: '#fef3c7', color: '#b45309', label: '중단됨' },
    quota_exceeded: { bg: '#fee2e2', color: '#dc2626', label: '쿼터 초과' },
  }[status] || { bg: '#f1f5f9', color: '#64748b', label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20,
      padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
      {cfg.label}
    </span>
  );
}

function ModelBadge({ model, label }) {
  const provider = (model || '').split('/')[0];
  const displayName = label || (model || '').split('/').pop() || '-';
  const cfg = provider === 'fireworks'
    ? { bg: '#fef3c7', color: '#b45309' }
    : { bg: '#dbeafe', color: '#1d4ed8' };
  return (
    <span
      title={model}
      style={{
        background: cfg.bg, color: cfg.color, borderRadius: 6,
        padding: '3px 8px', fontSize: 11, fontWeight: 600,
        fontFamily: 'monospace', whiteSpace: 'nowrap',
        maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'inline-block',
      }}
    >
      {displayName}
    </span>
  );
}

export default function HistoryPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  // 단일 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // 다중 선택 삭제 (체크박스는 항상 표시)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTargetIds, setBulkTargetIds] = useState(null); // 삭제 모달 대상 (null = 닫힘)
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState(0);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkConfirmText, setBulkConfirmText] = useState('');

  // 강제 중단 진행 중인 세션 id 집합
  const [cancellingIds, setCancellingIds] = useState(new Set());

  // 세부 항목 인라인 편집
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  const startEditItem = (session) => {
    setEditingItemId(session.session_id);
    setItemDraft(session.subject_item_name || '');
  };

  const saveItem = async (session) => {
    setItemSaving(true);
    try {
      await gradingAPI.updateSessionItem(session.session_id, itemDraft.trim());
      setEditingItemId(null);
      reloadHistory();
    } catch (e) {
      alert(e.response?.data?.detail || '세부 항목 저장에 실패했습니다');
    } finally {
      setItemSaving(false);
    }
  };

  // 다른 AI로 재채점
  const [regradeTarget, setRegradeTarget] = useState(null); // 모달 대상 세션 (null = 닫힘)
  const [availableModels, setAvailableModels] = useState([]);
  const [regradeModel, setRegradeModel] = useState('');
  const [regrading, setRegrading] = useState(false);
  const [regradeError, setRegradeError] = useState('');

  const openRegradeModal = async (session) => {
    setRegradeTarget(session);
    setRegradeModel('');
    setRegradeError('');
    if (availableModels.length === 0) {
      try {
        const res = await gradingAPI.getAvailableModels();
        setAvailableModels(res.data.models || []);
      } catch {
        setRegradeError('모델 목록을 불러올 수 없습니다');
      }
    }
  };

  const startRegrade = async () => {
    if (!regradeTarget || !regradeModel) return;
    setRegrading(true);
    setRegradeError('');
    try {
      const res = await gradingAPI.regradeSession(regradeTarget.session_id, regradeModel);
      setRegradeTarget(null);
      navigate(`/dashboard/${res.data.session_id}`);
    } catch (e) {
      setRegradeError(e.response?.data?.detail || '재채점 시작에 실패했습니다');
    } finally {
      setRegrading(false);
    }
  };

  const handleCancel = async (session) => {
    if (!window.confirm(`'${session.subject_item_name || session.subject_name || session.session_id.slice(0, 8)}' 채점을 강제 중단하시겠습니까?\n지금까지 채점된 결과는 보존됩니다.`)) return;
    setCancellingIds(prev => new Set(prev).add(session.session_id));
    try {
      await gradingAPI.cancelSession(session.session_id);
      reloadHistory();
    } catch (e) {
      alert(e.response?.data?.detail || '강제 중단에 실패했습니다');
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(session.session_id);
        return next;
      });
    }
  };

  const reloadHistory = () => {
    setLoading(true);
    gradingAPI.getHistory()
      .then(res => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadHistory();
  }, []);

  // 단일 삭제
  const openDeleteModal = (session) => {
    setDeleteTarget(session);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const expectedConfirmText = deleteTarget
    ? `${deleteTarget.subject_name || '과목 미지정'} / ${deleteTarget.subject_item_name || '항목 미지정'}`
    : '';

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim() !== expectedConfirmText.trim()) {
      setDeleteError('입력한 문구가 일치하지 않습니다');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await gradingAPI.deleteSession(deleteTarget.session_id);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      reloadHistory();
    } catch (e) {
      setDeleteError(e.response?.data?.detail || '삭제 실패');
    } finally {
      setDeleting(false);
    }
  };

  // 다중 선택 삭제
  const toggleSelect = (sessionId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleSelectAll = (sessions) => {
    const deletable = sessions.filter(s => s.status !== 'running').map(s => s.session_id);
    const allSelected = deletable.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) deletable.forEach(id => next.delete(id));
      else deletable.forEach(id => next.add(id));
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    const ids = bulkTargetIds || [];
    setBulkDeleting(true);
    setBulkDeleteProgress(0);
    setBulkDeleteError('');
    let done = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await gradingAPI.deleteSession(id);
      } catch {
        failed++;
      }
      done++;
      setBulkDeleteProgress(Math.round((done / ids.length) * 100));
    }
    setBulkDeleting(false);
    setBulkTargetIds(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    if (failed > 0) setBulkDeleteError(`${failed}개 삭제 실패`);
    reloadHistory();
  };

  const subjects = [...new Set(history.map(h => h.subject_name).filter(Boolean))];

  const filtered = history.filter(h => {
    const matchSubject = filterSubject === 'all' || h.subject_name === filterSubject;
    const matchSearch = !search ||
      (h.subject_name || '').includes(search) ||
      (h.subject_code || '').includes(search) ||
      h.session_id.includes(search);
    return matchSubject && matchSearch;
  });

  const grouped = filtered.reduce((acc, h) => {
    const key = h.subject_name || '과목 미지정';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={() => navigate('/upload')}>🏠 홈</button>
          <span style={s.headerTitle}>📚 채점 기록</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.revisionBtn} onClick={() => navigate('/revisions')}>📝 수정 로그</button>
          <span style={s.userName}>{user?.username}</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        {/* Filter bar */}
        <div style={s.filterBar}>
          <input
            style={s.search}
            placeholder="과목명, 과목코드 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={s.select}
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
          >
            <option value="all">전체 과목</option>
            {subjects.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        {bulkDeleteError && (
          <div style={s.bulkError}>{bulkDeleteError}</div>
        )}

        {loading ? (
          <div style={s.empty}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📭</div>
            <p>채점 기록이 없습니다</p>
            <button style={s.primaryBtn} onClick={() => navigate('/upload')}>첫 채점 시작하기</button>
          </div>
        ) : (
          Object.entries(grouped).map(([subjectName, sessions]) => {
            const deletableSessions = sessions.filter(s => s.status !== 'running');
            const allSelected = deletableSessions.length > 0 && deletableSessions.every(s => selectedIds.has(s.session_id));
            const someSelected = deletableSessions.some(s => selectedIds.has(s.session_id));
            const groupSelectedIds = deletableSessions.filter(s => selectedIds.has(s.session_id)).map(s => s.session_id);

            // 재채점 세션을 원본(루트) 바로 아래에 묶어서 배치
            const idSet = new Set(sessions.map(s => s.session_id));
            const childrenMap = {};
            const roots = [];
            sessions.forEach(s => {
              if (s.regraded_from && idSet.has(s.regraded_from)) {
                (childrenMap[s.regraded_from] = childrenMap[s.regraded_from] || []).push(s);
              } else {
                roots.push(s);
              }
            });
            const displayRows = roots.flatMap(r => [
              { session: r, isChild: false },
              ...(childrenMap[r.session_id] || []).map(c => ({ session: c, isChild: true })),
            ]);

            return (
              <div key={subjectName} style={s.subjectGroup}>
                <div style={s.subjectHeader}>
                  <span style={s.subjectName}>{subjectName}</span>
                  <span style={s.sessionCount}>{sessions.length}회 채점</span>
                  {deletableSessions.length > 0 && (
                    <button style={s.selectAllBtn} onClick={() => toggleSelectAll(sessions)}>
                      {allSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                  {groupSelectedIds.length > 0 && (
                    <button
                      style={s.bulkDeleteBtn}
                      onClick={() => { setBulkDeleteError(''); setBulkConfirmText(''); setBulkTargetIds(groupSelectedIds); }}
                    >
                      🗑 {groupSelectedIds.length}개 삭제
                    </button>
                  )}
                </div>

                <div style={s.tableCard}>
                  <table style={s.table}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ ...th, width: '44px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleSelectAll(sessions)}
                            disabled={deletableSessions.length === 0}
                            style={{ cursor: 'pointer', width: 15, height: 15 }}
                          />
                        </th>
                        <th style={{ ...th, width: '140px' }}>날짜</th>
                        <th style={{ ...th, width: '90px' }}>상태</th>
                        <th style={{ ...th, width: '120px' }}>세부 항목</th>
                        <th style={{ ...th, textAlign: 'center', width: '70px' }}>학생 수</th>
                        <th style={{ ...th, width: '140px' }}>완료 시간</th>
                        <th style={{ ...th, textAlign: 'center', width: '110px' }}>채점 AI</th>
                        <th style={{ ...th, textAlign: 'center', width: '80px' }}>결과 보기</th>
                        <th style={{ ...th, textAlign: 'center', width: '108px' }}>새 AI 채점</th>
                        <th style={{ ...th, textAlign: 'center', width: '72px' }}>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map(({ session, isChild }) => {
                        const isChecked = selectedIds.has(session.session_id);
                        const isDeletable = session.status !== 'running';
                        const canRegrade = session.can_regrade && session.status === 'completed';
                        return (
                          <tr
                            key={session.session_id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isChecked ? '#fef2f2' : 'transparent',
                              cursor: isDeletable ? 'pointer' : 'default',
                            }}
                            onClick={() => { if (isDeletable) toggleSelect(session.session_id); }}
                          >
                            <td style={{ ...td, textAlign: 'center' }}>
                              {isDeletable ? (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelect(session.session_id)}
                                  onClick={e => e.stopPropagation()}
                                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                                />
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td style={td}>
                              {isChild ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                                  <span style={{ color: '#94a3b8' }}>└</span>
                                  <div>
                                    <span style={s.regradeBadge}>🆕 새 AI 채점</span>
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{formatDate(session.created_at)}</div>
                                  </div>
                                </div>
                              ) : (
                                formatDate(session.created_at)
                              )}
                            </td>
                            <td style={td}><StatusBadge status={session.status} /></td>
                            <td style={td} onClick={e => e.stopPropagation()}>
                              {editingItemId === session.session_id ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <input
                                    value={itemDraft}
                                    onChange={e => setItemDraft(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveItem(session);
                                      if (e.key === 'Escape') setEditingItemId(null);
                                    }}
                                    placeholder="예: 중간고사"
                                    autoFocus
                                    disabled={itemSaving}
                                    style={s.itemInput}
                                  />
                                  <button style={s.itemSaveBtn} onClick={() => saveItem(session)} disabled={itemSaving} title="저장 (Enter)">✓</button>
                                  <button style={s.itemCancelBtn} onClick={() => setEditingItemId(null)} disabled={itemSaving} title="취소 (Esc)">✕</button>
                                </div>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  {session.subject_item_name ? (
                                    <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
                                      {session.subject_item_name}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                                  )}
                                  <button style={s.itemEditBtn} onClick={() => startEditItem(session)} title="세부 항목 추가/수정">✏️</button>
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{ fontWeight: 600 }}>{session.total_students}</span>명
                            </td>
                            <td style={{ ...td, color: '#64748b', fontSize: 13 }}>
                              {session.completed_at ? formatDate(session.completed_at) : '-'}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {session.grading_model ? (
                                <ModelBadge model={session.grading_model} label={session.grading_model_label} />
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button
                                style={session.status === 'completed' ? s.viewBtn : s.viewBtnDisabled}
                                onClick={e => { e.stopPropagation(); session.status === 'completed' && navigate(`/dashboard/${session.session_id}`); }}
                                disabled={session.status !== 'completed'}
                              >
                                {session.status === 'completed' ? '보기' : '—'}
                              </button>
                            </td>
                            <td style={{ ...td, padding: '14px 4px', textAlign: 'center' }}>
                              {session.status === 'running' ? (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                              ) : (
                                <button
                                  style={canRegrade ? s.regradeBtn : s.regradeBtnDisabled}
                                  onClick={e => { e.stopPropagation(); if (canRegrade) openRegradeModal(session); }}
                                  disabled={!canRegrade}
                                  title={canRegrade
                                    ? '새로운 AI 모델로 다시 채점합니다'
                                    : (session.status !== 'completed'
                                      ? '완료된 세션만 새 AI로 채점할 수 있습니다'
                                      : '채점 데이터가 저장되지 않은 세션입니다 (기능 추가 이전에 채점됨)')}
                                >
                                  🆕 새 AI 채점
                                </button>
                              )}
                            </td>
                            <td style={{ ...td, padding: '14px 4px', textAlign: 'center' }}>
                              {session.status === 'running' ? (
                                <button
                                  style={cancellingIds.has(session.session_id)
                                    ? { ...s.cancelBtn, opacity: 0.6, cursor: 'wait' }
                                    : s.cancelBtn}
                                  onClick={e => { e.stopPropagation(); handleCancel(session); }}
                                  disabled={cancellingIds.has(session.session_id)}
                                  title="채점을 강제로 중단합니다 (지금까지 결과는 보존)"
                                >
                                  {cancellingIds.has(session.session_id) ? '중단 중...' : '🛑 중단'}
                                </button>
                              ) : (
                                <button
                                  style={s.deleteBtn}
                                  onClick={e => { e.stopPropagation(); openDeleteModal(session); }}
                                  title="채점 기록 삭제"
                                >
                                  삭제
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* 단일 삭제 확인 모달 */}
      {deleteTarget && (
        <div style={s.modalOverlay} onClick={closeDeleteModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalIcon}>⚠️</div>
            <h3 style={s.modalTitle}>채점 기록을 삭제하시겠습니까?</h3>
            <p style={s.modalDesc}>
              이 작업은 <strong>되돌릴 수 없습니다</strong>. 학생 채점 결과 및 수정 이력이 모두 삭제됩니다.
            </p>
            <div style={s.modalInfoBox}>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>과목</span>
                <span style={s.modalInfoValue}>{deleteTarget.subject_name || '과목 미지정'}</span>
              </div>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>세부 항목</span>
                <span style={s.modalInfoValue}>{deleteTarget.subject_item_name || '항목 미지정'}</span>
              </div>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>학생 수</span>
                <span style={s.modalInfoValue}>{deleteTarget.total_students}명</span>
              </div>
            </div>
            <div style={s.modalConfirmSection}>
              <p style={s.modalConfirmLabel}>삭제를 확인하려면 아래 문구를 정확히 입력하세요:</p>
              <div style={s.modalConfirmHint}>{expectedConfirmText}</div>
              <input
                style={{
                  ...s.modalInput,
                  borderColor: deleteConfirmText && deleteConfirmText.trim() === expectedConfirmText.trim() ? '#16a34a' : '#e2e8f0',
                }}
                type="text"
                value={deleteConfirmText}
                onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError(''); }}
                placeholder="위 문구를 그대로 입력"
                autoFocus
                disabled={deleting}
              />
              {deleteError && <div style={s.modalError}>{deleteError}</div>}
            </div>
            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeDeleteModal} disabled={deleting}>취소</button>
              <button
                style={deleteConfirmText.trim() === expectedConfirmText.trim() && !deleting ? s.modalDeleteBtn : s.modalDeleteBtnDisabled}
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim() !== expectedConfirmText.trim() || deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다중 삭제 확인 모달 */}
      {bulkTargetIds && (() => {
        const selectedSessions = history.filter(h => bulkTargetIds.includes(h.session_id));
        const bulkConfirmRequired = '삭제 확인';
        const bulkConfirmOk = bulkConfirmText.trim() === bulkConfirmRequired;
        return (
          <div style={s.modalOverlay} onClick={() => { if (!bulkDeleting) { setBulkTargetIds(null); } }}>
            <div style={{ ...s.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div style={s.modalIcon}>🗑️</div>
              <h3 style={s.modalTitle}>{bulkTargetIds.length}개 채점 기록을 삭제하시겠습니까?</h3>
              <p style={s.modalDesc}>
                이 작업은 <strong>되돌릴 수 없습니다</strong>.<br />
                아래 선택한 채점 기록과 학생 결과가 모두 삭제됩니다.
              </p>

              {/* 선택된 항목 목록 */}
              <div style={s.bulkListBox}>
                {selectedSessions.map((sess, i) => (
                  <div key={sess.session_id} style={s.bulkListItem}>
                    <span style={s.bulkListNum}>{i + 1}</span>
                    <div style={s.bulkListInfo}>
                      <span style={s.bulkListSubject}>
                        {sess.subject_name || '과목 미지정'}
                        {sess.subject_item_name && (
                          <span style={s.bulkListItem2}> / {sess.subject_item_name}</span>
                        )}
                      </span>
                      <span style={s.bulkListMeta}>
                        {formatDate(sess.created_at)} · {sess.total_students}명
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {bulkDeleting ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>삭제 중...</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{bulkDeleteProgress}%</span>
                  </div>
                  <div style={{ height: 8, background: '#fee2e2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#dc2626', borderRadius: 99, width: `${bulkDeleteProgress}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={s.modalConfirmSection}>
                    <p style={s.modalConfirmLabel}>삭제를 확인하려면 아래 문구를 정확히 입력하세요:</p>
                    <div style={s.modalConfirmHint}>{bulkConfirmRequired}</div>
                    <input
                      style={{
                        ...s.modalInput,
                        borderColor: bulkConfirmOk ? '#16a34a' : '#e2e8f0',
                      }}
                      type="text"
                      value={bulkConfirmText}
                      onChange={e => setBulkConfirmText(e.target.value)}
                      placeholder="위 문구를 그대로 입력"
                      autoFocus
                    />
                    {bulkDeleteError && <div style={s.modalError}>{bulkDeleteError}</div>}
                  </div>
                  <div style={s.modalActions}>
                    <button style={s.modalCancelBtn} onClick={() => setBulkTargetIds(null)}>취소</button>
                    <button
                      style={bulkConfirmOk ? s.modalDeleteBtn : s.modalDeleteBtnDisabled}
                      onClick={confirmBulkDelete}
                      disabled={!bulkConfirmOk}
                    >
                      {bulkTargetIds.length}개 모두 삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 재채점 모델 선택 모달 */}
      {regradeTarget && (
        <div style={s.modalOverlay} onClick={() => { if (!regrading) setRegradeTarget(null); }}>
          <div style={{ ...s.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalIcon}>🆕</div>
            <h3 style={s.modalTitle}>새 AI로 채점하기</h3>
            <p style={s.modalDesc}>
              저장된 루브릭·정답·학생 데이터로 <strong>AI 모델만 바꿔</strong> 다시 채점합니다.<br />
              기존 결과는 보존되고, 새 채점 기록이 원본 아래에 추가됩니다.
            </p>

            <div style={s.modalInfoBox}>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>과목</span>
                <span style={s.modalInfoValue}>{regradeTarget.subject_name || '과목 미지정'}</span>
              </div>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>세부 항목</span>
                <span style={s.modalInfoValue}>{regradeTarget.subject_item_name || '—'}</span>
              </div>
              <div style={s.modalInfoRow}>
                <span style={s.modalInfoLabel}>학생 수</span>
                <span style={s.modalInfoValue}>{regradeTarget.total_students}명</span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={s.modalConfirmLabel}>새로 채점할 AI 모델을 선택하세요:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {availableModels.map(m => {
                  const isCurrent = m.id === regradeTarget.grading_model;
                  const isSelected = regradeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      style={isCurrent ? s.modelOptionDisabled : (isSelected ? s.modelOptionSelected : s.modelOption)}
                      onClick={() => !isCurrent && setRegradeModel(m.id)}
                      disabled={isCurrent}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.label}</span>
                      {isCurrent && <span style={s.currentModelTag}>현재 채점 모델</span>}
                      {isSelected && !isCurrent && <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>}
                    </button>
                  );
                })}
                {availableModels.length === 0 && !regradeError && (
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>모델 목록 로딩 중...</span>
                )}
              </div>
            </div>

            {regradeError && <div style={s.modalError}>{regradeError}</div>}

            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={() => setRegradeTarget(null)} disabled={regrading}>취소</button>
              <button
                style={regradeModel && !regrading ? s.regradeStartBtn : s.regradeStartBtnDisabled}
                onClick={startRegrade}
                disabled={!regradeModel || regrading}
              >
                {regrading ? '채점 시작 중...' : '🆕 새 AI로 채점 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' };
const td = { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' };

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '0 32px', height: 64, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  backBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  userName: { fontSize: 14, color: '#64748b' },
  logoutBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#64748b' },
  revisionBtn: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#92400e', fontWeight: 500,
  },
  main: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  filterBar: { display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center' },
  search: { flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  select: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' },
  bulkDeleteBtn: {
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
    padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  bulkError: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16,
  },
  bulkListBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '8px 12px', marginBottom: 20, maxHeight: 220, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  bulkListItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 6px', borderBottom: '1px solid #f1f5f9',
  },
  bulkListNum: {
    fontSize: 11, fontWeight: 700, color: '#94a3b8',
    background: '#e2e8f0', borderRadius: '50%', width: 20, height: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bulkListInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  bulkListSubject: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
  bulkListItem2: { fontSize: 13, fontWeight: 500, color: '#059669' },
  bulkListMeta: { fontSize: 11, color: '#94a3b8' },
  subjectGroup: { marginBottom: 32 },
  subjectHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  subjectName: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  sessionCount: { fontSize: 13, color: '#94a3b8', background: '#f1f5f9', borderRadius: 20, padding: '2px 10px' },
  itemInput: {
    width: 90, padding: '4px 6px', border: '1.5px solid #cbd5e1',
    borderRadius: 6, fontSize: 12, outline: 'none',
  },
  itemSaveBtn: {
    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
    borderRadius: 4, padding: '2px 6px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
  },
  itemCancelBtn: {
    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 4, padding: '2px 6px', fontSize: 12, cursor: 'pointer',
  },
  itemEditBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: 0, opacity: 0.55,
  },
  selectAllBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#64748b', fontWeight: 500,
  },
  tableCard: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  viewBtn: { background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  viewBtnDisabled: { background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'default', fontSize: 13 },
  deleteBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  regradeBtn: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  regradeBtnDisabled: { background: '#f8fafc', color: '#cbd5e1', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'not-allowed', fontSize: 12, whiteSpace: 'nowrap' },
  regradeBadge: {
    fontSize: 11, background: '#eff6ff', color: '#2563eb',
    borderRadius: 4, padding: '2px 6px', fontWeight: 700, whiteSpace: 'nowrap',
  },
  modelOption: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, cursor: 'pointer', textAlign: 'left',
  },
  modelOptionSelected: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#eff6ff', border: '1.5px solid #2563eb', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, cursor: 'pointer', textAlign: 'left',
  },
  modelOptionDisabled: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, cursor: 'not-allowed', textAlign: 'left',
    color: '#94a3b8',
  },
  currentModelTag: {
    fontSize: 11, background: '#e2e8f0', color: '#64748b',
    borderRadius: 4, padding: '2px 8px', fontWeight: 600,
  },
  regradeStartBtn: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  regradeStartBtnDisabled: {
    background: '#93c5fd', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
  },
  deleteBtnDisabled: { background: '#f1f5f9', color: '#cbd5e1', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 14px', cursor: 'not-allowed', fontSize: 13 },
  cancelBtn: { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  primaryBtn: { marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: '32px 32px 24px',
    maxWidth: 480, width: '100%',
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalIcon: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', textAlign: 'center', margin: '0 0 12px' },
  modalDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.6 },
  modalInfoBox: { background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', marginBottom: 20 },
  modalInfoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  modalInfoLabel: { fontSize: 13, color: '#64748b', fontWeight: 500 },
  modalInfoValue: { fontSize: 14, color: '#1e293b', fontWeight: 600 },
  modalConfirmSection: { marginBottom: 20 },
  modalConfirmLabel: { fontSize: 13, color: '#374151', margin: '0 0 8px', fontWeight: 500 },
  modalConfirmHint: {
    fontFamily: 'monospace', fontSize: 14, color: '#dc2626',
    background: '#fef2f2', border: '1px dashed #fca5a5',
    borderRadius: 6, padding: '8px 12px', marginBottom: 8,
    userSelect: 'none', textAlign: 'center', fontWeight: 600,
  },
  modalInput: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'monospace', transition: 'border-color 0.15s',
  },
  modalError: { fontSize: 13, color: '#dc2626', marginTop: 8, fontWeight: 500 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  modalCancelBtn: {
    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  modalDeleteBtn: {
    background: '#dc2626', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  modalDeleteBtnDisabled: {
    background: '#fca5a5', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
  },
};
