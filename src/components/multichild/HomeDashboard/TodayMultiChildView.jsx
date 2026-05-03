// src/components/multichild/HomeDashboard/TodayMultiChildView.jsx
// "오늘" 탭 통합 뷰 (다중 아이 + 미선택). 각 자녀 카드에 그 아이의 오늘
// 일정만 묶어 보여주고, 카드를 누르면 단일-아이 컨텍스트로 진입한다.
// 호출처: src/App.jsx — activeView === "calendar" && isParent && isMultiChild
// && !selectedChildId 분기. todayEvents는 events[todayDateKey] || [] 형태.
//
// 기존 TodayEventsList는 평면 단일 리스트(섞여서 보임)라 "아이별로 한눈에"
// 라는 요구를 만족하지 못한다. 이 컴포넌트는 아이별로 카드를 만들어 그
// 아이의 events만 묶어 보여준다.

import { useMemo } from "react";

const FF = '"BMHANNAPro", "Pretendard", system-ui, -apple-system, sans-serif';

function eventsForChild(events, childId) {
  if (!Array.isArray(events) || !childId) return [];
  return events.filter((e) => e?.is_family_event || (Array.isArray(e?.child_ids) && e.child_ids.includes(childId)));
}

function formatTime(time) {
  if (!time) return "";
  const [hStr, mStr] = String(time).split(":");
  const h = Number(hStr);
  if (!Number.isFinite(h)) return time;
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${mStr || "00"}`;
}

export function TodayMultiChildView({ children, todayEvents, onSelectChild }) {
  const eventsByChild = useMemo(() => {
    const map = new Map();
    for (const c of children || []) map.set(c.id, eventsForChild(todayEvents, c.id));
    return map;
  }, [children, todayEvents]);

  const today = new Date();
  const todayLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 (${"일월화수목금토"[today.getDay()]})`;

  return (
    <div className="hyeni-v5-parent-main" aria-label="오늘 가족 일정" style={{ fontFamily: FF }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 11, color: "var(--hyeni-pink-deep)", fontWeight: "var(--weight-bold)", letterSpacing: 0.5 }}>오늘</div>
        <div style={{ fontSize: 24, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)", marginTop: 2 }}>{todayLabel}</div>
        <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginTop: 4, fontWeight: "var(--weight-medium)" }}>
          카드를 탭하면 그 아이의 상세 일정이 열려요
        </div>
      </div>

      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {(children || []).map((child) => {
          const list = eventsByChild.get(child.id) || [];
          const color = child.color_hex || "#A78BFA";
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onSelectChild?.(child.id)}
              aria-label={`${child.name} 오늘 일정 ${list.length}건. 누르면 상세 보기`}
              className="card card-interactive"
              style={{
                textAlign: "left",
                borderLeft: `4px solid ${color}`,
                padding: "16px 16px 14px",
                fontFamily: FF,
                transition: "transform 0.12s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: list.length > 0 ? 12 : 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--radius-full)",
                    background: child.photo_url ? `url(${child.photo_url}) center/cover` : color,
                    border: `2px solid ${color}`,
                    flexShrink: 0,
                    color: "white",
                    fontWeight: "var(--weight-bold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                  }}
                >
                  {child.photo_url ? "" : (child.emoji || (child.name?.trim?.()[0] ?? "👶"))}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.name}</div>
                  <div style={{ fontSize: 13, color: list.length > 0 ? "var(--hyeni-pink-deep)" : "var(--fg-secondary)", marginTop: 3, fontWeight: list.length > 0 ? "var(--weight-bold)" : "var(--weight-medium)" }}>
                    {list.length === 0 ? "오늘 일정이 없어요" : `오늘 일정 ${list.length}건`}
                  </div>
                </div>
                <span aria-hidden="true" style={{ color: "var(--fg-tertiary)", fontSize: 20, fontWeight: "var(--weight-medium)" }}>›</span>
              </div>

              {list.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.slice(0, 4).map((ev) => (
                    <li
                      key={ev.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        background: "var(--bg-subtle)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: "var(--weight-bold)", color, minWidth: 64, fontSize: 12 }}>{formatTime(ev.time)}</span>
                      <span style={{ color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "var(--weight-medium)", fontSize: 14 }}>
                        {ev.is_family_event ? "👨‍👩‍👧 " : ""}
                        {ev.title || ev.name || "일정"}
                      </span>
                    </li>
                  ))}
                  {list.length > 4 && (
                    <li style={{ fontSize: 12, color: "var(--fg-tertiary)", paddingLeft: 4, fontWeight: "var(--weight-medium)" }}>+{list.length - 4}건 더</li>
                  )}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
