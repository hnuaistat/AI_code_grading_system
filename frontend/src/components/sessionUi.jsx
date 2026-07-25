/**
 * 채점 세션 관련 공용 표시 요소.
 * HistoryPage / ComparePage / HomePage가 함께 쓴다 (기존에는 페이지마다 복붙되어 있었음).
 */
import React from 'react';

/* 날짜/시간을 각각 nowrap으로 감싸 줄바꿈이 필요하면 날짜와 시간 사이에서만 일어나게 함 */
export function formatDate(iso) {
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

export function formatDuration(createdAt, completedAt) {
  if (!createdAt || !completedAt) return '-';
  const diffMs = new Date(completedAt) - new Date(createdAt);
  if (diffMs <= 0) return '-';
  const totalSec = Math.floor(diffMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
}

const STATUS_CFG = {
  completed:      { bg: '#dcfce7', color: '#16a34a', label: '완료' },
  running:        { bg: '#dbeafe', color: '#2563eb', label: '진행 중' },
  pending:        { bg: '#f1f5f9', color: '#64748b', label: '대기' },
  error:          { bg: '#fee2e2', color: '#dc2626', label: '오류' },
  cancelled:      { bg: '#fef3c7', color: '#b45309', label: '중단됨' },
  quota_exceeded: { bg: '#fee2e2', color: '#dc2626', label: '쿼터 초과' },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { bg: '#f1f5f9', color: '#64748b', label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20,
      padding: '3px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

export function ModelBadge({ model, label, maxWidth = '100px', verticalAlign }) {
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
        maxWidth, overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'inline-block', verticalAlign,
      }}
    >
      {displayName}
    </span>
  );
}

/**
 * 재채점 세션을 원본(루트) 바로 아래에 묶어 배치한다.
 * 반환: [{ session, isChild, inGroup, isGroupStart, isGroupEnd }]
 */
export function buildRegradeRows(sessions) {
  const idSet = new Set(sessions.map(s => s.session_id));
  const childrenMap = {};
  const roots = [];
  sessions.forEach(s => {
    if (s.regraded_from && idSet.has(s.regraded_from)) {
      (childrenMap[s.regraded_from] = childrenMap[s.regraded_from] || []).push(s);
    } else {
      roots.push(s);
    }
  });
  return roots.flatMap(r => {
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
}

/** 세션 배열을 과목명으로 그룹핑. 과목이 없으면 '과목 미지정'. */
export const NO_SUBJECT = '과목 미지정';

export function groupBySubject(sessions) {
  return sessions.reduce((acc, h) => {
    const key = h.subject_name || NO_SUBJECT;
    (acc[key] = acc[key] || []).push(h);
    return acc;
  }, {});
}
