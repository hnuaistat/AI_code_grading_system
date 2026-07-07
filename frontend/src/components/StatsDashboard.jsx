import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ComposedChart, Scatter, ScatterChart, ZAxis,
  LabelList,
} from 'recharts';

/* ── Data computation helpers ── */
function computeStats(scores) {
  if (!scores.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0, avg: 0, std: 0 };
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const avg = s.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  return {
    min: parseFloat(s[0].toFixed(2)), max: parseFloat(s[n - 1].toFixed(2)),
    q1: parseFloat(s[Math.floor(n * 0.25)].toFixed(2)),
    median: parseFloat(s[Math.floor(n * 0.5)].toFixed(2)),
    q3: parseFloat(s[Math.floor(n * 0.75)].toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
  };
}

/* 100점 환산 점수 기준 고정 10점 구간 히스토그램 (원점수 범위 병기) */
function computeHistogram(pctScores, maxScore) {
  if (!pctScores.length) return [];
  const fmt = v => parseFloat(v.toFixed(1));
  const bins = [];
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 10;
    bins.push({
      range: `${lo}~${hi}`,
      rawRange: `${fmt(lo / 100 * maxScore)}~${fmt(hi / 100 * maxScore)}점`,
      count: pctScores.filter(s => s >= lo && (hi === 100 ? s <= hi : s < hi)).length,
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

/* ── Summary card mini graphs (장식용) ── */
const CardSpark = ({ type, color }) => {
  const common = { width: 58, height: 30, viewBox: '0 0 58 30', style: { flexShrink: 0 } };
  if (type === 'area') return (
    <svg {...common}>
      <path d="M2 24 C8 12, 13 26, 19 17 S30 5, 36 13 S48 24, 56 8 L56 28 L2 28 Z" fill={color} opacity="0.15" />
      <path d="M2 24 C8 12, 13 26, 19 17 S30 5, 36 13 S48 24, 56 8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === 'line') return (
    <svg {...common}>
      <path d="M2 25 L12 19 L21 22 L31 12 L41 15 L56 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="56" cy="4" r="2.5" fill={color} />
    </svg>
  );
  if (type === 'bell') return (
    <svg {...common}>
      <path d="M2 27 C16 27, 20 4, 29 4 S42 27, 56 27" fill={color} opacity="0.15" />
      <path d="M2 27 C16 27, 20 4, 29 4 S42 27, 56 27" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg {...common}>
      {[{ x: 4, h: 10 }, { x: 13, h: 16 }, { x: 22, h: 7 }, { x: 31, h: 20 }, { x: 40, h: 13 }, { x: 49, h: 24 }].map((b, i) => (
        <rect key={i} x={b.x} y={28 - b.h} width="6" height={b.h} rx="1.5" fill={color} opacity={0.35 + i * 0.1} />
      ))}
    </svg>
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
  // 'pct' = 100점 환산, 'raw' = 원점수 — 기본값은 설정 페이지에서 지정 가능
  const [scale, setScale] = React.useState(
    () => (localStorage.getItem('stats_scale_default') === 'raw' ? 'raw' : 'pct')
  );

  const data = useMemo(() => {
    const maxScore = results[0]?.max_total_score || 100;
    const totalScores = results.map(r => r.total_score);
    const pctScores = totalScores.map(s => s / maxScore * 100);
    const allProblemIds = [...new Set(results.flatMap(r => r.problems.map(p => p.problem_id)))].sort();

    /* Histogram (100점 환산 기준) */
    const histData = computeHistogram(pctScores, maxScore);

    /* Problem averages (득점률 기준) */
    const problemData = allProblemIds.map(pid => {
      const rows = results.map(r => r.problems.find(p => p.problem_id === pid)).filter(Boolean);
      const full = rows[0]?.full_score || 0;
      const avg = rows.reduce((s, p) => s + p.obtained_score, 0) / (rows.length || 1);
      const pct = full > 0 ? parseFloat((avg / full * 100).toFixed(1)) : 0;
      return {
        name: `문제 ${pid}`, label: `문제 ${pid} (${full}점)`,
        avg: parseFloat(avg.toFixed(2)), full, pct,
      };
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
        rate: v.max > 0 ? parseFloat((v.obtained / v.max * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);

    /* Per-problem box plot data (배점 대비 % 정규화) */
    const boxData = allProblemIds.map(pid => {
      const rawFull = results[0]?.problems.find(p => p.problem_id === pid)?.full_score || 0;
      const pctList = results
        .map(r => {
          const p = r.problems.find(p => p.problem_id === pid);
          if (!p || !p.full_score) return null;
          return p.obtained_score / p.full_score * 100;
        })
        .filter(s => s !== null);
      return { name: `문제 ${pid} (${rawFull}점)`, full: 100, ...computeStats(pctList) };
    });

    /* Overall stats (100점 환산 / 원점수 둘 다 계산) */
    const pctStats = computeStats(pctScores);
    const rawStats = computeStats(totalScores);

    /* Grade distribution — 100점 환산 점수 기준, 반올림 없이 경계 적용 */
    const gradeData = [
      { grade: 'A (90~100)', count: pctScores.filter(p => p >= 90).length, color: '#059669' },
      { grade: 'B (80~89)', count: pctScores.filter(p => p >= 80 && p < 90).length, color: '#2563eb' },
      { grade: 'C (70~79)', count: pctScores.filter(p => p >= 70 && p < 80).length, color: '#d97706' },
      { grade: 'D (60~69)', count: pctScores.filter(p => p >= 60 && p < 70).length, color: '#ea580c' },
      { grade: 'F (<60)', count: pctScores.filter(p => p < 60).length, color: '#dc2626' },
    ];

    /* 그래프 하단 한 줄 해설용 인사이트 */
    const topBin = histData.reduce((a, b) => (b.count > a.count ? b : a), histData[0]);
    const topGrade = gradeData.reduce((a, b) => (b.count > a.count ? b : a), gradeData[0]);
    const bestProb = problemData.reduce((a, b) => (b.pct > a.pct ? b : a), problemData[0]);
    const worstProb = problemData.reduce((a, b) => (b.pct < a.pct ? b : a), problemData[0]);

    return {
      maxScore, histData, problemData, criteriaData, boxData, pctStats, rawStats, gradeData, allProblemIds,
      topBin, topGrade, bestProb, worstProb,
    };
  }, [results]);

  const isPct = scale === 'pct';
  const shownStats = isPct ? data.pctStats : data.rawStats;

  const n = results.length;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.container} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>📊 통계 대시보드</h2>
            <p style={s.sub}>
              {isPct
                ? `ⓘ ${data.maxScore}점 만점 기준 점수를 100점 만점으로 환산하여 표시 · 총 ${n}명(미제출·결시 학생 제외)`
                : `ⓘ 원점수(${data.maxScore}점 만점) 기준으로 표시 · 총 ${n}명(미제출·결시 학생 제외)`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={s.segmentWrap}>
              <button style={!isPct ? s.segmentActive : s.segment} onClick={() => setScale('raw')}>
                원점수
              </button>
              <button style={isPct ? s.segmentActive : s.segment} onClick={() => setScale('pct')}>
                100점 환산
              </button>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>

        <div style={s.body}>
          {n < 10 && (
            <div style={s.warnBanner}>
              ⚠️ 표본이 10명 미만입니다. 사분위수·등급 분포 등 분포 통계의 신뢰도가 낮을 수 있습니다.
            </div>
          )}

          {/* Summary cards (표시 기준 토글 반영) */}
          <div style={s.summaryRow}>
            {[
              { label: isPct ? '100점 환산 평균' : '평균 (원점수)', value: `${shownStats.avg.toFixed(1)}점`, color: '#2563eb', spark: 'area' },
              { label: isPct ? '100점 환산 중앙값' : '중앙값 (원점수)', value: `${shownStats.median.toFixed(1)}점`, color: '#059669', spark: 'line' },
              { label: '표준편차', value: `${shownStats.std.toFixed(1)}점`, color: '#d97706', spark: 'bell' },
              { label: '최고 / 최저', value: `${shownStats.max.toFixed(1)} / ${shownStats.min.toFixed(1)}`, color: '#7c3aed', spark: 'bars' },
            ].map((c, i) => (
              <div key={i} style={{ ...s.summaryCard, borderTop: `4px solid ${c.color}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...s.summaryLabel, color: c.color, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                  <div style={s.summaryVal}>{c.value}</div>
                </div>
                <CardSpark type={c.spark} color={c.color} />
              </div>
            ))}
          </div>

          {/* Row 1: Histogram + Grade dist */}
          <div style={s.row}>
            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>{isPct ? '100점 환산 점수 분포' : '원점수 분포'}</h3>
              <p style={s.chartDesc}>{isPct ? '10점 간격 구간별 학생 수 (명)' : `원점수 구간별 학생 수 (만점 ${data.maxScore}점, 10% 간격)`}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.histData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey={isPct ? 'range' : 'rawRange'} tick={{ fontSize: isPct ? 12 : 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                            {isPct ? `${label}점 (원점수 ${d.rawRange})` : `원점수 ${label} (환산 ${d.range}점)`}
                          </p>
                          <p style={{ color: '#2563eb', margin: '2px 0' }}>학생 수: <strong>{d.count}명</strong></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]}>
                    {data.histData.map((entry, i) => (
                      <Cell key={i} fill={entry.count === Math.max(...data.histData.map(d => d.count)) ? '#2563eb' : '#93c5fd'} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={s.chartNote}>
                ※ 점수가 {isPct ? `${data.topBin?.range}점` : `${data.topBin?.rawRange}(환산 ${data.topBin?.range}점)`} 구간에 가장 많이 분포되어 있습니다.
              </p>
            </div>

            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>100점 환산 등급 분포</h3>
              <p style={s.chartDesc}>비율 기준 등급별 학생 수 (총 {n}명)</p>
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
              <p style={s.chartNote}>
                ※ {data.topGrade?.grade} 등급이 {data.topGrade?.count}명으로 가장 많습니다. 등급은 100점 환산 점수 기준(반올림 없음)입니다.
              </p>
            </div>
          </div>

          {/* Row 2: Problem avg + Box plot */}
          <div style={s.row}>
            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>문항별 평균 득점률 (배점 보정)</h3>
              <p style={s.chartDesc}>각 문항을 100점 기준으로 환산한 평균 득점률</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.problemData} margin={{ top: 16, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{d.name}</p>
                          <p style={{ color: '#2563eb', margin: '2px 0' }}>평균 득점률: <strong>{d.pct}%</strong></p>
                          <p style={{ color: '#64748b', margin: '2px 0' }}>평균 {d.avg}점 / 배점 {d.full}점</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pct" name="평균 득점률" fill="#2563eb" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="pct" position="top" formatter={v => `${v}%`}
                      style={{ fontSize: 11, fill: '#374151', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={s.chartNote}>
                ※ 득점률이 가장 높은 문항은 {data.bestProb?.name}({data.bestProb?.pct}%), 가장 낮은 문항은 {data.worstProb?.name}({data.worstProb?.pct}%)입니다.
              </p>
            </div>

            <div style={s.chartCard}>
              <h3 style={s.chartTitle}>문항별 득점률 분포 박스플롯</h3>
              <p style={s.chartDesc}>배점 차이를 보정하기 위해 각 문항 점수를 100점 기준 비율로 환산</p>
              <div style={{ height: 220, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 0, padding: '10px 20px 40px' }}>
                <BoxPlotChart data={data.boxData} unit="%" />
              </div>
              <p style={s.chartNote}>※ 상자는 25~75%(Q1~Q3) 구간, 선은 중앙값, ●는 평균입니다.</p>
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
function BoxPlotChart({ data, unit = '' }) {
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
          <text x={35} y={scale(maxVal * t) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{Math.round(maxVal * t)}{unit}</text>
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
  segmentWrap: { display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 },
  segment: {
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '5px 12px', fontSize: 13, color: '#64748b', cursor: 'pointer', fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  segmentActive: {
    background: '#fff', border: 'none', borderRadius: 6,
    padding: '5px 12px', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
  },
  body: { overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 },
  summaryCard: {
    background: '#fff', borderRadius: 12, padding: '14px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  summaryVal: { fontSize: 22, fontWeight: 700, color: '#1e293b' },
  summaryLabel: { fontSize: 12 },
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
  chartNote: { fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 },
  warnBanner: {
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
  },
};
