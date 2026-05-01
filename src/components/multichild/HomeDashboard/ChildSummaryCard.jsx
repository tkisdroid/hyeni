// src/components/multichild/HomeDashboard/ChildSummaryCard.jsx
const DOT_COLORS = { green: "#10B981", yellow: "#F59E0B", red: "#EF4444" };

export function ChildSummaryCard({ child, location, safetyDots = [], screenLabel, onClick }) {
  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";
  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onClick(child.id) : undefined}
      aria-label={interactive ? `${child.name} 보기` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: 14, borderRadius: "var(--radius-card)",
        background: "white", border: "var(--border-card)",
        boxShadow: "var(--shadow-card)",
        textAlign: "left", width: "100%",
        cursor: interactive ? "pointer" : "default",
        font: "inherit",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: "var(--radius-pill)",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `3px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: "var(--weight-heading)", color: "#1F2937" }}>{child.name}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {location || "위치 확인 중..."}
        </div>
        <div style={{ fontSize: 12, color: "#4B5563", marginTop: 4, fontWeight: "var(--weight-label)" }}>
          ⏱️ 오늘 화면켜짐 {screenLabel || "0분"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {safetyDots.map((color, i) => (
          <div key={i} data-safety-dot style={{
            width: 8, height: 8, borderRadius: "var(--radius-pill)",
            background: DOT_COLORS[color] || "#D1D5DB",
          }} />
        ))}
      </div>
    </Wrapper>
  );
}
