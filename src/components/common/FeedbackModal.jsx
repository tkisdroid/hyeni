import { useState } from "react";
import { FF } from "../../lib/utils.js";
import { submitFeedback, shareViaKakao } from "../../lib/feedbackService.js";
import { getErrorLogs, getDeviceInfo } from "../../lib/errorLogger.js";

const TYPES = [
  { id: "bug", emoji: "🐛", label: "버그 신고" },
  { id: "suggestion", emoji: "💡", label: "제안" },
  { id: "other", emoji: "❓", label: "기타" },
];

export default function FeedbackModal({ open, onClose, userId, familyId, currentScreen }) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);

    try {
      await submitFeedback({ userId, familyId, type, message, currentScreen });
      setResult("success");
      setTimeout(() => {
        setMessage("");
        setType("bug");
        setResult(null);
        onClose();
      }, 1500);
    } catch (err) {
      const msg = err?.message || "";
      const isUserError = msg.startsWith("로") || msg.startsWith("내") || msg.startsWith("유") || msg.startsWith("피") || msg.startsWith("잠");
      setErrorMsg(isUserError ? msg : "전송에 실패했어요. 잠시 후 다시 시도해주세요.");
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  const handleKakaoShare = () => {
    shareViaKakao({ type, message: message || "(내용 없음)" });
  };

  const errorCount = getErrorLogs().length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 440, padding: "24px 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          animation: "slideUpModal 0.3s ease",
          fontFamily: FF,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>피드백 보내기</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 20,
            cursor: "pointer", color: "#9CA3AF", padding: 4,
          }}>✕</button>
        </div>
        <div style={{ background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, border: "1px solid #FDE68A" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 2 }}>💰 피드백 보상</div>
          <div style={{ fontSize: 11, color: "#78350F", lineHeight: 1.5 }}>
            피드백이 반영되면 <b style={{ color: "#E879A0" }}>혜니</b>를 드려요!<br/>
            버그 제보·에러 신고도 보상 대상이에요 🎁
          </div>
        </div>

        {/* 유형 선택 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              style={{
                flex: 1, padding: "10px 4px", borderRadius: 12,
                border: type === t.id ? "2px solid #8B5CF6" : "2px solid #E5E7EB",
                background: type === t.id ? "#F5F3FF" : "white",
                cursor: "pointer", fontFamily: FF, fontSize: 13, fontWeight: 600,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 20 }}>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 메시지 입력 */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="어떤 문제가 있었나요? 자세히 알려주세요"
          maxLength={2000}
          style={{
            width: "100%", minHeight: 100, borderRadius: 12,
            border: "2px solid #E5E7EB", padding: 12, fontSize: 14,
            fontFamily: FF, resize: "vertical", outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#8B5CF6"; }}
          onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; }}
        />

        {/* 에러 로그 안내 */}
        {errorCount > 0 && (
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 8,
            background: "#FEF2F2", color: "#991B1B", fontSize: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>🔍</span>
            <span>에러 로그 {errorCount}건이 자동으로 첨부됩니다</span>
          </div>
        )}

        {/* 결과 메시지 */}
        {result === "success" && (
          <div style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 8,
            background: "#F0FDF4", color: "#166534", fontSize: 13, fontWeight: 600,
            textAlign: "center",
          }}>
            ✅ 피드백이 전송되었어요! 반영되면 혜니를 드릴게요 💰
          </div>
        )}
        {result === "error" && (
          <div style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 8,
            background: "#FEF2F2", color: "#991B1B", fontSize: 13,
            textAlign: "center",
          }}>
            {errorMsg}
          </div>
        )}

        {/* 전송 버튼 */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 12,
              border: "none", background: sending || !message.trim() ? "#D1D5DB" : "linear-gradient(135deg, #8B5CF6, #6D28D9)",
              color: "white", fontWeight: 700, fontSize: 14,
              cursor: sending || !message.trim() ? "default" : "pointer",
              fontFamily: FF,
            }}
          >
            {sending ? "전송 중..." : "📨 전송하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
