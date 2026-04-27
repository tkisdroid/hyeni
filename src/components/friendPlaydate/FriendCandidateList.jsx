// src/components/friendPlaydate/FriendCandidateList.jsx
import { useState } from 'react';

export default function FriendCandidateList({ candidates, onStart, onCancel }) {
  const [selected, setSelected] = useState(null);

  if (!candidates || candidates.length === 0) {
    return (
      <div>
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
          지금 같은 곳에 친구가 없어요. 잠시 후 다시 봐요!
        </div>
        <button onClick={onCancel} style={{ width: '100%', padding: 12, marginTop: 8 }}>
          닫기
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>누구랑 놀고 싶어?</div>
      {candidates.map((c) => (
        <label
          key={c.child_user_id}
          style={{
            display: 'flex', alignItems: 'center', padding: 12,
            border: selected?.child_user_id === c.child_user_id ? '2px solid #10b981' : '1px solid #e5e7eb',
            borderRadius: 8, marginBottom: 8, cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="friend"
            value={c.child_user_id}
            checked={selected?.child_user_id === c.child_user_id}
            onChange={() => setSelected(c)}
            style={{ marginRight: 8 }}
          />
          <span>{c.child_name ?? '친구'}</span>
        </label>
      ))}
      <button
        onClick={() => onStart(selected)}
        disabled={!selected}
        aria-label="친구랑 놀래요 시작"
        style={{
          width: '100%', padding: 16, marginTop: 12,
          backgroundColor: selected ? '#10b981' : '#9ca3af',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 18, fontWeight: 700,
          cursor: selected ? 'pointer' : 'not-allowed',
        }}
      >
        🤝 친구랑 놀래요
      </button>
      <button
        onClick={onCancel}
        style={{ width: '100%', padding: 8, marginTop: 8, background: 'none', border: '1px solid #e5e7eb', borderRadius: 8 }}
      >
        취소
      </button>
    </div>
  );
}
