// src/components/friendPlaydate/PlaydateStartButton.jsx
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export default function PlaydateStartButton({ inSafePlace, onClick }) {
  return (
    <div className="hyeni-tool hyeni-tool--friend" style={{ gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!inSafePlace}
        className="hyeni-tool-button"
        aria-label="친구랑 놀래요"
      >
        <ThreeDIcon name="friend-pair" size={28} aria-label="친구" />
        <span className="hyeni-tool-button__label">친구랑 놀래요</span>
      </button>
      {!inSafePlace && (
        <div
          className="hyeni-tool-empty"
          style={{ padding: '10px 12px', fontSize: 11 }}
        >
          학교·공원처럼 등록된 곳에서만 시작할 수 있어요.
        </div>
      )}
    </div>
  );
}
