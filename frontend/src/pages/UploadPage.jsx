import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../App';
import { gradingAPI, subjectAPI } from '../services/api';
import StepIndicator from '../components/StepIndicator';

const STEPS = ['파일 업로드', '채점 기준 설정', '채점 실행'];

function DropZone({ label, icon, accept, onDrop, file }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept, multiple: false
  });
  return (
    <div {...getRootProps()} style={{
      ...dz.zone,
      borderColor: isDragActive ? '#2563eb' : file ? '#22c55e' : '#cbd5e1',
      background: isDragActive ? '#eff6ff' : file ? '#f0fdf4' : '#f8fafc',
    }}>
      <input {...getInputProps()} />
      <div style={dz.icon}>{file ? '✅' : icon}</div>
      <div style={dz.label}>{label}</div>
      {file
        ? <div style={dz.filename}>{file.name}</div>
        : <div style={dz.hint}>클릭하거나 파일을 드래그하세요</div>
      }
    </div>
  );
}

const dz = {
  zone: { border: '2px dashed', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  icon: { fontSize: 32, marginBottom: 8 },
  label: { fontWeight: 600, color: '#374151', marginBottom: 4 },
  hint: { fontSize: 13, color: '#94a3b8' },
  filename: { fontSize: 13, color: '#22c55e', fontWeight: 500, marginTop: 4 },
};

export default function UploadPage() {
  const [step] = useState(0);
  const [answerFile, setAnswerFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [criteriaFile, setCriteriaFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Subject state
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [itemLoading, setItemLoading] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    subjectAPI.list().then(res => {
      setSubjects(res.data);
      if (res.data.length > 0) setSelectedSubjectId(String(res.data[0].id));
    }).catch(() => {});
  }, []);

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    setSubjectLoading(true);
    try {
      const res = await subjectAPI.create(newSubjectName.trim(), newSubjectCode.trim() || null);
      const created = res.data;
      setSubjects(prev => [...prev, created]);
      setSelectedSubjectId(String(created.id));
      setSelectedItemId('');
      setShowNewSubject(false);
      setNewSubjectName('');
      setNewSubjectCode('');
    } catch (err) {
      setError(err.response?.data?.detail || '과목 생성에 실패했습니다');
    } finally {
      setSubjectLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !selectedSubjectId) return;
    setItemLoading(true);
    try {
      const res = await subjectAPI.createItem(selectedSubjectId, newItemName.trim());
      setSubjects(prev => prev.map(s =>
        s.id === parseInt(selectedSubjectId)
          ? { ...s, items: [...(s.items || []), res.data] }
          : s
      ));
      setSelectedItemId(String(res.data.id));
      setShowNewItem(false);
      setNewItemName('');
    } catch (err) {
      setError(err.response?.data?.detail || '항목 생성에 실패했습니다');
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedSubjectId) return;
    try {
      await subjectAPI.deleteItem(selectedSubjectId, itemId);
      setSubjects(prev => prev.map(s =>
        s.id === parseInt(selectedSubjectId)
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      ));
      if (selectedItemId === String(itemId)) setSelectedItemId('');
    } catch (err) {
      setError(err.response?.data?.detail || '항목 삭제에 실패했습니다');
    }
  };

  const handleStart = async () => {
    if (!answerFile || !zipFile || !criteriaFile) {
      setError('모든 파일을 업로드해주세요');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('answer_notebook', answerFile);
      fd.append('student_zip', zipFile);
      fd.append('criteria_file', criteriaFile);
      if (selectedSubjectId) fd.append('subject_id', selectedSubjectId);
      if (selectedItemId) fd.append('subject_item_id', selectedItemId);
      const res = await gradingAPI.startGrading(fd);
      navigate(`/dashboard/${res.data.session_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || '채점 시작에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const allReady = answerFile && zipFile && criteriaFile;
  const selectedSubject = subjects.find(s => String(s.id) === selectedSubjectId);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 24 }}>📓</span>
          <span style={s.headerTitle}>Jupyter 자동 채점 시스템</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.historyBtn} onClick={() => navigate('/history')}>📚 채점 기록</button>
          <span style={s.userName}>{user?.username} ({user?.role})</span>
          <button style={s.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        <StepIndicator steps={STEPS} current={step} />

        {/* Subject selector */}
        <div style={s.subjectCard}>
          <div style={s.subjectRow}>
            <div style={s.subjectLeft}>
              <span style={s.subjectLabel}>📘 과목 선택</span>
              {subjects.length > 0 ? (
                <select
                  style={s.select}
                  value={selectedSubjectId}
                  onChange={e => {
                    if (e.target.value === '__new__') setShowNewSubject(true);
                    else { setSelectedSubjectId(e.target.value); setShowNewSubject(false); }
                  }}
                >
                  {subjects.map(sub => (
                    <option key={sub.id} value={String(sub.id)}>
                      {sub.code ? `[${sub.code}] ` : ''}{sub.name}
                    </option>
                  ))}
                  <option value="__new__">+ 새 과목 만들기</option>
                </select>
              ) : (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>과목이 없습니다</span>
              )}
              {!showNewSubject && (
                <button style={s.newSubjectBtn} onClick={() => setShowNewSubject(true)}>
                  + 새 과목
                </button>
              )}
            </div>
            {selectedSubject && !showNewSubject && (
              <div style={s.subjectInfo}>
                <span style={s.subjectInfoName}>{selectedSubject.name}</span>
                {selectedSubject.code && <span style={s.subjectInfoCode}>{selectedSubject.code}</span>}
                <span style={s.subjectInfoCount}>채점 {selectedSubject.session_count}회</span>
              </div>
            )}
          </div>

          {showNewSubject && (
            <div style={s.newSubjectForm}>
              <input
                style={s.input}
                placeholder="과목명 (예: 알고리즘)"
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
              />
              <input
                style={s.input}
                placeholder="과목코드 (선택, 예: CS101)"
                value={newSubjectCode}
                onChange={e => setNewSubjectCode(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={s.createBtn}
                  onClick={handleCreateSubject}
                  disabled={subjectLoading || !newSubjectName.trim()}
                >
                  {subjectLoading ? '생성 중...' : '생성'}
                </button>
                <button style={s.cancelBtn} onClick={() => { setShowNewSubject(false); setNewSubjectName(''); setNewSubjectCode(''); }}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subject Items */}
        {selectedSubjectId && subjects.find(s => String(s.id) === selectedSubjectId)?.items && (
          <div style={s.itemsCard}>
            <div style={s.itemsHeader}>
              <span style={s.itemsLabel}>📋 세부 항목 (과제, 중간고사, 기말고사 등)</span>
              {!showNewItem && (
                <button style={s.addItemBtn} onClick={() => setShowNewItem(true)}>
                  + 항목 추가
                </button>
              )}
            </div>

            {showNewItem && (
              <div style={s.newItemForm}>
                <input
                  style={s.input}
                  placeholder="항목명 (예: 중간고사)"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={s.createBtn}
                    onClick={handleCreateItem}
                    disabled={itemLoading || !newItemName.trim()}
                  >
                    {itemLoading ? '추가 중...' : '추가'}
                  </button>
                  <button style={s.cancelBtn} onClick={() => { setShowNewItem(false); setNewItemName(''); }}>
                    취소
                  </button>
                </div>
              </div>
            )}

            {subjects.find(s => String(s.id) === selectedSubjectId)?.items.length > 0 ? (
              <div style={s.itemsGrid}>
                {subjects.find(s => String(s.id) === selectedSubjectId).items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      ...s.itemCard,
                      borderColor: selectedItemId === String(item.id) ? '#2563eb' : '#e2e8f0',
                      background: selectedItemId === String(item.id) ? '#eff6ff' : '#fff',
                    }}
                    onClick={() => setSelectedItemId(String(item.id))}
                  >
                    <div style={s.itemName}>{item.name}</div>
                    <button
                      style={s.itemDeleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              !showNewItem && <div style={s.empty}>항목이 없습니다</div>
            )}
          </div>
        )}

        <div style={s.card}>
          <h2 style={s.cardTitle}>파일 업로드</h2>
          <p style={s.cardDesc}>채점에 필요한 파일을 모두 업로드해주세요</p>

          <div style={s.grid}>
            <DropZone label="정답 노트북" icon="📝" accept={{ 'application/x-ipynb+json': ['.ipynb'] }}
              onDrop={([f]) => setAnswerFile(f)} file={answerFile} />
            <DropZone label="학생 제출물 (ZIP)" icon="📦"
              accept={{ 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'] }}
              onDrop={([f]) => setZipFile(f)} file={zipFile} />
            <DropZone label="채점 기준 (JSON)" icon="📋" accept={{ 'application/json': ['.json'] }}
              onDrop={([f]) => setCriteriaFile(f)} file={criteriaFile} />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button
              style={allReady && !loading ? s.primaryBtn : { ...s.primaryBtn, opacity: 0.5, cursor: 'not-allowed' }}
              onClick={handleStart}
              disabled={!allReady || loading}
            >
              {loading ? '채점 시작 중...' : '채점 시작 →'}
            </button>
          </div>

          <div style={s.formatHint}>
            <h3 style={s.hintTitle}>채점 기준 JSON 형식</h3>
            <pre style={s.pre}>{JSON.stringify({
              problems: [{
                problem_id: 1, full_score: 20,
                partial_score_criteria: [
                  { item: "변수명 적절성", score: 5 },
                  { item: "알고리즘 정확성", score: 10 },
                  { item: "출력값 일치", score: 5 }
                ]
              }]
            }, null, 2)}</pre>
          </div>
        </div>
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '0 32px', height: 64, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  historyBtn: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500,
  },
  userName: { fontSize: 14, color: '#64748b' },
  logoutBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#64748b' },
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },

  subjectCard: {
    background: '#fff', borderRadius: 12, padding: '18px 24px',
    marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
  },
  subjectRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  subjectLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  subjectLabel: { fontSize: 14, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' },
  select: { padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' },
  newSubjectBtn: { background: 'none', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  subjectInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  subjectInfoName: { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  subjectInfoCode: { fontSize: 12, background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '2px 8px', fontWeight: 600 },
  subjectInfoCount: { fontSize: 12, color: '#94a3b8' },
  newSubjectForm: { marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  createBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer', color: '#64748b' },

  itemsCard: {
    background: '#fff', borderRadius: 12, padding: '18px 24px',
    marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
  },
  itemsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  itemsLabel: { fontSize: 14, fontWeight: 700, color: '#1e293b' },
  addItemBtn: { background: 'none', border: '1px solid #059669', color: '#059669', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  newItemForm: { marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  itemsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 },
  itemCard: { border: '1.5px solid', borderRadius: 8, padding: '12px 10px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' },
  itemName: { fontSize: 13, fontWeight: 600, color: '#1e293b', textAlign: 'center' },
  itemDeleteBtn: { position: 'absolute', top: 4, right: 4, background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' },

  card: { background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 },
  cardDesc: { color: '#64748b', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
  actions: { display: 'flex', justifyContent: 'flex-end', marginBottom: 32 },
  primaryBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  formatHint: { background: '#f8fafc', borderRadius: 10, padding: 20, border: '1px solid #e2e8f0' },
  hintTitle: { fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 },
  pre: { fontSize: 12, color: '#374151', overflowX: 'auto', lineHeight: 1.6 },
};
