// src/components/multichild/HomeDashboard/TodayEventsList.jsx
export function TodayEventsList({ events, children }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
        오늘 일정이 없어요
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event) => {
        const eventChildren = (event.child_ids || [])
          .map((id) => children.find((c) => c.user_id === id))
          .filter(Boolean);
        const isFamily = event.is_family_event;
        const firstColor = eventChildren[0]?.color_hex || "#9CA3AF";

        return (
          <div
            key={event.id} data-event-id={event.id}
            style={{
              padding: "10px 14px",
              borderLeft: `4px ${isFamily ? "dashed" : "solid"} ${isFamily ? "#9CA3AF" : firstColor}`,
              background: "white", borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{event.title}</div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{event.time}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {isFamily ? "가족 전체" : eventChildren.map((c) => c.name).join(", ")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
