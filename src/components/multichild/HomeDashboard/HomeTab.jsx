// src/components/multichild/HomeDashboard/HomeTab.jsx
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";
import { formatDeviceDuration } from "../../../lib/deviceFormat.js";

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return [];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

function deriveScreenLabel(deviceStatus) {
  if (!deviceStatus) return null;
  const ms = Number(deviceStatus.screenOnMs);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return formatDeviceDuration(ms);
}

export function HomeTab({ children, positions, events, childLocations, childDeviceStatusMap, onMapTap, onSelectChild }) {
  const sectionLabelStyle = {
    fontSize: 12,
    fontWeight: "var(--weight-label)",
    color: "#9CA3AF",
    letterSpacing: 0.2,
    marginBottom: 12,
  };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <h3 style={sectionLabelStyle}>
          자녀 ({children.length}명){onSelectChild ? " — 탭하여 관리" : ""}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {children.map((c) => (
            <ChildSummaryCard
              key={c.user_id || c.id} child={c}
              location={childLocations[c.user_id]?.label}
              safetyDots={deriveSafetyDots(childDeviceStatusMap[c.user_id])}
              screenLabel={deriveScreenLabel(childDeviceStatusMap[c.user_id])}
              onClick={onSelectChild}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 style={sectionLabelStyle}>위치</h3>
        <MiniMap children={children} positions={positions} onTap={onMapTap} />
      </section>

      <section>
        <h3 style={sectionLabelStyle}>오늘 일정</h3>
        <TodayEventsList events={events} children={children} />
      </section>
    </div>
  );
}
