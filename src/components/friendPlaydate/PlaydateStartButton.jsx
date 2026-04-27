// src/components/friendPlaydate/PlaydateStartButton.jsx
export default function PlaydateStartButton({ inSafePlace, onClick }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={onClick}
        disabled={!inSafePlace}
        style={{
          width: '100%', padding: '20px 16px', borderRadius: 12,
          backgroundColor: inSafePlace ? '#10b981' : '#9ca3af',
          color: '#fff', fontSize: 22, fontWeight: 700,
          border: 'none', cursor: inSafePlace ? 'pointer' : 'not-allowed',
        }}
        aria-label="친구랑 놀래요"
      >
        🤝 친구랑 놀래요
      </button>
      {!inSafePlace && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
          친구놀이는 학교·공원처럼 등록된 곳에서만 시작할 수 있어요
        </div>
      )}
    </div>
  );
}
