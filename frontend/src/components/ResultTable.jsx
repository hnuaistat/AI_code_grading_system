import React, { useState } from 'react';

export default function ResultTable({ results, onSelectStudent }) {
  const [sortField, setSortField] = useState('total_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  // 먼저 총점으로 순위 계산
  const sortedByScore = [...results].sort((a, b) => b.total_score - a.total_score);
  const rankMap = {};
  sortedByScore.forEach((r, idx) => {
    if (idx > 0 && r.total_score === sortedByScore[idx - 1].total_score) {
      rankMap[r.student_id] = rankMap[sortedByScore[idx - 1].student_id];
    } else {
      rankMap[r.student_id] = idx + 1;
    }
  });

  const sorted = [...results]
    .filter(r => {
      const searchTerm = search.toLowerCase();
      return r.student_id.toLowerCase().includes(searchTerm) ||
             (r.student_name && r.student_name.toLowerCase().includes(searchTerm)) ||
             r.filename.toLowerCase().includes(searchTerm);
    })
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

  const Th = ({ label, field, isFirst }) => (
    <th style={isFirst ? { ...th, ...thSticky, top: 0, zIndex: 12 } : { ...th, position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }} onClick={() => field && toggleSort(field)} role={field ? 'button' : undefined}>
      {label} {field && sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <input
        style={s.search}
        placeholder="학번, 이름, 파일명 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {/* 고정 높이 스크롤 영역: 학번/이름 열 고정, 헤더 고정, 상하좌우 스크롤 */}
      <div style={{ overflow: 'auto', height: 'calc(100vh - 320px)', minHeight: 150, maxHeight: '90vh', border: '1px solid #e2e8f0', borderRadius: 8, resize: 'vertical' }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <Th label="학번" field="student_id" isFirst />
              <th style={{ ...th, ...thSticky, position: 'sticky', left: 100, top: 0, zIndex: 11, minWidth: 100 }}>이름</th>
              <th style={{ ...th, position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>상세</th>
              {allProblemIds.map(pid => {
                const problem = results.flatMap(r => r.problems).find(p => p.problem_id === pid);
                const maxScore = problem ? problem.full_score : 0;
                const pidStr = String(pid).startsWith('Q') ? pid : `Q${pid}`;
                return (
                  <th key={pid} style={{ ...th, position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>{pidStr} ({maxScore}점)</th>
                );
              })}
              <Th label="총점" field="total_score" />
              <th style={{ ...th, position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>순위</th>
              <th style={{ ...th, position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((student, i) => {
              const rank = rankMap[student.student_id] || '-';
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...td, ...tdSticky }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{student.student_id}</div>
                  </td>
                  <td style={{ ...td, ...tdSticky, left: 100, zIndex: 9, borderRight: '1px solid #f1f5f9', minWidth: 100 }}>
                    {student.student_name || '-'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button style={s.detailBtn} onClick={() => onSelectStudent(student)}>보기</button>
                  </td>
                  {allProblemIds.map(pid => {
                    const p = student.problems.find(p => p.problem_id === pid);
                    return (
                      <td key={pid} style={{ ...td, textAlign: 'center' }}>
                        {p ? (
                          <span style={{ color: p.obtained_score === p.full_score ? '#059669' : '#d97706', fontWeight: 600 }}>
                            {p.obtained_score.toFixed(2)}
                          </span>
                        ) : <span style={{ color: '#e2e8f0' }}>-</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#1e293b' }}>
                    {student.total_score.toFixed(2)}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#2563eb' }}>
                    {rank}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {student.error
                      ? <span style={{ color: '#dc2626', fontSize: 12 }}>오류</span>
                      : <span style={{ color: '#059669', fontSize: 12 }}>완료</span>
                    }
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
const thSticky = { position: 'sticky', left: 0, top: 0, background: '#f8fafc', zIndex: 12, borderRight: '1px solid #e2e8f0' };
const td = { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' };
const tdSticky = { position: 'sticky', left: 0, background: '#fff', zIndex: 10, borderRight: '1px solid #f1f5f9' };
const s = {
  search: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 16, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  detailBtn: { background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }
};
