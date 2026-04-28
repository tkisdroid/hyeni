// src/components/multichild/SubscriptionScreen/PerChildToggle.jsx
function birthYear(birthdate) {
  if (!birthdate) return null;
  return new Date(birthdate).getFullYear();
}

export function PerChildToggle({ child, subscribed, onToggle, busy = false }) {
  const year = birthYear(child.birthdate);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 16, borderRadius: 14,
      background: subscribed ? "white" : "#F9FAFB",
      border: subscribed ? "1.5px solid #FBCFE8" : "1.5px solid #E5E7EB",
      opacity: subscribed ? 1 : 0.85,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `2px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937" }}>
          {child.name}
          {year && <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8, fontWeight: 600 }}>({year}년생)</span>}
        </div>
        <div style={{ fontSize: 12, color: subscribed ? "#BE185D" : "#6B7280", marginTop: 2, fontWeight: 700 }}>
          {subscribed ? "₩1,500/월" : "무료"}
        </div>
      </div>
      <button
        type="button" role="switch"
        aria-checked={subscribed}
        onClick={() => onToggle(!subscribed)}
        disabled={busy}
        style={{
          width: 48, height: 28, borderRadius: 14,
          background: subscribed ? "#F779A8" : "#D1D5DB",
          border: "none", position: "relative",
          cursor: busy ? "wait" : "pointer", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2,
          left: subscribed ? 22 : 2,
          width: 24, height: 24, borderRadius: "50%",
          background: "white", transition: "left 0.15s",
        }} />
      </button>
    </div>
  );
}
