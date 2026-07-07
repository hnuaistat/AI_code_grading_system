import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gradingAPI } from '../services/api';

const MAX_SESSIONS = 4;

const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const fmt = v => (v === null || v === undefined || Number.isNaN(v)) ? '—' : String(round2(v));

// 날짜/시간을 각각 nowrap으로 감싸 줄바꿈이 필요하면 날짜와 시간 사이에서만 일어나게 함
function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <span style={{ whiteSpace: 'nowrap' }}>{datePart}</span>{' '}
      <span style={{ whiteSpace: 'nowrap' }}>{timePart}</span>
    </>
  );
}

function ModelBadge({ model, label }) {
  const provider = (model || '').split('/')[0];
  const displayName = label || (model || '').split('/').pop() || '-';
  const cfg = provider === 'fireworks'
    ? { bg: '#fef3c7', color: '#b45309' }
    : { bg: '#dbeafe', color: '#1d4ed8' };
  return (
    <span
      title={model}
      style={{
        background: cfg.bg, color: cfg.color, borderRadius: 6,
        padding: '3px 8px', fontSize: 11, fontWeight: 600,
        fontFamily: 'monospace', whiteSpace: 'nowrap',
        maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'inline-block', verticalAlign: 'middle',
      }}
    >
      {displayName}
    </span>
  );
}

