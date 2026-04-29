// src/components/multichild/HomeDashboard/HomeTab.jsx
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return [];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

export function HomeTab({ children, positions, events, childLocations, childDeviceStatusMap, onMapTap, onSelectChild }) {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          자녀 ({children.length}명){onSelectChild ? " — 탭하여 관리" : ""}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {children.map((c) => (
            <ChildSummaryCard
              key={c.user_id || c.id} child={c}
              location={childLocations[c.user_id]?.label}
              safetyDots={deriveSafetyDots(childDeviceStatusMap[c.user_id])}
              onClick={onSelectChild}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>위치</h3>
        <MiniMap children={children} positions={positions} onTap={onMapTap} />
      </section>

      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>오늘 일정</h3>
        <TodayEventsList events={events} children={children} />
      </section>
    </div>
  );
}
