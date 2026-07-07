// 브라우저 알림 (채점 완료 등). 설정은 localStorage에 저장.
const PREF_KEY = 'notify_browser';

export function getNotifyPref() {
  return localStorage.getItem(PREF_KEY) === '1';
}

export function setNotifyPref(on) {
  localStorage.setItem(PREF_KEY, on ? '1' : '0');
}

// 알림 차임 소리 (Web Audio — 두 음 딩동, 별도 파일 불필요)
// 주의: 브라우저 자동재생 정책상 페이지와 한 번도 상호작용하지 않은 탭에서는 소리가 안 날 수 있음
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = () => {
      const now = ctx.currentTime;
      [[880, 0], [1174.66, 0.18]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.2, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.55);
      });
      setTimeout(() => { ctx.close().catch(() => {}); }, 1500);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => { ctx.close().catch(() => {}); });
    } else {
      play();
    }
  } catch { /* 소리 실패는 알림 자체를 막지 않음 */ }
}

// force: 설정과 무관하게 발송 (설정 페이지의 테스트 버튼용)
export function sendBrowserNotification(title, body, { force = false } = {}) {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  if (!force && !getNotifyPref()) return false;
  try {
    const n = new Notification(title, { body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    playChime();
    return true;
  } catch {
    return false;
  }
}
