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

  useEffect(() => {
    gradingAPI.getHistory()
      .then(res => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

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
                      <th style={{ ...th, textAlign: 'center' }}>학생 수</th>
                      <th style={th}>완료 시간</th>
                      <th style={{ ...th, textAlign: 'center' }}>결과 보기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => (
                      <tr key={session.session_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}>{formatDate(session.created_at)}</td>
                        <td style={td}><StatusBadge status={session.status} /></td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </main>
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
  empty: { textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  primaryBtn: { marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};
