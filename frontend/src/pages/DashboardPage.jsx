import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // 강제 중단
  const [cancelling, setCancelling] = useState(false);

  // 예상 남은 시간 계산 기준점 (대시보드 진입 이후 관측된 처리량 기반)
  const etaBaseRef = useRef(null);

  // 세부 항목 인라인 편집
  const [itemEditing, setItemEditing] = useState(false);
  const [itemDraft, setItemDraft] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  const saveSubjectItem = async () => {
    setItemSaving(true);
    try {
      await gradingAPI.updateSessionItem(sessionId, itemDraft.trim());
      setItemEditing(false);
      await fetchSession();
    } catch (err) {
      setError(err.response?.data?.detail || '세부 항목 저장에 실패했습니다');
    } finally {
      setItemSaving(false);
    }
  };

  const fetchSession = useCallback(async () => {
    try {
      const res = await gradingAPI.getSession(sessionId);
      setSession(res.data);
    } catch (err) {
      setError('세션 정보를 불러올 수 없습니다');
    }
  }, [sessionId]);

  // 최초 1회 로드
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 채점 중일 때만 2초 폴링 (완료/초과/중단 시 자동 중단)
  useEffect(() => {
    if (session?.status === 'completed'
      || session?.status === 'quota_exceeded'
      || session?.status === 'cancelled') return;
    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [session?.status, fetchSession]);

  // 채점 시작을 관측한 시점의 (시각, 처리 인원)을 기준점으로 저장
  useEffect(() => {
    if (!session) return;
    const running = session.status === 'running' || session.status === 'pending';
    if (!running) { etaBaseRef.current = null; return; }
    if (!etaBaseRef.current || etaBaseRef.current.sessionId !== sessionId) {
      etaBaseRef.current = { sessionId, t0: Date.now(), p0: session.processed_students };
    }
  }, [session, sessionId]);

  const handleCancel = async () => {
    if (!window.confirm('채점을 강제 중단하시겠습니까?\n지금까지 채점된 결과는 보존되지만, 진행 중이던 학생의 결과는 저장되지 않을 수 있습니다.')) return;
    setCancelling(true);
    try {
      await gradingAPI.cancelSession(sessionId);
      await fetchSession();
    } catch (err) {
      setError(err.response?.data?.detail || '채점 중단에 실패했습니다');
    } finally {
      setCancelling(false);
    }
  };

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

      // 백엔드 Content-Disposition 헤더에서 파일명 추출
      const disposition = res.headers['content-disposition'] || res.headers['Content-Disposition'] || '';
      let filename = 'grading_results.xlsx';
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (utf8Match) {
        filename = decodeURIComponent(utf8Match[1]);
      } else if (plainMatch) {
        filename = plainMatch[1];
      }
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('다운로드에 실패했습니다');
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatDuration = (createdAt, completedAt) => {
    if (!createdAt || !completedAt) return null;
    const diffMs = new Date(completedAt) - new Date(createdAt);
    if (diffMs <= 0) return null;
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return `${sec}초`;
    if (sec === 0) return `${min}분`;
    return `${min}분 ${sec}초`;
  };

  if (!session) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#64748b' }}>
      {error || '로딩 중...'}
    </div>
  );

  const isRunning = session.status === 'running' || session.status === 'pending';
  const isDone = session.status === 'completed';

  // 예상 남은 시간 (관측된 학생당 처리 시간 × 남은 인원, ±여유를 둔 범위로 표시)
  const etaText = (() => {
    if (!isRunning) return null;
    const base = etaBaseRef.current;
    const left = session.total_students - session.processed_students;
    if (left <= 0) return null;
    if (!base || base.sessionId !== sessionId) return '예상 시간 계산 중...';
    const done = session.processed_students - base.p0;
    if (done < 1) return '예상 시간 계산 중...';
    const perMs = (Date.now() - base.t0) / done;
    const remainMs = perMs * left;
    const lowMin = Math.floor((remainMs * 0.9) / 60000);
    const highMin = Math.ceil((remainMs * 1.25) / 60000);
    if (highMin <= 1) return '약 1분 이내 남았습니다';
    if (lowMin < 1) return `약 ${highMin}분 이내 남았습니다`;
    if (lowMin === highMin) return `약 ${highMin}분 남았습니다`;
    return `약 ${lowMin}~${highMin}분 남았습니다`;
  })();
  const isQuotaExceeded = session.status === 'quota_exceeded';
  const isCancelled = session.status === 'cancelled';

  const avgScore = isDone && session.results.length > 0
    ? session.results.reduce((acc, r) => acc + r.total_score, 0) / session.results.length
    : 0;
  const maxTotal = session.results[0]?.max_total_score || 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={() => navigate('/history')}>← 돌아가기</button>
          <button style={s.backBtn} onClick={() => navigate('/upload')}>🏠 홈</button>
          <span style={s.headerTitle}>채점 결과 대시보드</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userName}>{user?.username}</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        {/* 채점 세션 정보 배너 */}
        <div style={s.infoBanner}>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>📘 과목</span>
            <span style={s.infoValue}>
              {session.subject_name || '—'}
              {session.subject_code && <span style={s.infoCode}>{session.subject_code}</span>}
            </span>
          </div>
          <div style={s.infoDivider} />
          <div style={s.infoItem}>
            <span style={s.infoLabel}>📋 세부 항목</span>
            {itemEditing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  value={itemDraft}
                  onChange={e => setItemDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveSubjectItem();
                    if (e.key === 'Escape') setItemEditing(false);
                  }}
                  placeholder="예: 중간고사"
                  autoFocus
                  disabled={itemSaving}
                  style={s.itemInput}
                />
                <button style={s.itemSaveBtn} onClick={saveSubjectItem} disabled={itemSaving} title="저장 (Enter)">✓</button>
                <button style={s.itemCancelBtn} onClick={() => setItemEditing(false)} disabled={itemSaving} title="취소 (Esc)">✕</button>
              </span>
            ) : (
              <span style={s.infoValue}>
                {session.subject_item_name || '—'}
                <button
                  style={s.itemEditBtn}
                  onClick={() => { setItemDraft(session.subject_item_name || ''); setItemEditing(true); }}
                  title="세부 항목 추가/수정"
                >
                  ✏️
                </button>
              </span>
            )}
          </div>
          <div style={s.infoDivider} />
          <div style={s.infoItem}>
            <span style={s.infoLabel}>👥 학생 수</span>
            <span style={s.infoValue}>{session.total_students}명</span>
          </div>
          <div style={s.infoDivider} />
          <div style={s.infoItem}>
            <span style={s.infoLabel}>⏱ 소요 시간</span>
            <span style={s.infoValue}>
              {formatDuration(session.created_at, session.completed_at) || (isRunning ? '채점 중...' : '—')}
            </span>
          </div>
          <div style={s.infoDivider} />
          <div style={s.infoItem}>
            <span style={s.infoLabel}>🤖 채점 AI</span>
            <span style={{
              ...s.infoValue,
              background: session.grading_model?.startsWith('fireworks') ? '#fef3c7' : '#dbeafe',
              color: session.grading_model?.startsWith('fireworks') ? '#b45309' : '#1d4ed8',
              borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
            }}>
              {session.grading_model
                ? session.grading_model.split('/').pop()
                : '—'}
            </span>
          </div>
          {session.regraded_from && (
            <>
              <div style={s.infoDivider} />
              <div style={s.infoItem}>
                <span style={s.infoLabel}>🆕 새 AI 채점</span>
                <span
                  style={{ ...s.infoValue, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => navigate(`/dashboard/${session.regraded_from}`)}
                  title="원본 채점 결과 보기"
                >
                  원본 보기 →
                </span>
              </div>
            </>
          )}
        </div>

        {/* Progress / Status */}
        {isRunning && (
          <div style={s.progressCard}>
            <div style={s.progressTop}>
              <span style={s.progressLabel}>
                채점 중... {session.processed_students}/{session.total_students}명
                {session.current_student && ` — ${session.current_student}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={s.progressPct}>{Math.round(session.progress)}%</span>
                <button
                  style={cancelling ? { ...s.cancelBtn, opacity: 0.6, cursor: 'wait' } : s.cancelBtn}
                  onClick={handleCancel}
                  disabled={cancelling}
                  title="채점을 강제로 중단합니다. 지금까지 채점된 결과는 보존됩니다."
                >
                  {cancelling ? '중단 중...' : '🛑 강제 중단'}
                </button>
              </div>
            </div>
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${session.progress}%` }} />
            </div>
            {etaText && <div style={s.etaText}>⏳ {etaText}</div>}
          </div>
        )}

        {isCancelled && (
          <div style={s.cancelledBanner}>
            <div style={s.cancelledIcon}>🛑</div>
            <div style={{ flex: 1 }}>
              <div style={s.cancelledTitle}>채점이 중단되었습니다</div>
              <div style={s.cancelledDesc}>
                {session.processed_students}/{session.total_students}명 채점 완료. 아래 표에서 지금까지의 결과를 확인할 수 있습니다.
              </div>
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
              {isDone
                ? `채점 완료 — ${session.results.length}명`
                : isCancelled
                  ? `채점 중단 — ${session.results.length}명 결과`
                  : '채점 진행 중...'}
            </h2>
            {(isDone || (isCancelled && session.results.length > 0)) && (
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
  card: { background:'#fff', borderRadius:10, padding:'10px 18px', flex:1, boxShadow:'0 1px 6px rgba(0,0,0,0.06)', display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' },
  value: { fontSize:20, fontWeight:700, color:'#1e293b' },
  unit: { fontSize:11, color:'#64748b' },
  label: { fontSize:12, color:'#94a3b8', width:'100%' }
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
  main: { maxWidth:1100, margin:'0 auto', padding:'16px 24px 24px' },
  infoBanner: {
    background: '#fff', borderRadius: 10, padding: '8px 16px',
    marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
  },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 14px' },
  infoLabel: { fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 },
  infoCode: { fontSize: 11, background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '1px 6px', fontWeight: 700 },
  itemInput: {
    width: 110, padding: '3px 6px', border: '1.5px solid #cbd5e1',
    borderRadius: 6, fontSize: 13, outline: 'none',
  },
  itemSaveBtn: {
    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
    borderRadius: 4, padding: '2px 6px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
  },
  itemCancelBtn: {
    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 4, padding: '2px 6px', fontSize: 12, cursor: 'pointer',
  },
  itemEditBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: 0, opacity: 0.55,
  },
  infoDivider: { width: 1, height: 28, background: '#e2e8f0', margin: '0 4px' },
  progressCard: { background:'#fff', borderRadius:12, padding:'16px 20px', marginBottom:12, boxShadow:'0 1px 6px rgba(0,0,0,0.06)' },
  progressTop: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  cancelBtn: {
    background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca',
    borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  cancelledBanner: {
    background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12,
    padding: '16px 20px', marginBottom: 24, display: 'flex',
    alignItems: 'center', gap: 14,
  },
  cancelledIcon: { fontSize: 28 },
  cancelledTitle: { fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 4 },
  cancelledDesc: { fontSize: 13, color: '#78350f', lineHeight: 1.5 },
  progressLabel: { fontSize:14, color:'#374151', fontWeight:500 },
  etaText: { marginTop:10, fontSize:13, color:'#2563eb', fontWeight:600 },
  progressPct: { fontSize:14, fontWeight:700, color:'#2563eb' },
  progressBar: { height:10, background:'#e2e8f0', borderRadius:99, overflow:'hidden' },
  progressFill: { height:'100%', background:'linear-gradient(90deg,#2563eb,#60a5fa)', borderRadius:99, transition:'width 0.5s ease' },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr) auto', gap:12, marginBottom:12, alignItems:'stretch' },
  statsBtn: {
    background:'#7c3aed', color:'#fff', border:'none', borderRadius:12,
    padding:'0 20px', fontSize:14, fontWeight:600, cursor:'pointer',
    whiteSpace:'nowrap', boxShadow:'0 1px 6px rgba(124,58,237,0.3)'
  },
  error: { background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:8, padding:'12px 16px', marginBottom:16 },
  tableCard: { background:'#fff', borderRadius:16, padding:'16px 20px', boxShadow:'0 1px 8px rgba(0,0,0,0.07)' },
  tableHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  tableTitle: { fontSize:17, fontWeight:700, color:'#1e293b' },
  dlBtn: { background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:14, fontWeight:600, cursor:'pointer' },
  empty: { textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:15 }
};
