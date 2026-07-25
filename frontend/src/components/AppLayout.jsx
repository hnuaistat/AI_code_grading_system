import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { subjectAPI } from '../services/api';
import ProfileCompleteModal from './ProfileCompleteModal';

// 페이지가 사이드바 가운데 구역에 내용을 렌더링할 수 있는 슬롯.
// 사용법: const slotNode = useSidebarSlot(); slotNode && createPortal(<내용 />, slotNode)
const SidebarSlotContext = createContext(null);
export function useSidebarSlot() { return useContext(SidebarSlotContext); }

/**
 * 사이드바에서 고른 과목/세부 항목 필터.
 * 채점 기록·수정 로그·채점 비교가 이 값을 함께 따른다.
 * 'all'이면 필터 없음.
 */
const SubjectFilterContext = createContext({ subject: 'all', item: 'all' });
export function useSubjectFilter() { return useContext(SubjectFilterContext); }

const NAV_ITEMS = [
  { path: '/home', icon: '🏠', label: '홈', match: p => p.startsWith('/home') },
  { path: '/upload', icon: '➕', label: '새 채점', match: p => p.startsWith('/upload') },
  { path: '/history', icon: '📚', label: '채점 기록', match: p => p.startsWith('/history') || p.startsWith('/dashboard') },
  { path: '/revisions', icon: '📝', label: '수정 로그', match: p => p.startsWith('/revisions') },
  { path: '/compare', icon: '⚖️', label: '채점 비교', match: p => p.startsWith('/compare') },
  { path: '/settings', icon: '⚙️', label: '설정', match: p => p.startsWith('/settings') },
];

