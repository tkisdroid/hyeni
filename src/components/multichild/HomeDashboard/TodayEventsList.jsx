// src/components/multichild/HomeDashboard/TodayEventsList.jsx
export function TodayEventsList({ events, children }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--fg-tertiary)", fontSize: 14 }}>
        오늘 일정이 없어요
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event) => {
        // child_ids stores family_members.id (matches events_children.child_id FK).
        const eventChildren = (event.child_ids || [])
          .map((id) => children.find((c) => c.id === id))
          .filter(Boolean);
        const isFamily = event.is_family_event;
        const firstColor = eventChildren[0]?.color_hex || "var(--theme-accent)";
        const familyColor = "var(--theme-accent)";

        return (
          <div
            key={event.id} data-event-id={event.id}
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderLeftWidth: 4,
              borderLeftStyle: isFamily ? "dashed" : "solid",
              borderLeftColor: isFamily ? familyColor : firstColor,
              background: "var(--cartoon-bg-card)",
              border: "1px solid var(--cartoon-line)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-primary)" }}>{event.title}</div>
              <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>{event.time}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>
              {isFamily ? "가족 전체" : eventChildren.map((c) => c.name).join(", ")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
