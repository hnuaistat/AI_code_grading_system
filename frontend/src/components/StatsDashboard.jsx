import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, ReferenceArea,
} from 'recharts';

/* ── Data computation helpers ── */
function computeStats(scores) {
  if (!scores.length) return { min: 0, median: 0, max: 0, avg: 0, std: 0 };
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const avg = s.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  return {
    min: parseFloat(s[0].toFixed(2)), max: parseFloat(s[n - 1].toFixed(2)),
    median: parseFloat(s[Math.floor(n * 0.5)].toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
  };
}

/* 100점 환산 점수 기준 고정 10점 구간 히스토그램 */
function computeHistogram(pctScores) {
  if (!pctScores.length) return [];
  const bins = [];
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 10;
    bins.push({
      range: `${lo}~${hi}`,
      label: `${lo}~${hi}`,
      count: pctScores.filter(s => s >= lo && (hi === 100 ? s <= hi : s < hi)).length,
    });
  }
  return bins;
}

/* 원점수 구간 폭 후보 — 만점에 따라 경계가 항상 정수로 떨어지도록 한다.
   구간 수가 6~14개가 되는 폭만 남기고, 없으면 전체 후보를 그대로 쓴다. */
const BIN_WIDTHS = [1, 2, 3, 5, 10, 20, 25];

function binWidthOptions(maxScore) {
  if (!maxScore || maxScore <= 0) return [1];
  const usable = BIN_WIDTHS.filter(w => {
    const n = Math.ceil(maxScore / w);
    return n >= 4 && n <= 20;
  });
  return usable.length ? usable : [Math.max(1, Math.round(maxScore / 10))];
}

/* 만점에 가장 알맞은 기본 폭 — 구간 수가 10개에 가장 가까운 것 */
function defaultBinWidth(maxScore) {
  const opts = binWidthOptions(maxScore);
  return opts.reduce((best, w) =>
    Math.abs(Math.ceil(maxScore / w) - 10) < Math.abs(Math.ceil(maxScore / best) - 10) ? w : best,
    opts[0]);
}

/* 원점수 기준 히스토그램 — 경계가 정수(또는 지정 폭 배수)로 떨어진다.
   마지막 구간은 만점을 넘지 않도록 라벨을 잘라 표시한다. */
function computeRawHistogram(rawScores, maxScore, width) {
  if (!rawScores.length || !width) return [];
  const fmt = v => parseFloat(v.toFixed(2));
  const bins = [];
  for (let lo = 0; lo < maxScore; lo += width) {
    const hi = lo + width;
    const shownHi = Math.min(hi, maxScore);
    const isLast = hi >= maxScore;
    bins.push({
      range: `${fmt(lo)}~${fmt(shownHi)}`,
      label: `${fmt(lo)}~${fmt(shownHi)}`,
      pctRange: maxScore
        ? `${Math.round(lo / maxScore * 100)}~${Math.round(shownHi / maxScore * 100)}%`
        : '',
      count: rawScores.filter(s => s >= lo && (isLast ? s <= hi : s < hi)).length,
    });
  }
  return bins;
}

/* 문항 강조 색 — 이 시험 안에서 가장 어려운/쉬운 문항만 배경 영역을 연하게 칠한다.
   막대(평균 점수)는 항상 회색 — 평균이 낮은 문항은 막대가 작아 색이 보이지 않기 때문. */
const HARD = '#dc2626', EASY = '#059669', MID = '#64748b';
const HARD_BG = '#fee2e2', EASY_BG = '#dcfce7', MID_BG = '#f1f5f9';

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

