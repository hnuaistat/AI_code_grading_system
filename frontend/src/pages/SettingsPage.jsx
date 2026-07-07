import React, { useState } from 'react';
import { useAuth } from '../App';
import { authAPI } from '../services/api';
import { getNotifyPref, setNotifyPref, sendBrowserNotification } from '../services/notify';

const ROLE_BADGE = {
  professor: { label: '교수님', bg: '#eff6ff', color: '#2563eb' },
  admin:     { label: '관리자', bg: '#fef3c7', color: '#b45309' },
  student:   { label: '학생',   bg: '#f0fdf4', color: '#16a34a' },
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  // 이메일 수정
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  // 비밀번호 변경
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const startEditEmail = () => {
    setEmailDraft(user?.email || '');
    setEmailError('');
    setEditingEmail(true);
  };

  const saveEmail = async () => {
    if (!emailDraft.trim()) return;
    setEmailSaving(true);
    setEmailError('');
    try {
      await authAPI.updateEmail(emailDraft.trim());
      await refreshUser();
      setEditingEmail(false);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (e) {
      setEmailError(e.response?.data?.detail || '이메일 변경에 실패했습니다');
    } finally {
      setEmailSaving(false);
    }
  };

  const savePassword = async () => {
    setPwError('');
    if (!pwCurrent || !pwNew) { setPwError('모든 항목을 입력해주세요'); return; }
    if (pwNew.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다'); return; }
    if (pwNew !== pwConfirm) { setPwError('새 비밀번호가 서로 일치하지 않습니다'); return; }
    setPwSaving(true);
    try {
      await authAPI.changePassword(pwCurrent, pwNew);
      setShowPwForm(false);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (e) {
      setPwError(e.response?.data?.detail || '비밀번호 변경에 실패했습니다');
    } finally {
      setPwSaving(false);
    }
  };
  const [browserOn, setBrowserOn] = useState(getNotifyPref());
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [testSent, setTestSent] = useState(false);
  // 통계 대시보드 기본 점수 기준 ('pct' = 100점 환산, 'raw' = 원점수)
  const [statsScale, setStatsScale] = useState(
    () => (localStorage.getItem('stats_scale_default') === 'raw' ? 'raw' : 'pct')
  );

  const changeStatsScale = (v) => {
    localStorage.setItem('stats_scale_default', v);
    setStatsScale(v);
  };

  const role = ROLE_BADGE[user?.role] || { label: user?.role || '-', bg: '#f1f5f9', color: '#64748b' };
  const initial = (user?.username || '?').charAt(0).toUpperCase();

  const toggleBrowser = async () => {
    if (browserOn) {
      setNotifyPref(false);
      setBrowserOn(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    setPermission(perm);
    if (perm === 'granted') {
      setNotifyPref(true);
      setBrowserOn(true);
    }
  };

  const sendTest = () => {
    sendBrowserNotification('🔔 테스트 알림', 'AI 채점 조교 알림이 정상 작동합니다!', { force: true });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div style={s.page}>
      <main style={s.main}>
        <h1 style={s.pageTitle}>⚙️ 설정</h1>

        {/* 사용자 정보 */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>사용자 정보</h2>
          <div style={s.profileRow}>
            <div style={s.avatar}>{initial}</div>
            <div style={{ ...s.profileInfo, flex: 1, minWidth: 0 }}>
              <div style={s.nameRow}>
                <span style={s.name}>{user?.username}</span>
                <span style={{ ...s.roleBadge, background: role.bg, color: role.color }}>{role.label}</span>
              </div>
              {editingEmail ? (
                <div style={s.emailForm}>
                  <input
                    style={s.input}
                    type="email"
                    value={emailDraft}
                    onChange={e => setEmailDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEmail();
                      if (e.key === 'Escape') setEditingEmail(false);
                    }}
                    placeholder="new@univ.ac.kr"
                    autoFocus
                    disabled={emailSaving}
                  />
                  <button style={s.saveBtn} onClick={saveEmail} disabled={emailSaving || !emailDraft.trim()}>
                    {emailSaving ? '저장 중...' : '저장'}
                  </button>
                  <button style={s.cancelBtn} onClick={() => setEditingEmail(false)} disabled={emailSaving}>취소</button>
                </div>
              ) : (
                <div style={s.email}>
                  ✉️ {user?.email || '이메일 정보 없음'}
                  <button style={s.editBtn} onClick={startEditEmail} title="이메일 변경">✏️</button>
                  {emailSaved && <span style={s.savedTag}>변경됨 ✓</span>}
                </div>
              )}
              {emailError && <div style={s.errorText}>{emailError}</div>}
            </div>

            {/* 비밀번호 변경 버튼 — 카드 우측 상단 */}
            {!showPwForm && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <button style={s.pwToggleBtn} onClick={() => { setShowPwForm(true); setPwError(''); }}>
                  🔒 비밀번호 변경
                </button>
                {pwSaved && <span style={s.savedTag}>변경되었습니다 ✓</span>}
              </div>
            )}
          </div>

          {/* 비밀번호 변경 폼 */}
          {showPwForm && (
            <div style={s.pwSection}>
              <div style={s.pwForm}>
                <input
                  style={s.input}
                  type="password"
                  placeholder="현재 비밀번호"
                  value={pwCurrent}
                  onChange={e => setPwCurrent(e.target.value)}
                  autoFocus
                  disabled={pwSaving}
                />
                <input
                  style={s.input}
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  disabled={pwSaving}
                />
                <input
                  style={s.input}
                  type="password"
                  placeholder="새 비밀번호 확인"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePassword(); }}
                  disabled={pwSaving}
                />
                {pwError && <div style={s.errorText}>{pwError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={s.saveBtn} onClick={savePassword} disabled={pwSaving}>
                    {pwSaving ? '변경 중...' : '변경'}
                  </button>
                  <button
                    style={s.cancelBtn}
                    onClick={() => { setShowPwForm(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError(''); }}
                    disabled={pwSaving}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 화면 표시 */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>화면 표시</h2>
          <div style={{ ...s.notifyRow, borderBottom: 'none' }}>
            <div style={s.notifyInfo}>
              <div style={s.notifyLabel}>📊 통계 대시보드 기본 점수 기준</div>
              <div style={s.notifyDesc}>통계 대시보드를 열 때 어떤 기준으로 먼저 보여줄지 정해요 (대시보드 안에서 언제든 전환 가능)</div>
            </div>
            <div style={s.segmentWrap}>
              <button
                style={statsScale === 'raw' ? s.segmentActive : s.segment}
                onClick={() => changeStatsScale('raw')}
              >
                원점수
              </button>
              <button
                style={statsScale === 'pct' ? s.segmentActive : s.segment}
                onClick={() => changeStatsScale('pct')}
              >
                100점 환산
              </button>
            </div>
          </div>
        </section>

        {/* 알림 설정 */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>알림</h2>
          <p style={s.cardDesc}>채점이 완료되면 알림을 받아요. 채점이 오래 걸릴 때 다른 작업을 하다가 완료 소식을 들을 수 있어요.</p>

          {/* 브라우저 알림 */}
          <div style={s.notifyRow}>
            <div style={s.notifyInfo}>
              <div style={s.notifyLabel}>🖥️ 브라우저 알림</div>
              <div style={s.notifyDesc}>
                채점 완료 시 데스크톱 알림을 띄워요 (브라우저가 열려 있을 때)
                {permission === 'denied' && (
                  <div style={s.warnText}>
                    ⚠️ 브라우저에서 알림이 차단되어 있어요. 주소창 왼쪽 자물쇠 아이콘 → 알림 → 허용으로 바꿔주세요.
                  </div>
                )}
              </div>
            </div>
            <div style={s.notifyControls}>
              {browserOn && (
                <button style={s.testBtn} onClick={sendTest}>
                  {testSent ? '전송됨 ✓' : '테스트'}
                </button>
              )}
              <button
                style={browserOn ? s.toggleOn : s.toggleOff}
                onClick={toggleBrowser}
                disabled={permission === 'denied' || permission === 'unsupported'}
                title={permission === 'denied' ? '브라우저에서 알림이 차단됨' : ''}
              >
                <span style={{ ...s.toggleKnob, transform: browserOn ? 'translateX(18px)' : 'translateX(0)' }} />
              </button>
            </div>
          </div>

          {/* 이메일 알림 (추후) */}
          <div style={{ ...s.notifyRow, opacity: 0.55 }}>
            <div style={s.notifyInfo}>
              <div style={s.notifyLabel}>✉️ 이메일 알림 <span style={s.soonBadge}>추후 지원</span></div>
              <div style={s.notifyDesc}>채점 완료 시 {user?.email || '등록된 이메일'}로 결과 요약을 보내드려요</div>
            </div>
            <button style={{ ...s.toggleOff, cursor: 'not-allowed' }} disabled>
              <span style={s.toggleKnob} />
            </button>
          </div>

          {/* 문자 알림 (추후) */}
          <div style={{ ...s.notifyRow, opacity: 0.55, borderBottom: 'none' }}>
            <div style={s.notifyInfo}>
              <div style={s.notifyLabel}>📱 문자(SMS) 알림 <span style={s.soonBadge}>추후 지원</span></div>
              <div style={s.notifyDesc}>휴대폰 번호를 등록하면 문자로 알려드려요</div>
            </div>
            <button style={{ ...s.toggleOff, cursor: 'not-allowed' }} disabled>
              <span style={s.toggleKnob} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 24px' },

  card: {
    background: '#fff', borderRadius: 12, padding: '22px 26px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' },
  cardDesc: { fontSize: 13, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 },

  profileRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 },
  avatar: {
    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
    background: '#eff6ff', color: '#2563eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 700,
  },
  profileInfo: { display: 'flex', flexDirection: 'column', gap: 6 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  roleBadge: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 10px' },
  email: { fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, opacity: 0.6 },
  emailForm: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, outline: 'none', minWidth: 220,
  },
  saveBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
    padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  cancelBtn: {
    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '7px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  savedTag: { fontSize: 12, color: '#16a34a', fontWeight: 600 },
  errorText: { fontSize: 12.5, color: '#dc2626', marginTop: 6 },
  pwSection: { marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' },
  pwToggleBtn: {
    background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  pwForm: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 },

  notifyRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '14px 0', borderBottom: '1px solid #f1f5f9',
  },
  notifyInfo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  notifyLabel: { fontSize: 14, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 },
  notifyDesc: { fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 },
  warnText: { color: '#dc2626', marginTop: 6, fontSize: 12 },
  soonBadge: {
    fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7',
    borderRadius: 4, padding: '1px 6px',
  },
  notifyControls: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  segmentWrap: { display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 },
  segment: {
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '5px 12px', fontSize: 13, color: '#64748b', cursor: 'pointer', fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  segmentActive: {
    background: '#fff', border: 'none', borderRadius: 6,
    padding: '5px 12px', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
  },
  testBtn: {
    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
    borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  toggleOn: {
    width: 44, height: 26, borderRadius: 20, border: 'none', cursor: 'pointer',
    background: '#2563eb', position: 'relative', padding: 2, flexShrink: 0,
  },
  toggleOff: {
    width: 44, height: 26, borderRadius: 20, border: 'none', cursor: 'pointer',
    background: '#cbd5e1', position: 'relative', padding: 2, flexShrink: 0,
  },
  toggleKnob: {
    display: 'block', width: 22, height: 22, borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    transition: 'transform 0.15s ease',
  },
};
