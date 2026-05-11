// src/components/multichild/HomeDashboard/ChildSelectCard.jsx
// 자녀 선택 카드 — 큰 photo (colored ring + sticker), 자녀별 색 배경, 이름·dots·배터리·주소.
// 부모 모드 다자녀 홈 (HomeTab) 에서 사용. 단독자녀도 동일 컴포넌트로 1개 카드 렌더 가능.

import { ChildAvatar } from "./ChildAvatar.jsx";

const DOT_COLORS = {
  green: "var(--status-positive, #00BF40)",
  yellow: "var(--status-cautionary, #F59E0B)",
  red: "var(--status-negative, #DC2626)",
};

const CHILD_PALETTES = [
  {
    soft: "var(--brand-rose-soft, #FFE2EC)",
    line: "var(--brand-rose-line, #FFD0DD)",
    accent: "var(--brand-rose, #F779A8)",
    sticker: "🌸",
  },
  {
    soft: "var(--brand-mint-soft, #DDF7EA)",
    line: "var(--brand-mint-line, #BCEBD8)",
    accent: "var(--brand-mint, #31C48D)",
    sticker: "⭐",
  },
  {
    soft: "var(--brand-lavender-soft, #EFE8FF)",
    line: "var(--brand-lavender-line, #DDD1FF)",
    accent: "var(--brand-lavender, #A78BFA)",
    sticker: "🌟",
  },
  {
    soft: "var(--brand-yellow-soft, #FFF3C7)",
    line: "rgba(255,215,106,0.4)",
    accent: "var(--brand-yellow, #FFD76A)",
    sticker: "🎀",
  },
];

const HOME_LOCATION_REGION_LABELS = new Set([
  "서울", "서울시", "서울특별시",
  "부산", "부산시", "부산광역시",
  "대구", "대구시", "대구광역시",
  "인천", "인천시", "인천광역시",
  "광주", "광주시", "광주광역시",
  "대전", "대전시", "대전광역시",
  "울산", "울산시", "울산광역시",
  "세종", "세종시", "세종특별자치시",
  "경기", "경기도",
  "강원", "강원도", "강원특별자치도",
  "충북", "충청북도",
  "충남", "충청남도",
  "전북", "전라북도", "전북특별자치도",
  "전남", "전라남도",
  "경북", "경상북도",
  "경남", "경상남도",
  "제주", "제주도", "제주특별자치도",
]);

function formatChildAddressLabel(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const parts = raw.split(" ").filter(Boolean);
  while (parts.length > 1 && HOME_LOCATION_REGION_LABELS.has(parts[0])) parts.shift();
  while (parts.length > 1 && /시$/.test(parts[0])) parts.shift();
  return parts.join(" ") || raw;
}

function splitChildAddressLines(value) {
  const stripped = formatChildAddressLabel(value);
  if (!stripped) return null;
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { primary: stripped, secondary: "" };
  return { primary: parts[0], secondary: parts.slice(1).join(" ") };
}

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return ["green", "green", "green"];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

export function ChildSelectCard({ child, index = 0, deviceStatus, locationLabel, nextEventChip, onSelect }) {
  const palette = CHILD_PALETTES[index % CHILD_PALETTES.length];
  const dots = deriveSafetyDots(deviceStatus);
  const battery = Number(deviceStatus?.batteryLevel);
  const batteryPct = Number.isFinite(battery)
    ? Math.max(0, Math.min(100, Math.round(battery)))
    : null;
  const addressLines = splitChildAddressLines(locationLabel);
  const accent = child?.color_hex || palette.accent;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(child.id)}
      aria-label={`${child.name} 선택`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "18px 14px",
        background: palette.soft,
        border: `1px solid ${palette.line}`,
        borderRadius: 26,
        boxShadow: "0 6px 18px rgba(31, 24, 28, 0.06)",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        position: "relative",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0, width: 78, height: 78 }}>
        <div style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          border: `4px solid ${accent}`,
          background: "#FFFFFF",
          boxShadow: "0 4px 12px rgba(31, 24, 28, 0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}>
          <ChildAvatar child={child} size={68} fontSize={28} decorative />
        </div>
        <span aria-hidden="true" style={{
          position: "absolute",
          bottom: -2,
          left: -4,
          fontSize: 26,
          lineHeight: 1,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
        }}>{palette.sticker}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          fontSize: 22,
          fontWeight: 900,
          color: "var(--fg-primary, #1F2A24)",
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
        }}>{child.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span aria-label="안전 상태" style={{ display: "inline-flex", gap: 4 }}>
            {dots.map((c, i) => (
              <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: DOT_COLORS[c] }} />
            ))}
          </span>
          {batteryPct != null && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              fontWeight: 800,
              color: "var(--fg-secondary)",
            }}>
              <span aria-hidden="true">🔋</span>
              {batteryPct}%
            </span>
          )}
        </div>
        {addressLines && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 4,
              minWidth: 0,
            }}
            title={locationLabel || ""}
          >
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1.4, flexShrink: 0 }}>📍</span>
            <div style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--fg-secondary)",
              lineHeight: 1.4,
              wordBreak: "keep-all",
              overflowWrap: "break-word",
            }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {addressLines.primary}
              </div>
              {addressLines.secondary && (
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {addressLines.secondary}
                </div>
              )}
            </div>
          </div>
        )}
        {nextEventChip && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-tertiary)" }}>{nextEventChip}</div>
        )}
      </div>

      <div aria-hidden="true" style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.94)",
        boxShadow: "0 2px 8px rgba(31, 24, 28, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        color: "var(--fg-secondary, #5F6368)",
        fontWeight: 800,
      }}>›</div>
    </button>
  );
}
