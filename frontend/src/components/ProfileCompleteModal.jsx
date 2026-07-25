import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../App';
import { authAPI } from '../services/api';
import { TERMS_OF_SERVICE, PRIVACY_REQUIRED, PRIVACY_OPTIONAL } from '../constants/legalTerms';

/**
 * 기존 계정 프로필 보완 안내 (유도형).
 *
 * 이름 또는 필수 동의 이력이 없는 계정에 로그인 직후 노출된다.
 * '나중에 하기'로 닫을 수 있고, 7일 뒤 다시 뜬다 (노출 조건은 백엔드가 판단).
 * 기존 계정이 전원 입력을 마치면 이 컴포넌트와 name 폴백을 함께 제거할 수 있다.
 */
export default function ProfileCompleteModal() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState({ terms: false, privacy: false, notify: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Esc 핸들러가 최신 저장 상태를 보도록 ref 로 함께 들고 있는다
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    authAPI.profileStatus()
      .then(res => {
        if (cancelled) return;
        setStatus(res.data);
        setName(user.name || '');
        setSchool(user.school || '');
        setDepartment(user.department || '');
        setPhone(user.phone || '');
      })
      .catch(() => { /* 안내용이므로 실패해도 조용히 넘어간다 */ });
    return () => { cancelled = true; };
  }, [user]);

  const open = !!status?.should_prompt;

  // 모달이 떠 있는 동안 배경 스크롤을 막는다
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc 는 이번 화면에서만 닫는다 — '나중에 하기'와 달리 7일 유예를 쓰지 않는다.
  // 실수로 누른 Esc 로 유예가 소모되면 안 되므로 dismiss API 는 호출하지 않고,
  // 다음 로그인 때 다시 안내한다. 오버레이 밖으로 포커스가 나가도 듣도록 document 에 건다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || loadingRef.current) return;
      setStatus({ should_prompt: false });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const needsConsent = status.needs_consent;
  const requiredAgreed = !needsConsent || (agree.terms && agree.privacy);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!requiredAgreed) {
      setError('필수 약관에 동의해주세요');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.completeProfile({
        name: name.trim(),
        school: school.trim() || null,
        department: department.trim() || null,
        phone: agree.notify ? (phone.trim() || null) : null,
        agree_terms: agree.terms || !needsConsent,
        agree_privacy: agree.privacy || !needsConsent,
        agree_notify: agree.notify,
      });
      await refreshUser();
      setStatus({ should_prompt: false });
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setStatus({ should_prompt: false });
    try {
      await authAPI.dismissProfilePrompt();
    } catch { /* 실패해도 이번 세션에서는 닫힌 상태로 둔다 */ }
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true"
      aria-labelledby="profile-modal-title">
      <div style={s.modal}>
        <div style={s.header}>
          <h2 id="profile-modal-title" style={s.title}>프로필 정보를 입력해주세요</h2>
          <p style={s.subtitle}>
            {needsConsent
              ? '서비스 개선으로 이름과 약관 동의가 추가되었습니다. 잠깐이면 됩니다.'
              : '화면에 표시할 이름이 아직 등록되지 않았습니다.'}
          </p>
        </div>

        <div style={s.body}>
          <Field label="이름" required>
            <input className="auth-input auth-focusable" style={s.input} value={name}
              onChange={e => setName(e.target.value)}
              placeholder="실명 입력" autoComplete="name" autoFocus />
          </Field>
          <div style={s.formGrid}>
            <Field label="학교">
              <input className="auth-input auth-focusable" style={s.input} value={school}
                onChange={e => setSchool(e.target.value)}
                placeholder="예) 한남대학교" autoComplete="organization" />
            </Field>
            <Field label="학과">
              <input className="auth-input auth-focusable" style={s.input} value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="예) 수학과" />
            </Field>
          </div>

          {needsConsent && (
            <div style={s.consentWrap}>
              <AgreeRow
                label="이용약관 동의" required
                checked={agree.terms}
                onToggle={() => setAgree(a => ({ ...a, terms: !a.terms }))}
                body={TERMS_OF_SERVICE}
              />
              <AgreeRow
                label="개인정보 수집 및 이용 동의" required
                checked={agree.privacy}
                onToggle={() => setAgree(a => ({ ...a, privacy: !a.privacy }))}
                body={PRIVACY_REQUIRED}
              />
              <AgreeRow
                label="알림 서비스를 위한 개인정보 수집 및 이용 동의"
                checked={agree.notify}
                onToggle={() => setAgree(a => ({ ...a, notify: !a.notify }))}
                body={PRIVACY_OPTIONAL}
              />
            </div>
          )}

          {agree.notify && (
            <div className="auth-reveal">
              <Field label="휴대전화번호" hint="선택 · 미입력해도 저장됩니다">
                <input className="auth-input auth-focusable" style={s.input} type="tel"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="010-1234-5678" autoComplete="tel" />
                <p style={s.fieldNote}>채점 완료·과목 초대 알림에만 사용됩니다.</p>
              </Field>
            </div>
          )}
        </div>

        <div style={s.footer}>
          {error && <div style={s.error} role="alert">{error}</div>}
          <div style={s.buttonRow}>
            <button type="button" className="auth-ghost-button auth-focusable"
              style={s.ghostButton} onClick={handleDismiss} disabled={loading}>
              나중에 하기
            </button>
            <button type="button" className="auth-button auth-focusable"
              style={loading ? { ...s.button, opacity: 0.7 } : s.button}
              onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <span style={s.spinner} aria-hidden="true" />
                  저장 중...
                </>
              ) : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgreeRow({ label, required, checked, onToggle, body }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={s.agreeRow}>
      <div style={s.agreeHead}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          className="auth-agree-toggle auth-focusable"
          style={s.agreeToggle}
          onClick={onToggle}
        >
          <span className="auth-checkbox" style={{
            ...s.checkbox,
            background: checked ? '#2563eb' : '#fff',
            borderColor: checked ? '#2563eb' : '#cbd5e1',
          }}>
            {checked && <Check size={12} strokeWidth={3} color="#fff" />}
          </span>
          <span style={s.agreeLabel}>
            {label}
            <span style={{ ...s.agreeTag, color: required ? '#dc2626' : '#64748b' }}>
              ({required ? '필수' : '선택'})
            </span>
          </span>
        </button>
        <button type="button" className="auth-text-button auth-focusable"
          style={s.viewButton} onClick={() => setOpen(o => !o)}
          aria-expanded={open}>
          {open ? '접기' : '보기'}
        </button>
      </div>
      {open && (
        <div className="auth-terms-body" style={s.agreeBody} tabIndex={0}
          role="region" aria-label={`${label} 본문`}>
          {body}
        </div>
      )}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={s.label}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
        {hint && <span style={s.fieldHint}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
    maxHeight: 'calc(100vh - 32px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(15,23,42,0.22)',
  },
  // 헤더·푸터는 고정하고 가운데 본문만 스크롤시켜 버튼이 잘리지 않게 한다
  header: { padding: '24px 24px 16px', flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 1.5 },
  body: {
    display: 'flex', flexDirection: 'column', gap: 16,
    overflowY: 'auto', padding: '0 24px 8px', flex: 1, minHeight: 0,
  },
  footer: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '16px 24px 24px', flexShrink: 0,
    borderTop: '1px solid #e2e8f0', background: '#fff',
  },

  // 학교/학과 2열. 모달 폭이 좁아 RegisterPage(200px)보다 낮은 기준으로 접는다
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16,
  },
  label: { fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: '#374151' },
  fieldHint: { fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 8 },
  fieldNote: { fontSize: 12, lineHeight: 1.5, color: '#64748b', marginTop: 8 },
  input: {
    padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  },

  consentWrap: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '16px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 12,
  },
  agreeRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  agreeHead: { display: 'flex', alignItems: 'center', gap: 8 },
  agreeToggle: {
    display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
    background: 'none', border: 'none', padding: '8px 4px', margin: '-8px -4px',
    cursor: 'pointer', textAlign: 'left', borderRadius: 8,
  },
  agreeLabel: { fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: '#374151' },
  agreeTag: { fontSize: 12, fontWeight: 600, marginLeft: 4, whiteSpace: 'nowrap' },
  viewButton: {
    background: 'none', border: 'none', color: '#2563eb', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', padding: '8px 12px', flexShrink: 0,
    borderRadius: 6, minHeight: 40,
  },
  agreeBody: {
    maxHeight: 160, overflowY: 'auto', padding: '12px 14px',
    border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
    fontSize: 13, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, border: '1.5px solid #cbd5e1',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  error: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
    borderRadius: 8, padding: '12px 16px', fontSize: 14, lineHeight: 1.5,
  },
  buttonRow: { display: 'flex', gap: 12 },
  button: {
    flex: 2, background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    minHeight: 48, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  ghostButton: {
    flex: 1, background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0',
    borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    minHeight: 48,
  },
  spinner: {
    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', display: 'inline-block',
  },
};
