import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { adminAPI } from '../services/api';

/* ── 탭 컴포넌트 ── */
function TabBar({ active, onChange }) {
  const tabs = [
    { key: 'stats', label: '시스템 통계' },
    { key: 'users', label: '사용자 관리' },
    { key: 'sessions', label: '채점 세션' },
    { key: 'settings', label: '시스템 설정' },
    { key: 'dbquery', label: 'DB 쿼리' },
  ];
  return (
    <div style={t.bar}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          style={active === tab.key ? { ...t.tab, ...t.tabActive } : t.tab}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── 통계 탭 ── */
function StatsTab({ stats }) {
  if (!stats) return <div style={c.loading}>로딩 중...</div>;
  const cards = [
    { label: '전체 사용자', value: stats.total_users, color: '#2563eb' },
    { label: '전체 채점 세션', value: stats.total_sessions, color: '#7c3aed' },
    { label: '완료된 세션', value: stats.completed_sessions, color: '#059669' },
    { label: '진행 중 세션', value: stats.running_sessions, color: '#d97706' },
    { label: '총 채점 학생 수', value: stats.total_students_graded, color: '#dc2626' },
    { label: '최근 7일 세션', value: stats.recent_sessions_7d, color: '#0891b2' },
    { label: 'LLM 토큰 사용량', value: (stats.total_tokens_used ?? 0).toLocaleString(), color: '#be185d' },
  ];
  return (
    <div>
      <div style={c.cardGrid}>
        {cards.map((card, i) => (
          <div key={i} style={{ ...c.statCard, borderLeftColor: card.color }}>
            <div style={c.statValue}>{card.value}</div>
            <div style={c.statLabel}>{card.label}</div>
          </div>
        ))}
      </div>
      {stats.user_stats && stats.user_stats.length > 0 && (
        <div style={c.section}>
          <h3 style={c.sectionTitle}>사용자별 활동</h3>
          <table style={c.table}>
            <thead>
              <tr>
                <th style={c.th}>사용자</th>
                <th style={c.th}>역할</th>
                <th style={c.th}>과목 수</th>
                <th style={c.th}>채점 세션</th>
              </tr>
            </thead>
            <tbody>
              {stats.user_stats.map(u => (
                <tr key={u.id}>
                  <td style={c.td}>{u.username}</td>
                  <td style={c.td}><span style={{ ...c.roleBadge, ...roleColor(u.role) }}>{u.role}</span></td>
                  <td style={c.td}>{u.subjects}</td>
                  <td style={c.td}>{u.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 사용자 관리 탭 ── */
function UsersTab({ users, onRefresh }) {
  const [editId, setEditId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [resetPwId, setResetPwId] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');

  const handleRoleChange = async (userId) => {
    try {
      await adminAPI.updateUser(userId, { role: editRole });
      setEditId(null);
      setMsg('역할이 변경되었습니다');
      onRefresh();
    } catch (e) {
      setMsg(e.response?.data?.detail || '오류 발생');
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await adminAPI.updateUser(userId, { password: newPw });
      setResetPwId(null);
      setNewPw('');
      setMsg('비밀번호가 초기화되었습니다');
    } catch (e) {
      setMsg(e.response?.data?.detail || '오류 발생');
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`정말 ${username} 계정을 삭제하시겠습니까?`)) return;
    try {
      await adminAPI.deleteUser(userId);
      setMsg('사용자가 삭제되었습니다');
      onRefresh();
    } catch (e) {
      setMsg(e.response?.data?.detail || '오류 발생');
    }
  };

  if (!users) return <div style={c.loading}>로딩 중...</div>;

  return (
    <div>
      {msg && <div style={c.msgBox} onClick={() => setMsg('')}>{msg}</div>}
      <table style={c.table}>
        <thead>
          <tr>
            <th style={c.th}>ID</th>
            <th style={c.th}>아이디</th>
            <th style={c.th}>이메일</th>
            <th style={c.th}>역할</th>
            <th style={c.th}>가입일</th>
            <th style={c.th}>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={c.td}>{u.id}</td>
              <td style={c.td}><strong>{u.username}</strong></td>
              <td style={c.td}>{u.email}</td>
              <td style={c.td}>
                {editId === u.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} style={c.select}>
                      <option value="admin">admin</option>
                      <option value="professor">professor</option>
                      <option value="ta">ta</option>
                      <option value="student">student</option>
                    </select>
                    <button style={c.btnSm} onClick={() => handleRoleChange(u.id)}>저장</button>
                    <button style={c.btnSmGray} onClick={() => setEditId(null)}>취소</button>
                  </div>
                ) : (
                  <span style={{ ...c.roleBadge, ...roleColor(u.role) }}>{u.role}</span>
                )}
              </td>
              <td style={c.td}>{u.created_at?.slice(0, 10)}</td>
              <td style={c.td}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {editId !== u.id && (
                    <button style={c.btnSm} onClick={() => { setEditId(u.id); setEditRole(u.role); }}>역할변경</button>
                  )}
                  {resetPwId === u.id ? (
                    <>
                      <input
                        style={c.inputSm}
                        type="text"
                        placeholder="새 비밀번호"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                      />
                      <button style={c.btnSm} onClick={() => handleResetPassword(u.id)}>확인</button>
                      <button style={c.btnSmGray} onClick={() => { setResetPwId(null); setNewPw(''); }}>취소</button>
                    </>
                  ) : (
                    <button style={c.btnSmGray} onClick={() => setResetPwId(u.id)}>PW초기화</button>
                  )}
                  {u.role !== 'admin' && (
                    <button style={c.btnSmDanger} onClick={() => handleDelete(u.id, u.username)}>삭제</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 채점 세션 탭 ── */
function SessionsTab({ sessions }) {
  if (!sessions) return <div style={c.loading}>로딩 중...</div>;
  const statusColor = (s) => {
    if (s === 'completed') return '#059669';
    if (s === 'running') return '#d97706';
    if (s === 'quota_exceeded') return '#dc2626';
    return '#64748b';
  };
  const renderModel = (model, label) => {
    if (!model) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const provider = model.split('/')[0];
    const shortName = label || model.split('/').pop();
    const cfg = provider === 'fireworks'
      ? { bg: '#fef3c7', color: '#b45309' }
      : { bg: '#dbeafe', color: '#1d4ed8' };
    return (
      <span
        title={model}
        style={{
          background: cfg.bg, color: cfg.color, borderRadius: 4,
          padding: '2px 6px', fontSize: 11, fontWeight: 600,
          fontFamily: 'monospace', whiteSpace: 'nowrap',
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'inline-block',
        }}
      >
        {shortName}
      </span>
    );
  };
  return (
    <div>
      <table style={c.table}>
        <thead>
          <tr>
            <th style={c.th}>사용자</th>
            <th style={c.th}>과목</th>
            <th style={c.th}>상태</th>
            <th style={c.th}>학생수</th>
            <th style={c.th}>처리완료</th>
            <th style={c.th}>채점 AI</th>
            <th style={c.th}>생성일</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.session_id}>
              <td style={c.td}><strong>{s.username}</strong></td>
              <td style={c.td}>{s.subject_name || '-'}</td>
              <td style={c.td}><span style={{ color: statusColor(s.status), fontWeight: 600 }}>{s.status}</span></td>
              <td style={c.td}>{s.total_students}</td>
              <td style={c.td}>{s.processed_students}</td>
              <td style={c.td}>{renderModel(s.grading_model, s.grading_model_label)}</td>
              <td style={c.td}>{s.created_at?.slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <div style={c.empty}>채점 세션이 없습니다</div>}
    </div>
  );
}

/* ── 설정 탭 ── */
function SettingsTab({ settings, onSave }) {
  const [form, setForm] = useState({
    openai_api_key: '',
    fireworks_api_key: '',
    llm_model: 'gpt-4o-mini',
    base_system_prompt: '',
    max_upload_size_mb: '50',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setForm(prev => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      // API 키가 마스킹된 값이면 전송하지 않음
      const payload = { ...form };
      if (payload.openai_api_key && payload.openai_api_key.includes('...')) {
        delete payload.openai_api_key;
      }
      if (payload.fireworks_api_key && payload.fireworks_api_key.includes('...')) {
        delete payload.fireworks_api_key;
      }
      await adminAPI.updateSettings(payload);
      setMsg('설정이 저장되었습니다');
      onSave();
    } catch (e) {
      setMsg(e.response?.data?.detail || '오류 발생');
    }
  };

  return (
    <div style={c.settingsForm}>
      {msg && <div style={c.msgBox} onClick={() => setMsg('')}>{msg}</div>}

      <div style={c.settingsGroup}>
        <h3 style={c.settingsGroupTitle}>LLM API 설정</h3>
        <div style={c.formField}>
          <label style={c.formLabel}>OpenAI API Key</label>
          <input
            style={c.formInput}
            type="password"
            value={form.openai_api_key}
            onChange={e => setForm({ ...form, openai_api_key: e.target.value })}
            placeholder="sk-..."
          />
          <span style={c.formHint}>변경하지 않으려면 그대로 두세요</span>
        </div>
        <div style={c.formField}>
          <label style={c.formLabel}>Fireworks API Key</label>
          <input
            style={c.formInput}
            type="password"
            value={form.fireworks_api_key}
            onChange={e => setForm({ ...form, fireworks_api_key: e.target.value })}
            placeholder="fw-..."
          />
          <span style={c.formHint}>Llama / Qwen / DeepSeek 등 Fireworks 모델 사용 시 필요 (없으면 비워두기)</span>
        </div>
        <div style={c.formField}>
          <label style={c.formLabel}>LLM 모델</label>
          <select
            style={c.formInput}
            value={form.llm_model}
            onChange={e => setForm({ ...form, llm_model: e.target.value })}
          >
            <option value="gpt-4o-mini">gpt-4o-mini (빠르고 저렴)</option>
            <option value="gpt-4o">gpt-4o (고성능)</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            <option value="gpt-4.1">gpt-4.1</option>
          </select>
        </div>
      </div>

      <div style={c.settingsGroup}>
        <h3 style={c.settingsGroupTitle}>시스템 기본 프롬프트</h3>
        <div style={c.formField}>
          <label style={c.formLabel}>Base System Prompt</label>
          <textarea
            style={{ ...c.formInput, minHeight: 120, resize: 'vertical' }}
            value={form.base_system_prompt}
            onChange={e => setForm({ ...form, base_system_prompt: e.target.value })}
            placeholder="모든 채점에 기본으로 적용되는 시스템 프롬프트 (빈칸이면 기본값 사용)"
          />
          <span style={c.formHint}>모든 AI 채점에 앞서 추가되는 지시사항입니다</span>
        </div>
      </div>

      <div style={c.settingsGroup}>
        <h3 style={c.settingsGroupTitle}>보안 설정</h3>
        <div style={c.formField}>
          <label style={c.formLabel}>최대 업로드 용량 (MB)</label>
          <input
            style={c.formInput}
            type="number"
            value={form.max_upload_size_mb}
            onChange={e => setForm({ ...form, max_upload_size_mb: e.target.value })}
          />
        </div>
      </div>

      <button style={c.saveBtn} onClick={handleSave}>설정 저장</button>
    </div>
  );
}

/* ── DB 쿼리 탭 ── */
function DBQueryTab() {
  const [schema, setSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminAPI.getDbSchema()
      .then(res => {
        setSchema(res.data);
        if (res.data.length > 0) setSelectedTable(res.data[0].table);
      })
      .catch(e => setError('스키마 로딩 실패'));
  }, []);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await adminAPI.runDbQuery(query);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || '쿼리 실행 오류');
    } finally {
      setLoading(false);
    }
  };

  const insertSample = (tableName) => {
    setQuery(`SELECT * FROM ${tableName} LIMIT 10;`);
  };

  const selectedTableData = schema?.find(t => t.table === selectedTable);

  return (
    <div style={dq.wrapper}>
      {/* 왼쪽: 테이블 목록 + 컬럼 정보 */}
      <div style={dq.sidebar}>
        <div style={dq.sidebarTitle}>📂 데이터베이스 테이블</div>
        <div style={dq.tableList}>
          {schema?.map(t => (
            <div
              key={t.table}
              style={selectedTable === t.table ? { ...dq.tableItem, ...dq.tableItemActive } : dq.tableItem}
              onClick={() => setSelectedTable(t.table)}
              onDoubleClick={() => insertSample(t.table)}
            >
              <div style={dq.tableName}>{t.table}</div>
              <div style={dq.tableDesc}>{t.description}</div>
            </div>
          ))}
        </div>
        {selectedTableData && (
          <div style={dq.columnsBox}>
            <div style={dq.columnsTitle}>📋 컬럼 정보</div>
            <div style={dq.columnsList}>
              {selectedTableData.columns.map(col => (
                <div key={col.name} style={dq.columnItem}>
                  <span style={dq.columnName}>
                    {col.primary_key && '🔑 '}
                    {col.name}
                  </span>
                  <span style={dq.columnType}>{col.type}</span>
                </div>
              ))}
            </div>
            <div style={dq.hint}>💡 테이블 더블클릭하면 샘플 쿼리 입력</div>
          </div>
        )}
      </div>

      {/* 오른쪽: 쿼리 + 결과 */}
      <div style={dq.main}>
        <div style={dq.queryBox}>
          <div style={dq.queryHeader}>
            <span style={dq.queryTitle}>✏️ SQL 쿼리 (SELECT만 가능)</span>
            <button
              style={loading ? { ...dq.runBtn, opacity: 0.6 } : dq.runBtn}
              onClick={runQuery}
              disabled={loading}
            >
              {loading ? '실행 중...' : '▶ 실행'}
            </button>
          </div>
          <textarea
            style={dq.queryInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="예: SELECT * FROM users LIMIT 10;"
          />
        </div>

        <div style={dq.resultBox}>
          <div style={dq.resultTitle}>📊 쿼리 결과</div>
          {error && <div style={dq.errorMsg}>❌ {error}</div>}
          {!error && !result && <div style={dq.emptyResult}>쿼리를 실행하면 결과가 여기에 표시됩니다</div>}
          {result && (
            <div>
              <div style={dq.resultMeta}>
                {result.row_count}건 조회됨
                {result.truncated && ' (1000건으로 제한됨)'}
              </div>
              <div style={dq.tableScroll}>
                <table style={dq.resultTable}>
                  <thead>
                    <tr>
                      {result.columns.map(col => (
                        <th key={col} style={dq.resultTh}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {result.columns.map(col => (
                          <td key={col} style={dq.resultTd}>
                            {row[col] === null ? <span style={{ color: '#94a3b8' }}>NULL</span> :
                             typeof row[col] === 'object' ? JSON.stringify(row[col]).slice(0, 100) :
                             String(row[col]).slice(0, 200)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 헬퍼 ── */
function roleColor(role) {
  if (role === 'admin') return { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' };
  if (role === 'professor') return { background: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' };
  if (role === 'ta') return { background: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' };
  return { background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };
}

/* ── 메인 페이지 ── */
export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [settings, setSettings] = useState(null);

  const loadData = useCallback(async (targetTab) => {
    try {
      if (targetTab === 'stats') {
        const res = await adminAPI.getStats();
        setStats(res.data);
      } else if (targetTab === 'users') {
        const res = await adminAPI.getUsers();
        setUsers(res.data);
      } else if (targetTab === 'sessions') {
        const res = await adminAPI.getSessions();
        setSessions(res.data);
      } else if (targetTab === 'settings') {
        const res = await adminAPI.getSettings();
        setSettings(res.data);
      }
    } catch (e) {
      console.error('Admin data load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData(tab);
  }, [tab, loadData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={p.wrapper}>
      {/* 헤더 */}
      <div style={p.header}>
        <div style={p.headerLeft}>
          <span style={p.headerTitle}>Admin Dashboard</span>
          <span style={p.headerUser}>{user?.username}</span>
        </div>
        <button style={p.logoutBtn} onClick={handleLogout}>로그아웃</button>
      </div>

      {/* 탭 */}
      <TabBar active={tab} onChange={setTab} />

      {/* 컨텐츠 */}
      <div style={p.content}>
        {tab === 'stats' && <StatsTab stats={stats} />}
        {tab === 'users' && <UsersTab users={users} onRefresh={() => loadData('users')} />}
        {tab === 'sessions' && <SessionsTab sessions={sessions} />}
        {tab === 'settings' && <SettingsTab settings={settings} onSave={() => loadData('settings')} />}
        {tab === 'dbquery' && <DBQueryTab />}
      </div>
    </div>
  );
}

/* ── 스타일 ── */
const p = {
  wrapper: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', background: '#1e293b', borderBottom: '1px solid #334155',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 700, color: '#f8fafc' },
  headerUser: { fontSize: 13, color: '#94a3b8', background: '#334155', padding: '4px 12px', borderRadius: 20 },
  logoutBtn: {
    background: 'none', border: '1px solid #475569', borderRadius: 8,
    padding: '6px 16px', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
  },
  content: { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
};

const t = {
  bar: {
    display: 'flex', gap: 0, background: '#1e293b',
    borderBottom: '1px solid #334155', padding: '0 32px',
  },
  tab: {
    padding: '12px 24px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#94a3b8',
    cursor: 'pointer', fontSize: 14, fontWeight: 500,
  },
  tabActive: {
    color: '#60a5fa', borderBottomColor: '#60a5fa', fontWeight: 700,
  },
};

const c = {
  loading: { textAlign: 'center', padding: 40, color: '#64748b' },
  empty: { textAlign: 'center', padding: 40, color: '#64748b' },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16, marginBottom: 32,
  },
  statCard: {
    background: '#1e293b', borderRadius: 12, padding: '20px 24px',
    borderLeft: '4px solid', borderColor: '#334155',
  },
  statValue: { fontSize: 32, fontWeight: 700, color: '#f8fafc' },
  statLabel: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 12 },
  table: {
    width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 12, overflow: 'hidden',
  },
  th: {
    textAlign: 'left', padding: '12px 16px', background: '#334155',
    fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
  },
  td: { padding: '10px 16px', borderBottom: '1px solid #334155', fontSize: 14, color: '#cbd5e1' },
  roleBadge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: 12, fontWeight: 600, border: '1px solid',
  },
  msgBox: {
    background: '#1e40af', color: '#fff', padding: '10px 16px',
    borderRadius: 8, marginBottom: 16, cursor: 'pointer', fontSize: 14,
  },
  select: {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 13,
  },
  btnSm: {
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
  btnSmGray: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #475569',
    background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
  },
  btnSmDanger: {
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
  inputSm: {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 13, width: 120,
  },
  /* 설정 폼 */
  settingsForm: { maxWidth: 640 },
  settingsGroup: {
    background: '#1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 20,
  },
  settingsGroupTitle: { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  formField: { marginBottom: 16 },
  formLabel: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  formInput: {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box',
  },
  formHint: { fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' },
  saveBtn: {
    padding: '10px 32px', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer',
  },
};

/* ── DB 쿼리 탭 스타일 ── */
const dq = {
  wrapper: {
    display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16,
    minHeight: 'calc(100vh - 240px)',
  },
  sidebar: {
    background: '#1e293b', borderRadius: 12, padding: 16,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sidebarTitle: {
    fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12,
    paddingBottom: 8, borderBottom: '1px solid #334155',
  },
  tableList: {
    display: 'flex', flexDirection: 'column', gap: 4,
    maxHeight: 280, overflowY: 'auto', marginBottom: 16,
  },
  tableItem: {
    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
    background: '#0f172a', border: '1px solid transparent',
    transition: 'all 0.15s',
  },
  tableItemActive: {
    background: '#1e3a8a', borderColor: '#3b82f6',
  },
  tableName: { fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 },
  tableDesc: { fontSize: 11, color: '#94a3b8' },
  columnsBox: {
    flex: 1, paddingTop: 12, borderTop: '1px solid #334155',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  columnsTitle: { fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 10 },
  columnsList: {
    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
  },
  columnItem: {
    padding: '6px 10px', background: '#0f172a', borderRadius: 6,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  columnName: { fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace' },
  columnType: { fontSize: 11, color: '#64748b', fontFamily: 'monospace' },
  hint: { fontSize: 11, color: '#64748b', marginTop: 10, textAlign: 'center' },
  main: { display: 'flex', flexDirection: 'column', gap: 16 },
  queryBox: {
    background: '#1e293b', borderRadius: 12, padding: 16,
  },
  queryHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  queryTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  runBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
  },
  queryInput: {
    width: '100%', minHeight: 120, padding: 12, borderRadius: 8,
    border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0',
    fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
  },
  resultBox: {
    background: '#1e293b', borderRadius: 12, padding: 16, flex: 1,
    display: 'flex', flexDirection: 'column',
  },
  resultTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 },
  resultMeta: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  emptyResult: {
    padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13,
  },
  errorMsg: {
    padding: 12, background: '#7f1d1d', color: '#fecaca', borderRadius: 8,
    fontSize: 13, fontFamily: 'monospace',
  },
  tableScroll: {
    overflow: 'auto', maxHeight: 480, border: '1px solid #334155', borderRadius: 8,
  },
  resultTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
  },
  resultTh: {
    padding: '8px 12px', background: '#334155', color: '#e2e8f0',
    textAlign: 'left', fontWeight: 700, fontSize: 12,
    borderBottom: '1px solid #475569', position: 'sticky', top: 0,
  },
  resultTd: {
    padding: '6px 12px', color: '#cbd5e1', borderBottom: '1px solid #334155',
    fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
