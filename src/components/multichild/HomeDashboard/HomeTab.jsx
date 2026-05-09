// src/components/multichild/HomeDashboard/HomeTab.jsx
// 부모 홈 — Phase 07 redesign. 큰 민트 그린 hero (요일·날짜 + 다음 일정 chip
// + wave 마스코트) → 오늘 일정 → 자녀 그리드 → 위치 지도 mini preview.
// Props interface 보존.

import { useState } from "react";
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";
import { formatDeviceDuration } from "../../../lib/deviceFormat.js";
import { HyeniMascot } from "../../auth/HyeniMascot.jsx";
import { ThreeDIcon } from "../../icons/ThreeDIcon.jsx";

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

const WEEKDAY_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function findNextEvent(events) {
  if (!events || events.length === 0) return null;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const nowKey = `${hh}:${mm}`;
  const sorted = [...events].sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  return sorted.find((e) => String(e.time || "") >= nowKey) || sorted[0] || null;
}

function formatNextEventChip(event) {
  if (!event) return null;
  const t = String(event.time || "");
  const [h, m] = t.split(":");
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return event.title || null;
  const ampm = hour < 12 ? "오전" : "오후";
  const hh12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mmStr = minute === 0 ? "" : ` ${minute}분`;
  return `${ampm} ${hh12}시${mmStr} ${event.title || "일정"}`;
}

export function HomeTab({ children, positions, events, childLocations, childDeviceStatusMap, onMapTap, onSelectChild }) {
  const [mapOpen, setMapOpen] = useState(false);
  const density = pickDensity(children.length);
  const isMultiChild = children.length >= 2;

  const childCardCommonProps = (c) => {
    const status = childDeviceStatusMap[c.user_id];
    const rawBattery = status?.batteryLevel;
    const batteryLevel = Number.isFinite(Number(rawBattery))
      ? Math.max(0, Math.min(100, Math.round(Number(rawBattery))))
      : (Number.isFinite(Number(c?.battery_level)) ? Number(c.battery_level) : null);
    return {
      child: c,
      location: childLocations[c.user_id]?.label,
      safetyDots: deriveSafetyDots(status),
      screenLabel: deriveScreenLabel(status),
      batteryLevel,
      onClick: onSelectChild,
      density,
    };
  };

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

  const today = new Date();
  const weekday = WEEKDAY_LABELS[today.getDay()];
  const monthDay = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const nextEvent = findNextEvent(events);
  const nextEventChip = formatNextEventChip(nextEvent);

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 20, background: "#FAFAF7" }}>
      <section
        aria-label="오늘"
        style={{
          position: "relative",
          background: "linear-gradient(160deg, #DDF3E5 0%, #C9EBD7 100%)",
          borderRadius: 24,
          padding: "20px",
          overflow: "hidden",
          minHeight: 200,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative", zIndex: 1, maxWidth: "55%" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2D7C53", letterSpacing: "-0.01em" }}>{weekday}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#1F2A24", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            {monthDay}
          </div>
          {nextEventChip && (
            <div
              style={{
                marginTop: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.6)",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                color: "#1F2A24",
                width: "fit-content",
                maxWidth: "100%",
              }}
            >
              <ThreeDIcon name="calendar-check" size={16} aria-label="" />
              <span style={{ color: "#3A8862" }}>다음 일정</span>
              <span aria-hidden="true" style={{ color: "#A892A0" }}>·</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextEventChip}</span>
            </div>
          )}
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <HyeniMascot variant="wave" size={156} aria-label="" />
        </div>
        <div aria-hidden="true" style={{ position: "absolute", right: 16, top: 12 }}>
          <ThreeDIcon name="heart" size={20} />
        </div>
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1F2A24", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ThreeDIcon name="calendar-heart" size={20} aria-label="" />
            오늘 일정
          </h3>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "#E5F5EC",
              color: "#2D7C53",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            전체 {events?.length || 0} ›
          </span>
        </div>
        <TodayEventsList events={events} children={children} />
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: "#1F2A24",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            <ThreeDIcon name="pin-heart" size={18} aria-label="" />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              아이 {children.length}명{onSelectChild ? " · 지금 어디?" : ""}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            aria-controls="home-map-region"
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "transparent",
              border: "none",
              color: "#3A8862",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">↻</span>
            지금 새로고침
          </button>
        </div>
        {renderChildCards()}
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1F2A24", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ThreeDIcon name="pin" size={20} aria-label="" />
            위치 지도
          </h3>
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "#E5F5EC",
              border: "none",
              color: "#2D7C53",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            {mapOpen ? "접기" : "펼치기"} ›
          </button>
        </div>
        <div id="home-map-region">
          <MiniMap children={children} positions={positions} onTap={onMapTap} />
        </div>
      </section>
    </div>
  );
}
