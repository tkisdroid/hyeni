// src/components/friendPlaydate/FriendPlaydateToggle.jsx
import { useState } from 'react';
import { setFamilyPlaydateEnabled } from '../../lib/friendPlaydate.js';

export default function FriendPlaydateToggle({ familyId, enabled, onChange }) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = !enabled;
      await setFamilyPlaydateEnabled(familyId, next);
      onChange?.(next);
    } catch (e) {
      console.error('[FriendPlaydateToggle]', e);
      alert('토글 변경에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>친구놀이 기능</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            양쪽 부모가 모두 켜야 작동합니다. 같은 안전장소의 다른 혜니 가족과 자녀가 매칭됩니다.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="친구놀이 기능 토글"
          disabled={busy}
          onClick={handleToggle}
          style={{
            width: 52, height: 28, borderRadius: 14,
            backgroundColor: enabled ? '#10b981' : '#d1d5db',
            border: 'none', cursor: busy ? 'wait' : 'pointer',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: enabled ? 26 : 2,
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: '#fff', transition: 'left 0.2s',
          }} />
        </button>
      </div>
    </div>
  );
}
