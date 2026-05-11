// src/components/multichild/HomeDashboard/ChildSelectCard.jsx
// 옵션 C — 이름·사진·안전 dot 3개·위치명·배터리%·다음 일정 한 줄.

import { ChildAvatar } from "./ChildAvatar.jsx";

const DOT_COLORS = {
  green: "var(--status-positive, #00BF40)",
  yellow: "var(--status-cautionary, #F59E0B)",
  red: "var(--status-negative, #DC2626)",
};

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

// 시/도/광역시 prefix 제거 → 첫 토큰이 "구/군/시"로 끝나는 행정구역부터 시작.
// 예: "서울특별시 서초구 양재동 12-3 빌딩" → "서초구 양재동 12-3 빌딩".
function formatChildAddressLabel(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const parts = raw.split(" ").filter(Boolean);
  while (parts.length > 1 && HOME_LOCATION_REGION_LABELS.has(parts[0])) parts.shift();
  while (parts.length > 1 && /시$/.test(parts[0])) parts.shift();
  return parts.join(" ") || raw;
}

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
  const shortAddress = formatChildAddressLabel(locationLabel);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(child.id)}
      aria-label={`${child.name} 선택`}
      style={{
        display: "flex",
        alignItems: "flex-start",
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {dots.map((c, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_COLORS[c] }} />
            ))}
          </span>
          {batteryLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-secondary)" }}>{batteryLabel}</span>
          )}
        </div>
        {shortAddress && (
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--brand-mint-text, #087653)",
              marginTop: 4,
              lineHeight: 1.4,
              wordBreak: "keep-all",
              overflowWrap: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={locationLabel || ""}
          >
            📍 {shortAddress}
          </div>
        )}
        {nextEventChip && (
          <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 3 }}>{nextEventChip}</div>
        )}
      </div>
      <span aria-hidden="true" style={{ color: "var(--fg-tertiary, #A892A0)", fontSize: 20, alignSelf: "center" }}>›</span>
    </button>
  );
}
