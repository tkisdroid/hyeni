// src/components/multichild/HomeDashboard/TodayEventsList.jsx
// Phase 07 redesign — 카드 list (accent bar + 3D 카테고리 아이콘 + 제목 + 시간).

import { CategoryIcon } from "../../icons/CategoryIcon.jsx";
import { HyeniMascot } from "../../auth/HyeniMascot.jsx";

const KEYWORD_TO_CATEGORY = [
  { regex: /(피아노|미술|영어|수학|논술|코딩|학원|책|독서|학교)/, id: "school" },
  { regex: /(태권도|축구|수영|운동|체육|발레|줄넘기)/, id: "sports" },
  { regex: /(그림|만들기|취미|놀이)/, id: "hobby" },
  { regex: /(가족|외식|가족식사|모임)/, id: "family" },
  { regex: /(친구|놀러|파티|생일)/, id: "friend" },
];

function inferCategoryId(event) {
  if (event?.category) return event.category;
  const title = String(event?.title || "");
  for (const m of KEYWORD_TO_CATEGORY) {
    if (m.regex.test(title)) return m.id;
  }
  return "other";
}

export function TodayEventsList({ events, children }) {
  if (!events || events.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1px solid var(--theme-accent-line)",
          borderRadius: 16,
          color: "var(--fg-secondary)",
          fontSize: 14,
          fontWeight: 500,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <HyeniMascot variant="sad" size={64} aria-label="" />
        오늘 일정이 없어요
      </div>
    );
  }

  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }} aria-label="오늘 일정 목록">
      {events.map((event) => {
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
        const categoryId = inferCategoryId(event);

        return (
          <li
            key={event.id}
            data-event-id={event.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              background: "var(--bg-card)",
              border: "1px solid var(--theme-accent-line)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <span
              aria-hidden="true"
              className="hyeni-today-marker"
              style={{
                position: "absolute",
                left: 0,
                top: 8,
                bottom: 8,
                width: 4,
                background: isFamily ? "transparent" : accent,
                borderWidth: 1,
                borderStyle: isFamily ? "dashed" : "solid",
                borderColor: accent,
                borderRadius: 4,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "var(--theme-accent-soft)",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 4,
                flexShrink: 0,
              }}
            >
              <CategoryIcon categoryId={categoryId} size={36} aria-label="" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg-primary)", letterSpacing: 0 }}>{event.title}</div>
              {childLabel && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-accent-text)", marginTop: 2 }}>{childLabel}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: 0 }}>
                {event.time}
              </span>
              <span aria-hidden="true" style={{ color: "var(--fg-tertiary)", fontSize: 18 }}>›</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
