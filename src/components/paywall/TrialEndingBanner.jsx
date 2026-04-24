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

  return (
    <div
      role="status"
      style={{
        width: "100%",
        maxWidth: 420,
        marginBottom: 10,
        padding: "12px 14px",
        borderRadius: 18,
        background: danger ? "#FFF1F2" : "#FEFCE8",
        border: `1.5px solid ${danger ? "#FB7185" : "#FACC15"}`,
        boxShadow: "0 10px 24px rgba(180,120,150,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 22 }}>{danger ? "⏰" : "✨"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: danger ? "#BE123C" : "#92400E" }}>{copy}</div>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>체험이 끝나도 데이터는 남고, 프리미엄 기능만 잠깁니다.</div>
      </div>
      <button
        type="button"
        onClick={onContinue}
        style={{
          padding: "10px 14px",
          borderRadius: 14,
          border: "none",
          background: danger ? "#E11D48" : "#CA8A04",
          color: "white",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {TRIAL_ENDING.cta}
      </button>
    </div>
  );
}
