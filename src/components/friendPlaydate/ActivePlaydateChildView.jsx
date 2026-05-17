// src/components/friendPlaydate/ActivePlaydateChildView.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';
import { appToast } from '../../lib/appToast.js';

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
      appToast('종료에 실패했어요. 다시 해줘');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hyeni-tool hyeni-tool--friend" style={{ textAlign: 'center' }}>
      <article className="hyeni-tool-card hyeni-tool-card--accent" style={{ paddingTop: 22 }}>
        <span className="hyeni-tool-card__rule" aria-hidden="true" />
        <span className="hyeni-tool-card__kicker">놀이 중</span>
        <h2 className="hyeni-tool-card__title" style={{ fontSize: 22 }}>
          {friend}와 놀고 있어요
        </h2>
        <p className="hyeni-tool-card__sub" style={{ fontSize: 13 }}>
          {formatTime(session.started_at)} 시작
        </p>
      </article>
      <button
        type="button"
        onClick={handleStop}
        disabled={busy}
        aria-label="그만 놀래요"
        className="hyeni-tool-button"
      >
        <span className="hyeni-tool-button__label">그만 놀래요</span>
      </button>
    </section>
  );
}
