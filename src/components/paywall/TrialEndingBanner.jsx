import { TRIAL_ENDING } from "../../lib/paywallCopy.js";

function pickBannerCopy(trialDaysLeft) {
  if (trialDaysLeft == null || trialDaysLeft >= 4) return null;
  if (trialDaysLeft === 3) return TRIAL_ENDING.d3;
  if (trialDaysLeft === 2) return TRIAL_ENDING.d2;
  if (trialDaysLeft === 1) return TRIAL_ENDING.d1;
  return TRIAL_ENDING.today;
}

export function TrialEndingBanner({ trialDaysLeft, isTrial, onContinue, isChild = false }) {
  if (!isTrial || isChild) return null;
  const copy = pickBannerCopy(trialDaysLeft);
  if (!copy) return null;

  const danger = trialDaysLeft <= 1;
  const statusClass = danger ? "cartoon-status--negative" : "cartoon-status--cautionary";

  return (
    <div
      role="status"
      className={`cartoon-status ${statusClass}`}
      style={{
        width: "100%",
        maxWidth: 420,
        marginBottom: "var(--space-3)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <div aria-hidden="true" style={{ fontSize: 22 }}>{danger ? "⏰" : "✨"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.4 }}>{copy}</div>
        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3, opacity: 0.85 }}>
          체험이 끝나도 데이터는 남고, 프리미엄 기능만 잠깁니다.
        </div>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="cartoon-pill cartoon-pill--rose"
        style={{
          height: 36,
          padding: "0 var(--space-4)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {TRIAL_ENDING.cta}
      </button>
    </div>
  );
}
