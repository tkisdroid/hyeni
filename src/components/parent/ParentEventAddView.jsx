// src/components/parent/ParentEventAddView.jsx
// 일정등록 탭 view — 오늘 날짜 default form 즉시 노출.
// EventSheet의 children prop에 들어가는 form 본체는 App.jsx에서 inject.

import { EventSheet } from "../multichild/EventModal/EventSheet.jsx";

export function ParentEventAddView({ children, onSave, onClose, canSave, saveLabel, isDirty, bottomNavigation }) {
  return (
    <>
      <EventSheet
        open
        title="새 일정"
        saveLabel={saveLabel || "저장"}
        onClose={onClose}
        onSave={onSave}
        canSave={canSave}
        isDirty={isDirty}
      >
        {children}
      </EventSheet>
      {bottomNavigation}
    </>
  );
}
