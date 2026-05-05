// src/components/multichild/HomeDashboard/HomeTab.jsx
// Phase 2 spec section 3.1 — 부모 홈: BigStat → 오늘 일정 → 자녀 (density) → 위치 (collapsible).
import { useState } from "react";
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";
import { HomeBigStat } from "./HomeBigStat.jsx";
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

function pickDensity(count) {
  if (count <= 1) return "full";
  if (count <= 3) return "row";
  return "mini";
}

export function HomeTab({ children, positions, events, childLocations, childDeviceStatusMap, onMapTap, onSelectChild }) {
  const [mapOpen, setMapOpen] = useState(false);
  const density = pickDensity(children.length);

  const childCardCommonProps = (c) => ({
    child: c,
    location: childLocations[c.user_id]?.label,
    safetyDots: deriveSafetyDots(childDeviceStatusMap[c.user_id]),
    screenLabel: deriveScreenLabel(childDeviceStatusMap[c.user_id]),
    onClick: onSelectChild,
    density,
  });

  return (
    <div style={{ padding: "var(--space-screen-pad)", display: "flex", flexDirection: "column", gap: "var(--space-screen-gap)" }}>
      <HomeBigStat events={events} />

      <section>
        <h3 className="t-section-label">오늘 일정</h3>
        <TodayEventsList events={events} children={children} />
      </section>

      <section>
        <h3 className="t-section-label">
          아이 {children.length}명{onSelectChild ? " · 카드를 누르면 자세히 봐요" : ""}
        </h3>
        {density === "mini" ? (
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              overflowX: "auto",
              paddingBottom: "var(--space-2)",
              marginInline: "calc(-1 * var(--space-screen-pad))",
              paddingInline: "var(--space-screen-pad)",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children.map((c) => (
              <div key={c.user_id || c.id} style={{ scrollSnapAlign: "start" }}>
                <ChildSummaryCard {...childCardCommonProps(c)} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {children.map((c) => (
              <ChildSummaryCard key={c.user_id || c.id} {...childCardCommonProps(c)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setMapOpen((v) => !v)}
          aria-expanded={mapOpen}
          aria-controls="home-map-region"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "var(--space-3) 0",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            font: "inherit",
            color: "var(--fg-primary)",
          }}
        >
          <span className="t-section-label" style={{ marginBottom: 0 }}>위치 지도</span>
          <span aria-hidden="true" style={{ fontSize: 13, color: "var(--fg-tertiary)", fontWeight: "var(--weight-semibold)" }}>
            {mapOpen ? "접기 ▴" : "펼치기 ▾"}
          </span>
        </button>
        {mapOpen && (
          <div id="home-map-region" style={{ marginTop: "var(--space-2)" }}>
            <MiniMap children={children} positions={positions} onTap={onMapTap} />
          </div>
        )}
      </section>
    </div>
  );
}
