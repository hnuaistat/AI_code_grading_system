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

  // 쿼터 초과 resume 상태
  const [resumeAnswer, setResumeAnswer] = useState(null);
  const [resumeZip, setResumeZip] = useState(null);
  const [resumeCriteria, setResumeCriteria] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');

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
      if (session?.status !== 'completed' && session?.status !== 'quota_exceeded') fetchSession();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchSession, session?.status]);

  const handleResume = async () => {
    if (!resumeAnswer || !resumeZip || !resumeCriteria) {
      setResumeError('3개 파일을 모두 업로드해주세요');
      return;
    }
    setResumeLoading(true);
    setResumeError('');
    try {
      const fd = new FormData();
      fd.append('answer_notebook', resumeAnswer);
      fd.append('student_zip', resumeZip);
      fd.append('criteria_file', resumeCriteria);
      await gradingAPI.resumeGrading(sessionId, fd);
      setResumeAnswer(null);
      setResumeZip(null);
      setResumeCriteria(null);
      fetchSession();
    } catch (err) {
      setResumeError(err.response?.data?.detail || '이어서 채점 시작에 실패했습니다');
    } finally {
      setResumeLoading(false);
    }
  };

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
  const isQuotaExceeded = session.status === 'quota_exceeded';

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
          sessionId={sessionId}
          onClose={() => setSelectedStudent(null)}
          onStudentUpdate={(updated) => {
            setSelectedStudent(updated);
            setSession(prev => prev ? {
              ...prev,
              results: prev.results.map(r => r.filename === updated.filename ? updated : r)
            } : prev);
          }}
        />
      )}

      {showStats && (
        <StatsDashboard
          results={session.results}
          onClose={() => setShowStats(false)}
        />
      )}

      {isQuotaExceeded && (
        <div style={qp.overlay}>
          <div style={qp.modal}>
            <div style={qp.icon}>⚠️</div>
            <h2 style={qp.title}>API 사용량 초과</h2>
            <p style={qp.desc}>
              OpenAI API 크레딧이 부족하여 채점이 중단되었습니다.<br />
              <strong>{session.processed_students}명</strong> 채점 완료,{' '}
              <strong>{session.total_students - session.processed_students}명</strong> 남음.
            </p>
            <p style={qp.subdesc}>API 충전 후 같은 파일로 이어서 채점할 수 있습니다.</p>

            <div style={qp.fileList}>
              {[
                { label: '📝 정답 노트북 (.ipynb)', file: resumeAnswer, setter: setResumeAnswer, accept: '.ipynb' },
                { label: '📦 학생 제출물 (.zip)', file: resumeZip, setter: setResumeZip, accept: '.zip' },
                { label: '📋 채점 기준 (.json)', file: resumeCriteria, setter: setResumeCriteria, accept: '.json' },
              ].map(({ label, file, setter, accept }) => (
                <label key={label} style={qp.fileRow}>
                  <span style={qp.fileLabel}>{file ? `✅ ${file.name}` : label}</span>
                  <input
                    type="file" accept={accept} style={{ display: 'none' }}
                    onChange={e => setter(e.target.files[0])}
                  />
                  <span style={qp.fileBtn}>파일 선택</span>
                </label>
              ))}
            </div>

            {resumeError && <div style={qp.error}>{resumeError}</div>}

            <button
              style={resumeLoading ? { ...qp.resumeBtn, opacity: 0.6 } : qp.resumeBtn}
              onClick={handleResume}
              disabled={resumeLoading}
            >
              {resumeLoading ? '채점 재개 중...' : '이어서 채점하기 →'}
            </button>

            <p style={qp.hint}>이미 완료된 결과는 아래 표에서 확인할 수 있습니다.</p>
          </div>
        </div>
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

const qp = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 24,
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '40px 36px',
    maxWidth: 480, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 12 },
  desc: { fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 8 },
  subdesc: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  fileList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, textAlign: 'left' },
  fileRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 14px',
    cursor: 'pointer', transition: 'border-color 0.2s',
  },
  fileLabel: { fontSize: 13, color: '#374151', fontWeight: 500 },
  fileBtn: {
    fontSize: 12, color: '#2563eb', fontWeight: 600,
    background: '#eff6ff', borderRadius: 5, padding: '3px 10px',
  },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14,
  },
  resumeBtn: {
    width: '100%', background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 10, padding: '14px 0', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', marginBottom: 14,
  },
  hint: { fontSize: 12, color: '#94a3b8' },
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
