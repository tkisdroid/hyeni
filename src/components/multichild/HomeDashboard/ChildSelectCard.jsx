// src/components/multichild/HomeDashboard/ChildSelectCard.jsx
// 옵션 C — 이름·사진·안전 dot 3개·위치명·배터리%·다음 일정 한 줄.

import { ChildAvatar } from "./ChildAvatar.jsx";

const DOT_COLORS = {
  green: "var(--status-positive, #00BF40)",
  yellow: "var(--status-cautionary, #F59E0B)",
  red: "var(--status-negative, #DC2626)",
};

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return ["green", "green", "green"];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

export function ChildSelectCard({ child, deviceStatus, locationLabel, nextEventChip, onSelect }) {
  const dots = deriveSafetyDots(deviceStatus);
  const battery = Number(deviceStatus?.batteryLevel);
  const batteryLabel = Number.isFinite(battery)
    ? `🔋 ${Math.max(0, Math.min(100, Math.round(battery)))}%`
    : null;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(child.id)}
      aria-label={`${child.name} 선택`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        background: "var(--cartoon-bg-card, #FFF)",
        border: "1px solid var(--cartoon-line, #FFD6DD)",
        borderRadius: 16,
        boxShadow: "var(--cartoon-shadow-card, 0 8px 24px rgba(245,96,130,0.08))",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <ChildAvatar child={child} size={48} fontSize={20} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg-primary, #1F2A24)" }}>{child.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {dots.map((c, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_COLORS[c] }} />
            ))}
          </span>
          {locationLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-mint-text, #087653)" }}>
              📍 {locationLabel}
            </span>
          )}
          {batteryLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-secondary)" }}>{batteryLabel}</span>
          )}
        </div>
        {nextEventChip && (
          <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>{nextEventChip}</div>
        )}
      </div>
      <span aria-hidden="true" style={{ color: "var(--fg-tertiary, #A892A0)", fontSize: 20 }}>›</span>
    </button>
  );
}
