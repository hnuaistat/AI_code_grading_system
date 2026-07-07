import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import ComparePage from './pages/ComparePage';
import RevisionLogPage from './pages/RevisionLogPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AppLayout from './components/AppLayout';
import { authAPI } from './services/api';

export const AuthContext = createContext(null);

export function useAuth() { return useContext(AuthContext); }

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/upload" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.me()
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };
  // 이메일 변경 등 프로필 수정 후 컨텍스트의 사용자 정보 갱신
  const refreshUser = async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data);
    } catch { /* 토큰 만료 시 인터셉터가 처리 */ }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18, color: '#64748b' }}>
      로딩 중...
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/revisions" element={<RevisionLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dashboard/:sessionId" element={<DashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? "/admin" : "/upload") : "/login"} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
