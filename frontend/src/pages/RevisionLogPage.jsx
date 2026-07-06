import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { gradingAPI } from '../services/api';

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fieldLabel(name) {
  const map = {
    obtained_score: '문제 점수',
    professor_feedback: '교수 코멘트',
    partial_score: '세부 점수',
  };
  return map[name] || name;
}

function fieldBadgeStyle(name) {
  const map = {
    obtained_score: { bg: '#fef3c7', color: '#92400e' },
    professor_feedback: { bg: '#dbeafe', color: '#1e40af' },
    partial_score: { bg: '#dcfce7', color: '#166534' },
  };
  const cfg = map[name] || { bg: '#f1f5f9', color: '#475569' };
  return {
    background: cfg.bg, color: cfg.color, borderRadius: 4,
    padding: '3px 10px', fontSize: 12, fontWeight: 600,
    display: 'inline-block', whiteSpace: 'nowrap',
  };
}

function ValueBox({ value, isOld }) {
  if (value === null || value === undefined || value === '') {
    return <span style={s.emptyValue}>(없음)</span>;
  }
  return (
    <div style={isOld ? s.oldValue : s.newValue}>
      {String(value)}
    </div>
  );
}

export default function RevisionLogPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterField, setFilterField] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  useEffect(() => {
    gradingAPI.getAllRevisions()
      .then(res => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(
    () => [...new Set(logs.map(l => l.subject_name).filter(Boolean))],
    [logs]
  );

  const filtered = logs.filter(log => {
    if (filterField !== 'all' && log.field_name !== filterField) return false;
    if (filterSubject !== 'all' && log.subject_name !== filterSubject) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        log.student_filename, log.problem_id,
        log.subject_name, log.subject_item_name,
        String(log.old_value || ''), String(log.new_value || ''),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 날짜별 그룹핑
  const groupedByDate = useMemo(() => {
    const groups = {};
    for (const log of filtered) {
      const dateKey = log.revised_at ? log.revised_at.slice(0, 10) : '날짜 없음';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    }
    return groups;
  }, [filtered]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={() => navigate('/upload')}>🏠 홈</button>
          <span style={s.headerTitle}>📝 수정 로그</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.navBtn} onClick={() => navigate('/history')}>📚 채점 기록</button>
          <span style={s.userName}>{user?.username}</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        {/* 통계 */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statValue}>{logs.length}</div>
            <div style={s.statLabel}>전체 수정 건수</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statValue}>{new Set(logs.map(l => l.session_id)).size}</div>
            <div style={s.statLabel}>수정 세션 수</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statValue}>{new Set(logs.map(l => l.student_filename)).size}</div>
            <div style={s.statLabel}>수정 학생 수</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statValue}>{filtered.length}</div>
            <div style={s.statLabel}>현재 보이는 건수</div>
          </div>
        </div>

        {/* 필터 */}
        <div style={s.filterBar}>
          <input
            style={s.search}
            placeholder="학생명, 문제, 코멘트 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={s.select}
            value={filterField}
            onChange={e => setFilterField(e.target.value)}
          >
            <option value="all">전체 항목</option>
            <option value="obtained_score">문제 점수</option>
            <option value="partial_score">세부 점수</option>
            <option value="professor_feedback">교수 코멘트</option>
          </select>
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
            <p>{logs.length === 0 ? '수정 이력이 없습니다' : '필터 조건에 맞는 기록이 없습니다'}</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateLogs]) => (
            <div key={date} style={s.dateGroup}>
              <div style={s.dateHeader}>
                <span style={s.dateLabel}>{date}</span>
                <span style={s.dateCount}>{dateLogs.length}건</span>
              </div>
              <div style={s.logList}>
                {dateLogs.map(log => (
                  <div key={log.id} style={s.logCard}>
                    <div style={s.logTopRow}>
                      <span style={fieldBadgeStyle(log.field_name)}>
                        {fieldLabel(log.field_name)}
                        {log.field_name === 'partial_score' && log.partial_score_index !== null
                          ? ` #${log.partial_score_index + 1}`
                          : ''}
                      </span>
                      <span style={s.logTime}>{formatDateTime(log.revised_at)}</span>
                    </div>

                    <div style={s.logMeta}>
                      <span style={s.metaItem}>
                        <span style={s.metaLabel}>과목:</span>
                        <span style={s.metaValue}>
                          {log.subject_name || '미지정'}
                          {log.subject_item_name && (
                            <span style={s.metaItem2}> / {log.subject_item_name}</span>
                          )}
                        </span>
                      </span>
                      <span style={s.metaItem}>
                        <span style={s.metaLabel}>학생:</span>
                        <span style={s.metaValue}>{log.student_filename}</span>
                      </span>
                      <span style={s.metaItem}>
                        <span style={s.metaLabel}>문제:</span>
                        <span style={s.metaValue}>{log.problem_id}</span>
                      </span>
                    </div>

                    <div style={s.logChanges}>
                      <div style={s.changeColumn}>
                        <div style={s.changeLabel}>이전</div>
                        <ValueBox value={log.old_value} isOld />
                      </div>
                      <div style={s.changeArrow}>→</div>
                      <div style={s.changeColumn}>
                        <div style={s.changeLabel}>이후</div>
                        <ValueBox value={log.new_value} />
                      </div>
                    </div>

                    <div style={s.logFooter}>
                      <button
                        style={s.openSessionBtn}
                        onClick={() => navigate(`/dashboard/${log.session_id}`)}
                      >
                        해당 채점 화면 열기 →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '0 32px', height: 64, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  backBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navBtn: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500,
  },
  userName: { fontSize: 14, color: '#64748b' },
  logoutBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#64748b',
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },

  /* 통계 카드 */
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12, marginBottom: 24,
  },
  statCard: {
    background: '#fff', borderRadius: 10, padding: '16px 20px',
    border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statValue: { fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },

  /* 필터 */
  filterBar: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 200, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  select: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' },

  empty: { textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },

  /* 날짜별 그룹 */
  dateGroup: { marginBottom: 28 },
  dateHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  dateLabel: { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  dateCount: { fontSize: 12, color: '#94a3b8', background: '#f1f5f9', borderRadius: 20, padding: '2px 10px' },
  logList: { display: 'flex', flexDirection: 'column', gap: 10 },

  /* 로그 카드 */
  logCard: {
    background: '#fff', borderRadius: 12, padding: 18,
    border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  logTopRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  logTime: { fontSize: 12, color: '#94a3b8' },
  logMeta: {
    display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14,
    paddingBottom: 14, borderBottom: '1px dashed #e2e8f0',
  },
  metaItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
  metaItem2: { color: '#94a3b8' },
  metaLabel: { color: '#64748b', fontWeight: 500 },
  metaValue: { color: '#1e293b', fontWeight: 600 },

  logChanges: {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12,
    alignItems: 'center', marginBottom: 12,
  },
  changeColumn: { display: 'flex', flexDirection: 'column', gap: 6 },
  changeLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  changeArrow: { fontSize: 22, color: '#cbd5e1', fontWeight: 700, alignSelf: 'flex-end', paddingBottom: 6 },
  oldValue: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 36,
  },
  newValue: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 36,
  },
  emptyValue: { fontStyle: 'italic', color: '#cbd5e1', fontSize: 13 },

  logFooter: { display: 'flex', justifyContent: 'flex-end' },
  openSessionBtn: {
    background: 'none', color: '#2563eb', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, padding: '4px 0',
  },
};
