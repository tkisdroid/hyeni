// src/components/friendPlaydate/PlaydateStartButton.jsx
export default function PlaydateStartButton({ inSafePlace, onClick }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <button
        onClick={onClick}
        disabled={!inSafePlace}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '10px 12px',
          borderRadius: 14,
          backgroundColor: inSafePlace ? '#10B981' : '#F3F4F6',
          color: inSafePlace ? '#fff' : '#9CA3AF',
          fontSize: 14,
          fontWeight: 900,
          border: inSafePlace ? 'none' : '1px solid #E5E7EB',
          cursor: inSafePlace ? 'pointer' : 'not-allowed',
          boxShadow: inSafePlace ? '0 6px 14px rgba(16,185,129,0.18)' : 'none',
        }}
        aria-label="친구랑 놀래요"
      >
        🤝 친구랑 놀래요
      </button>
      {!inSafePlace && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center', fontWeight: 700 }}>
          친구놀이는 학교·공원처럼 등록된 곳에서만 시작할 수 있어요
        </div>
      )}
    </div>
  );
}
