import React, { useState, useEffect, useRef } from 'react';
import { Check, Minus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../App';
import { authAPI } from '../services/api';
import { getNotifyPref, setNotifyPref, sendBrowserNotification } from '../services/notify';
import { TERMS_OF_SERVICE, PRIVACY_REQUIRED } from '../constants/legalTerms';

const ROLE_BADGE = {
  professor: { label: '교수님', bg: '#eff6ff', color: '#2563eb' },
  admin:     { label: '관리자', bg: '#fef3c7', color: '#b45309' },
  student:   { label: '학생',   bg: '#f0fdf4', color: '#16a34a' },
};

// 서버 detail 이 객체·배열(FastAPI 검증 오류)로 오는 경우까지 감안해
// 사람이 읽을 수 있는 문장만 노출한다
function errorMessage(e, fallback) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  return fallback;
}

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

  // 내 정보 (이름 · 학교 · 학과 · 전화번호)
  const emptyProfile = { name: '', school: '', department: '', phone: '', agree_notify: false };
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(emptyProfile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  // 알림 수신 동의 철회 확인 모달
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const revokeModalRef = useRef(null);

  const confirmRevokeNotify = () => {
    setProfileDraft(p => ({ ...p, agree_notify: false }));
    setShowRevokeConfirm(false);
  };

  // 확인 모달이 떠 있는 동안 Esc 로 닫고, 배경 스크롤을 막고, 포커스를 모달 안에 가둔다.
  // 되돌릴 수 없는 선택을 묻는 창이라 Tab 으로 뒤 폼에 빠져나가면 무엇을 답하는 중인지
  // 알 수 없게 된다. 닫을 때는 체크박스로 포커스를 돌려준다
  useEffect(() => {
    if (!showRevokeConfirm) return;
    const opener = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowRevokeConfirm(false); return; }
      if (e.key !== 'Tab') return;
      const items = revokeModalRef.current?.querySelectorAll('button');
      if (!items || !items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [showRevokeConfirm]);

  // 필수 약관 동의 (가입 이전 계정 보완용)
  const [consentDraft, setConsentDraft] = useState({ terms: false, privacy: false });
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState('');

  const needsRequiredConsent = !!user && (!user.terms_agreed_at || !user.privacy_agreed_at);

  const saveConsent = async () => {
    setConsentError('');
    // 화면에 떠 있는(=아직 미동의인) 항목만 확인한다
    const pendingTerms = !user?.terms_agreed_at;
    const pendingPrivacy = !user?.privacy_agreed_at;
    if ((pendingTerms && !consentDraft.terms) || (pendingPrivacy && !consentDraft.privacy)) {
      setConsentError('필수 약관에 모두 동의해주세요');
      return;
    }
    setConsentSaving(true);
    try {
      await authAPI.agreeTerms({
        agree_terms: consentDraft.terms,
        agree_privacy: consentDraft.privacy,
      });
      await refreshUser();
      setConsentDraft({ terms: false, privacy: false });
    } catch (e) {
      setConsentError(errorMessage(e, '동의 저장에 실패했습니다. 잠시 후 다시 시도해주세요'));
    } finally {
      setConsentSaving(false);
    }
  };

  // 편집 모드는 한 번에 하나만 — 여러 폼이 동시에 열려 어느 저장 버튼이
  // 무엇을 저장하는지 헷갈리는 것을 막는다
  const closeOtherEdits = (keep) => {
    if (keep !== 'email') { setEditingEmail(false); setEmailError(''); }
    if (keep !== 'password') {
      setShowPwForm(false);
      setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
    }
    if (keep !== 'profile') { setEditingProfile(false); setProfileError(''); }
  };

  const startEditProfile = () => {
    closeOtherEdits('profile');
    setProfileDraft({
      name: user?.name || '',
      school: user?.school || '',
      department: user?.department || '',
      phone: user?.phone || '',
      agree_notify: !!user?.agree_notify,
    });
    setProfileError('');
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    setProfileError('');
    if (!profileDraft.name.trim()) { setProfileError('이름을 입력해주세요'); return; }
    if (profileDraft.agree_notify && profileDraft.phone.trim()) {
      const digits = profileDraft.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        setProfileError('전화번호는 숫자 10~11자리로 입력해주세요');
        return;
      }
    }
    setProfileSaving(true);
    try {
      await authAPI.updateProfile({
        name: profileDraft.name.trim(),
        school: profileDraft.school,
        department: profileDraft.department,
        phone: profileDraft.agree_notify ? profileDraft.phone : '',
        agree_notify: profileDraft.agree_notify,
      });
      await refreshUser();
      setEditingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      setProfileError(errorMessage(e, '저장에 실패했습니다. 잠시 후 다시 시도해주세요'));
    } finally {
      setProfileSaving(false);
    }
  };

  const startEditEmail = () => {
    closeOtherEdits('email');
    setEmailDraft(user?.email || '');
    setEmailError('');
    setEditingEmail(true);
  };

  const startEditPassword = () => {
    closeOtherEdits('password');
    setPwError('');
    setShowPwForm(true);
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
      setEmailError(errorMessage(e, '이메일 변경에 실패했습니다. 잠시 후 다시 시도해주세요'));
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
      setPwError(errorMessage(e, '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요'));
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
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase();

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
                <span style={s.name}>{user?.name || user?.username}</span>
                <span style={{ ...s.roleBadge, background: role.bg, color: role.color }}>{role.label}</span>
              </div>
              <div style={s.email}>
                ✉️ <span style={s.emailText}>{user?.email || '이메일 정보 없음'}</span>
                {emailSaved && <span style={s.savedTag}>✓ 변경됨</span>}
              </div>
            </div>

            {/* 비밀번호 변경 버튼 — 카드 우측 상단 */}
            {!showPwForm && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <button style={s.pwToggleBtn} onClick={startEditPassword}>
                  🔒 비밀번호 변경
                </button>
                {pwSaved && <span style={s.savedTag}>✓ 변경되었습니다</span>}
              </div>
            )}
          </div>

          {/* 비밀번호 변경 폼 */}
          {showPwForm && (
            <div className="auth-reveal" style={s.pwSection}>
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
                {pwError && <div style={s.errorText} role="alert">{pwError}</div>}
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

          {/* 내 정보 — 이름 · 학교 · 학과 · 전화번호 */}
          <div style={s.profileSection}>
            <div style={s.sectionHead}>
              <span style={s.sectionTitle}>내 정보</span>
              {!editingProfile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {profileSaved && <span style={s.savedTag}>✓ 저장됨</span>}
                  <button style={s.pwToggleBtn} onClick={startEditProfile}>✏️ 수정</button>
                </div>
              )}
            </div>

            {editingProfile ? (
              <div className="auth-reveal" style={s.profileForm}>
                <label style={s.field}>
                  <span style={s.fieldLabel}>이름 <span style={s.req}>*</span></span>
                  <input
                    style={s.fieldInput}
                    value={profileDraft.name}
                    onChange={e => setProfileDraft(p => ({ ...p, name: e.target.value }))}
                    placeholder="홍길동"
                    autoFocus
                    disabled={profileSaving}
                  />
                </label>
                <label style={s.field}>
                  <span style={s.fieldLabel}>학교</span>
                  <input
                    style={s.fieldInput}
                    value={profileDraft.school}
                    onChange={e => setProfileDraft(p => ({ ...p, school: e.target.value }))}
                    placeholder="○○대학교"
                    disabled={profileSaving}
                  />
                </label>
                <label style={s.field}>
                  <span style={s.fieldLabel}>학과</span>
                  <input
                    style={s.fieldInput}
                    value={profileDraft.department}
                    onChange={e => setProfileDraft(p => ({ ...p, department: e.target.value }))}
                    placeholder="정보통계학과"
                    disabled={profileSaving}
                  />
                </label>

                <label style={s.consentRow}>
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={profileDraft.agree_notify}
                    onChange={e => {
                      const on = e.target.checked;
                      // 철회하면 알림을 받지 못하고 저장된 번호도 파기된다.
                      // 되돌릴 수 없으므로 확인 모달을 띄운다
                      if (!on) { setShowRevokeConfirm(true); return; }
                      setProfileDraft(p => ({ ...p, agree_notify: on }));
                    }}
                    disabled={profileSaving}
                  />
                  <span style={s.consentText}>
                    알림 수신에 동의합니다 <span style={s.optionalTag}>선택</span>
                    <span style={s.consentHint}>
                      전화번호는 알림 수신에 동의하신 경우에만 보관해요. 동의를 해제하면 저장된 번호도 함께 삭제됩니다.
                    </span>
                  </span>
                </label>

                {profileDraft.agree_notify && (
                  <label className="auth-reveal" style={s.field}>
                    <span style={s.fieldLabel}>전화번호</span>
                    <input
                      style={s.fieldInput}
                      value={profileDraft.phone}
                      onChange={e => setProfileDraft(p => ({ ...p, phone: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveProfile(); }}
                      placeholder="010-1234-5678"
                      inputMode="tel"
                      disabled={profileSaving}
                    />
                  </label>
                )}

                {profileError && <div style={s.errorText} role="alert">{profileError}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button style={s.saveBtn} onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? '저장 중...' : '저장'}
                  </button>
                  <button style={s.cancelBtn} onClick={() => setEditingProfile(false)} disabled={profileSaving}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <dl style={s.infoList}>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>아이디</dt>
                  <dd style={s.infoVal}>
                    <span style={s.infoValText}>{user?.username}</span>
                    <span style={s.lockedTag}>변경 불가</span>
                  </dd>
                </div>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>이름</dt>
                  <dd style={user?.name ? s.infoVal : s.infoEmpty}>{user?.name || '— 미입력'}</dd>
                </div>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>이메일</dt>
                  {editingEmail ? (
                    /* 진입 버튼과 같은 자리에서 열어 시선 이동을 없앤다 */
                    <dd style={s.infoValBlock}>
                      <div className="auth-reveal" style={s.emailForm}>
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
                          aria-label="새 이메일 주소"
                          autoFocus
                          disabled={emailSaving}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={s.saveBtn} onClick={saveEmail} disabled={emailSaving || !emailDraft.trim()}>
                            {emailSaving ? '저장 중...' : '저장'}
                          </button>
                          <button style={s.cancelBtn} onClick={() => setEditingEmail(false)} disabled={emailSaving}>취소</button>
                        </div>
                      </div>
                      {emailError && <div style={s.errorText} role="alert">{emailError}</div>}
                    </dd>
                  ) : (
                    <dd style={user?.email ? s.infoVal : s.infoEmpty}>
                      <span style={s.infoValText}>{user?.email || '— 미입력'}</span>
                      <button style={s.inlineEditBtn} onClick={startEditEmail}>변경</button>
                      {emailSaved && <span style={s.savedTag}>✓ 변경됨</span>}
                    </dd>
                  )}
                </div>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>학교</dt>
                  <dd style={user?.school ? s.infoVal : s.infoEmpty}>{user?.school || '— 미입력'}</dd>
                </div>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>학과</dt>
                  <dd style={user?.department ? s.infoVal : s.infoEmpty}>{user?.department || '— 미입력'}</dd>
                </div>
                <div style={s.infoRow}>
                  <dt style={s.infoKey}>전화번호</dt>
                  <dd style={user?.phone ? s.infoVal : s.infoEmpty}>
                    {user?.phone || (user?.agree_notify ? '— 미입력' : '— 미등록 (알림 미동의)')}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* 약관 동의 현황 */}
          <div style={s.profileSection}>
            <div style={s.sectionHead}>
              <span style={s.sectionTitle}>약관 동의</span>
            </div>
            <dl style={s.consentList}>
              <ConsentRow label="이용약관" required at={user?.terms_agreed_at} />
              <ConsentRow label="개인정보 수집 및 이용" required at={user?.privacy_agreed_at} />
              <ConsentRow label="알림 서비스 개인정보 이용" at={user?.notify_agreed_at} />
            </dl>

            {/* 필수 약관 미동의 — 이 자리에서 바로 동의할 수 있게 한다.
                가입 이전에 만들어진 계정은 동의 이력이 없어 여기로 들어온다. */}
            {needsRequiredConsent && (
              <div style={s.consentTodo}>
                <p style={s.consentTodoText}>
                  아직 동의하지 않은 필수 약관이 있어요. 아래에서 전문을 확인하고 동의해주세요.
                </p>

                {!user?.terms_agreed_at && (
                  <ConsentAgreeBlock
                    label="이용약관"
                    body={TERMS_OF_SERVICE}
                    checked={consentDraft.terms}
                    onToggle={() => setConsentDraft(c => ({ ...c, terms: !c.terms }))}
                    disabled={consentSaving}
                  />
                )}
                {!user?.privacy_agreed_at && (
                  <ConsentAgreeBlock
                    label="개인정보 수집 및 이용"
                    body={PRIVACY_REQUIRED}
                    checked={consentDraft.privacy}
                    onToggle={() => setConsentDraft(c => ({ ...c, privacy: !c.privacy }))}
                    disabled={consentSaving}
                  />
                )}

                {consentError && <div style={s.errorText} role="alert">{consentError}</div>}
                <button
                  style={s.saveBtn}
                  onClick={saveConsent}
                  disabled={consentSaving}
                >
                  {consentSaving ? '저장 중...' : '동의하고 저장'}
                </button>
              </div>
            )}

            <p style={s.consentFoot}>
              <strong style={s.consentFootLead}>선택 동의</strong>(알림 서비스)는 위 「내 정보」 수정에서 언제든 철회할 수 있어요. 철회하면 저장된 전화번호도 함께 삭제됩니다.
            </p>
            <p style={s.consentFoot}>
              <strong style={s.consentFootLead}>필수 동의</strong>(이용약관·개인정보 수집 및 이용)는 계정을 유지하는 근거라 따로 철회할 수 없어요.
              철회를 원하시면 계정 삭제로 처리되며, 저장된 개인정보와 채점 기록이 모두 파기됩니다.
            </p>
            <p style={s.consentFoot}>
              계정 삭제는 현재 화면에서 지원하지 않아요. 시스템 관리자에게 요청해주세요.
            </p>
          </div>
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
              <div style={s.notifyDesc}>
                {user?.phone
                  ? `${user.phone} 로 문자를 보내드릴 예정이에요`
                  : '위 「내 정보」에서 휴대폰 번호를 등록하면 문자로 알려드려요'}
              </div>
            </div>
            <button style={{ ...s.toggleOff, cursor: 'not-allowed' }} disabled>
              <span style={s.toggleKnob} />
            </button>
          </div>
        </section>
      </main>

      {/* 알림 수신 동의 철회 확인 */}
      {showRevokeConfirm && (
        <div style={s.overlay} role="presentation">
          <div
            ref={revokeModalRef}
            style={s.modal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            aria-describedby="revoke-desc"
          >
            <div style={s.modalIcon} aria-hidden="true">
              <AlertTriangle size={22} strokeWidth={2.5} />
            </div>
            <h3 id="revoke-title" style={s.modalTitle}>알림 수신 동의를 철회할까요?</h3>
            <p id="revoke-desc" style={s.modalBody}>
              철회하시면 채점 완료·과목 초대 알림을 <strong>더 이상 받으실 수 없어요</strong>.
              {user?.phone && (
                <> 저장된 전화번호 <span style={s.modalPhone}>{user.phone}</span> 도 함께 삭제됩니다.</>
              )}
            </p>
            <p style={s.modalNote}>
              나중에 언제든 다시 동의하실 수 있어요. 다만 전화번호는 새로 입력하셔야 합니다.
            </p>
            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={() => setShowRevokeConfirm(false)} autoFocus>
                유지할게요
              </button>
              <button style={s.dangerBtn} onClick={confirmRevokeNotify}>
                철회할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsentRow({ label, required, at }) {
  const date = at ? new Date(at).toLocaleDateString('ko-KR') : null;
  return (
    <div style={s.consentItem}>
      <dt style={s.consentKey}>
        <span style={s.consentLabel}>{label}</span>
        <span style={{ ...s.agreeTag, color: required ? '#b91c1c' : '#475569' }}>
          {required ? '필수' : '선택'}
        </span>
      </dt>
      {/* 색만으로 구분하지 않도록 아이콘을 함께 둔다 */}
      <dd style={date ? s.consentValOk : s.consentValNone}>
        {date
          ? <><Check size={14} strokeWidth={3} aria-hidden="true" />동의함 <span style={s.consentDate}>{date}</span></>
          : <><Minus size={14} strokeWidth={3} aria-hidden="true" />미동의</>}
      </dd>
    </div>
  );
}

// 미동의 필수 약관 — 전문을 보여주고 체크로 동의받는다 (가입 2단계와 같은 구성)
function ConsentAgreeBlock({ label, body, checked, onToggle, disabled }) {
  return (
    <div style={s.agreeBlock}>
      <label style={s.agreeToggle}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          style={s.agreeCheckbox}
        />
        <span style={s.agreeBlockLabel}>
          {label}
          <span style={{ ...s.agreeTag, color: '#b91c1c' }}>필수</span>
        </span>
      </label>
      <div className="auth-terms-body" style={s.agreeBody} tabIndex={0} role="region" aria-label={`${label} 전문`}>
        {body}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 24px' },

  card: {
    background: '#fff', borderRadius: 12, padding: '24px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 8px', lineHeight: 1.3 },
  cardDesc: { fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 },

  profileRow: {
    display: 'flex', alignItems: 'center', gap: 16, marginTop: 12,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
    background: '#eff6ff', color: '#2563eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 700,
  },
  profileInfo: { display: 'flex', flexDirection: 'column', gap: 8 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 },
  roleBadge: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 10px', lineHeight: 1.5 },
  email: {
    fontSize: 14, color: '#475569', lineHeight: 1.5,
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0,
  },
  // 긴 주소가 카드를 밀어내지 않도록 줄바꿈을 허용한다
  emailText: { overflowWrap: 'anywhere', minWidth: 0 },
  emailForm: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: {
    padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, lineHeight: 1.5, outline: 'none',
    minWidth: 0, width: '100%', maxWidth: 260, boxSizing: 'border-box',
  },
  saveBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: 40,
  },
  cancelBtn: {
    background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: 40,
  },
  savedTag: { fontSize: 12, color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' },
  errorText: { fontSize: 13, color: '#b91c1c', lineHeight: 1.5, marginTop: 8 },
  pwSection: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' },
  pwToggleBtn: {
    background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    minHeight: 40, whiteSpace: 'nowrap',
  },
  pwForm: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 },

  // 하위 섹션은 옅은 패널로 감싸 카드 안에서 경계가 한눈에 보이게 한다
  profileSection: {
    marginTop: 16, padding: 16,
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
  },
  sectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 12, flexWrap: 'wrap',
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#374151', lineHeight: 1.3 },

  infoList: { margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  // 좁은 폭에서는 라벨과 값이 겹치지 않도록 세로로 접는다
  infoRow: {
    display: 'flex', alignItems: 'baseline', gap: 12,
    flexWrap: 'wrap', rowGap: 4,
  },
  infoKey: { fontSize: 13, color: '#64748b', width: 72, flexShrink: 0, margin: 0, lineHeight: 1.5 },
  infoVal: {
    fontSize: 14, color: '#1e293b', margin: 0, minWidth: 0, lineHeight: 1.5,
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  // 인라인 폼이 들어가는 값 칸 — 폼이 라벨 옆에서 온전히 펼쳐지도록 한다
  infoValBlock: { margin: 0, minWidth: 0, flex: '1 1 240px' },
  infoValText: { overflowWrap: 'anywhere', minWidth: 0 },
  infoEmpty: { fontSize: 14, color: '#64748b', margin: 0, minWidth: 0, lineHeight: 1.5 },
  lockedTag: {
    fontSize: 11, fontWeight: 700, color: '#475569', background: '#e2e8f0',
    borderRadius: 4, padding: '2px 6px', lineHeight: 1.5,
  },
  inlineEditBtn: {
    background: 'none', border: 'none', color: '#1d4ed8', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
    // 40px 클릭 영역을 확보하되 여백만큼 음수 마진으로 당겨 줄 간격은 유지한다
    padding: '10px 8px', margin: '-10px -8px', borderRadius: 6,
  },

  consentList: { margin: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  consentItem: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap', rowGap: 4, padding: '8px 0',
    borderBottom: '1px solid #e2e8f0',
  },
  consentKey: {
    fontSize: 13, color: '#475569', margin: 0, minWidth: 0,
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  consentLabel: { minWidth: 0 },
  consentValOk: {
    fontSize: 13, color: '#15803d', fontWeight: 600, margin: 0,
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
  },
  consentValNone: {
    fontSize: 13, color: '#64748b', fontWeight: 600, margin: 0,
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
  },
  consentDate: { fontWeight: 400, color: '#64748b', fontVariantNumeric: 'tabular-nums' },
  agreeTag: { fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, zIndex: 1000,
  },
  // 낮은 화면(노트북·가로 모드)에서 버튼이 잘리지 않도록 높이를 제한하고 스크롤을 연다
  modal: {
    background: '#fff', borderRadius: 12, padding: 24,
    width: '100%', maxWidth: 420, boxShadow: '0 12px 32px rgba(15,23,42,0.2)',
    maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxSizing: 'border-box',
  },
  // 위험한 선택임을 색 외에 아이콘으로도 알린다
  modalIcon: {
    width: 40, height: 40, borderRadius: '50%', marginBottom: 12,
    background: '#fef2f2', color: '#b91c1c',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: '#1e293b', margin: '0 0 12px' },
  modalBody: { fontSize: 14, lineHeight: 1.6, color: '#374151', margin: '0 0 8px' },
  modalPhone: { fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  modalNote: { fontSize: 13, lineHeight: 1.6, color: '#64748b', margin: '0 0 20px' },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  // 모달 버튼은 인라인 폼 버튼보다 크게 — 오답이 곧 데이터 삭제라 표적을 넉넉히 둔다
  modalCancelBtn: {
    background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    minHeight: 44, whiteSpace: 'nowrap',
  },
  dangerBtn: {
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    minHeight: 44, whiteSpace: 'nowrap',
  },

  consentTodo: {
    marginTop: 16, padding: 16, borderRadius: 8,
    background: '#fffbeb', border: '1px solid #fde68a',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  consentTodoText: { fontSize: 13, lineHeight: 1.6, color: '#92400e', margin: 0 },
  agreeBlock: { display: 'flex', flexDirection: 'column', gap: 8 },
  agreeToggle: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    padding: '4px 0', minHeight: 32,
  },
  agreeCheckbox: { width: 18, height: 18, accentColor: '#2563eb', flexShrink: 0, cursor: 'pointer' },
  agreeBlockLabel: {
    fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: '#374151',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  agreeBody: {
    maxHeight: 140, overflowY: 'auto', padding: 12,
    border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
    fontSize: 12.5, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap',
  },
  consentFoot: { fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: '12px 0 0' },
  consentFootLead: { color: '#475569', fontWeight: 700 },

  profileForm: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#475569', lineHeight: 1.5 },
  fieldInput: {
    padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  req: { color: '#b91c1c' },
  consentRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px',
  },
  consentText: { fontSize: 13, color: '#374151', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 },
  checkbox: { width: 18, height: 18, flexShrink: 0, marginTop: 1, cursor: 'pointer', accentColor: '#2563eb' },
  consentHint: { fontSize: 12, color: '#64748b', lineHeight: 1.5 },
  optionalTag: {
    fontSize: 11, fontWeight: 700, color: '#475569', background: '#e2e8f0',
    borderRadius: 4, padding: '2px 6px', marginLeft: 4, lineHeight: 1.5,
  },

  notifyRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '16px 0', borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap',
  },
  notifyInfo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  notifyLabel: {
    fontSize: 14, fontWeight: 600, color: '#374151', lineHeight: 1.5,
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  notifyDesc: { fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  warnText: { color: '#b91c1c', marginTop: 8, fontSize: 12, lineHeight: 1.5 },
  soonBadge: {
    fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7',
    borderRadius: 4, padding: '2px 6px', lineHeight: 1.5,
  },
  notifyControls: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  segmentWrap: { display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 },
  segment: {
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '8px 12px', fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 500,
    whiteSpace: 'nowrap', minHeight: 36,
  },
  segmentActive: {
    background: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 12px', fontSize: 13, color: '#1d4ed8', cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', minHeight: 36,
  },
  testBtn: {
    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
    borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    minHeight: 40, whiteSpace: 'nowrap',
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
