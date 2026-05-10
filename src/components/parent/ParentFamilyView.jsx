// src/components/parent/ParentFamilyView.jsx
// 가족 탭 — familyId 유무로 페어링 vs 관리 분기.

export function ParentFamilyView({ bottomNavigation, children }) {
  return (
    <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
      {children}
      {bottomNavigation}
    </div>
  );
}
