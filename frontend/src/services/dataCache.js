/**
 * 페이지 간 공유 데이터 캐시 (stale-while-revalidate).
 *
 * 채점 기록·수정 로그처럼 여러 화면이 같은 목록을 쓰는데, 지금까지는 페이지를
 * 옮길 때마다 처음부터 다시 불러오느라 매번 빈 화면 + 로딩이 떴다.
 * 캐시가 있으면 이전 값을 즉시 보여주고, 뒤에서 조용히 새로 받아 교체한다.
 *
 * 사용:
 *   const { data, loading, refresh } = useCached('history', gradingAPI.getHistory);
 *   - 첫 방문: loading=true (표시할 게 없으므로)
 *   - 재방문:  loading=false + 캐시된 data 즉시 반환, 백그라운드 갱신
 *   - 쓰기 작업 후에는 invalidate(key)로 캐시를 버린다.
 */
import { useCallback, useEffect, useState } from 'react';

const store = new Map();      // key -> { data, at }
const inflight = new Map();   // key -> Promise (같은 키 중복 요청 합치기)
const listeners = new Map();  // key -> Set<fn>

/** 이 시간이 지난 캐시는 화면에 먼저 보여주되 곧바로 재검증한다 */
const STALE_MS = 30_000;

function notify(key, entry) {
  const set = listeners.get(key);
  if (set) set.forEach(fn => fn(entry));
}

/** 캐시를 버린다. 세션 삭제·재채점·점수 수정 등 쓰기 작업 후에 호출. */
export function invalidate(...keys) {
  if (!keys.length) {
    store.clear();
    listeners.forEach((set, k) => set.forEach(fn => fn(undefined)));
    return;
  }
  keys.forEach(k => {
    store.delete(k);
    notify(k, undefined);
  });
}

/** 로그아웃 시 다른 계정 데이터가 남지 않도록 전부 비운다. */
export function clearCache() {
  store.clear();
  inflight.clear();
}

function fetchAndStore(key, fetcher) {
  // 같은 키로 이미 요청이 떠 있으면 그걸 재사용 (중복 호출 방지)
  if (inflight.has(key)) return inflight.get(key);

  const p = Promise.resolve()
    .then(fetcher)
    .then(res => {
      const entry = { data: res?.data, at: Date.now() };
      store.set(key, entry);
      notify(key, entry);
      return entry;
    })
    .catch(err => {
      // 실패해도 기존 캐시는 유지한다 (빈 화면으로 되돌리지 않음)
      notify(key, store.get(key));
      throw err;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/**
 * @param key      캐시 키
 * @param fetcher  () => Promise<AxiosResponse>
 * @param options  { enabled?: boolean, fallback?: any }
 */
export function useCached(key, fetcher, options = {}) {
  const { enabled = true, fallback = null } = options;

  const cached = store.get(key);
  const [entry, setEntry] = useState(cached);
  // 보여줄 값이 아직 없을 때만 로딩으로 취급한다 — 재방문 시 화면이 깜빡이지 않는다
  const [loading, setLoading] = useState(!cached && enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let alive = true;
    const listener = (e) => { if (alive) setEntry(e); };
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(listener);

    const current = store.get(key);
    const fresh = current && (Date.now() - current.at) < STALE_MS;

    if (current) {
      setEntry(current);
      setLoading(false);
    }
    if (!fresh) {
      if (!current) setLoading(true);
      fetchAndStore(key, fetcher)
        .then(() => { if (alive) setError(null); })
        .catch(e => { if (alive) setError(e); })
        .finally(() => { if (alive) setLoading(false); });
    }

    return () => {
      alive = false;
      listeners.get(key)?.delete(listener);
    };
    // fetcher는 매 렌더 새 함수일 수 있어 의존성에서 뺀다 (key가 정체성을 결정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  /** 강제로 다시 불러온다 (사용자가 새로고침 버튼을 눌렀을 때 등) */
  const refresh = useCallback(() => {
    store.delete(key);
    setLoading(!store.get(key));
    return fetchAndStore(key, fetcher)
      .catch(e => { setError(e); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: entry?.data ?? fallback,
    loading,
    error,
    refresh,
    isStale: entry ? (Date.now() - entry.at) >= STALE_MS : false,
  };
}

/* 자주 쓰는 키 — 오타로 캐시가 갈리지 않게 상수로 둔다 */
export const CACHE_KEYS = {
  history: 'grading:history',
  revisions: 'grading:all-revisions',
  subjects: 'subjects',
  models: 'grading:available-models',
  dashboard: 'dashboard:summary',
};
