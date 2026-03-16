import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.register(form.username, form.email, form.password);
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
        <div style={s.logo}>
          <div style={s.logoIcon}>📓</div>
          <h1 style={s.title}>회원가입</h1>
          <p style={s.subtitle}>Jupyter 자동 채점 시스템</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <Field label="아이디" type="text" value={form.username} onChange={set('username')} placeholder="영문, 숫자 조합" required />
          <Field label="이메일" type="email" value={form.email} onChange={set('email')} placeholder="professor@univ.ac.kr" required />
          <Field label="비밀번호" type="password" value={form.password} onChange={set('password')} placeholder="6자 이상" required />
          <Field label="비밀번호 확인" type="password" value={form.confirm} onChange={set('confirm')} placeholder="비밀번호 재입력" required />

          {error && <div style={s.error}>{error}</div>}

          <button
            style={loading ? { ...s.button, opacity: 0.7 } : s.button}
            type="submit"
            disabled={loading}
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        <div style={s.footer}>
          <span style={s.footerText}>이미 계정이 있으신가요?</span>
          <Link to="/login" style={s.link}>로그인</Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={s.label}>{label}</label>
      <input
        style={s.input}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

const s = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
    padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '48px 40px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 4px 24px rgba(37,99,235,0.10)',
  },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 },
  subtitle: { color: '#64748b', fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  label: { fontSize: 14, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none',
  },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 14,
  },
  button: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 16, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
  },
  footer: { marginTop: 24, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#64748b' },
  link: { fontSize: 14, fontWeight: 600, color: '#2563eb', textDecoration: 'none' },
};
