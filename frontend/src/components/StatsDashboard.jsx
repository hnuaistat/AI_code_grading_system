import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ComposedChart, Scatter, ScatterChart, ZAxis,
  Legend, LabelList,
} from 'recharts';

/* ── Data computation helpers ── */
function computeStats(scores) {
  if (!scores.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0, avg: 0, std: 0 };
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const avg = s.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  return {
    min: s[0], max: s[n - 1],
    q1: s[Math.floor(n * 0.25)],
    median: s[Math.floor(n * 0.5)],
    q3: s[Math.floor(n * 0.75)],
    avg: parseFloat(avg.toFixed(1)),
    std: parseFloat(std.toFixed(1)),
  };
}

function computeHistogram(scores, maxScore) {
  const count = scores.length;
  if (!count) return [];
  const step = maxScore <= 20 ? 5 : maxScore <= 50 ? 10 : 20;
  const bins = [];
  for (let lo = 0; lo < maxScore; lo += step) {
    const hi = Math.min(lo + step, maxScore);
    bins.push({
      range: `${lo}~${hi}`,
      count: scores.filter(s => s >= lo && (hi === maxScore ? s <= hi : s < hi)).length,
    });
  }
  return bins;
}

/* ── Custom tooltip ── */
const CustomTooltip = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#374151', margin: '2px 0' }}>
          {p.name}: <strong>{p.value}{suffix}</strong>
        </p>
      ))}
    </div>
  );
};

/* ── Box Plot (custom SVG via ScatterChart trick) ── */
const BoxPlotShape = (props) => {
  const { cx, cy, payload, yAxisScale, boxHalfW = 28 } = props;
  if (!payload || !yAxisScale) return null;
  const { min, q1, median, q3, max } = payload;
  const y = (v) => yAxisScale(v);
  const yMin = y(min), yQ1 = y(q1), yMed = y(median), yQ3 = y(q3), yMax = y(max);
  return (
    <g>
      {/* whisker lines */}
      <line x1={cx} y1={yMin} x2={cx} y2={yQ3} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,2" />
      <line x1={cx} y1={yQ1} x2={cx} y2={yMax} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,2" />
      {/* min/max caps */}
      <line x1={cx - boxHalfW * 0.5} y1={yMin} x2={cx + boxHalfW * 0.5} y2={yMin} stroke="#64748b" strokeWidth={2} />
      <line x1={cx - boxHalfW * 0.5} y1={yMax} x2={cx + boxHalfW * 0.5} y2={yMax} stroke="#64748b" strokeWidth={2} />
      {/* IQR box */}
      <rect x={cx - boxHalfW} y={yQ3} width={boxHalfW * 2} height={yQ1 - yQ3}
        fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.5} rx={3} />
      {/* median */}
      <line x1={cx - boxHalfW} y1={yMed} x2={cx + boxHalfW} y2={yMed} stroke="#1d4ed8" strokeWidth={2.5} />
      {/* avg dot */}
      <circle cx={cx} cy={y(payload.avg)} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
    </g>
  );
};

