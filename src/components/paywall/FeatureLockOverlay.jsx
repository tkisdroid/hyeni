import { FEATURE_LOCK, PRICING } from "../../lib/paywallCopy.js";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

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
      aria-labelledby="feature-lock-title"
      className="cartoon-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="cartoon-modal-card"
        style={{
          background: "linear-gradient(180deg, var(--bg-card), color-mix(in srgb, var(--fg-primary) 2%, var(--theme-accent-soft)))",
          border: "1px solid var(--theme-accent-line)",
          boxShadow: "var(--hyeni-theme-shadow)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 96,
            height: 96,
            background: "linear-gradient(180deg, var(--theme-accent-soft), var(--bg-card))",
            borderRadius: 28,
            border: "1px solid var(--theme-accent-line)",
            margin: "0 auto var(--space-3)",
            overflow: "visible",
            position: "relative",
          }}
        >
          <HyeniMascot variant="winkStar" size={104} aria-label="혜니" />
        </div>
        <h2 id="feature-lock-title" className="cartoon-title" style={{ fontSize: 20, color: "var(--fg-primary)" }}>{title}</h2>
        <p className="cartoon-subtitle" style={{ marginTop: "var(--space-2)", fontSize: 14, lineHeight: 1.6 }}>{body}</p>

        <div className="cartoon-modal-meta">
          7일 무료 체험 후 {PRICING.monthlyLabel}부터 시작할 수 있어요.
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
          <button
            type="button"
            onClick={onStart}
            className="btn btn-primary"
            style={{ flex: 1, background: "var(--hyeni-theme-gradient)" }}
          >
            7일 무료 체험 시작
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flexShrink: 0, padding: "0 var(--space-5)" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
