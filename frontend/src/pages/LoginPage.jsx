import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(username, password);
      const token = res.data.access_token;
      // 토큰을 먼저 저장하고 /auth/me 호출
      localStorage.setItem('token', token);
      const meRes = await authAPI.me();
      login(token, meRes.data);
      navigate(meRes.data.role === 'admin' ? '/admin' : '/upload');
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>📓</div>
          <h1 style={styles.title}>Jupyter 자동 채점 시스템</h1>
          <p style={styles.subtitle}>평가자 로그인</p>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>아이디</label>
            <input
              style={styles.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디 입력"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>비밀번호</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button style={loading ? { ...styles.button, opacity: 0.7 } : styles.button} type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <div style={styles.hint}>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>기본 계정: professor / secret</p>
          <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>관리자: admin / admin123123</p>
          <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>처음 사용하시나요? </span>
            <a href="/register" style={{ color: '#000000ff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              회원가입
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'linear-gradient(135deg, #c1fffaff 0%, #f0f9ff 100%)'
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '48px 40px',
    width: '100%', maxWidth: 400,
    boxShadow: '0 4px 24px rgba(37,99,235,0.10)'
  },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 },
  subtitle: { color: '#64748b', fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none', transition: 'border 0.2s'
  },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 14
  },
  button: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 16, fontWeight: 600,
    cursor: 'pointer', transition: 'background 0.2s'
  },
  hint: { marginTop: 20, textAlign: 'center' }
};
