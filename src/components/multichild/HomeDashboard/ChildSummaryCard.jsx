// src/components/multichild/HomeDashboard/ChildSummaryCard.jsx
const DOT_COLORS = { green: "#10B981", yellow: "#F59E0B", red: "#EF4444" };

export function ChildSummaryCard({ child, location, safetyDots = [] }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 14, borderRadius: 16,
      background: "white", border: "1.5px solid #F3F4F6",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `3px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937" }}>{child.name}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {location || "위치 확인 중..."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {safetyDots.map((color, i) => (
          <div key={i} data-safety-dot style={{
            width: 8, height: 8, borderRadius: "50%",
            background: DOT_COLORS[color] || "#D1D5DB",
          }} />
        ))}
      </div>
    </div>
  );
}
