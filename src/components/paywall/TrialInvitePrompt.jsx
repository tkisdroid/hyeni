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
        background: "color-mix(in srgb, var(--fg-primary) 38%, transparent)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        className="card-elevated"
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: "16px 16px 0 0",
          padding: "24px 20px 32px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--status-cautionary-subtle)",
            color: "var(--status-cautionary-strong)",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <span>✨</span>
          <span>{EARLY_ADOPTER_BADGE}</span>
        </div>
        <h2 id="trial-invite-title" style={{ fontSize: 22, margin: "12px 0 8px", color: "var(--fg-primary)" }}>
          {TRIAL_INVITE.title}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--fg-secondary)", lineHeight: 1.6 }}>{TRIAL_INVITE.body}</p>
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 20,
            background: "linear-gradient(135deg,var(--theme-accent-soft),var(--bg-subtle))",
            border: "1px solid var(--theme-accent-line)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, color: "var(--theme-accent-text)" }}>{PRICING.monthlyLabel}</div>
          <div style={{ fontSize: 12, color: "var(--theme-accent-text)", marginTop: 4 }}>
            {PRICING.dailyLabel} · {PRICING.yearlyLabel}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 8, lineHeight: 1.5 }}>
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
              background: "var(--hyeni-theme-gradient)",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
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
              border: "1px solid var(--line-soft)",
              background: "var(--bg-subtle)",
              color: "var(--fg-secondary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
            }}
          >
            {TRIAL_INVITE.ctaSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}
