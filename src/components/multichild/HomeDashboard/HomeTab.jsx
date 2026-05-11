// src/components/multichild/HomeDashboard/HomeTab.jsx
// 옵션 C — 자녀 선택 hub. 큰 hero 타이틀 + 우측 3D 일러스트 + ChildSelectCard 리스트.

import { ChildSelectCard } from "./ChildSelectCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { ThreeDIcon } from "../../icons/ThreeDIcon.jsx";

export function HomeTab({
  children = [],
  deviceStatusByChildId = {},
  locationByChildId = {},
  nextEventByChildId = {},
  positions = [],
  unreadAlertCount = 0,
  recentAlertTitle = "",
  onOpenAlertCenter,
  onSelectChild,
  onTapMap,
}) {
  return (
    <div style={{ padding: "8px 16px 24px", display: "flex", flexDirection: "column", gap: 14, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 2px 12px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            color: "var(--fg-primary, #1F2A24)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}>아이 선택</h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--fg-secondary, #5F6368)",
            lineHeight: 1.4,
            wordBreak: "keep-all",
          }}>관리할 아이를 선택해 주세요</p>
        </div>
        <div aria-hidden="true" style={{
          position: "relative",
          flexShrink: 0,
          width: 110,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <ThreeDIcon name="calendar-heart" size={88} aria-label="" />
          <span style={{ position: "absolute", top: 4, right: 4, fontSize: 14, opacity: 0.85 }}>♥</span>
          <span style={{ position: "absolute", top: 18, left: -2, fontSize: 12, opacity: 0.65 }}>✨</span>
          <span style={{ position: "absolute", bottom: 6, right: -2, fontSize: 16 }}>⭐</span>
        </div>
      </div>
      {typeof onOpenAlertCenter === "function" && (
        <button
          type="button"
          onClick={onOpenAlertCenter}
          aria-label={unreadAlertCount > 0 ? `새 알림 ${unreadAlertCount}건 — 알림 센터 열기` : "알림 센터 열기"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: unreadAlertCount > 0
              ? "linear-gradient(135deg, var(--brand-rose-soft, #FFE2EC) 0%, #FFFDF8 100%)"
              : "#FFFFFF",
            border: `1px solid ${unreadAlertCount > 0 ? "var(--brand-rose-line, #FFD0DD)" : "var(--line-soft, #F1ECEE)"}`,
            borderRadius: 22,
            boxShadow: unreadAlertCount > 0 ? "0 6px 16px rgba(247,121,168,0.16)" : "0 4px 12px rgba(31,24,28,0.04)",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span aria-hidden="true" style={{ position: "relative", flexShrink: 0, fontSize: 30, lineHeight: 1 }}>
            🔔
            {unreadAlertCount > 0 && (
              <span style={{ position: "absolute", top: -4, right: -6, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "var(--brand-rose, #F779A8)", color: "#FFFFFF", fontSize: 10.5, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #FFFFFF" }}>
                {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
              </span>
            )}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--fg-primary, #1F2A24)", letterSpacing: "-0.01em" }}>
              알림 센터
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: unreadAlertCount > 0 ? "var(--brand-rose-text, #B83262)" : "var(--fg-secondary, #5F6368)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {unreadAlertCount > 0
                ? (recentAlertTitle ? `${recentAlertTitle}` : `새 알림 ${unreadAlertCount}건`)
                : "새 알림이 없어요"}
            </div>
          </div>
          <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 18, fontWeight: 900, color: "var(--fg-secondary, #5F6368)" }}>›</span>
        </button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children.map((c, idx) => (
          <ChildSelectCard
            key={c.id}
            child={c}
            index={idx}
            deviceStatus={deviceStatusByChildId[c.user_id]}
            locationLabel={locationByChildId[c.user_id]}
            nextEventChip={nextEventByChildId[c.id]}
            onSelect={onSelectChild}
          />
        ))}
      </div>
      {positions.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <h2 style={{
            margin: "0 2px 8px",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--fg-secondary, #5F6368)",
            letterSpacing: "-0.01em",
          }}>아이들 현재 위치</h2>
          <MiniMap children={children} positions={positions} onTap={onTapMap} />
        </div>
      )}
    </div>
  );
}
