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

function StatusBadge({ status }) {
  const cfg = {
    completed: { bg: '#dcfce7', color: '#16a34a', label: '완료' },
    running:   { bg: '#dbeafe', color: '#2563eb', label: '진행 중' },
    pending:   { bg: '#f1f5f9', color: '#64748b', label: '대기' },
    error:     { bg: '#fee2e2', color: '#dc2626', label: '오류' },
  }[status] || { bg: '#f1f5f9', color: '#64748b', label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20,
      padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
      {cfg.label}
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // 사용자가 따라 써야 할 확인 문구: "과목명 / 세부항목" 형식
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

  const subjects = [...new Set(history.map(h => h.subject_name).filter(Boolean))];

  const filtered = history.filter(h => {
    const matchSubject = filterSubject === 'all' || h.subject_name === filterSubject;
    const matchSearch = !search ||
      (h.subject_name || '').includes(search) ||
      (h.subject_code || '').includes(search) ||
      h.session_id.includes(search);
    return matchSubject && matchSearch;
  });

  // Group by subject
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
          <button style={s.backBtn} onClick={() => navigate('/upload')}>← 새 채점</button>
          <span style={s.headerTitle}>📚 채점 기록</span>
        </div>
        <div style={s.headerRight}>
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

        {loading ? (
          <div style={s.empty}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📭</div>
            <p>채점 기록이 없습니다</p>
            <button style={s.primaryBtn} onClick={() => navigate('/upload')}>첫 채점 시작하기</button>
          </div>
        ) : (
          Object.entries(grouped).map(([subjectName, sessions]) => (
            <div key={subjectName} style={s.subjectGroup}>
              <div style={s.subjectHeader}>
                <span style={s.subjectName}>{subjectName}</span>
                <span style={s.sessionCount}>{sessions.length}회 채점</span>
              </div>

              <div style={s.tableCard}>
                <table style={s.table}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>날짜</th>
                      <th style={th}>상태</th>
                      <th style={th}>세부 항목</th>
                      <th style={{ ...th, textAlign: 'center' }}>학생 수</th>
                      <th style={th}>완료 시간</th>
                      <th style={{ ...th, textAlign: 'center' }}>결과 보기</th>
                      <th style={{ ...th, textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => (
                      <tr key={session.session_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}>{formatDate(session.created_at)}</td>
                        <td style={td}><StatusBadge status={session.status} /></td>
                        <td style={td}>
                          {session.subject_item_name ? (
                            <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
                              {session.subject_item_name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{session.total_students}</span>명
                        </td>
                        <td style={{ ...td, color: '#64748b', fontSize: 13 }}>
                          {session.completed_at ? formatDate(session.completed_at) : '-'}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button
                            style={session.status === 'completed' ? s.viewBtn : s.viewBtnDisabled}
                            onClick={() => session.status === 'completed' && navigate(`/dashboard/${session.session_id}`)}
                            disabled={session.status !== 'completed'}
                          >
                            {session.status === 'completed' ? '보기' : '—'}
                          </button>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button
                            style={session.status === 'running' ? s.deleteBtnDisabled : s.deleteBtn}
                            onClick={() => session.status !== 'running' && openDeleteModal(session)}
                            disabled={session.status === 'running'}
                            title={session.status === 'running' ? '진행 중인 채점은 삭제할 수 없습니다' : '채점 기록 삭제'}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </main>

      {/* 삭제 확인 모달 */}
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
              <p style={s.modalConfirmLabel}>
                삭제를 확인하려면 아래 문구를 정확히 입력하세요:
              </p>
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
              <button style={s.modalCancelBtn} onClick={closeDeleteModal} disabled={deleting}>
                취소
              </button>
              <button
                style={
                  deleteConfirmText.trim() === expectedConfirmText.trim() && !deleting
                    ? s.modalDeleteBtn
                    : s.modalDeleteBtnDisabled
                }
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim() !== expectedConfirmText.trim() || deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
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
  main: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  filterBar: { display: 'flex', gap: 12, marginBottom: 28 },
  search: { flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  select: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' },
  subjectGroup: { marginBottom: 32 },
  subjectHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  subjectName: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  sessionCount: { fontSize: 13, color: '#94a3b8', background: '#f1f5f9', borderRadius: 20, padding: '2px 10px' },
  tableCard: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  viewBtn: { background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  viewBtnDisabled: { background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'default', fontSize: 13 },
  deleteBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  deleteBtnDisabled: { background: '#f1f5f9', color: '#cbd5e1', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 14px', cursor: 'not-allowed', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  primaryBtn: { marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  /* 삭제 확인 모달 */
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
  modalTitle: {
    fontSize: 20, fontWeight: 700, color: '#1e293b',
    textAlign: 'center', margin: '0 0 12px',
  },
  modalDesc: {
    fontSize: 14, color: '#64748b', textAlign: 'center',
    margin: '0 0 20px', lineHeight: 1.6,
  },
  modalInfoBox: {
    background: '#f8fafc', borderRadius: 10, padding: 16,
    border: '1px solid #e2e8f0', marginBottom: 20,
  },
  modalInfoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0',
  },
  modalInfoLabel: { fontSize: 13, color: '#64748b', fontWeight: 500 },
  modalInfoValue: { fontSize: 14, color: '#1e293b', fontWeight: 600 },
  modalConfirmSection: { marginBottom: 20 },
  modalConfirmLabel: {
    fontSize: 13, color: '#374151', margin: '0 0 8px', fontWeight: 500,
  },
  modalConfirmHint: {
    fontFamily: 'monospace', fontSize: 14, color: '#dc2626',
    background: '#fef2f2', border: '1px dashed #fca5a5',
    borderRadius: 6, padding: '8px 12px', marginBottom: 8,
    userSelect: 'none', textAlign: 'center', fontWeight: 600,
  },
  modalInput: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'monospace',
    transition: 'border-color 0.15s',
  },
  modalError: {
    fontSize: 13, color: '#dc2626', marginTop: 8, fontWeight: 500,
  },
  modalActions: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  modalDeleteBtn: {
    background: '#dc2626', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer',
  },
  modalDeleteBtnDisabled: {
    background: '#fca5a5', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700,
    cursor: 'not-allowed',
  },
};
