import React, { useState } from 'react';

export default function ResultTable({ results, onSelectStudent }) {
  const [sortField, setSortField] = useState('total_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const sorted = [...results]
    .filter(r => r.student_id.toLowerCase().includes(search.toLowerCase()) ||
                 r.filename.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const allProblemIds = [...new Set(results.flatMap(r => r.problems.map(p => p.problem_id)))].sort();

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const Th = ({ label, field }) => (
    <th style={th} onClick={() => field && toggleSort(field)} role={field ? 'button' : undefined}>
      {label} {field && sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <input
        style={s.search}
        placeholder="학번 또는 파일명 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <Th label="학번/이름" field="student_id" />
              {allProblemIds.map(pid => (
                <th key={pid} style={th}>문제{pid}</th>
              ))}
              <Th label="총점" field="total_score" />
              <th style={th}>비율</th>
              <th style={th}>상태</th>
              <th style={th}>상세</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((student, i) => {
              const ratio = student.max_total_score > 0
                ? (student.total_score / student.max_total_score * 100).toFixed(1)
                : 0;
              const ratioNum = parseFloat(ratio);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{student.student_id}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{student.filename}</div>
                  </td>
                  {allProblemIds.map(pid => {
                    const p = student.problems.find(p => p.problem_id === pid);
                    return (
                      <td key={pid} style={{ ...td, textAlign: 'center' }}>
                        {p ? (
                          <span style={{ color: p.obtained_score === p.full_score ? '#059669' : '#d97706', fontWeight: 600 }}>
                            {p.obtained_score.toFixed(2)}<span style={{ color: '#94a3b8', fontWeight: 400 }}>/{p.full_score}</span>
                          </span>
                        ) : <span style={{ color: '#e2e8f0' }}>-</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#1e293b' }}>
                    {student.total_score.toFixed(2)}
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>/{student.max_total_score}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      background: ratioNum >= 80 ? '#dcfce7' : ratioNum >= 60 ? '#fef9c3' : '#fee2e2',
                      color: ratioNum >= 80 ? '#16a34a' : ratioNum >= 60 ? '#ca8a04' : '#dc2626',
                      borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 600
                    }}>{ratio}%</span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {student.error
                      ? <span style={{ color: '#dc2626', fontSize: 12 }}>오류</span>
                      : <span style={{ color: '#059669', fontSize: 12 }}>완료</span>
                    }
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button style={s.detailBtn} onClick={() => onSelectStudent(student)}>보기</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0' }}>검색 결과가 없습니다</div>
      )}
    </div>
  );
}

const th = { padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
const td = { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' };
const s = {
  search: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 16, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  detailBtn: { background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
};
