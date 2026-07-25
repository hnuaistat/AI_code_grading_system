import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, UserCog, Check, ChevronRight } from 'lucide-react';
import { authAPI } from '../services/api';
import { TERMS_OF_SERVICE, PRIVACY_REQUIRED, PRIVACY_OPTIONAL } from '../constants/legalTerms';

const STEPS = ['가입 유형', '약관 동의', '정보 입력'];

const ROLES = [
  { value: 'professor', label: '교수', desc: '과목을 만들고 채점을 관리합니다', Icon: GraduationCap },
  { value: 'ta', label: '조교', desc: '초대받은 과목의 채점에 참여합니다', Icon: UserCog },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState('professor');
  const [agree, setAgree] = useState({ terms: false, privacy: false, notify: false });
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '',
    name: '', school: '', department: '', phone: '',
  });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const allAgreed = agree.terms && agree.privacy && agree.notify;
  const requiredAgreed = agree.terms && agree.privacy;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgree({ terms: next, privacy: next, notify: next });
  };

  const goStep = (next) => {
    setError('');
    setStep(next);
  };

  const handleSelectRole = (value) => {
    setRole(value);
    goStep(2);
  };

  const handleAgreeNext = () => {
    if (!requiredAgreed) {
      setError('필수 약관에 동의해주세요');
      return;
    }
    goStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (!form.name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role,
        school: form.school.trim() || null,
        department: form.department.trim() || null,
        phone: agree.notify ? (form.phone.trim() || null) : null,
        agree_terms: agree.terms,
        agree_privacy: agree.privacy,
        agree_notify: agree.notify,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.detail || '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <Stepper current={step} />

        {step === 1 && (
          <>
            <h1 style={s.title}>회원가입</h1>
            <p style={s.subtitle}>가입하실 유형을 선택해주세요</p>
            <div style={s.roleList}>
              {ROLES.map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className="auth-role-card auth-focusable"
                  style={s.roleCard}
                  onClick={() => handleSelectRole(value)}
                >
                  <Icon size={24} strokeWidth={1.8} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <span style={s.roleText}>
                    <span style={s.roleLabel}>{label}</span>
                    <span style={s.roleDesc}>{desc}</span>
                  </span>
                  <ChevronRight size={20} strokeWidth={2} style={{ color: '#94a3b8', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={s.title}>회원가입 동의</h1>
            <p style={s.subtitle}>
              {role === 'ta' ? '조교' : '교수'} 회원가입을 위해 약관에 동의해주세요
            </p>

            <button
              type="button"
              role="checkbox"
              aria-checked={allAgreed}
              className="auth-agree-row auth-focusable"
              style={s.agreeAllRow}
              onClick={toggleAll}
            >
              <CheckBox checked={allAgreed} />
              <span style={s.agreeAllText}>이용약관, 개인정보 수집 및 이용에 모두 동의합니다.</span>
            </button>

            <AgreeBlock
              label="이용약관 동의" required
              checked={agree.terms}
              onToggle={() => setAgree(a => ({ ...a, terms: !a.terms }))}
              body={TERMS_OF_SERVICE}
            />
            <AgreeBlock
              label="개인정보 수집 및 이용 동의" required
              checked={agree.privacy}
              onToggle={() => setAgree(a => ({ ...a, privacy: !a.privacy }))}
              body={PRIVACY_REQUIRED}
            />
            <AgreeBlock
              label="알림 서비스를 위한 개인정보 수집 및 이용 동의"
              checked={agree.notify}
              onToggle={() => setAgree(a => ({ ...a, notify: !a.notify }))}
              body={PRIVACY_OPTIONAL}
            />

            {error && <div style={s.error} role="alert">{error}</div>}
            <div style={s.buttonRow}>
              <button type="button" className="auth-ghost-button auth-focusable"
                style={s.ghostButton} onClick={() => goStep(1)}>
                이전
              </button>
              <button type="button" className="auth-button auth-focusable"
                style={s.button} onClick={handleAgreeNext}>
                다음
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 style={s.title}>정보 입력</h1>
            <p style={s.subtitle}>서비스 이용에 필요한 정보를 입력해주세요</p>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.formGrid}>
                <Field label="아이디" required>
                  <input className="auth-input auth-focusable" style={s.input} type="text"
                    value={form.username} onChange={set('username')}
                    placeholder="영문, 숫자 조합" autoComplete="username" required />
                </Field>
                <Field label="이름" required>
                  <input className="auth-input auth-focusable" style={s.input} type="text"
                    value={form.name} onChange={set('name')}
                    placeholder="실명 입력" autoComplete="name" required />
                </Field>
              </div>
              <Field label="이메일" required>
                <input className="auth-input auth-focusable" style={s.input} type="email"
                  value={form.email} onChange={set('email')}
                  placeholder="professor@univ.ac.kr" autoComplete="email" required />
              </Field>
              <div style={s.formGrid}>
                <Field label="비밀번호" required hint="6자 이상">
                  <input className="auth-input auth-focusable" style={s.input} type="password"
                    value={form.password} onChange={set('password')}
                    placeholder="비밀번호 입력" autoComplete="new-password" required />
                </Field>
                <Field label="비밀번호 확인" required>
                  <input className="auth-input auth-focusable" style={s.input} type="password"
                    value={form.confirm} onChange={set('confirm')}
                    placeholder="비밀번호 재입력" autoComplete="new-password" required />
                </Field>
              </div>
              <div style={s.formGrid}>
                <Field label="학교">
                  <input className="auth-input auth-focusable" style={s.input} type="text"
                    value={form.school} onChange={set('school')}
                    placeholder="예) 한남대학교" autoComplete="organization" />
                </Field>
                <Field label="학과">
                  <input className="auth-input auth-focusable" style={s.input} type="text"
                    value={form.department} onChange={set('department')}
                    placeholder="예) 수학과" />
                </Field>
              </div>
              {agree.notify && (
                <div className="auth-reveal">
                  <Field label="휴대전화번호" hint="선택 · 미입력해도 가입됩니다">
                    <input className="auth-input auth-focusable" style={s.input} type="tel"
                      value={form.phone} onChange={set('phone')}
                      placeholder="010-1234-5678" autoComplete="tel" />
                    <p style={s.fieldNote}>
                      2단계에서 알림 수신에 동의하셔서 표시됩니다. 채점 완료·과목 초대 알림에만 사용됩니다.
                    </p>
                  </Field>
                </div>
              )}

              {error && <div style={s.error} role="alert">{error}</div>}
              <div style={s.buttonRow}>
                <button type="button" className="auth-ghost-button auth-focusable"
                  style={s.ghostButton} onClick={() => goStep(2)} disabled={loading}>
                  이전
                </button>
                <button className="auth-button auth-focusable"
                  style={loading ? { ...s.button, opacity: 0.7 } : s.button}
                  type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span style={s.spinner} aria-hidden="true" />
                      처리 중...
                    </>
                  ) : '가입 완료'}
                </button>
              </div>
            </form>
          </>
        )}

        <div style={s.footer}>
          <span style={s.footerText}>이미 계정이 있으신가요?</span>
          <Link to="/login" className="auth-focusable" style={s.link}>로그인</Link>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }) {
  return (
    <div style={s.stepper}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <React.Fragment key={label}>
            {i > 0 && <span style={{ ...s.stepLine, background: done || active ? '#2563eb' : '#e2e8f0' }} />}
            <span style={s.stepItem} aria-current={active ? 'step' : undefined}>
              <span style={{
                ...s.stepNum,
                background: done || active ? '#2563eb' : '#e2e8f0',
                color: done || active ? '#fff' : '#64748b',
              }}>
                {done ? <Check size={14} strokeWidth={3} /> : n}
              </span>
              <span style={{
                ...s.stepLabel,
                color: active ? '#1e293b' : '#64748b',
                fontWeight: active ? 700 : 500,
              }}>
                {label}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CheckBox({ checked }) {
  return (
    <span className="auth-checkbox" style={{
      ...s.checkbox,
      background: checked ? '#2563eb' : '#fff',
      borderColor: checked ? '#2563eb' : '#cbd5e1',
    }}>
      {checked && <Check size={14} strokeWidth={3} color="#fff" />}
    </span>
  );
}

function AgreeBlock({ label, required, checked, onToggle, body }) {
  return (
    <div style={s.agreeBlock}>
      <div style={s.agreeHeader}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          className="auth-agree-toggle auth-focusable"
          style={s.agreeToggle}
          onClick={onToggle}
        >
          <CheckBox checked={checked} />
          <span style={s.agreeLabel}>
            {label}
            <span style={{ ...s.agreeTag, color: required ? '#dc2626' : '#64748b' }}>
              ({required ? '필수' : '선택'})
            </span>
          </span>
        </button>
      </div>
      <div className="auth-terms-body" style={s.agreeBody} tabIndex={0} role="region" aria-label={`${label} 본문`}>
        {body}
      </div>
      <p style={s.scrollHint}>스크롤하여 전문을 확인하실 수 있습니다</p>
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
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f8fafc', padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '40px',
    width: '100%', maxWidth: 560, boxShadow: '0 4px 24px rgba(37,99,235,0.10)',
  },
  stepper: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 32, flexWrap: 'wrap',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8 },
  stepNum: {
    width: 24, height: 24, borderRadius: '50%', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
    flexShrink: 0,
  },
  stepLabel: { fontSize: 13, lineHeight: 1.4 },
  stepLine: { width: 24, height: 2, borderRadius: 1, flexShrink: 0 },

  title: { fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 1.5, textAlign: 'center', marginBottom: 32 },

  roleList: { display: 'flex', flexDirection: 'column', gap: 12 },
  roleCard: {
    display: 'flex', alignItems: 'center', gap: 16, width: '100%',
    padding: '20px', border: '1.5px solid #e2e8f0', borderRadius: 12,
    background: '#fff', cursor: 'pointer', textAlign: 'left',
  },
  roleText: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  roleLabel: { fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: '#1e293b' },
  roleDesc: { fontSize: 13, lineHeight: 1.5, color: '#64748b' },

  agreeAllRow: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '16px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
    borderRadius: 12, marginBottom: 24, cursor: 'pointer', textAlign: 'left',
  },
  agreeAllText: { fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: '#1e293b' },

  agreeBlock: { marginBottom: 24 },
  agreeHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  agreeToggle: {
    display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
    background: 'none', border: 'none', padding: '8px 4px', margin: '-8px -4px',
    cursor: 'pointer', textAlign: 'left', borderRadius: 8,
  },
  agreeLabel: { fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: '#374151' },
  agreeTag: { fontSize: 13, fontWeight: 600, marginLeft: 6, whiteSpace: 'nowrap' },
  agreeBody: {
    maxHeight: 160, overflowY: 'auto', padding: '16px',
    border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc',
    fontSize: 13, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap',
  },
  scrollHint: { fontSize: 12, lineHeight: 1.5, color: '#64748b', marginTop: 8 },

  checkbox: {
    width: 20, height: 20, borderRadius: 6, border: '1.5px solid #cbd5e1',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20,
  },
  label: { fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: '#374151' },
  fieldHint: { fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 8 },
  fieldNote: { fontSize: 12, lineHeight: 1.5, color: '#64748b', marginTop: 8 },
  input: {
    padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, lineHeight: 1.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    color: '#b91c1c', borderRadius: 8, padding: '12px 16px',
    fontSize: 14, lineHeight: 1.5,
  },
  buttonRow: { display: 'flex', gap: 12, marginTop: 4 },
  button: {
    flex: 2, background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
    minHeight: 48, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  ghostButton: {
    flex: 1, background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0',
    borderRadius: 8, padding: '12px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
    minHeight: 48,
  },
  spinner: {
    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', display: 'inline-block',
  },
  footer: {
    marginTop: 32, textAlign: 'center', display: 'flex',
    justifyContent: 'center', gap: 8, alignItems: 'center',
  },
  footerText: { fontSize: 14, lineHeight: 1.5, color: '#64748b' },
  link: {
    fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: '#2563eb',
    textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 6,
  },
};
