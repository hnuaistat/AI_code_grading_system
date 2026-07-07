import React, { createContext, useContext, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';

// 페이지가 사이드바 가운데 구역에 내용을 렌더링할 수 있는 슬롯.
// 사용법: const slotNode = useSidebarSlot(); slotNode && createPortal(<내용 />, slotNode)
const SidebarSlotContext = createContext(null);
export function useSidebarSlot() { return useContext(SidebarSlotContext); }

const NAV_ITEMS = [
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');
  // 접힌 상태에서 마우스를 올리면 임시로 펼침 (마우스가 벗어나면 다시 접힘)
  const [hoverOpen, setHoverOpen] = useState(false);
  const [slotNode, setSlotNode] = useState(null);

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
            <div style={s.logoClickable} onClick={() => navigate('/upload')} title="AI 채점 조교">
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

          <nav style={s.nav}>
            {NAV_ITEMS.map(item => {
              const active = item.match(path);
              return (
                <button
                  key={item.path}
                  style={{
                    ...(active ? s.navItemActive : s.navItem),
                    justifyContent: open ? 'flex-start' : 'center',
                    padding: open ? '10px 14px' : '10px 0',
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
                <span style={s.userName}>👤 {user?.username}</span>
                {user?.role && <span style={s.userRole}>{user.role}</span>}
              </div>
            )}
            <button
              style={{ ...s.logoutBtn, padding: open ? '8px 14px' : '8px 0' }}
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
  userRole: { fontSize: 11, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 6px' },
  logoutBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, color: '#94a3b8',
    padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0,
  },
  content: { flex: 1, minWidth: 0 },
};
