// src/components/friendPlaydate/FriendCandidateList.jsx
import { useState } from 'react';

export default function FriendCandidateList({ candidates, onStart, onCancel }) {
  const [selected, setSelected] = useState(null);

  if (!candidates || candidates.length === 0) {
    return (
      <section className="hyeni-tool hyeni-tool--friend">
        <article className="hyeni-tool-card">
          <h2 className="hyeni-tool-card__title">아직 친구가 없어요</h2>
          <p className="hyeni-tool-card__sub">
            지금 같은 곳에 친구가 없어요. 잠시 후 다시 봐 주세요!
          </p>
        </article>
        <button
          type="button"
          onClick={onCancel}
          className="hyeni-tool-button hyeni-tool-button--ghost hyeni-tool-button--small"
        >
          <span className="hyeni-tool-button__label">닫기</span>
        </button>
      </section>
    );
  }

  return (
    <section className="hyeni-tool hyeni-tool--friend">
      <article className="hyeni-tool-card">
        <h2 className="hyeni-tool-card__title">누구랑 놀고 싶어?</h2>
        <p className="hyeni-tool-card__sub">한 명을 골라 보세요.</p>
      </article>

      <ul className="hyeni-tool-list" aria-label="친구 후보">
        {candidates.map((c) => {
          const checked = selected?.child_user_id === c.child_user_id;
          return (
            <li
              key={c.child_user_id}
              className="hyeni-tool-list__row"
              style={
                checked
                  ? {
                      background: 'var(--hyeni-friend-tint)',
                      boxShadow: 'inset 3px 0 0 var(--hyeni-friend)',
                    }
                  : undefined
              }
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="friend"
                  value={c.child_user_id}
                  checked={checked}
                  onChange={() => setSelected(c)}
                  style={{ accentColor: 'var(--hyeni-friend)' }}
                />
                <span className="hyeni-tool-list__primary">{c.child_name ?? '친구'}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => onStart(selected)}
        disabled={!selected}
        aria-label="친구랑 놀래요 시작"
        className="hyeni-tool-button"
      >
        <span className="hyeni-tool-button__label">친구랑 놀래요</span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="hyeni-tool-button hyeni-tool-button--ghost hyeni-tool-button--small"
      >
        <span className="hyeni-tool-button__label">취소</span>
      </button>
    </section>
  );
}
