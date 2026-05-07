import { FEATURE_LOCK, PRICING } from "../../lib/paywallCopy.js";
import { HyeniGirl } from "../decoration/CartoonIllustrations.jsx";

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
      <div className="cartoon-modal-card">
        <div
          style={{
            display: "inline-flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 84,
            height: 84,
            background: "var(--cartoon-bg-chip)",
            borderRadius: "50%",
            border: "1px solid var(--cartoon-line)",
            margin: "0 auto var(--space-3)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <HyeniGirl size={76} ariaLabel="" />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: -2,
              top: -2,
              fontSize: 22,
              filter: "var(--cartoon-shadow-badge)",
            }}
          >
            {copy?.emoji || "💎"}
          </span>
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
            className="cartoon-pill cartoon-pill--rose"
            style={{ flex: 1 }}
          >
            7일 무료 체험 시작
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cartoon-pill cartoon-pill--white"
            style={{ flexShrink: 0, padding: "0 var(--space-5)" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