/* ── Main component ── */
export default function StatsDashboard({ results, onClose }) {
  // 'pct' = 100점 환산, 'raw' = 원점수 — 기본값은 설정 페이지에서 지정 가능
  const [scale, setScale] = React.useState(
    () => (localStorage.getItem('stats_scale_default') === 'raw' ? 'raw' : 'pct')
  );

  const data = useMemo(() => {
    const maxScore = results[0]?.max_total_score || 100;
    const totalScores = results.map(r => r.total_score);
    const pctScores = results.map(r => (r.max_total_score ? r.total_score / r.max_total_score * 100 : 0));
    const allProblemIds = [...new Set(results.flatMap(r => r.problems.map(p => p.problem_id)))].sort();

    /* Histogram (100점 환산 기준 — 고정 10점 구간) */
    const histData = computeHistogram(pctScores);
    /* 원점수 구간 폭 후보 (교수님이 선택 가능) */
    const widthOptions = binWidthOptions(maxScore);

    /* 문항별 평균 점수 — 원래 문항 순서 유지, 색상은 배점 대비 비율(pct)로 결정 */
    const problemData = allProblemIds.map(pid => {
      const rows = results
        .map(r => r.problems.find(p => p.problem_id === pid))
        .filter(Boolean);
      const scored = rows.filter(p => p.full_score > 0);
      const full = rows[0]?.full_score || 0;
      const pct = scored.length
        ? parseFloat((scored.reduce((s, p) => s + p.obtained_score / p.full_score, 0) / scored.length * 100).toFixed(1))
        : 0;
      const avg = rows.length
        ? parseFloat((rows.reduce((s, p) => s + p.obtained_score, 0) / rows.length).toFixed(2))
        : 0;
      return {
        name: `문제 ${pid}`,
        label: `문제 ${pid} (${full}점)`,
        avg, full, pct, n: rows.length,
      };
    });

    /* 학생별 요약 — 상위/하위 테이블용 */
    const perStudent = results.map(r => {
      const probs = r.problems.filter(p => p.full_score > 0);
      const zeroIds = probs.filter(p => p.obtained_score <= 0).map(p => p.problem_id);
      const perfect = probs.filter(p => p.obtained_score >= p.full_score).length;
      const weakest = probs.length
        ? probs.reduce((a, b) =>
            (b.obtained_score / b.full_score) < (a.obtained_score / a.full_score) ? b : a)
        : null;
      return {
        name: r.student_name || r.student_id || r.filename || '(이름 없음)',
        total: r.total_score,
        pct: r.max_total_score ? r.total_score / r.max_total_score * 100 : 0,
        maxTotal: r.max_total_score || 0,
        zeroIds, perfect, totalProbs: probs.length,
        weakestId: weakest?.problem_id,
      };
    });
    const byScore = [...perStudent].sort((a, b) => a.total - b.total);
    const N = Math.max(1, Math.min(3, Math.floor(results.length / 2)));
    const bottomN = byScore.slice(0, N);
    const topN = [...byScore].reverse().slice(0, N);

    /* Overall stats (100점 환산 / 원점수 둘 다 계산) */
    const pctStats = computeStats(pctScores);
    const rawStats = computeStats(totalScores);

    /* 그래프 하단 한 줄 해설용 인사이트 */
    const hardest = problemData.reduce((a, b) => (b.pct < a.pct ? b : a), problemData[0]);
    const easiest = problemData.reduce((a, b) => (b.pct > a.pct ? b : a), problemData[0]);
    /* 양극 강조용 색 — 문항이 2개 미만이거나 전부 동점이면 강조하지 않음 */
    const distinct = hardest && easiest && hardest.pct !== easiest.pct;
    problemData.forEach(p => {
      const kind = !distinct ? 'mid'
        : p.pct === hardest.pct ? 'hard'
        : p.pct === easiest.pct ? 'easy' : 'mid';
      p.kind = kind;
      p.tone = kind === 'hard' ? HARD : kind === 'easy' ? EASY : MID;
      p.bg = kind === 'hard' ? HARD_BG : kind === 'easy' ? EASY_BG : MID_BG;
    });

    return {
      maxScore, histData, problemData, pctStats, rawStats, allProblemIds,
      totalScores, widthOptions, hardest, easiest, bottomN, topN, N,
    };
  }, [results]);

  /* 원점수 히스토그램 구간 폭 — 자동 계산값을 기본으로, 교수님이 바꿀 수 있다 */
  const [binWidth, setBinWidth] = React.useState(() => defaultBinWidth(data.maxScore));
  React.useEffect(() => {
    setBinWidth(defaultBinWidth(data.maxScore));
  }, [data.maxScore]);

  const isPct = scale === 'pct';
  const rawHistData = useMemo(
    () => computeRawHistogram(data.totalScores, data.maxScore, binWidth),
    [data.totalScores, data.maxScore, binWidth]
  );
  const shownHist = isPct ? data.histData : rawHistData;
  const topBin = shownHist.reduce((a, b) => (b.count > a.count ? b : a), shownHist[0]);
  const shownStats = isPct ? data.pctStats : data.rawStats;
  const fmtScore = st => (isPct ? `${st.pct.toFixed(1)}점` : `${st.total.toFixed(1)}점`);

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
                ? `ⓘ ${data.maxScore}점 만점 기준 점수를 100점 만점으로 환산하여 표시 · 총 ${n}명(0점·미제출 포함)`
                : `ⓘ 원점수(${data.maxScore}점 만점) 기준으로 표시 · 총 ${n}명(0점·미제출 포함)`}
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
              ⚠️ 표본이 10명 미만입니다. 평균·표준편차 등 분포 통계의 신뢰도가 낮을 수 있습니다.
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

          {/* 1. 점수 분포 히스토그램 */}
          <div style={s.chartCardFull}>
            <div style={s.chartHeadRow}>
              <div>
                <h3 style={s.chartTitle}>{isPct ? '100점 환산 점수 분포' : '원점수 분포'}</h3>
                <p style={s.chartDesc}>
                  {isPct
                    ? '10점 간격 구간별 학생 수 (명)'
                    : `원점수 구간별 학생 수 (만점 ${data.maxScore}점, ${binWidth}점 간격 · ${shownHist.length}개 구간)`}
                </p>
              </div>
              {/* 원점수 뷰에서만 구간 폭을 직접 고를 수 있다 */}
              {!isPct && data.widthOptions.length > 1 && (
                <div style={s.binPicker}>
                  <span style={s.binPickerLabel}>구간 폭</span>
                  {data.widthOptions.map(w => (
                    <button key={w}
                      style={w === binWidth ? s.binBtnActive : s.binBtn}
                      onClick={() => setBinWidth(w)}
                      title={`${w}점 간격 · ${Math.ceil(data.maxScore / w)}개 구간`}
                    >
                      {w}점
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={shownHist} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: shownHist.length > 12 ? 10 : 12 }}
                  interval={0} angle={shownHist.length > 12 ? -35 : 0}
                  textAnchor={shownHist.length > 12 ? 'end' : 'middle'}
                  height={shownHist.length > 12 ? 52 : 30} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={s.tooltip}>
                        <p style={s.tooltipTitle}>
                          {isPct ? `${label}점` : `원점수 ${label}점 (${d.pctRange})`}
                        </p>
                        <p style={{ color: '#2563eb', margin: '2px 0' }}>학생 수: <strong>{d.count}명</strong></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" name="학생 수" radius={[4, 4, 0, 0]}>
                  {shownHist.map((entry, i) => (
                    <Cell key={i} fill={entry.count === Math.max(...shownHist.map(d => d.count)) ? '#2563eb' : '#93c5fd'} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={s.chartNote}>
              ※ 점수가 {isPct ? `${topBin?.range}점` : `${topBin?.range}점(${topBin?.pctRange})`} 구간에
              {' '}가장 많이 분포되어 있습니다({topBin?.count}명).
              {!isPct && ' 구간 폭은 위 버튼으로 바꿀 수 있습니다.'}
            </p>
          </div>

          {/* 2. 문항별 평균 점수 */}
          <div style={s.chartCardFull}>
            <h3 style={s.chartTitle}>문항별 평균 점수</h3>
            <p style={s.chartDesc}>
              막대에 적힌 점수는 <strong style={{ color: '#64748b' }}>원점수 그대로의 학생 평균</strong>입니다.
              문제의 난이도는 <strong style={{ color: '#64748b' }}>배점 대비 비율</strong>로 판단합니다 ·{' '}
              <span style={s.formula}>배점 대비 비율 = 학생 평균 점수 ÷ 문항 배점 × 100</span>
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.problemData}
                margin={{ top: 24, right: 16, left: -10, bottom: 8 }}
                barGap={-36}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}점`} tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={s.tooltip}>
                        <p style={s.tooltipTitle}>
                          {d.name}
                          {d.tone === HARD ? ' · 가장 어려웠던 문항' : d.tone === EASY ? ' · 가장 쉬웠던 문항' : ''}
                        </p>
                        <p style={{ color: d.tone, margin: '2px 0' }}>
                          평균 <strong>{d.avg}점</strong> / 배점 {d.full}점
                        </p>
                        <p style={{ color: '#64748b', margin: '2px 0' }}>배점 대비 {d.pct}%</p>
                        <p style={{ color: '#94a3b8', margin: '2px 0', fontSize: 12 }}>채점 학생 {d.n}명</p>
                      </div>
                    );
                  }}
                />
                {/* 최난이도/최이도 문항의 칸 전체를 연한 빨강·초록으로 강조 */}
                {data.problemData.map((entry, i) => (
                  entry.kind === 'mid' ? null : (
                    <ReferenceArea key={i} x1={entry.name} x2={entry.name}
                      fill={entry.bg} fillOpacity={1} ifOverflow="extendDomain" />
                  )
                ))}
                {/* 배경 막대: 문항 배점 */}
                <Bar dataKey="full" name="배점" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={36}
                  isAnimationActive={false} />
                {/* 전경 막대: 평균 점수 — 배점 막대와 같은 폭으로 겹쳐 그린다 */}
                <Bar dataKey="avg" name="평균 점수" fill={MID} radius={[4, 4, 0, 0]} barSize={36}>
                  <LabelList dataKey="avg" position="top" formatter={v => `${v}점`}
                    style={{ fontSize: 12, fill: '#374151', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={s.chartNote}>
              ※ <span style={{ background: HARD_BG, color: HARD, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                가장 어려웠던 문항
              </span>{' '}{data.hardest?.name} ({data.hardest?.avg}/{data.hardest?.full}점, 배점 대비 {data.hardest?.pct}%) ·{' '}
              <span style={{ background: EASY_BG, color: EASY, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                가장 쉬웠던 문항
              </span>{' '}{data.easiest?.name} ({data.easiest?.avg}/{data.easiest?.full}점, 배점 대비 {data.easiest?.pct}%).
              {' '}난이도는 원점수가 아니라 <strong>배점 대비 비율</strong>로 비교합니다.
            </p>
          </div>

          {/* 3. 상위 / 하위 학생 */}
          <div style={s.chartCardFull}>
            <h3 style={s.chartTitle}>상위 · 하위 {data.N}명</h3>
            <p style={s.chartDesc}>
              {isPct ? '100점 환산 점수' : '원점수'} 기준 · 동점자는 순서가 임의일 수 있습니다
            </p>
            <div style={s.tableRow}>
              {/* 하위 */}
              <div>
                <div style={{ ...s.tableHead, color: '#dc2626' }}>⚠️ 보완이 필요한 하위 {data.N}명</div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>학생</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 80 }}>점수</th>
                      <th style={{ ...s.th, width: '45%' }}>취약 문항</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bottomN.map((st, i) => (
                      <tr key={i}>
                        <td style={s.td}>{st.name}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          {fmtScore(st)}
                        </td>
                        <td style={{ ...s.td, color: '#64748b' }}>
                          {st.zeroIds.length
                            ? st.zeroIds.map(id => `문제 ${id}`).join(', ')
                            : st.weakestId != null ? `문제 ${st.weakestId}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 상위 */}
              <div>
                <div style={{ ...s.tableHead, color: '#059669' }}>🏆 상위 {data.N}명</div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>학생</th>
                      <th style={{ ...s.th, textAlign: 'right', width: 80 }}>점수</th>
                      <th style={{ ...s.th, width: '45%' }}>만점 문항</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topN.map((st, i) => (
                      <tr key={i}>
                        <td style={s.td}>{st.name}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {fmtScore(st)}
                        </td>
                        <td style={{ ...s.td, color: '#64748b' }}>
                          {st.totalProbs
                            ? `${st.totalProbs}문항 중 ${st.perfect}개 만점`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={s.chartNote}>
              ※ 취약 문항은 0점을 받은 문항입니다. 0점 문항이 없으면 획득률이 가장 낮은 문항 1개를 표시합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
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
  chartCardFull: {
    background: '#fff', borderRadius: 12, padding: '20px 20px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartHeadRow: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 16,
  },
  binPicker: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#f1f5f9', borderRadius: 8, padding: 3, flexShrink: 0,
  },
  binPickerLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: '0 6px' },
  binBtn: {
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, color: '#64748b',
    cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
  },
  binBtnActive: {
    background: '#fff', border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, color: '#2563eb',
    cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  chartTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 2 },
  chartDesc: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  formula: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: '#64748b', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 6px',
  },
  chartNote: { fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 },
  tooltip: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  tooltipTitle: { fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  tableHead: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8',
    padding: '6px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px', borderBottom: '1px solid #f1f5f9', color: '#1e293b',
    overflow: 'hidden', textOverflow: 'ellipsis',
  },
  warnBanner: {
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
  },
};
