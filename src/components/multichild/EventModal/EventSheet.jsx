// src/components/multichild/EventModal/EventSheet.jsx
// Phase 2 spec section 3.3 — 일정 모달 → bottom sheet 80vh.
// Wraps existing event form (title/time/category/children/location/memo) in a swipe-down sheet.
// 자체 구현 (vaul 의존성 없이) — drag handle + backdrop click + swipe-down 종료.

import { useEffect, useRef, useState } from "react";

export function EventSheet({
    open,
    title = "일정",
    onClose,
    onSave,
    canSave = true,
    saveLabel = "저장",
    children,
    quick = false,
    isDirty = false,
}) {
    const sheetRef = useRef(null);
    const dragStartY = useRef(null);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isClosing, setIsClosing] = useState(false);

    // Lock body scroll while sheet open
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    const requestClose = () => {
        if (isDirty && !window.confirm("변경사항이 있어요. 정말 닫을까요?")) return;
        setIsClosing(true);
        window.setTimeout(() => {
            setIsClosing(false);
            setDragOffsetY(0);
            if (typeof onClose === "function") onClose();
        }, 240);
    };

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) requestClose();
    };

    const handleHandlePointerDown = (event) => {
        dragStartY.current = event.clientY;
    };
    const handleHandlePointerMove = (event) => {
        if (dragStartY.current == null) return;
        const dy = event.clientY - dragStartY.current;
        if (dy > 0) setDragOffsetY(dy);
    };
    const handleHandlePointerUp = () => {
        if (dragStartY.current == null) return;
        if (dragOffsetY > 120) {
            requestClose();
        } else {
            setDragOffsetY(0);
        }
        dragStartY.current = null;
    };

    if (!open) return null;

    return (
        <>
            <div
                className="event-sheet-backdrop"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />
            <div
                ref={sheetRef}
                className={`event-sheet${quick ? " event-sheet-quick" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={{
                    transform: `translateY(${dragOffsetY}px)`,
                    transition: dragStartY.current == null
                        ? `transform var(--duration-sheet-close) var(--easing-sheet)${isClosing ? "" : ""}`
                        : "none",
                    ...(isClosing ? { animation: "none", transform: "translateY(100%)", opacity: 0 } : null),
                }}
            >
                <button
                    type="button"
                    className="event-sheet-handle"
                    onPointerDown={handleHandlePointerDown}
                    onPointerMove={handleHandlePointerMove}
                    onPointerUp={handleHandlePointerUp}
                    onPointerCancel={handleHandlePointerUp}
                    aria-label="아래로 끌어 닫기"
                    style={{ border: "none", padding: 0, cursor: "grab" }}
                />
                <div className="event-sheet-header">
                    <button type="button" className="sheet-cancel" onClick={requestClose}>취소</button>
                    <span className="sheet-title">{title}</span>
                    <button
                        type="button"
                        className="sheet-save"
                        onClick={onSave}
                        disabled={!canSave}
                    >
                        {saveLabel}
                    </button>
                </div>
                <div className="event-sheet-body">
                    {children}
                </div>
            </div>
        </>
    );
}
