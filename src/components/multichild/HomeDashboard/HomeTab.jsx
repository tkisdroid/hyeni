// src/components/multichild/HomeDashboard/HomeTab.jsx
// 부모 홈: HomeGreeting → BigStat(날짜) → NextEventHero → 자녀 status (+ 지도 inline) → 오늘 일정.
// 다자녀 환경 정보 위계 재구성 — "다음 일정" 시각적 anchor + 자녀 통합 상태.
import { useState } from "react";
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";
import { HomeBigStat } from "./HomeBigStat.jsx";
import { NextEventHero } from "./NextEventHero.jsx";
import { HomeGreeting } from "./HomeGreeting.jsx";
import { HyeniMascot } from "../../auth/HyeniMascot.jsx";
import { formatDeviceDuration } from "../../../lib/deviceFormat.js";

const STYLE_SECTION_HEAD_MASCOT = {
  width: 36,
  height: 36,
  background: "var(--cartoon-bg-chip)",
  border: "1px solid var(--cartoon-line)",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "flex-end",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
  marginRight: "var(--space-2)",
};

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
  const isMultiChild = children.length >= 2;

  const childCardCommonProps = (c) => ({
    child: c,
    location: childLocations[c.user_id]?.label,
    safetyDots: deriveSafetyDots(childDeviceStatusMap[c.user_id]),
    screenLabel: deriveScreenLabel(childDeviceStatusMap[c.user_id]),
    onClick: onSelectChild,
    density,
  });

  const renderChildCards = () => {
    if (density === "mini") {
      return (
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
      );
    }
    if (density === "row" && isMultiChild) {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "var(--space-2)",
          }}
        >
          {children.map((c) => (
            <ChildSummaryCard key={c.user_id || c.id} {...childCardCommonProps(c)} />
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {children.map((c) => (
          <ChildSummaryCard key={c.user_id || c.id} {...childCardCommonProps(c)} />
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: "var(--space-screen-pad)", display: "flex", flexDirection: "column", gap: "var(--space-screen-gap)" }}>
      <HomeGreeting />

      <HomeBigStat events={events} showNextEvent={false} />

      <NextEventHero events={events} children={children} childLocations={childLocations} />

      <section>
        <div className="hyeni-section-head" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
            <div style={STYLE_SECTION_HEAD_MASCOT} aria-hidden="true">
              <HyeniMascot size={32} variant="static" aria-label="" />
            </div>
            <h3 className="t-section-label" style={{ marginBottom: 0 }}>
              아이 {children.length}명{onSelectChild ? " · 지금 어디?" : ""}
            </h3>
          </div>
          <button
            type="button"
            className="hyeni-section-toggle"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            aria-controls="home-map-region"
          >
            <span aria-hidden="true">🗺️</span>
            <span>{mapOpen ? "지도 접기" : "지도 보기"}</span>
          </button>
        </div>
        {mapOpen && (
          <div id="home-map-region" style={{ marginBottom: "var(--space-3)" }}>
            <MiniMap children={children} positions={positions} onTap={onMapTap} />
          </div>
        )}
        {renderChildCards()}
      </section>

      <section>
        <h3 className="t-section-label">오늘 일정</h3>
        <TodayEventsList events={events} children={children} />
      </section>
    </div>
  );
}
