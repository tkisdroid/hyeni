// One-shot migration: Tailwind palette + small fontSize → Wanted DS tokens.
// Conservative replacement — only context-safe substitutions where the
// surrounding code makes the intent unambiguous (color text vs background bg).

import fs from "node:fs";

const targets = [
  "src/App.jsx",
  "src/components/paywall/TrialEndingBanner.jsx",
  "src/components/paywall/TrialInvitePrompt.jsx",
  "src/components/paywall/AutoRenewalDisclosure.jsx",
  "src/components/paywall/FeatureLockOverlay.jsx",
  "src/components/friendPlaydate/ActivePlaydateCard.jsx",
  "src/components/friendPlaydate/PlaydateStartButton.jsx",
  "src/components/forceRing/ForceRingHistory.jsx",
  "src/components/multichild/HomeDashboard/MiniMap.jsx",
  "src/components/multichild/HomeDashboard/TodayMultiChildView.jsx",
  "src/components/multichild/HomeDashboard/TodayEventsList.jsx",
  "src/components/multichild/SubscriptionScreen/PriceSummary.jsx",
  "src/components/multichild/SubscriptionScreen/PerChildToggle.jsx",
  "src/components/multichild/EventModal/ChildSelector.jsx",
  "src/components/multichild/PairingWizard/ChildCountStep.jsx",
  "src/components/multichild/PairingWizard/PhotoUpload.jsx",
  "src/components/multichild/PairingWizard/ColorPicker.jsx",
  "src/components/birthdate/BirthdatePicker.jsx",
];

const surfaceMap = {
  "#10B981": "var(--status-positive)",
  "#22C55E": "var(--status-positive)",
  "#16A34A": "var(--status-positive-strong)",
  "#15803D": "var(--status-positive-strong)",
  "#047857": "var(--status-positive-strong)",
  "#EF4444": "var(--status-negative)",
  "#DC2626": "var(--status-negative-strong)",
  "#B91C1C": "var(--status-negative-strong)",
  "#F59E0B": "var(--status-cautionary)",
  "#D97706": "var(--status-cautionary-strong)",
  "#B45309": "var(--status-cautionary-strong)",
  "#92400E": "var(--status-cautionary-strong)",
  "#9A3412": "var(--status-cautionary-strong)",
  "#C2410C": "var(--status-cautionary-strong)",
};

const tintMap = {
  "#D1FAE5": "var(--status-positive-subtle)",
  "#DCFCE7": "var(--status-positive-subtle)",
  "#FEE2E2": "var(--status-negative-subtle)",
  "#FECACA": "var(--status-negative-subtle)",
  "#FEF2F2": "var(--status-negative-subtle)",
  "#FEF3C7": "var(--status-cautionary-subtle)",
  "#FFFBEB": "var(--status-cautionary-subtle)",
  "#FFF7ED": "var(--status-cautionary-subtle)",
  "#FEF4E6": "var(--status-cautionary-subtle)",
  "#F9FAFB": "var(--bg-subtle)",
  "#F3F4F6": "var(--bg-muted)",
  "#F0F9FF": "var(--bg-subtle)",
  "#EFF6FF": "var(--bg-subtle)",
  "#DBEAFE": "var(--bg-subtle)",
};

const fontSizeBumps = [
  [/fontSize:\s*9\s*,/g, "fontSize: 11,"],
  [/fontSize:\s*9\s*\}/g, "fontSize: 11 }"],
];

let totalFiles = 0;

for (const rel of targets) {
  const path = `C:/Users/TK/Desktop/hyeni-1/${rel}`;
  if (!fs.existsSync(path)) {
    console.warn(`[skip] not found: ${rel}`);
    continue;
  }
  let src = fs.readFileSync(path, "utf8");
  const orig = src;

  for (const [from, to] of Object.entries({ ...surfaceMap, ...tintMap })) {
    const re = new RegExp(from, "gi");
    src = src.replace(re, to);
  }

  for (const [re, replacement] of fontSizeBumps) {
    src = src.replace(re, replacement);
  }

  if (src !== orig) {
    fs.writeFileSync(path, src);
    console.log(`[updated] ${rel}`);
    totalFiles += 1;
  }
}

console.log(`\nTotal files updated: ${totalFiles}`);
