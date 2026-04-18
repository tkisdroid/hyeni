import { EARLY_ADOPTER_BADGE, PRICING, TRIAL_INVITE } from "../../lib/paywallCopy.js";

export function TrialInvitePrompt({ open, onStart, onDismiss, isChild = false }) {
  if (!open || isChild) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="trial-invite-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(15,23,42,0.35)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "white",
          borderRadius: "28px 28px 0 0",
          padding: "24px 20px 32px",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "#FFF7ED",
            color: "#C2410C",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <span>✨</span>
          <span>{EARLY_ADOPTER_BADGE}</span>
        </div>
        <h2 id="trial-invite-title" style={{ fontSize: 22, margin: "12px 0 8px", color: "#1F2937" }}>
          {TRIAL_INVITE.title}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>{TRIAL_INVITE.body}</p>
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 20,
            background: "linear-gradient(135deg,#FFF0F7,#FDF2F8)",
            border: "1px solid #FBCFE8",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, color: "#BE185D" }}>{PRICING.monthlyLabel}</div>
          <div style={{ fontSize: 12, color: "#9D174D", marginTop: 4 }}>
            {PRICING.dailyLabel} · {PRICING.yearlyLabel}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
            {TRIAL_INVITE.highlight}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 18,
              border: "none",
              background: "linear-gradient(135deg,#E879A0,#BE185D)",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {TRIAL_INVITE.ctaPrimary}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#6B7280",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {TRIAL_INVITE.ctaSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}