const WIDE = 240;
const NARROW = 64;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 기본값은 접힘 — 사용자가 명시적으로 펼쳐 고정했을 때만 펼친 상태로 시작한다
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') !== '0');

  // 접힌 상태에서 마우스를 올리면 임시로 펼침 (마우스가 벗어나면 다시 접힘)
  const [hoverOpen, setHoverOpen] = useState(false);
  const [slotNode, setSlotNode] = useState(null);

  /* ── 과목 / 세부 항목 필터 ── */
  const [subjects, setSubjects] = useState([]);
  const [filterSubject, setFilterSubject] = useState(
    () => sessionStorage.getItem('nav_filter_subject') || 'all'
  );
  const [filterItem, setFilterItem] = useState(
    () => sessionStorage.getItem('nav_filter_item') || 'all'
  );

  useEffect(() => {
    subjectAPI.list()
      .then(res => setSubjects(res.data || []))
      .catch(() => setSubjects([]));
  }, []);

  // 새로고침해도 선택이 유지되도록 저장 (탭을 닫으면 초기화)
  useEffect(() => {
    sessionStorage.setItem('nav_filter_subject', filterSubject);
    sessionStorage.setItem('nav_filter_item', filterItem);
  }, [filterSubject, filterItem]);

  const selectedSubject = useMemo(
    () => subjects.find(s => s.name === filterSubject) || null,
    [subjects, filterSubject]
  );
  const itemOptions = selectedSubject?.items || [];

  const changeSubject = (name) => {
    setFilterSubject(name);
    setFilterItem('all'); // 과목이 바뀌면 이전 과목의 세부 항목은 무효
  };

  const filterValue = useMemo(
    () => ({ subject: filterSubject, item: filterItem }),
    [filterSubject, filterItem]
  );
  const filtering = filterSubject !== 'all';

  const open = !collapsed || hoverOpen;
  const overlaying = collapsed && hoverOpen; // 호버로 펼쳐진 상태 — 본문을 밀지 않고 위에 겹침

  const collapse = () => {
    localStorage.setItem('sidebar_collapsed', '1');
    setCollapsed(true);
    setHoverOpen(false);
  };
  const pinOpen = () => {
    localStorage.setItem('sidebar_collapsed', '0');
    setCollapsed(false);
    setHoverOpen(false);
  };

  const path = location.pathname;

  return (
    <SidebarSlotContext.Provider value={slotNode}>
     <SubjectFilterContext.Provider value={filterValue}>
      {/* 기존 계정 프로필 보완 안내 — 로그인 직후 어느 화면에서나 노출된다 */}
      <ProfileCompleteModal />
      <div style={s.shell}>
        {/* 본문 자리 확보용 스페이서 (호버 펼침 시에는 좁은 폭 유지 → 본문이 흔들리지 않음) */}
        <div style={{ width: collapsed ? NARROW : WIDE, flexShrink: 0, transition: 'width 0.15s ease' }} />

        <aside
          style={{
            ...s.sidebar,
            width: open ? WIDE : NARROW,
            boxShadow: overlaying ? '4px 0 20px rgba(15,23,42,0.12)' : 'none',
          }}
          onMouseEnter={() => { if (collapsed) setHoverOpen(true); }}
          onMouseLeave={() => setHoverOpen(false)}
        >
          <div style={{ ...s.logoRow, justifyContent: open ? 'space-between' : 'center' }}>
            <div style={s.logoClickable} onClick={() => navigate('/home')} title="AI 채점 조교">
              <span style={{ fontSize: 22 }}>📓</span>
              {open && <span style={s.logoText}>AI 채점 조교</span>}
            </div>
            {open && (
              <button
                style={s.collapseBtn}
                onClick={overlaying ? pinOpen : collapse}
                title={overlaying ? '사이드바 고정' : '사이드바 접기'}
              >
                {overlaying ? '📌' : '«'}
              </button>
            )}
          </div>

          {/* 과목 · 세부 항목 필터 — 채점 기록/수정 로그/채점 비교에 함께 적용된다 */}
          {open ? (
            <div style={s.filterBox}>
              <div style={s.filterHead}>
                <span style={s.filterTitle}>과목 필터</span>
                {filtering && (
                  <button style={s.filterClear}
                    onClick={() => changeSubject('all')}
                    title="필터 해제">해제</button>
                )}
              </div>
              <select
                style={{ ...s.filterSelect, ...(filtering ? s.filterSelectOn : null) }}
                value={filterSubject}
                onChange={e => changeSubject(e.target.value)}
              >
                <option value="all">전체 과목</option>
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}{sub.code ? ` (${sub.code})` : ''}
                  </option>
                ))}
              </select>
              <select
                style={{
                  ...s.filterSelect,
                  marginTop: 8,
                  opacity: itemOptions.length ? 1 : 0.55,
                  ...(filterItem !== 'all' ? s.filterSelectOn : null),
                }}
                value={filterItem}
                disabled={!itemOptions.length}
                onChange={e => setFilterItem(e.target.value)}
                title={
                  filterSubject === 'all' ? '과목을 먼저 선택하세요'
                    : itemOptions.length ? '' : '이 과목에는 세부 항목이 없습니다'
                }
              >
                <option value="all">전체 세부 항목</option>
                {itemOptions.map(it => (
                  <option key={it.id} value={it.name}>{it.name}</option>
                ))}
              </select>
              {filtering && (
                <div style={s.filterHint}>
                  ✓ 채점 기록 · 수정 로그 · 채점 비교에 적용 중
                </div>
              )}
            </div>
          ) : (
            // 접힌 상태에서도 필터가 걸려 있음을 알 수 있어야 한다 (점만으로는 약해서 라벨을 함께 둔다)
            filtering && (
              <div
                style={s.filterDotWrap}
                title={`과목 필터 적용 중: ${filterSubject}${filterItem !== 'all' ? ` / ${filterItem}` : ''}`}
              >
                <span style={s.filterDot} />
                <span style={s.filterDotLabel}>필터</span>
              </div>
            )
          )}

          <nav style={s.nav}>
            {NAV_ITEMS.map(item => {
              const active = item.match(path);
              return (
                <button
                  key={item.path}
                  style={{
                    ...(active ? s.navItemActive : s.navItem),
                    justifyContent: open ? 'flex-start' : 'center',
                    padding: open ? '12px 14px' : '12px 0',
                  }}
                  onClick={() => navigate(item.path)}
                  title={item.label}
                >
                  <span style={s.navIcon}>{item.icon}</span>
                  {open && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* 페이지별 컨텍스트 구역 */}
          {open && <div style={s.slotWrap} ref={setSlotNode} />}

          <div style={s.bottom}>
            {open && (
              <div style={s.userBox}>
                <span style={s.userName}>👤 {user?.name || user?.username}</span>
                {user?.role && <span style={s.userRole}>{user.role}</span>}
              </div>
            )}
            <button
              style={{ ...s.logoutBtn, padding: open ? '10px 14px' : '10px 0' }}
              onClick={logout}
              title="로그아웃"
            >
              {open ? '로그아웃' : '🚪'}
            </button>
          </div>
        </aside>

        <div style={s.content}>
          <Outlet />
        </div>
      </div>
     </SubjectFilterContext.Provider>
    </SidebarSlotContext.Provider>
  );
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: '#f8fafc' },
  sidebar: {
    position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 200,
    background: '#fff', borderRight: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column',
    padding: '16px 12px', boxSizing: 'border-box',
    transition: 'width 0.15s ease, box-shadow 0.15s ease',
    overflow: 'hidden',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '4px 6px 16px',
    borderBottom: '1px solid #f1f5f9', marginBottom: 12,
  },
  logoClickable: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 0 },
  logoText: { fontSize: 15, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' },
  filterBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: 12, marginBottom: 16,
  },
  filterHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  filterTitle: { fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.2px' },
  filterClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: '#2563eb', fontWeight: 600,
    padding: '6px 4px', margin: '-6px -4px', // 클릭 영역만 넓힘
  },
  filterSelect: {
    width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 8px', fontSize: 13, color: '#1e293b',
    background: '#fff', cursor: 'pointer',
  },
  filterSelectOn: { borderColor: '#93c5fd', color: '#1d4ed8', fontWeight: 600 },
  filterHint: {
    fontSize: 12, color: '#1d4ed8', marginTop: 8, lineHeight: 1.5,
  },
  filterDotWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, marginBottom: 12,
  },
  filterDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#2563eb',
    boxShadow: '0 0 0 3px rgba(37,99,235,0.18)',
  },
  filterDotLabel: { fontSize: 10, fontWeight: 700, color: '#2563eb', letterSpacing: '0.2px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'none', border: 'none', borderRadius: 8,
    fontSize: 14, color: '#475569', cursor: 'pointer',
    textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 500,
  },
  navItemActive: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#eff6ff', border: 'none', borderRadius: 8,
    fontSize: 14, color: '#2563eb', cursor: 'pointer',
    textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 700,
  },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 },
  slotWrap: { flex: 1, overflowY: 'auto', marginTop: 16, minHeight: 0 },
  bottom: {
    marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #f1f5f9',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  userBox: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 4px', flexWrap: 'wrap' },
  userName: { fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11, color: '#475569', background: '#f1f5f9', borderRadius: 4, padding: '2px 6px' },
  logoutBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, color: '#475569', whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, color: '#64748b',
    padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1,
  },
  content: { flex: 1, minWidth: 0 },
};
