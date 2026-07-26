import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../App';
import { invitationAPI } from '../services/api';

/**
 * 과목 공유 초대 안내.
 *
 * 로그인 후 대기 중인 초대가 있으면 띄운다. 수락해야 과목이 공유되므로
 * (본인 동의 없이 계정이 남의 과목에 묶이지 않도록) 여기서 수락/거절을 받는다.
 * 나중에 결정하고 싶으면 닫아도 되고, 다음 로그인 때 다시 안내한다.
 *
 * paused: 프로필 보완 모달이 떠 있는 동안 true. 두 모달이 겹쳐 뜨면 오버레이가
 * 이중으로 어두워지고 Esc 한 번에 둘 다 닫히므로, 프로필을 먼저 끝내게 미뤄둔다.
 */
export default function InvitationModal({ onAccepted, paused = false }) {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    invitationAPI.list()
      .then(res => { if (!cancelled) setInvitations(res.data || []); })
      .catch(() => { /* 안내용이므로 실패해도 조용히 넘어간다 */ });
    return () => { cancelled = true; };
  }, [user]);

  const open = !dismissed && !paused && invitations.length > 0;

  // 배경 스크롤 잠금 + Esc 로 닫기 (닫아도 다음 로그인 때 다시 뜬다)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && busyId === null) setDismissed(true); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busyId]);

  if (!open) return null;

  const respond = async (inv, accept) => {
    setBusyId(inv.id);
    setError('');
    try {
      if (accept) await invitationAPI.accept(inv.id);
      else await invitationAPI.decline(inv.id);
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
      // 수락한 과목이 즉시 목록에 나타나야 하므로 상위에서 재조회한다
      if (accept && onAccepted) onAccepted();
    } catch (e) {
      const d = e.response?.data?.detail;
      setError(typeof d === 'string' ? d : '처리에 실패했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={s.overlay} role="presentation">
      <div style={s.modal} role="dialog" aria-modal="true" aria-labelledby="inv-title">
        <div style={s.iconWrap}>
          <Users size={22} strokeWidth={2.5} />
        </div>
        <h3 id="inv-title" style={s.title}>
          과목 공유 초대가 도착했어요
          {invitations.length > 1 && ` (${invitations.length}건)`}
        </h3>
        <p style={s.desc}>
          수락하시면 해당 과목의 채점 결과를 함께 보고 채점에 참여하실 수 있어요.
          지금 결정하지 않으면 다음 로그인 때 다시 안내해 드립니다.
        </p>

        <ul style={s.list}>
          {invitations.map(inv => (
            <li key={inv.id} style={s.item}>
              <div style={s.itemInfo}>
                <span style={s.subjectName}>
                  {inv.subject_code ? `[${inv.subject_code}] ` : ''}{inv.subject_name}
                </span>
                <span style={s.inviter}>
                  {inv.invited_by_display || inv.invited_by_username} 님이 초대했습니다
                </span>
              </div>
              <div style={s.itemActions}>
                <button
                  style={busyId !== null ? { ...s.declineBtn, opacity: 0.5, cursor: 'default' } : s.declineBtn}
                  onClick={() => respond(inv, false)}
                  disabled={busyId !== null}
                >
                  거절
                </button>
                <button
                  style={busyId !== null ? { ...s.acceptBtn, opacity: 0.5, cursor: 'default' } : s.acceptBtn}
                  onClick={() => respond(inv, true)}
                  disabled={busyId !== null}
                >
                  {busyId === inv.id ? '처리 중...' : '수락'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {error && <div style={s.error} role="alert">{error}</div>}

        <div style={s.footer}>
          <button style={s.laterBtn} onClick={() => setDismissed(true)} disabled={busyId !== null}>
            나중에 결정할게요
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 24,
    width: '100%', maxWidth: 460, boxSizing: 'border-box',
    maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
    boxShadow: '0 12px 32px rgba(15,23,42,0.2)',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: '#1e293b', margin: '0 0 8px' },
  desc: { fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '0 0 16px' },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap',
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px',
  },
  itemInfo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140, flex: 1 },
  subjectName: { fontSize: 14, fontWeight: 700, color: '#1e293b', lineHeight: 1.4, wordBreak: 'break-all' },
  inviter: { fontSize: 13, color: '#475569', lineHeight: 1.5 },
  itemActions: { display: 'flex', gap: 8, flexShrink: 0 },
  acceptBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    minHeight: 40, whiteSpace: 'nowrap',
  },
  declineBtn: {
    background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    minHeight: 40, whiteSpace: 'nowrap',
  },
  error: {
    fontSize: 13, color: '#b91c1c', lineHeight: 1.5, marginTop: 12,
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', marginTop: 16 },
  laterBtn: {
    background: 'none', border: 'none', color: '#475569', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', padding: '10px 8px', minHeight: 40, borderRadius: 6,
  },
};
