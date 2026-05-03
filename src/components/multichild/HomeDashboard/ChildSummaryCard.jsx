// src/components/multichild/HomeDashboard/ChildSummaryCard.jsx
const DOT_COLORS = { green: "var(--status-positive)", yellow: "var(--status-cautionary)", red: "var(--status-negative)" };
const DOT_LABELS = ["배터리", "최근 위치", "앱 사용 가능"];
const DOT_STATE_LABELS = { green: "정상", yellow: "주의", red: "위험" };

export function ChildSummaryCard({ child, location, safetyDots = [], screenLabel, onClick }) {
  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";
  const worstColor = safetyDots.includes("red") ? "red" : safetyDots.includes("yellow") ? "yellow" : "green";
  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onClick(child.id) : undefined}
      aria-label={interactive ? `${child.name} 보기` : undefined}
      className={interactive ? "card card-interactive" : "card"}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: 16,
        textAlign: "left", width: "100%",
        font: "inherit",
        borderLeft: `4px solid ${child.color_hex}`,
        transition: "transform 0.12s ease",
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: "var(--radius-full)",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `2px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{child.name}</div>
        <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "var(--weight-medium)" }}>
          📍 {location || "위치 확인 중..."}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 3, fontWeight: "var(--weight-medium)" }}>
          오늘 화면켜짐 {screenLabel || "0분"}
        </div>
      </div>
      {safetyDots.length > 0 && (
        <div
          aria-label={`안전 상태 ${DOT_STATE_LABELS[worstColor]}`}
          title={safetyDots.map((c, i) => `${DOT_LABELS[i]}: ${DOT_STATE_LABELS[c] || "확인 불가"}`).join("\n")}
          style={{ display: "flex", gap: 4, flexShrink: 0 }}
        >
          {safetyDots.map((color, i) => (
            <div key={i} data-safety-dot style={{
              width: 8, height: 8, borderRadius: "var(--radius-full)",
              background: DOT_COLORS[color] || "var(--line-default)",
            }} />
          ))}
        </div>
      )}
    </Wrapper>
  );
}
