import { EARLY_ADOPTER_BADGE, PRICING, TRIAL_INVITE } from "../../lib/paywallCopy.js";
import { ParentMomDuo } from "../decoration/CartoonIllustrations.jsx";

export function TrialInvitePrompt({ open, onStart, onDismiss, isChild = false }) {
  if (!open || isChild) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="trial-invite-title"
      className="cartoon-modal-backdrop cartoon-modal-backdrop--bottom"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="cartoon-modal-card cartoon-modal-card--bottom">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "flex-end",
              justifyContent: "center",
              width: 72,
              height: 64,
              background: "var(--cartoon-bg-chip)",
              borderRadius: "var(--cartoon-radius-icon)",
              border: "1px solid var(--cartoon-line)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <ParentMomDuo size={72} ariaLabel="" />
          </span>
          <div className="cartoon-chip cartoon-chip--pink" style={{ fontSize: 12 }}>
            <span aria-hidden="true">✨</span>
            <span>{EARLY_ADOPTER_BADGE}</span>
          </div>
        </div>

        <h2 id="trial-invite-title" className="cartoon-title" style={{ fontSize: 22, color: "var(--fg-primary)", textAlign: "left" }}>
          {TRIAL_INVITE.title}
        </h2>
        <p className="cartoon-subtitle" style={{ fontSize: 14, lineHeight: 1.65, textAlign: "left" }}>
          {TRIAL_INVITE.body}
        </p>

        <div
          className="cartoon-modal-meta"
          style={{ textAlign: "left", marginTop: "var(--space-4)" }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, color: "var(--cartoon-rose-text)" }}>
            {PRICING.monthlyLabel}
          </div>
          <div style={{ fontSize: 12, color: "var(--cartoon-rose-text)", marginTop: 4, fontWeight: 700 }}>
            {PRICING.dailyLabel} · {PRICING.yearlyLabel}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: "var(--space-2)", lineHeight: 1.5, fontWeight: 600 }}>
            {TRIAL_INVITE.highlight}
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
          <button
            type="button"
            onClick={onStart}
            className="cartoon-pill cartoon-pill--rose"
            style={{ flex: 1 }}
          >
            {TRIAL_INVITE.ctaPrimary}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="cartoon-pill cartoon-pill--white"
            style={{ flexShrink: 0, padding: "0 var(--space-5)" }}
          >
            {TRIAL_INVITE.ctaSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}
