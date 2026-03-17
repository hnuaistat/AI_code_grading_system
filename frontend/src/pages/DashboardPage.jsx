import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { gradingAPI } from '../services/api';
import ResultTable from '../components/ResultTable';
import StudentDetailModal from '../components/StudentDetailModal';
import StatsDashboard from '../components/StatsDashboard';

export default function DashboardPage() {
  const { sessionId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSession = useCallback(async () => {
    try {
      const res = await gradingAPI.getSession(sessionId);
      setSession(res.data);
    } catch (err) {
      setError('세션 정보를 불러올 수 없습니다');
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(() => {
      if (session?.status !== 'completed') fetchSession();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchSession, session?.status]);

  const handleDownload = async () => {
    setDownloadLoading(true);
    try {
      const res = await gradingAPI.downloadExcel(sessionId);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `grading_results.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('다운로드에 실패했습니다');
    } finally {
      setDownloadLoading(false);
    }
  };

  if (!session) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#64748b' }}>
      {error || '로딩 중...'}
    </div>
  );

  const isRunning = session.status === 'running' || session.status === 'pending';
  const isDone = session.status === 'completed';

  const avgScore = isDone && session.results.length > 0
    ? session.results.reduce((acc, r) => acc + r.total_score, 0) / session.results.length
    : 0;
  const maxTotal = session.results[0]?.max_total_score || 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={() => navigate('/upload')}>← 새 채점</button>
          <span style={s.headerTitle}>채점 결과 대시보드</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userName}>{user?.username}</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        {/* Progress / Status */}
        {isRunning && (
          <div style={s.progressCard}>
            <div style={s.progressTop}>
              <span style={s.progressLabel}>
                채점 중... {session.processed_students}/{session.total_students}명
                {session.current_student && ` — ${session.current_student}`}
              </span>
              <span style={s.progressPct}>{Math.round(session.progress)}%</span>
            </div>
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${session.progress}%` }} />
            </div>
          </div>
        )}

        {isDone && (
          <div style={s.statsRow}>
            <StatCard label="총 학생 수" value={session.results.length} unit="명" color="#2563eb" />
            <StatCard label="평균 점수" value={avgScore.toFixed(2)} unit={`/ ${maxTotal}`} color="#059669" />
            <StatCard
              label="최고 점수"
              value={session.results.length > 0 ? Math.max(...session.results.map(r => r.total_score)).toFixed(2) : 0}
              unit={`/ ${maxTotal}`}
              color="#d97706"
            />
            <StatCard
              label="최저 점수"
              value={session.results.length > 0 ? Math.min(...session.results.map(r => r.total_score)).toFixed(2) : 0}
              unit={`/ ${maxTotal}`}
              color="#dc2626"
            />
            <button style={s.statsBtn} onClick={() => setShowStats(true)}>
              📊 통계 대시보드
            </button>
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}

        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <h2 style={s.tableTitle}>
              {isDone ? `채점 완료 — ${session.results.length}명` : '채점 진행 중...'}
            </h2>
            {isDone && (
              <button
                style={downloadLoading ? {...s.dlBtn, opacity:0.7} : s.dlBtn}
                onClick={handleDownload}
                disabled={downloadLoading}
              >
                {downloadLoading ? '다운로드 중...' : '📥 Excel 다운로드'}
              </button>
            )}
          </div>

          {session.results.length > 0 ? (
            <ResultTable
              results={session.results}
              onSelectStudent={setSelectedStudent}
            />
          ) : (
            <div style={s.empty}>채점 결과가 없습니다</div>
          )}
        </div>
      </main>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {showStats && (
        <StatsDashboard
          results={session.results}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ ...sc.card, borderTop: `4px solid ${color}` }}>
      <div style={sc.value}>{value}</div>
      <div style={sc.unit}>{unit}</div>
      <div style={sc.label}>{label}</div>
    </div>
  );
}

const sc = {
  card: { background:'#fff', borderRadius:12, padding:'20px 24px', flex:1, boxShadow:'0 1px 6px rgba(0,0,0,0.06)' },
  value: { fontSize:28, fontWeight:700, color:'#1e293b' },
  unit: { fontSize:13, color:'#64748b', marginBottom:6 },
  label: { fontSize:14, color:'#94a3b8' }
};

const s = {
  page: { minHeight:'100vh', background:'#f8fafc' },
  header: {
    background:'#fff', borderBottom:'1px solid #e2e8f0',
    padding:'0 32px', height:64, display:'flex',
    alignItems:'center', justifyContent:'space-between'
  },
  headerLeft: { display:'flex', alignItems:'center', gap:16 },
  backBtn: { background:'none', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:14 },
  headerTitle: { fontSize:18, fontWeight:700, color:'#1e293b' },
  headerRight: { display:'flex', alignItems:'center', gap:16 },
  userName: { fontSize:14, color:'#64748b' },
  logoutBtn: { background:'none', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:14, color:'#64748b' },
  main: { maxWidth:1100, margin:'0 auto', padding:'32px 24px' },
  progressCard: { background:'#fff', borderRadius:12, padding:'20px 24px', marginBottom:24, boxShadow:'0 1px 6px rgba(0,0,0,0.06)' },
  progressTop: { display:'flex', justifyContent:'space-between', marginBottom:10 },
  progressLabel: { fontSize:14, color:'#374151', fontWeight:500 },
  progressPct: { fontSize:14, fontWeight:700, color:'#2563eb' },
  progressBar: { height:10, background:'#e2e8f0', borderRadius:99, overflow:'hidden' },
  progressFill: { height:'100%', background:'linear-gradient(90deg,#2563eb,#60a5fa)', borderRadius:99, transition:'width 0.5s ease' },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr) auto', gap:16, marginBottom:24, alignItems:'stretch' },
  statsBtn: {
    background:'#7c3aed', color:'#fff', border:'none', borderRadius:12,
    padding:'0 20px', fontSize:14, fontWeight:600, cursor:'pointer',
    whiteSpace:'nowrap', boxShadow:'0 1px 6px rgba(124,58,237,0.3)'
  },
  error: { background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:8, padding:'12px 16px', marginBottom:16 },
  tableCard: { background:'#fff', borderRadius:16, padding:28, boxShadow:'0 1px 8px rgba(0,0,0,0.07)' },
  tableHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  tableTitle: { fontSize:18, fontWeight:700, color:'#1e293b' },
  dlBtn: { background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer' },
  empty: { textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:15 }
};