function DeltaBadge({ value }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const v = round2(value);
  const cfg = v > 0
    ? { bg: '#eff6ff', color: '#2563eb', label: `+${v}` }
    : v < 0
      ? { bg: '#fef2f2', color: '#dc2626', label: `${v}` }
      : { bg: '#f1f5f9', color: '#94a3b8', label: '±0' };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4,
      padding: '1px 6px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// 교수 수정 로그에서 AI 원본 점수 복원:
// 같은 (학생, 문항, 필드, 인덱스)의 가장 오래된 old_value가 AI가 준 원점수
function buildAiOriginalResults(results, revisions) {
  const firstOld = new Map();
  [...revisions]
    .sort((a, b) => new Date(a.revised_at) - new Date(b.revised_at))
    .forEach(r => {
      const key = `${r.student_filename}|${r.problem_id}|${r.field_name}|${r.partial_score_index ?? ''}`;
      if (!firstOld.has(key)) firstOld.set(key, r.old_value);
    });
  if (firstOld.size === 0) return results;

  return results.map(stu => {
    let changed = false;
    const problems = (stu.problems || []).map(p => {
      const base = `${stu.filename}|${p.problem_id}`;
      let psChanged = false;
      const ps = (p.partial_scores || []).map((it, i) => {
        const k = `${base}|partial_score|${i}`;
        if (!firstOld.has(k)) return it;
        const v = parseFloat(firstOld.get(k));
        if (Number.isNaN(v)) return it;
        psChanged = true;
        return { ...it, score: v };
      });
      let obtained = p.obtained_score;
      const ok = `${base}|obtained_score|`;
      if (firstOld.has(ok)) {
        const v = parseFloat(firstOld.get(ok));
        if (!Number.isNaN(v)) obtained = v;
      } else if (psChanged) {
        obtained = Math.max(0, Math.min(ps.reduce((sum, it) => sum + (it.score || 0), 0), p.full_score));
      }
      if (!psChanged && obtained === p.obtained_score) return p;
      changed = true;
      return { ...p, partial_scores: ps, obtained_score: round2(obtained) };
    });
    if (!changed) return stu;
    const total = round2(problems.reduce((sum, p) => sum + (p.obtained_score || 0), 0));
    return { ...stu, problems, total_score: total };
  });
}

// 한 문항을 세션별로 나란히 비교 (루브릭 항목 + AI 피드백)
function ProblemCompare({ pid, cells, basis }) {
  const probs = cells.map(c => {
    if (!c) return null;
    const stu = basis === 'ai' ? c.ai : c.final;
    return (stu.problems || []).find(p => String(p.problem_id) === pid) || null;
  });
  const present = probs.filter(Boolean);
  if (present.length === 0) return null;

  const fullScore = present[0].full_score;
  const baseIdx = probs.findIndex(Boolean);
  const itemLists = present.map(p => (p.partial_scores || []).map(it => it.item));
  const aligned = itemLists.length > 0 && itemLists[0].length > 0 &&
    itemLists.every(l => l.length === itemLists[0].length && l.every((x, i) => x === itemLists[0][i]));

  return (
    <div style={dt.problemBlock}>
      <div style={dt.problemTitle}>
        문제 {pid} <span style={dt.problemFull}>(만점 {fmt(fullScore)}점)</span>
      </div>

      {/* 문항 총점 비교 */}
      <table style={dt.table}>
        <thead>
          <tr>
            <th style={{ ...dt.th, width: '38%' }}>항목</th>
            {probs.map((_, i) => (
              <th key={i} style={dt.th}>{i === 0 ? '기준' : `비교 ${i}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aligned && probs[baseIdx].partial_scores.map((baseItem, ri) => (
            <tr key={ri}>
              <td style={dt.tdItem} title={baseItem.item}>
                {baseItem.item} <span style={dt.itemMax}>/{fmt(baseItem.max_score)}</span>
              </td>
              {probs.map((p, si) => {
                if (!p) return <td key={si} style={dt.td}>—</td>;
                const it = p.partial_scores[ri];
                const baseScore = probs[baseIdx].partial_scores[ri].score;
                const diff = si !== baseIdx && it.score !== baseScore;
                return (
                  <td key={si} style={{ ...dt.td, background: diff ? '#fffbeb' : 'transparent', fontWeight: diff ? 700 : 400 }}
                    title={it.reason || ''}>
                    {fmt(it.score)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td style={{ ...dt.tdItem, fontWeight: 700 }}>문항 점수</td>
            {probs.map((p, si) => {
              if (!p) return <td key={si} style={dt.td}>—</td>;
              const baseScore = probs[baseIdx].obtained_score;
              const diff = si !== baseIdx && p.obtained_score !== baseScore;
              return (
                <td key={si} style={{ ...dt.td, fontWeight: 700, color: diff ? '#b45309' : '#1e293b' }}>
                  {fmt(p.obtained_score)}
                  {si !== baseIdx && <span style={{ marginLeft: 6 }}><DeltaBadge value={p.obtained_score - baseScore} /></span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {/* 루브릭 구조가 다르면 세션별로 따로 표시 */}
      {!aligned && itemLists.some(l => l.length > 0) && (
        <div style={{ ...dt.feedbackGrid, gridTemplateColumns: `repeat(${probs.length}, 1fr)` }}>
          {probs.map((p, si) => (
            <div key={si} style={dt.feedbackCell}>
              {p ? (p.partial_scores || []).map((it, i) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0' }} title={it.reason || ''}>
                  · {it.item}: <b>{fmt(it.score)}</b>/{fmt(it.max_score)}
                </div>
              )) : <span style={{ color: '#94a3b8' }}>—</span>}
            </div>
          ))}
        </div>
      )}

      {/* AI 피드백 나란히 */}
      <div style={{ ...dt.feedbackGrid, gridTemplateColumns: `repeat(${probs.length}, 1fr)` }}>
        {probs.map((p, si) => (
          <div key={si} style={dt.feedbackCell}>
            {p ? (
              <>
                <div style={dt.feedbackText}>{p.ai_feedback || <span style={{ color: '#94a3b8' }}>피드백 없음</span>}</div>
                {p.professor_feedback && (
                  <div style={dt.profFeedback}>✏ 교수 피드백: {p.professor_feedback}</div>
                )}
              </>
            ) : <span style={{ color: '#94a3b8' }}>이 세션에 없음</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const allIds = useMemo(() => idsParam.split(',').filter(Boolean), [idsParam]);
  const ids = useMemo(() => allIds.slice(0, MAX_SESSIONS), [allIds]);

  const [sessions, setSessions] = useState(null); // [{meta, finalResults, aiResults, revisionCount}]
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelLabels, setModelLabels] = useState({});
  const [basis, setBasis] = useState('ai'); // 'ai' = AI 원본 점수, 'final' = 교수 수정 반영
  const [scale, setScale] = useState('pct'); // 'pct' = 100점 환산, 'raw' = 원점수
  const [sortMode, setSortMode] = useState('name'); // 'name' | 'delta'
  const [expanded, setExpanded] = useState(new Set());

  // 세션 선택 화면 (ids 없이 진입 시)
  const [pickerList, setPickerList] = useState([]);
  const [pickSel, setPickSel] = useState(new Set());

  useEffect(() => {
    let alive = true;
    if (ids.length < 2) {
      // 선택 화면 모드: 완료된 세션 목록 로드
      setSessions(null);
      setError('');
      setLoading(true);
      gradingAPI.getHistory()
        .then(res => { if (alive) setPickerList((res.data || []).filter(h => h.status === 'completed')); })
        .catch(() => { if (alive) setError('채점 기록을 불러오지 못했습니다.'); })
        .finally(() => { if (alive) setLoading(false); });
      gradingAPI.getAvailableModels()
        .then(res => {
          if (!alive) return;
          const map = {};
          (res.data.models || []).forEach(m => { map[m.id] = m.label; });
          setModelLabels(map);
        })
        .catch(() => {});
      return () => { alive = false; };
    }
    setLoading(true);
    (async () => {
      try {
        const loaded = await Promise.all(ids.map(async id => {
          const [sessRes, revRes] = await Promise.all([
            gradingAPI.getSession(id),
            gradingAPI.getRevisions(id).catch(() => ({ data: [] })),
          ]);
          return { sess: sessRes.data, revisions: revRes.data || [] };
        }));
        if (!alive) return;
        const ok = [];
        const skip = [];
        loaded.forEach(({ sess, revisions }) => {
          if (sess.status !== 'completed' || !Array.isArray(sess.results) || sess.results.length === 0) {
            skip.push(sess);
            return;
          }
          ok.push({
            meta: sess,
            finalResults: sess.results,
            aiResults: buildAiOriginalResults(sess.results, revisions),
            revisionCount: revisions.length,
          });
        });
        // 원본(루트) 세션을 기준 컬럼으로: regraded_from 없는 세션 우선, 그다음 시작 시각순
        ok.sort((a, b) => {
          const ra = a.meta.regraded_from ? 1 : 0;
          const rb = b.meta.regraded_from ? 1 : 0;
          if (ra !== rb) return ra - rb;
          return new Date(a.meta.created_at) - new Date(b.meta.created_at);
        });
        setSkipped(skip);
        if (ok.length < 2) setError('완료된 세션이 2개 이상 있어야 비교할 수 있습니다.');
        else setSessions(ok);
      } catch (e) {
        if (alive) setError(e.response?.data?.detail || '세션 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    gradingAPI.getAvailableModels()
      .then(res => {
        if (!alive) return;
        const map = {};
        (res.data.models || []).forEach(m => { map[m.id] = m.label; });
        setModelLabels(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [ids]);

  // 학생 filename 기준으로 세션들을 병합 (한쪽에만 있는 학생은 빈칸)
  const rows = useMemo(() => {
    if (!sessions) return [];
    const order = [];
    const map = new Map();
    sessions.forEach((sess, si) => {
      sess.finalResults.forEach(stu => {
        let row = map.get(stu.filename);
        if (!row) {
          row = {
            filename: stu.filename,
            student_id: stu.student_id,
            student_name: stu.student_name,
            perSession: sessions.map(() => null),
          };
          map.set(stu.filename, row);
          order.push(row);
        }
        if (!row.student_id && stu.student_id) row.student_id = stu.student_id;
        if (!row.student_name && stu.student_name) row.student_name = stu.student_name;
        row.perSession[si] = { final: stu, ai: stu };
      });
      sess.aiResults.forEach(stu => {
        const row = map.get(stu.filename);
        if (row && row.perSession[si]) row.perSession[si].ai = stu;
      });
    });
    return order;
  }, [sessions]);

  // 표시 점수: 원점수 또는 100점 환산 (세션별 만점 기준)
  const stuTotal = (stu) => (scale === 'pct' && stu.max_total_score)
    ? stu.total_score / stu.max_total_score * 100
    : stu.total_score;
  const getTotal = (cell) => cell ? stuTotal(basis === 'ai' ? cell.ai : cell.final) : null;
  const getOtherTotal = (cell) => cell ? stuTotal(basis === 'ai' ? cell.final : cell.ai) : null;

  const sortedRows = useMemo(() => {
    const withDelta = rows.map(r => {
      const baseVal = getTotal(r.perSession[0]);
      let maxAbs = 0;
      r.perSession.forEach((c, i) => {
        if (i === 0 || c === null || baseVal === null) return;
        maxAbs = Math.max(maxAbs, Math.abs(getTotal(c) - baseVal));
      });
      return { row: r, maxAbsDelta: maxAbs };
    });
    if (sortMode === 'delta') {
      withDelta.sort((a, b) => b.maxAbsDelta - a.maxAbsDelta);
    } else {
      withDelta.sort((a, b) =>
        (a.row.student_id || a.row.filename).localeCompare(b.row.student_id || b.row.filename, 'ko', { numeric: true }));
    }
    return withDelta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, basis, scale, sortMode]);

  const stats = useMemo(() => {
    if (!sessions) return [];
    return sessions.map((sess, si) => {
      const totals = rows.map(r => r.perSession[si]).filter(Boolean)
        .map(c => stuTotal(basis === 'ai' ? c.ai : c.final));
      const n = totals.length;
      const mean = n ? totals.reduce((a, b) => a + b, 0) / n : 0;
      const sd = n ? Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
      return { n, mean, sd };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, rows, basis, scale]);

  const highlights = useMemo(() => {
    if (!sessions || rows.length === 0) return null;
    // 총점 차이가 가장 큰 학생
    let topStudent = null;
    sortedRows.forEach(({ row, maxAbsDelta }) => {
      if (!topStudent || maxAbsDelta > topStudent.delta) {
        topStudent = { row, delta: maxAbsDelta };
      }
    });
    // 세션 간 평균 점수차가 가장 큰 문항
    const acc = new Map();
    rows.forEach(r => {
      const baseCell = r.perSession[0];
      if (!baseCell) return;
      const baseStu = basis === 'ai' ? baseCell.ai : baseCell.final;
      const baseByPid = new Map((baseStu.problems || []).map(p => [String(p.problem_id), p.obtained_score]));
      r.perSession.forEach((c, i) => {
        if (i === 0 || !c) return;
        const stu = basis === 'ai' ? c.ai : c.final;
        (stu.problems || []).forEach(p => {
          const b = baseByPid.get(String(p.problem_id));
          if (b === undefined) return;
          const e = acc.get(String(p.problem_id)) || { sum: 0, count: 0 };
          e.sum += Math.abs(p.obtained_score - b);
          e.count += 1;
          acc.set(String(p.problem_id), e);
        });
      });
    });
    let topProblem = null;
    acc.forEach((e, pid) => {
      const avg = e.count ? e.sum / e.count : 0;
      if (!topProblem || avg > topProblem.avg) topProblem = { pid, avg };
    });
    return { topStudent, topProblem };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, rows, sortedRows, basis]);

  const toggleExpand = (filename) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  // 카드 드래그/버튼으로 세션 순서(기준) 변경 — 첫 번째 세션이 기준(Δ 기준점)
  const [dragIdx, setDragIdx] = useState(null);
  const moveSession = (from, to) => {
    if (from === null || to === null || from === to) return;
    setSessions(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const anyRevision = sessions ? sessions.some(sess => sess.revisionCount > 0) : false;
  const baseMeta = sessions ? sessions[0].meta : null;
  const maxTotal = sessions && sessions[0].finalResults[0] ? sessions[0].finalResults[0].max_total_score : null;

  // 세션 선택 화면: 과목별 그룹
  const pickerGrouped = useMemo(() => {
    const g = {};
    pickerList.forEach(h => {
      const k = h.subject_name || '과목 미지정';
      (g[k] = g[k] || []).push(h);
    });
    return g;
  }, [pickerList]);

  const togglePick = (id) => {
    setPickSel(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SESSIONS) next.add(id);
      return next;
    });
  };

  return (
    <div style={s.page}>
      <main style={s.main}>
        <div style={s.pageTitleRow}>
          <button style={s.backBtn} onClick={() => navigate('/history')}>← 채점 기록</button>
          <h1 style={s.pageTitle}>⚖ 채점 결과 비교</h1>
        </div>
        {loading ? (
          <div style={s.empty}>비교 데이터 로딩 중...</div>
        ) : ids.length < 2 ? (
          /* ── 세션 선택 화면 (사이드바 메뉴로 직접 진입 시) ── */
          error ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>⚠️</div>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div style={s.noticeBlue}>
                비교할 완료된 채점 세션을 2~{MAX_SESSIONS}개 선택하세요.
                같은 시험을 다른 AI로 재채점한 세션끼리는 학생별 상세 비교가 되고,
                만점이 다른 세션끼리는 100점 환산 기준으로 비교돼요.
              </div>
              {pickerList.length === 0 ? (
                <div style={s.empty}>
                  <div style={s.emptyIcon}>📭</div>
                  <p>완료된 채점 세션이 없습니다</p>
                </div>
              ) : (
                <>
                  <div style={s.pickBar}>
                    <span style={s.pickCount}>
                      {pickSel.size}개 선택{pickSel.size >= MAX_SESSIONS ? ' (최대)' : ''}
                    </span>
                    <button
                      style={pickSel.size >= 2 ? s.pickStartBtn : s.pickStartBtnDisabled}
                      disabled={pickSel.size < 2}
                      onClick={() => navigate(`/compare?ids=${[...pickSel].join(',')}`)}
                    >
                      ⚖ {pickSel.size >= 2 ? `${pickSel.size}개 세션 비교 시작` : '2개 이상 선택하세요'}
                    </button>
                  </div>
                  {Object.entries(pickerGrouped).map(([subjectName, list]) => {
                    // 재채점 세션을 원본 아래에 묶어서 표시 (채점 기록과 동일한 규칙)
                    const idSet = new Set(list.map(h => h.session_id));
                    const childrenMap = {};
                    const roots = [];
                    list.forEach(h => {
                      if (h.regraded_from && idSet.has(h.regraded_from)) {
                        (childrenMap[h.regraded_from] = childrenMap[h.regraded_from] || []).push(h);
                      } else {
                        roots.push(h);
                      }
                    });
                    const displayRows = roots.flatMap(r => {
                      const kids = childrenMap[r.session_id] || [];
                      const inGroup = kids.length > 0;
                      return [
                        { session: r, isChild: false, inGroup, isGroupStart: inGroup, isGroupEnd: false },
                        ...kids.map((c, i) => ({
                          session: c, isChild: true, inGroup: true,
                          isGroupStart: false, isGroupEnd: i === kids.length - 1,
                        })),
                      ];
                    });

                    return (
                      <div key={subjectName} style={s.pickGroup}>
                        <div style={s.pickSubject}>
                          {subjectName} <span style={s.sessionCount}>{list.length}회 채점</span>
                        </div>
                        <div style={s.tableCard}>
                          <table style={{ ...s.table, tableLayout: 'fixed' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={{ ...th, width: '5%' }} />
                                <th style={{ ...th, width: '19%' }}>날짜</th>
                                <th style={{ ...th, width: '17%' }}>세부 항목</th>
                                <th style={{ ...th, width: '10%' }}>학생 수</th>
                                <th style={{ ...th, width: '19%' }}>완료 시간</th>
                                <th style={{ ...th, width: '17%' }}>채점 AI</th>
                                <th style={{ ...th, width: '13%' }}>결과 보기</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map(({ session, isChild, inGroup, isGroupStart, isGroupEnd }) => {
                                const checked = pickSel.has(session.session_id);
                                const blocked = !checked && pickSel.size >= MAX_SESSIONS;
                                return (
                                  <tr
                                    key={session.session_id}
                                    style={{
                                      borderBottom: isGroupEnd ? '2px solid #bfdbfe' : '1px solid #f1f5f9',
                                      borderTop: isGroupStart ? '2px solid #bfdbfe' : undefined,
                                      background: checked ? '#eff6ff' : (inGroup ? '#f7faff' : 'transparent'),
                                      cursor: blocked ? 'default' : 'pointer',
                                      opacity: blocked ? 0.55 : 1,
                                    }}
                                    onClick={() => togglePick(session.session_id)}
                                  >
                                    <td style={{ ...td, textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={blocked}
                                        onChange={() => togglePick(session.session_id)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ cursor: blocked ? 'not-allowed' : 'pointer', width: 15, height: 15 }}
                                      />
                                    </td>
                                    <td style={td}>
                                      {isChild ? (
                                        <div>
                                          <span style={s.regradeBadge}>🆕 새 AI 채점</span>
                                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{formatDate(session.created_at)}</div>
                                        </div>
                                      ) : (
                                        formatDate(session.created_at)
                                      )}
                                    </td>
                                    <td style={td}>
                                      {session.subject_item_name ? (
                                        <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
                                          {session.subject_item_name}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ ...td, textAlign: 'center' }}>
                                      <span style={{ fontWeight: 600 }}>{session.total_students}</span>명
                                    </td>
                                    <td style={{ ...td, color: '#64748b', fontSize: 13 }}>
                                      {session.completed_at ? formatDate(session.completed_at) : '-'}
                                    </td>
                                    <td style={{ ...td, padding: '12px 4px', textAlign: 'center' }}>
                                      {session.grading_model ? (
                                        <ModelBadge model={session.grading_model} label={session.grading_model_label} />
                                      ) : (
                                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ ...td, padding: '12px 4px', textAlign: 'center' }}>
                                      <button
                                        style={s.viewBtn}
                                        onClick={e => { e.stopPropagation(); navigate(`/dashboard/${session.session_id}`); }}
                                      >
                                        보기
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )
        ) : error ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>⚠️</div>
            <p>{error}</p>
            <button style={s.primaryBtn} onClick={() => navigate('/history')}>채점 기록으로</button>
          </div>
        ) : (
          <>
            {/* 안내 배너 */}
            <div style={s.infoBar}>
              <div>
                <span style={s.subjectName}>{baseMeta.subject_name || '과목 미지정'}</span>
                {baseMeta.subject_item_name && <span style={s.itemName}> · {baseMeta.subject_item_name}</span>}
                <span style={s.sessionCount}>{sessions.length}개 세션 비교</span>
                {maxTotal !== null && (
                  <span style={s.maxTotal}>
                    {scale === 'pct' ? `100점 환산 표시 (원 만점 ${fmt(maxTotal)}점)` : `만점 ${fmt(maxTotal)}점`}
                  </span>
                )}
              </div>
              <div style={s.controls}>
                <div style={s.segmentWrap}>
                  <button
                    style={scale === 'raw' ? s.segmentActive : s.segment}
                    onClick={() => setScale('raw')}
                    title="채점된 원점수 그대로 비교합니다"
                  >
                    원점수
                  </button>
                  <button
                    style={scale === 'pct' ? s.segmentActive : s.segment}
                    onClick={() => setScale('pct')}
                    title="각 세션의 만점을 100점으로 환산하여 비교합니다"
                  >
                    100점 환산
                  </button>
                </div>
                <div style={s.segmentWrap}>
                  <button
                    style={basis === 'ai' ? s.segmentActive : s.segment}
                    onClick={() => setBasis('ai')}
                    title="교수 수정 전, AI가 매긴 원래 점수로 비교합니다"
                  >
                    🤖 AI 원본 점수
                  </button>
                  <button
                    style={basis === 'final' ? s.segmentActive : s.segment}
                    onClick={() => setBasis('final')}
                    title="교수 수정이 반영된 최종 점수로 비교합니다"
                  >
                    ✏ 수정 반영 점수
                  </button>
                </div>
                <select style={s.select} value={sortMode} onChange={e => setSortMode(e.target.value)}>
                  <option value="name">학번순</option>
                  <option value="delta">점수차 큰 순</option>
                </select>
              </div>
            </div>

            {allIds.length > MAX_SESSIONS && (
              <div style={s.notice}>선택한 세션이 많아 처음 {MAX_SESSIONS}개만 비교합니다.</div>
            )}
            {skipped.length > 0 && (
              <div style={s.notice}>완료되지 않은 세션 {skipped.length}개는 비교에서 제외했습니다.</div>
            )}
            {anyRevision && (
              <div style={s.noticeBlue}>
                ✏ 교수 수정이 있는 세션이 있습니다. 수정된 점수는 표시 기준의 반대 값을 셀 아래에 함께 보여줍니다.
              </div>
            )}

            {/* 세션 요약 카드 */}
            <div style={s.dragHint}>
              ↔ 카드를 드래그해서 순서를 바꾸거나, "기준으로" 버튼으로 기준 세션을 변경할 수 있어요
            </div>
            <div style={{ ...s.cardGrid, gridTemplateColumns: `repeat(${sessions.length}, 1fr)` }}>
              {sessions.map((sess, si) => (
                <div
                  key={sess.meta.session_id}
                  draggable
                  onDragStart={() => setDragIdx(si)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { moveSession(dragIdx, si); setDragIdx(null); }}
                  onDragEnd={() => setDragIdx(null)}
                  style={{
                    ...(si === 0 ? s.cardBase : s.card),
                    opacity: dragIdx === si ? 0.4 : 1,
                    cursor: 'grab',
                  }}
                >
                  <div style={s.cardTop}>
                    <span style={si === 0 ? s.roleTagBase : s.roleTag}>{si === 0 ? '기준' : `비교 ${si}`}</span>
                    <ModelBadge model={sess.meta.grading_model} label={modelLabels[sess.meta.grading_model]} />
                    {si > 0 && (
                      <button
                        style={s.setBaseBtn}
                        onClick={() => moveSession(si, 0)}
                        title="이 세션을 기준(첫 컬럼)으로 설정"
                      >
                        기준으로 ↖
                      </button>
                    )}
                  </div>
                  <div style={s.cardSubject}>
                    {sess.meta.subject_name || '과목 미지정'}
                    {sess.meta.subject_item_name && <span style={s.cardItem}> · {sess.meta.subject_item_name}</span>}
                  </div>
                  <div style={s.cardDate}>{formatDate(sess.meta.created_at)}</div>
                  <div style={s.cardStats}>
                    <div style={s.cardStat}>
                      <div style={s.cardStatLabel}>평균</div>
                      <div style={s.cardStatValue}>{fmt(stats[si].mean)}</div>
                    </div>
                    <div style={s.cardStat}>
                      <div style={s.cardStatLabel}>표준편차</div>
                      <div style={s.cardStatValue}>{fmt(stats[si].sd)}</div>
                    </div>
                    <div style={s.cardStat}>
                      <div style={s.cardStatLabel}>학생</div>
                      <div style={s.cardStatValue}>{stats[si].n}명</div>
                    </div>
                  </div>
                  {si > 0 && (
                    <div style={s.cardDelta}>
                      기준 대비 평균 <DeltaBadge value={stats[si].mean - stats[0].mean} />
                    </div>
                  )}
                  {sess.revisionCount > 0 && (
                    <div style={s.cardRevision}>✏ 교수 수정 {sess.revisionCount}건</div>
                  )}
                  <button
                    style={s.cardLink}
                    onClick={() => navigate(`/dashboard/${sess.meta.session_id}`)}
                  >
                    결과 보기 →
                  </button>
                </div>
              ))}
            </div>

            {/* 하이라이트 */}
            {highlights && (highlights.topStudent?.delta > 0 || highlights.topProblem?.avg > 0) && (
              <div style={s.highlightBar}>
                {highlights.topStudent && highlights.topStudent.delta > 0 && (
                  <span style={s.highlightItem}>
                    🔍 점수차 최대 학생: <b>{highlights.topStudent.row.student_name || highlights.topStudent.row.student_id || highlights.topStudent.row.filename}</b> ({fmt(highlights.topStudent.delta)}점)
                  </span>
                )}
                {highlights.topProblem && highlights.topProblem.avg > 0 && (
                  <span style={s.highlightItem}>
                    📌 가장 의견이 갈린 문항: <b>문제 {highlights.topProblem.pid}</b> (평균 {fmt(highlights.topProblem.avg)}점 차)
                  </span>
                )}
              </div>
            )}

            {/* 학생별 비교 테이블 */}
            <div style={s.tableCard}>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ ...th, width: 110 }}>학번</th>
                      <th style={{ ...th, width: 90 }}>이름</th>
                      {sessions.map((sess, si) => (
                        <th key={sess.meta.session_id} style={{ ...th, textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 11, color: si === 0 ? '#2563eb' : '#94a3b8', fontWeight: 700 }}>
                              {si === 0 ? '기준' : `비교 ${si}`}
                            </span>
                            <ModelBadge model={sess.meta.grading_model} label={modelLabels[sess.meta.grading_model]} />
                            {sess.meta.subject_item_name && (
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sess.meta.subject_item_name}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map(({ row }) => {
                      const isOpen = expanded.has(row.filename);
                      const baseVal = getTotal(row.perSession[0]);
                      return (
                        <React.Fragment key={row.filename}>
                          <tr
                            style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff' }}
                            onClick={() => toggleExpand(row.filename)}
                          >
                            <td style={td}>
                              <span style={{ marginRight: 6, fontSize: 11, color: '#94a3b8' }}>{isOpen ? '▾' : '▸'}</span>
                              {row.student_id || row.filename}
                            </td>
                            <td style={td}>{row.student_name || '-'}</td>
                            {row.perSession.map((cell, si) => {
                              if (!cell) {
                                return <td key={si} style={{ ...td, textAlign: 'center', color: '#cbd5e1' }}>—</td>;
                              }
                              const val = getTotal(cell);
                              const other = getOtherTotal(cell);
                              const revised = round2(val) !== round2(other);
                              const delta = si > 0 && baseVal !== null ? val - baseVal : null;
                              return (
                                <td key={si} style={{ ...td, textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{fmt(val)}</span>
                                      {delta !== null && <DeltaBadge value={delta} />}
                                    </div>
                                    {revised && (
                                      <span style={s.revisedSub}>
                                        ✏ {basis === 'ai' ? '수정 반영' : 'AI 원본'} {fmt(other)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={2 + sessions.length} style={s.detailCell}>
                                {(() => {
                                  const pidSet = [];
                                  row.perSession.forEach(cell => {
                                    if (!cell) return;
                                    const stu = basis === 'ai' ? cell.ai : cell.final;
                                    (stu.problems || []).forEach(p => {
                                      const pid = String(p.problem_id);
                                      if (!pidSet.includes(pid)) pidSet.push(pid);
                                    });
                                  });
                                  return pidSet.map(pid => (
                                    <ProblemCompare key={pid} pid={pid} cells={row.perSession} basis={basis} />
                                  ));
                                })()}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const th = { padding: '11px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' };
const td = { padding: '12px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle', textAlign: 'center' };

// 펼침 상세(문항 비교) 스타일
const dt = {
  problemBlock: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '14px 16px', marginBottom: 12,
  },
  problemTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 },
  problemFull: { fontSize: 12, fontWeight: 500, color: '#94a3b8' },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 10 },
  th: {
    padding: '6px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600,
    color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
  },
  td: { padding: '6px 10px', textAlign: 'center', fontSize: 13, color: '#374151', borderBottom: '1px solid #f8fafc' },
  tdItem: {
    padding: '6px 10px', textAlign: 'center', fontSize: 12.5, color: '#374151',
    borderBottom: '1px solid #f8fafc', maxWidth: 320,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  itemMax: { color: '#94a3b8', fontSize: 11 },
  feedbackGrid: { display: 'grid', gap: 8, marginTop: 4 },
  feedbackCell: {
    background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8,
    padding: '8px 10px', fontSize: 12.5,
  },
  feedbackText: { color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  profFeedback: {
    marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0',
    color: '#b45309', fontSize: 12, lineHeight: 1.5,
  },
};

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  header: {
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '0 32px', height: 64, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  userName: { fontSize: 14, color: '#64748b' },
  logoutBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, color: '#64748b' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  pageTitleRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 },

  infoBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 20, flexWrap: 'wrap',
  },
  subjectName: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  itemName: { fontSize: 15, fontWeight: 600, color: '#059669' },
  sessionCount: { fontSize: 13, color: '#94a3b8', background: '#f1f5f9', borderRadius: 20, padding: '2px 10px', marginLeft: 10 },
  maxTotal: { fontSize: 13, color: '#64748b', marginLeft: 8 },
  controls: { display: 'flex', alignItems: 'center', gap: 10 },
  segmentWrap: {
    display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2,
  },
  segment: {
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 13, color: '#64748b', cursor: 'pointer', fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  segmentActive: {
    background: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap',
  },
  select: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer',
  },
  notice: {
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 12,
  },
  noticeBlue: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
    borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 12,
  },

  cardGrid: { display: 'grid', gap: 14, marginBottom: 20 },
  card: {
    background: '#fff', borderRadius: 12, padding: '16px 18px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardBase: {
    background: '#fff', borderRadius: 12, padding: '16px 18px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8,
    border: '1.5px solid #bfdbfe',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardSubject: { fontSize: 13, fontWeight: 700, color: '#1e293b' },
  cardItem: { fontWeight: 600, color: '#059669' },
  setBaseBtn: {
    marginLeft: 'auto', background: '#eff6ff', color: '#2563eb',
    border: '1px solid #bfdbfe', borderRadius: 6,
    padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  dragHint: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  roleTag: {
    fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9',
    borderRadius: 4, padding: '2px 8px',
  },
  roleTagBase: {
    fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff',
    borderRadius: 4, padding: '2px 8px',
  },
  cardDate: { fontSize: 12, color: '#94a3b8' },
  cardStats: { display: 'flex', gap: 16 },
  cardStat: { display: 'flex', flexDirection: 'column', gap: 2 },
  cardStatLabel: { fontSize: 11, color: '#94a3b8' },
  cardStatValue: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  cardDelta: { fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 },
  cardRevision: { fontSize: 12, color: '#b45309' },
  cardLink: {
    marginTop: 'auto', alignSelf: 'flex-start',
    background: 'none', border: 'none', color: '#2563eb',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
  },

  highlightBar: {
    background: '#fff', borderRadius: 12, padding: '12px 18px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20,
    display: 'flex', gap: 24, flexWrap: 'wrap',
  },
  highlightItem: { fontSize: 13, color: '#374151' },

  tableCard: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  revisedSub: { fontSize: 11, color: '#b45309', whiteSpace: 'nowrap' },
  detailCell: { padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' },

  empty: { textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  primaryBtn: { marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  /* 세션 선택 화면 */
  pickGroup: { marginBottom: 24 },
  pickSubject: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
  regradeBadge: {
    fontSize: 11, background: '#eff6ff', color: '#2563eb',
    borderRadius: 4, padding: '2px 6px', fontWeight: 700, whiteSpace: 'nowrap',
  },
  viewBtn: {
    background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6,
    padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
  },
  pickBar: {
    position: 'sticky', top: 16, zIndex: 50, marginBottom: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 12, padding: '12px 20px',
    boxShadow: '0 4px 20px rgba(15,23,42,0.15)', border: '1px solid #e2e8f0',
  },
  pickCount: { fontSize: 14, fontWeight: 600, color: '#374151' },
  pickStartBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  pickStartBtnDisabled: {
    background: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
  },
};
