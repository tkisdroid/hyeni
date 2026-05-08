// src/components/multichild/HomeDashboard/TodayEventsList.jsx
// Timeline 스타일 — 왼쪽 시간 컬럼 + 자녀 컬러 점 + 제목/자녀명.
export function TodayEventsList({ events, children }) {
  if (!events || events.length === 0) {
    return (
      <div className="hyeni-today-empty">
        오늘 일정이 없어요
      </div>
    );
  }

  return (
    <ol className="hyeni-today-timeline" aria-label="오늘 일정 목록">
      {events.map((event) => {
        // child_ids stores family_members.id (matches events_children.child_id FK).
        const eventChildren = (event.child_ids || [])
          .map((id) => children.find((c) => c.id === id))
          .filter(Boolean);
        const isFamily = event.is_family_event;
        const accent = isFamily
          ? "var(--theme-accent)"
          : (eventChildren[0]?.color_hex || "var(--theme-accent)");
        const childLabel = isFamily
          ? "가족 전체"
          : eventChildren.map((c) => c.name).join(", ");

        return (
          <li
            key={event.id}
            data-event-id={event.id}
            className="hyeni-today-row"
          >
            <span className="hyeni-today-time">{event.time}</span>
            <span
              className="hyeni-today-marker"
              aria-hidden="true"
              style={{
                background: isFamily ? "transparent" : accent,
                borderStyle: isFamily ? "dashed" : "solid",
                borderColor: accent,
              }}
            />
            <div className="hyeni-today-body">
              <div className="hyeni-today-title">{event.title}</div>
              {childLabel ? <div className="hyeni-today-meta">{childLabel}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
