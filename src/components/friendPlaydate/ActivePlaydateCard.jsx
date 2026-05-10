// src/components/friendPlaydate/ActivePlaydateCard.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';
import { withParticle } from '../../lib/koreanParticle.js';

function formatPhoneTel(p) {
  return `tel:${p.replace(/[^\d+]/g, '')}`;
}

export default function ActivePlaydateCard({ session, onEnd }) {
  const [busy, setBusy] = useState(false);
  const phones = (session.friend_family_phones ?? []).filter(Boolean);
  const friendChild = session.friend_child_name ?? '친구';
  const placeName = session.place_name ?? '안전장소';

  const handleStop = async () => {
    if (busy) return;
    if (!confirm(`${withParticle(friendChild, '과', '와')}의 친구 만남을 정지하시겠어요?`)) return;
    setBusy(true);
    try {
      await endPlaydate(session.id, 'parent_end');
      onEnd?.();
    } catch (e) {
      console.error('[ActivePlaydateCard.stop]', e);
      alert('정지에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="hyeni-tool-card hyeni-tool-card--accent" style={{ display: 'grid', gap: 12 }}>
      <span className="hyeni-tool-card__rule" aria-hidden="true" />
      <div>
        <span className="hyeni-tool-card__kicker">진행 중</span>
        <h3 className="hyeni-tool-card__title">
          {placeName}에서 {friendChild}와 놀고 있어요
        </h3>
      </div>

      {phones.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{
            color: 'var(--fg-tertiary)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.02em',
          }}>
            상대 부모 연락처
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {phones.map((p) => (
              <a key={p} href={formatPhoneTel(p)} className="hyeni-tool-tel">
                📞 {p}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="hyeni-tool-status hyeni-tool-status--warn" role="status">
          <div className="hyeni-tool-status__body">
            상대 가족 연락처가 등록되어 있지 않아요.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleStop}
        disabled={busy}
        aria-label="정지 - 친구 만남 종료"
        className="hyeni-tool-button hyeni-tool-button--small"
      >
        <span className="hyeni-tool-button__label">정지</span>
      </button>
    </article>
  );
}
