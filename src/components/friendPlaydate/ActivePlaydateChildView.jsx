// src/components/friendPlaydate/ActivePlaydateChildView.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function ActivePlaydateChildView({ session, onEnd }) {
  const [busy, setBusy] = useState(false);
  const friend = session?.friend_child_name ?? '친구';

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await endPlaydate(session.id, 'child_end');
      onEnd?.();
    } catch (e) {
      console.error('[ActivePlaydateChildView]', e);
      alert('종료에 실패했어요. 다시 시도해줘');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: 24, border: '2px solid #10b981', borderRadius: 12,
      backgroundColor: '#ecfdf5', marginBottom: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        🎈 {friend}와 놀고 있어요
      </div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
        ⏰ {formatTime(session.started_at)} 시작
      </div>
      <button
        onClick={handleStop}
        disabled={busy}
        aria-label="그만 놀래요"
        style={{
          width: '100%', padding: 16, fontSize: 18, fontWeight: 700,
          backgroundColor: '#dc2626', color: '#fff',
          border: 'none', borderRadius: 8,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        🛑 그만 놀래요
      </button>
    </div>
  );
}
