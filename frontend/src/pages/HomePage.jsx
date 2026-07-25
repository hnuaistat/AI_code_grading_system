import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useSubjectFilter } from '../components/AppLayout';
import { dashboardAPI, gradingAPI } from '../services/api';
import { formatDate, StatusBadge } from '../components/sessionUi';
import { useCached, CACHE_KEYS } from '../services/dataCache';

const fmtPct = v => (v === null || v === undefined ? '—' : `${v}%`);

const FIELD_LABEL = {
  obtained_score: '문제 점수',
  partial_score: '세부 점수',
  professor_feedback: '교수 코멘트',
};

function shortValue(v) {
  const str = String(v ?? '—');
  return str.length > 40 ? `${str.slice(0, 40)}…` : str;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const filter = useSubjectFilter();

  const filtering = filter.subject !== 'all';

  // 인사말만 보여주는 상태에서는 데이터를 받아올 필요가 없다 (enabled: filtering)
  const { data: summary, loading: loadingSummary } = useCached(
    CACHE_KEYS.dashboard, dashboardAPI.summary, { enabled: filtering }
  );
  const { data: revisions, loading: loadingRev } = useCached(
    CACHE_KEYS.revisions, gradingAPI.getAllRevisions, { enabled: filtering, fallback: [] }
  );

  const sessions = useMemo(() => summary?.sessions || [], [summary]);
  const loading = loadingSummary || loadingRev;

  // 과목/세부 항목이 사이드바 필터와 맞는 항목만 남긴다
  const matches = useCallback((subjectName, itemName) => {
    if (filter.subject !== 'all' && subjectName !== filter.subject) return false;
    if (filter.item !== 'all' && itemName !== filter.item) return false;
    return true;
  }, [filter.subject, filter.item]);

  const mySessions = useMemo(
    () => sessions.filter(x => matches(x.subject_name, x.subject_item_name)),
    [sessions, matches]
  );
  const myRevisions = useMemo(
    () => revisions.filter(r => matches(r.subject_name, r.subject_item_name)),
    [revisions, matches]
  );

  /* 비교 후보: 완료된 세션 2개 이상이면 최근 2개를 제안 */
  const comparable = useMemo(
    () => mySessions.filter(s => s.status === 'completed'),
    [mySessions]
  );

  const avgPct = useMemo(() => {
    const list = comparable.map(s => s.avg_pct).filter(v => v !== null && v !== undefined);
    if (!list.length) return null;
    return Math.round(list.reduce((a, b) => a + b, 0) / list.length * 10) / 10;
  }, [comparable]);

  const title = filter.item !== 'all'
    ? `${filter.subject} · ${filter.item}`
    : filter.subject;

  /* ── 필터 없음: 인사말만 ── */
  if (!filtering) {
    return (
      <div style={s.page}>
        <main style={s.centerMain}>
          <div style={s.greetWrap}>
            <div style={s.glow} />
            <h1 style={s.greeting}>
              {/* name은 신규 가입자만 보유 — 기존 계정은 프로필 보완 전까지 username으로 표시 */}
              {(user?.name || user?.username) ? `${user.name || user.username}님 반갑습니다` : '반갑습니다'}
            </h1>
            <p style={s.greetHint}>
              왼쪽 사이드바의 <strong>과목 필터</strong>에서 과목을 선택하면
              채점 기록 · 수정 로그 · 채점 비교를 한눈에 볼 수 있습니다.
            </p>
            <button style={s.greetBtn} onClick={() => navigate('/upload')}>
              새 채점 시작하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ── 필터 있음: 해당 과목 요약 ── */
  return (
    <div style={s.page}>
      <main style={s.main}>
        <div style={s.headRow}>
          <div>
            <h1 style={s.pageTitle}>{title}</h1>
            <p style={s.pageSub}>
              {loading ? '불러오는 중...' : (
                <>
                  채점 {mySessions.length}회 · 수정 {myRevisions.length}건
                  {avgPct !== null && <> · 평균 {fmtPct(avgPct)} (100점 환산)</>}
                </>
              )}
            </p>
          </div>
          {comparable.length >= 2 && (
            <button
              style={s.primaryBtn}
              onClick={() => navigate(
                `/compare?ids=${comparable.slice(0, 2).map(x => x.session_id).reverse().join(',')}`
              )}
              title="가장 최근 완료된 채점 2회를 비교합니다"
            >
              ⚖️ 최근 2회 비교
            </button>
          )}
        </div>

        {loading ? (
          <div style={s.empty} role="status" aria-live="polite">
            <div style={s.spinner} />
            <p style={s.emptyTitle}>채점 기록을 불러오는 중입니다</p>
          </div>
        ) : mySessions.length === 0 && myRevisions.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={s.emptyTitle}>‘{title}’에 해당하는 채점 기록이 없습니다</p>
            <p style={s.emptyDesc}>
              사이드바에서 다른 과목·세부 항목을 고르거나, 이 과목의 첫 채점을 시작하세요.
            </p>
            <button style={s.primaryBtn} onClick={() => navigate('/upload')}>
              새 채점 시작하기
            </button>
          </div>
        ) : (
          <div style={s.grid}>
            {/* 채점 기록 */}
            <section style={s.card}>
              <div style={s.cardHead}>
                <h3 style={s.cardTitle}>📚 채점 기록</h3>
                <button style={s.linkBtn} onClick={() => navigate('/history')}>전체 →</button>
              </div>
              {mySessions.length === 0 ? (
                <div style={s.emptySmall}>
                  <p style={s.emptySmallText}>이 과목의 채점 기록이 없습니다</p>
                  <button style={s.emptySmallBtn} onClick={() => navigate('/upload')}>
                    새 채점 시작하기 →
                  </button>
                </div>
              ) : (
                /* 좁은 화면에서 표가 카드를 밀어내지 않도록 가로 스크롤로 감싼다 */
                <div style={s.tableScroll}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>날짜</th>
                        <th style={s.th}>세부 항목</th>
                        <th style={s.th}>상태</th>
                        <th style={s.th}>평균</th>
                        <th style={{ ...s.th, width: 60 }}>결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySessions.slice(0, 6).map(r => (
                        <tr key={r.session_id}>
                          <td style={{ ...s.td, ...s.tdNum }}>{formatDate(r.created_at)}</td>
                          <td style={s.td}>{r.subject_item_name || '—'}</td>
                          <td style={s.td}><StatusBadge status={r.status} /></td>
                          <td style={{ ...s.td, ...s.tdNum }}>
                            {r.avg_score === null || r.avg_score === undefined ? '—' : (
                              <>
                                <strong>{r.avg_score}</strong>
                                {r.max_total_score ? `/${r.max_total_score}` : ''}
                              </>
                            )}
                          </td>
                          <td style={s.td}>
                            <button style={s.smallBtn}
                              onClick={() => navigate(`/dashboard/${r.session_id}`)}
                              title="이 채점 결과 화면 열기">
                              보기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 수정 로그 */}
            <section style={s.card}>
              <div style={s.cardHead}>
                <h3 style={s.cardTitle}>📝 수정 로그</h3>
                <button style={s.linkBtn} onClick={() => navigate('/revisions')}>전체 →</button>
              </div>
              {myRevisions.length === 0 ? (
                <div style={s.emptySmall}>
                  <p style={s.emptySmallText}>AI 채점 결과를 수정한 내역이 없습니다</p>
                  <p style={s.emptySmallSub}>
                    채점 결과 화면에서 점수나 코멘트를 고치면 여기에 기록됩니다
                  </p>
                </div>
              ) : (
                <div>
                  {myRevisions.slice(0, 5).map(log => (
                    <button key={log.id} type="button" style={s.logRow}
                      title={`${log.old_value ?? '(없음)'} → ${log.new_value ?? '(없음)'}`}
                      onClick={() => navigate(`/dashboard/${log.session_id}`)}>
                      <div style={s.logTop}>
                        <span style={s.fieldTag}>{FIELD_LABEL[log.field_name] || log.field_name}</span>
                        <span style={s.dim}>{log.student_filename} · {log.problem_id}</span>
                      </div>
                      <div style={s.logDiff}>
                        <span style={s.oldVal}>{shortValue(log.old_value)}</span>
                        <span style={s.arrow}>→</span>
                        <span style={s.newVal}>{shortValue(log.new_value)}</span>
                      </div>
                    </button>
                  ))}
                  {myRevisions.length > 5 && (
                    <button style={s.moreHint} onClick={() => navigate('/revisions')}>
                      외 {myRevisions.length - 5}건 모두 보기 →
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* 채점 비교 */}
            <section style={{ ...s.card, gridColumn: '1 / -1' }}>
              <div style={s.cardHead}>
                <h3 style={s.cardTitle}>⚖️ 채점 비교</h3>
                <button style={s.linkBtn} onClick={() => navigate('/compare')}>직접 고르기 →</button>
              </div>
              {comparable.length < 2 ? (
                <div style={s.emptySmall}>
                  <p style={s.emptySmallText}>
                    완료된 채점이 2회 이상이어야 비교할 수 있습니다 (현재 {comparable.length}회)
                  </p>
                  <button style={s.emptySmallBtn} onClick={() => navigate('/upload')}>
                    새 채점 시작하기 →
                  </button>
                </div>
              ) : (
                <div style={s.compareWrap}>
                  {comparable.slice(0, 4).map(c => (
                    <button key={c.session_id} type="button" style={s.compareCard}
                      onClick={() => navigate(`/dashboard/${c.session_id}`)}
                      title="이 채점 결과 화면 열기">
                      <div style={s.compareItem}>{c.subject_item_name || '세부 항목 없음'}</div>
                      <div style={s.compareAvg}>
                        평균 {c.avg_score}
                        <span style={s.compareFull}>
                          {c.max_total_score ? ` / ${c.max_total_score}점` : ''}
                        </span>
                      </div>
                      <div style={s.compareMeta}>학생 {c.graded_students}명</div>
                      <div style={s.compareMeta}>{formatDate(c.created_at)}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  centerMain: {
    maxWidth: 1100, margin: '0 auto', padding: '32px 24px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', minHeight: '70vh',
  },
  /* 그라데이션 원을 제목 뒤에 절대 배치하고, 인사말·안내·버튼은 일반 흐름으로 쌓는다.
     (이전에는 원을 피하려고 안내문에 marginTop:150 임의값을 줬었다) */
  greetWrap: {
    position: 'relative', textAlign: 'center', maxWidth: 480,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  greeting: {
    position: 'relative', zIndex: 1,
    fontSize: 32, fontWeight: 700, color: '#1e293b', margin: 0,
    lineHeight: 1.3, letterSpacing: '-0.5px',
  },
  glow: {
    position: 'absolute', left: '50%', top: 0,
    transform: 'translate(-50%, -40%)',
    width: 320, height: 320, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(37,99,235,0.30) 0%, rgba(59,130,246,0.14) 40%, rgba(59,130,246,0) 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  greetHint: {
    position: 'relative', zIndex: 1,
    marginTop: 16, fontSize: 14, color: '#475569',
    lineHeight: 1.6, textAlign: 'center',
  },
  greetBtn: {
    position: 'relative', zIndex: 1, marginTop: 24,
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  headRow: {
    display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 16, marginBottom: 20,
  },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 4px', lineHeight: 1.3 },
  pageSub: { fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 },
  primaryBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  // 카드 폭이 420px 아래로 내려가면 자동으로 1열이 된다 (좁은 화면 대응)
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 16, alignItems: 'start',
  },
  card: {
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    minWidth: 0,
  },
  cardHead: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0, lineHeight: 1.3 },
  linkBtn: {
    background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer',
    fontSize: 13, color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap',
    margin: '-8px -4px', // 클릭 영역만 넓히고 시각적 위치는 유지
  },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  // 채점 기록 표는 헤더·셀 모두 가운데 정렬로 맞춘다
  th: {
    textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b',
    padding: '8px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 8px', borderBottom: '1px solid #f1f5f9',
    color: '#1e293b', verticalAlign: 'middle', textAlign: 'center',
    lineHeight: 1.5,
  },
  // 가운데 정렬이라 자릿수가 흔들려 보이므로 등폭 숫자로 완화
  tdNum: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  dim: {
    color: '#64748b', fontSize: 12, minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  smallBtn: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, fontWeight: 600,
    color: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  logRow: {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9',
    padding: '10px 4px', cursor: 'pointer', font: 'inherit',
  },
  logTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  fieldTag: {
    background: '#eff6ff', color: '#1d4ed8', borderRadius: 5,
    padding: '2px 8px', fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  // 이전값/이후값을 한 줄에 나란히 두되, 좁아지면 각자 ellipsis 되도록 minWidth:0
  logDiff: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  oldVal: {
    background: '#fef2f2', color: '#b91c1c', borderRadius: 5,
    padding: '3px 8px', minWidth: 0, flexShrink: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  newVal: {
    background: '#f0fdf4', color: '#15803d', borderRadius: 5,
    padding: '3px 8px', minWidth: 0, flexShrink: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  arrow: { color: '#94a3b8', flexShrink: 0 },
  moreHint: {
    display: 'block', width: '100%', background: 'none', border: 'none',
    fontSize: 13, fontWeight: 600, color: '#2563eb',
    padding: '10px 0 4px', textAlign: 'center', cursor: 'pointer',
  },
  compareWrap: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  compareCard: {
    flex: '1 1 180px', minWidth: 0, background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px',
    textAlign: 'left', cursor: 'pointer', font: 'inherit',
  },
  compareItem: {
    fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  compareAvg: {
    fontSize: 20, fontWeight: 700, color: '#2563eb', marginBottom: 8,
    whiteSpace: 'nowrap', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums',
  },
  // 만점 표기는 평균값보다 약하게 두되 본문 대비(4.5:1)는 지킨다
  compareFull: { fontSize: 14, fontWeight: 600, color: '#64748b' },
  compareMeta: { fontSize: 13, color: '#64748b', lineHeight: 1.6 },
  empty: {
    background: '#fff', borderRadius: 12, padding: '48px 24px',
    textAlign: 'center', color: '#64748b',
    border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  spinner: {
    width: 28, height: 28, margin: '0 auto 16px', borderRadius: '50%',
    border: '3px solid #e2e8f0', borderTopColor: '#2563eb',
    animation: 'spin 0.8s linear infinite',
  },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: '#334155', margin: '0 0 8px', lineHeight: 1.5 },
  emptyDesc: { fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 },
  emptySmall: { padding: '20px 8px', textAlign: 'center' },
  emptySmallText: { fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 },
  emptySmallSub: { fontSize: 12, color: '#64748b', margin: '6px 0 0', lineHeight: 1.6 },
  emptySmallBtn: {
    marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
    color: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
