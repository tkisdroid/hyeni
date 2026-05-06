// src/components/multichild/SubscriptionScreen/PerChildToggle.jsx
import { ChildAvatar } from "../HomeDashboard/ChildAvatar.jsx";

function birthYear(birthdate) {
  if (!birthdate) return null;
  return new Date(birthdate).getFullYear();
}

export function PerChildToggle({ child, subscribed, onToggle, busy = false }) {
  const year = birthYear(child.birthdate);
  return (
    <div data-child-id={child.id} data-user-id={child.user_id} style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 16, borderRadius: 14,
      background: subscribed ? "white" : "var(--bg-subtle)",
      border: subscribed ? "1.5px solid var(--theme-accent-line)" : "1.5px solid var(--line-soft)",
      opacity: subscribed ? 1 : 0.85,
    }}>
      <ChildAvatar child={child} size={44} radius="50%" fontSize={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg-primary)" }}>
          {child.name}
          {year && <span style={{ fontSize: 12, color: "var(--fg-secondary)", marginLeft: 8, fontWeight: 600 }}>({year}년생)</span>}
        </div>
        <div style={{ fontSize: 12, color: subscribed ? "var(--theme-accent-text)" : "var(--fg-secondary)", marginTop: 2, fontWeight: 700 }}>
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
          background: subscribed ? "var(--theme-accent)" : "var(--line-default)",
          border: "none", position: "relative",
          cursor: busy ? "wait" : "pointer", flexShrink: 0,
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "manipulation",
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