/* ── Main component ── */
export default function StatsDashboard({ results, onClose }) {
  const data = useMemo(() => {
    const maxScore = results[0]?.max_total_score || 100;
    const totalScores = results.map(r => r.total_score);
    const allProblemIds = [...new Set(results.flatMap(r => r.problems.map(p => p.problem_id)))].sort();

    /* Histogram */
    const histData = computeHistogram(totalScores, maxScore);

    /* Problem averages */
    const problemData = allProblemIds.map(pid => {
      const rows = results.map(r => r.problems.find(p => p.problem_id === pid)).filter(Boolean);
      const full = rows[0]?.full_score || 0;
      const avg = rows.reduce((s, p) => s + p.obtained_score, 0) / (rows.length || 1);
      const pct = full > 0 ? parseFloat((avg / full * 100).toFixed(1)) : 0;
      return { name: `문제 ${pid}`, avg: parseFloat(avg.toFixed(1)), full, miss: parseFloat((full - avg).toFixed(1)), pct };
    });

    /* Most missed criteria */
    const criteriaMap = {};
    results.forEach(r => r.problems.forEach(p => p.partial_scores.forEach(ps => {
      if (!criteriaMap[ps.item]) criteriaMap[ps.item] = { obtained: 0, max: 0 };
      criteriaMap[ps.item].obtained += ps.score;
      criteriaMap[ps.item].max += ps.max_score;
    })));
    const criteriaData = Object.entries(criteriaMap)
      .map(([item, v]) => ({
        item: item.length > 10 ? item.slice(0, 10) + '…' : item,
        fullItem: item,
        rate: v.max > 0 ? parseFloat((v.obtained / v.max * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);

    /* Per-problem box plot data */
    const boxData = allProblemIds.map(pid => {
      const scores = results
        .map(r => r.problems.find(p => p.problem_id === pid)?.obtained_score ?? null)
        .filter(s => s !== null);
      const full = results[0]?.problems.find(p => p.problem_id === pid)?.full_score || 0;
      return { name: `문제 ${pid}`, full, ...computeStats(scores) };
    });

    /* Overall stats */
    const stats = computeStats(totalScores);

    /* Grade distribution */
    const gradeData = [
      { grade: 'A (90+)', count: totalScores.filter(s => s / maxScore >= 0.9).length, color: '#059669' },
      { grade: 'B (70~)', count: totalScores.filter(s => s / maxScore >= 0.7 && s / maxScore < 0.9).length, color: '#2563eb' },
      { grade: 'C (50~)', count: totalScores.filter(s => s / maxScore >= 0.5 && s / maxScore < 0.7).length, color: '#d97706' },
      { grade: 'D (~50)', count: totalScores.filter(s => s / maxScore < 0.5).length, color: '#dc2626' },
    ];

    return { maxScore, histData, problemData, criteriaData, boxData, stats, gradeData, allProblemIds };
  }, [results]);

  const n = results.length;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.container} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>📊 통계 대시보드</h2>
            <p style={s.sub}>총 {n}명 채점 결과 분석</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕ 닫기</button>
        </div>

        <div style={s.body}>
          {/* Summary cards */}
          <div style={s.summaryRow}>
            {[
              { label: '평균 점수', value: `${data.stats.avg}`, unit: `/ ${data.maxScore}`, color: '#2563eb' },
              { label: '중앙값', value: `${data.stats.median}`, unit: `/ ${data.maxScore}`, color: '#059669' },
              { label: '표준편차', value: `${data.stats.std}`, unit: 'pts', color: '#d97706' },
              { label: '최고 / 최저', value: `${data.stats.max} / ${data.stats.min}`, unit: '', color: '#7c3aed' },
            ].map((c, i) => (
              <div key={i} style={{ ...s.summaryCard, borderTop: `4px solid ${c.color}` }}>
                <div style={s.summaryVal}>{c.value} <span style={s.summaryUnit}>{c.unit}</span></div>
                <div style={s.summaryLabel}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Row 1: Histogram + Grade dist */}
          <div style={s.row}>
            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>점수 분포 히스토그램</h3>
              <p style={s.chartDesc}>구간별 학생 수</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.histData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip suffix="명" />} />
                  <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]}>
                    {data.histData.map((entry, i) => (
                      <Cell key={i} fill={entry.count === Math.max(...data.histData.map(d => d.count)) ? '#2563eb' : '#93c5fd'} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>등급 분포</h3>
              <p style={s.chartDesc}>비율 기준 등급별 학생 수</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.gradeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip suffix="명" />} />
                  <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]}>
                    {data.gradeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Problem avg + Box plot */}
          <div style={s.row}>
            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>문제별 평균 획득 점수</h3>
              <p style={s.chartDesc}>평균 점수(파랑) vs 미취득 점수(연회색)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.problemData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip suffix="점" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="avg" name="평균 획득" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="pct" position="inside" formatter={v => `${v}%`}
                      style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="miss" name="미취득" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>문제별 점수 박스플롯</h3>
              <p style={s.chartDesc}>박스: Q1~Q3 · 선: 중앙값 · ●: 평균</p>
              <div style={{ height: 220, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 0, padding: '10px 20px 40px' }}>
                <BoxPlotChart data={data.boxData} />
              </div>
            </div>
          </div>

          {/* Row 3: Most missed criteria */}
          <div style={s.chartCardFull}>
            <h3 style={s.chartTitle}>채점 항목별 평균 정답률 (낮은 순)</h3>
            <p style={s.chartDesc}>가장 많이 틀린 항목 — 교육 보완이 필요한 영역</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.criteriaData}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="item" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`${v}%`, '정답률']}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                        <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{d.fullItem}</p>
                        <p style={{ color: '#2563eb' }}>정답률: <strong>{d.rate}%</strong></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" name="정답률" radius={[0, 4, 4, 0]}>
                  {data.criteriaData.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 70 ? '#059669' : entry.rate >= 40 ? '#d97706' : '#dc2626'} />
                  ))}
                  <LabelList dataKey="rate" position="right" formatter={v => `${v}%`}
                    style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
                <ReferenceLine x={70} stroke="#059669" strokeDasharray="4 3" label={{ value: '70%', position: 'top', fontSize: 11, fill: '#059669' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline box plot chart (pure SVG) ── */
function BoxPlotChart({ data }) {
  if (!data.length) return null;
  const W = 100 / data.length;
  const maxVal = Math.max(...data.map(d => d.full || d.max));
  const scale = v => 160 * (1 - v / maxVal);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 400 180`} style={{ overflow: 'visible' }}>
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={t}>
          <line x1={40} y1={scale(maxVal * t)} x2={380} y2={scale(maxVal * t)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={35} y={scale(maxVal * t) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{Math.round(maxVal * t)}</text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = 60 + i * (320 / data.length) + (320 / data.length) / 2;
        const bw = Math.min(40, 280 / data.length * 0.5);
        const yMin = scale(d.min), yQ1 = scale(d.q1), yMed = scale(d.median), yQ3 = scale(d.q3), yMax = scale(d.max), yAvg = scale(d.avg);

        return (
          <g key={i}>
            {/* Max/Min whisker */}
            <line x1={cx} y1={yMin} x2={cx} y2={yMax} stroke="#94a3b8" strokeWidth={1.5} />
            {/* Min/Max caps */}
            <line x1={cx - bw * 0.4} y1={yMin} x2={cx + bw * 0.4} y2={yMin} stroke="#64748b" strokeWidth={2} />
            <line x1={cx - bw * 0.4} y1={yMax} x2={cx + bw * 0.4} y2={yMax} stroke="#64748b" strokeWidth={2} />
            {/* IQR box */}
            <rect x={cx - bw / 2} y={yQ3} width={bw} height={Math.max(yQ1 - yQ3, 1)} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.5} rx={3} />
            {/* Median */}
            <line x1={cx - bw / 2} y1={yMed} x2={cx + bw / 2} y2={yMed} stroke="#1d4ed8" strokeWidth={2.5} />
            {/* Avg dot (orange) */}
            <circle cx={cx} cy={yAvg} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
            {/* X label */}
            <text x={cx} y={175} textAnchor="middle" fontSize={11} fill="#374151" fontWeight={600}>{d.name}</text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(40, 5)">
        <rect x={0} y={0} width={12} height={12} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1} rx={2} />
        <text x={16} y={10} fontSize={10} fill="#374151">Q1~Q3 (IQR)</text>
        <line x1={80} y1={6} x2={94} y2={6} stroke="#1d4ed8" strokeWidth={2.5} />
        <text x={98} y={10} fontSize={10} fill="#374151">중앙값</text>
        <circle cx={145} cy={6} r={4} fill="#f59e0b" />
        <text x={153} y={10} fontSize={10} fill="#374151">평균</text>
      </g>
    </svg>
  );
}

/* ── Styles ── */
const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.65)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  container: {
    background: '#f8fafc', borderRadius: 16,
    width: '100%', maxWidth: 1200,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '16px 28px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 2 },
  sub: { fontSize: 13, color: '#94a3b8', margin: 0 },
  closeBtn: {
    background: 'none', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
    fontSize: 14, color: '#64748b', fontWeight: 500,
  },
  body: { overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 },
  summaryCard: { background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  summaryVal: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 2 },
  summaryUnit: { fontSize: 13, color: '#94a3b8', fontWeight: 400 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  chartCard: {
    background: '#fff', borderRadius: 12, padding: '20px 20px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartCardFull: {
    background: '#fff', borderRadius: 12, padding: '20px 20px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 2 },
  chartDesc: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
};
