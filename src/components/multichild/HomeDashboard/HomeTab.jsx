// src/components/multichild/HomeDashboard/HomeTab.jsx
// 옵션 C — 자녀 선택 hub. 큰 hero 타이틀 + 우측 3D 일러스트 + ChildSelectCard 리스트.

import { ChildSelectCard } from "./ChildSelectCard.jsx";
import { ThreeDIcon } from "../../icons/ThreeDIcon.jsx";

export function HomeTab({
  children = [],
  deviceStatusByChildId = {},
  locationByChildId = {},
  nextEventByChildId = {},
  onSelectChild,
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
    </div>
  );
}
