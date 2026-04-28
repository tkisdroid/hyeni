// src/components/multichild/HomeDashboard/MiniMap.jsx
export function MiniMap({ children, positions, onTap }) {
  const pinned = (positions || []).map((p) => {
    const child = children.find((c) => c.user_id === p.user_id);
    return child ? { ...p, color_hex: child.color_hex, name: child.name } : null;
  }).filter(Boolean);

  return (
    <button
      type="button" onClick={onTap} aria-label="지도 탭으로 이동"
      style={{
        position: "relative", width: "100%", height: 160, borderRadius: 16,
        background: "linear-gradient(135deg, #F0F9FF, #FEF3F8)",
        border: "1.5px solid #E5E7EB", overflow: "hidden", cursor: "pointer", padding: 0,
      }}
    >
      {pinned.map((p, i) => (
        <div
          key={p.user_id} data-pin
          style={{
            position: "absolute",
            top: `${30 + (i * 30) % 80}%`,
            left: `${20 + (i * 40) % 60}%`,
            width: 18, height: 18, borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            background: p.color_hex,
            border: "2px solid white",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        />
      ))}
      <div style={{
        position: "absolute", bottom: 8, right: 12,
        fontSize: 11, color: "#6B7280", fontWeight: 700,
      }}>탭하여 전체 지도 보기</div>
    </button>
  );
}
