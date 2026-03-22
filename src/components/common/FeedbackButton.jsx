import { useState, useEffect } from "react";
import { FF } from "../../lib/utils.js";
import { getErrorLogs } from "../../lib/errorLogger.js";

export default function FeedbackButton({ onClick }) {
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setHasErrors(getErrorLogs().length > 0);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      aria-label="피드백 보내기"
      style={{
        position: "fixed",
        bottom: 90,
        right: 16,
        zIndex: 900,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
        color: "white",
        fontSize: 22,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(109,40,217,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FF,
        transition: "transform 0.2s",
      }}
    >
      <span role="img" aria-label="feedback">💬</span>
      {hasErrors && (
        <span style={{
          position: "absolute",
          top: -2,
          right: -2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#EF4444",
          border: "2px solid white",
        }} />
      )}
    </button>
  );
}
