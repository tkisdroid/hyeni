// src/components/multichild/HomeDashboard/HomeTab.jsx
// 옵션 C — 자녀 선택 hub. hero/대시보드 제거, ChildSelectCard 리스트만.

import { ChildSelectCard } from "./ChildSelectCard.jsx";

export function HomeTab({
  children = [],
  deviceStatusByChildId = {},
  locationByChildId = {},
  nextEventByChildId = {},
  onSelectChild,
}) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-card-soft, #FAFAF7)", minHeight: "100%" }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--fg-primary, #1F2A24)" }}>아이 선택</h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--fg-secondary)" }}>관리할 아이를 선택해주세요</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children.map((c) => (
          <ChildSelectCard
            key={c.id}
            child={c}
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
