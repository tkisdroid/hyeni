// src/components/friendPlaydate/ActivePlaydateCard.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';

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
    if (!confirm(`${friendChild}와의 친구놀이를 정지하시겠어요?`)) return;
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
    <div style={{
      padding: 16, border: '2px solid #10b981', borderRadius: 12,
      backgroundColor: '#ecfdf5', marginBottom: 12,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        🎈 {placeName}에서 {friendChild}와 놀고 있어요
      </div>

      {phones.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            상대 부모 연락처
          </div>
          {phones.map((p) => (
            <a
              key={p}
              href={formatPhoneTel(p)}
              style={{
                display: 'inline-block', marginRight: 8, marginTop: 4,
                padding: '8px 16px', border: '1px solid #10b981', borderRadius: 8,
                backgroundColor: '#fff', color: '#065f46',
                textDecoration: 'none', fontSize: 14,
              }}
            >
              📞 {p}
            </a>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
          ⚠ 상대 가족 연락처가 등록되어 있지 않습니다
        </div>
      )}

      <button
        onClick={handleStop}
        disabled={busy}
        aria-label="친구놀이 정지"
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 8,
          backgroundColor: '#dc2626', color: '#fff', fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        🛑 정지
      </button>
    </div>
  );
}
