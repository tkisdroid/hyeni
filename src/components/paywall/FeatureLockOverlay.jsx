import { FEATURE_LOCK, PRICING } from "../../lib/paywallCopy.js";

export function FeatureLockOverlay({
  open,
  feature,
  onStart,
  onClose,
  isChild = false,
  customTitle = "",
  customBody = "",
}) {
  if (!open || isChild) return null;

  const copy = FEATURE_LOCK[feature] || FEATURE_LOCK.remote_audio;
  const title = customTitle || copy?.title || "프리미엄 기능이에요";
  const body = customBody || copy?.body || "프리미엄을 시작하면 바로 사용할 수 있어요.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 720,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "white",
          borderRadius: 24,
          padding: "24px 20px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44 }}>{copy?.emoji || "💎"}</div>
        <div style={{ marginTop: 10, fontSize: 19, fontWeight: 900, color: "#1F2937" }}>{title}</div>
        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#6B7280" }}>{body}</div>
        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            background: "#F8FAFC",
            padding: "12px 14px",
            fontSize: 13,
            color: "#475569",
          }}
        >
          7일 무료 체험 후 {PRICING.monthlyLabel}부터 시작할 수 있어요.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              flex: 1,
              padding: "13px 14px",
              borderRadius: 16,
              border: "none",
              background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            7일 무료 체험 시작
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "13px 14px",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#6B7280",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
