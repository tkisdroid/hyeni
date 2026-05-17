// src/components/multichild/EventModal/EventSheet.jsx
// Phase 2 spec section 3.3 — 일정 모달 → bottom sheet 80vh.
// Wraps existing event form (title/time/category/children/location/memo) in a swipe-down sheet.
// 자체 구현 (vaul 의존성 없이) — drag handle + backdrop click + swipe-down 종료.

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackHandler } from "../../../lib/backHandler.js";
import { appConfirm } from "../../../lib/appConfirm.js";

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
    const dragOffsetYRef = useRef(0);
    const dragCleanupRef = useRef(null);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isClosing, setIsClosing] = useState(false);
    const [isSheetDragging, setIsSheetDragging] = useState(false);

    // Lock body scroll while sheet open
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
            if (typeof dragCleanupRef.current === "function") {
                dragCleanupRef.current();
                dragCleanupRef.current = null;
            }
        };
    }, [open]);

    // Capacitor 하드웨어 백키 — 시트가 열린 상태에서만 가로채 닫음
    useBackHandler(() => {
        if (!open) return false;
        if (typeof onClose === "function") onClose();
        return true;
    });

    const requestClose = useCallback(async () => {
        if (isDirty && !(await appConfirm({
            title: "변경사항이 있어요",
            message: "저장하지 않고 닫을까요?",
            confirmLabel: "닫기",
            cancelLabel: "계속 편집",
            tone: "danger",
        }))) return;
        setIsClosing(true);
        window.setTimeout(() => {
            setIsClosing(false);
            dragOffsetYRef.current = 0;
            setDragOffsetY(0);
            if (typeof onClose === "function") onClose();
        }, 240);
    }, [isDirty, onClose]);

    const handleBackdropClick = useCallback((event) => {
        if (event.target === event.currentTarget) requestClose();
    }, [requestClose]);

    const setSheetDragOffset = useCallback((offset) => {
        dragOffsetYRef.current = offset;
        setDragOffsetY(offset);
    }, []);

    const finishDrag = useCallback((finalOffset) => {
        if (typeof dragCleanupRef.current === "function") {
            dragCleanupRef.current();
            dragCleanupRef.current = null;
        }
        dragStartY.current = null;
        dragOffsetYRef.current = 0;
        setIsSheetDragging(false);
        if (finalOffset > 120) {
            requestClose();
        } else {
            setDragOffsetY(0);
        }
    }, [requestClose]);

    const canStartSheetDrag = useCallback((event) => {
        const target = event.target;
        if (!target?.closest?.(".event-sheet")) return false;
        // 인터랙티브/스크롤/입력 요소 위에서는 시트 드래그 시작 안 함 — 본래 동작 유지.
        if (target?.closest?.("input, textarea, select, button, a, label, [contenteditable=\"true\"], [role=\"button\"], [role=\"slider\"], [role=\"switch\"], [role=\"tab\"], [data-no-sheet-drag=\"true\"]")) {
            return false;
        }
        // 스크롤 영역 안에 있고, 스크롤이 맨 위가 아니라면 콘텐츠 스크롤이 우선이라 드래그 시작 안 함.
        const scrollContainer = target?.closest?.(".event-sheet-body");
        if (scrollContainer && scrollContainer.scrollTop > 0) return false;
        // 그 외 본문 어느 부분이든 아래로 끌어 닫기 허용.
        return true;
    }, []);

    const handleDragPointerDown = useCallback((event) => {
        if (event.button != null && event.button !== 0) return;
        if (!canStartSheetDrag(event)) return;
        if (dragStartY.current != null) return;
        event.preventDefault();
        dragStartY.current = event.clientY;
        dragOffsetYRef.current = 0;
        setIsSheetDragging(true);
        if (typeof dragCleanupRef.current === "function") {
            dragCleanupRef.current();
            dragCleanupRef.current = null;
        }
        const pointerId = event.pointerId;
        const handleMove = (pointerEvent) => {
            if (pointerEvent.pointerId !== pointerId || dragStartY.current == null) return;
            const dy = pointerEvent.clientY - dragStartY.current;
            if (dy > 4) pointerEvent.preventDefault();
            setSheetDragOffset(Math.max(0, dy));
        };
        const handleEnd = (pointerEvent) => {
            if (pointerEvent.pointerId !== pointerId || dragStartY.current == null) return;
            const dy = Math.max(0, pointerEvent.clientY - dragStartY.current);
            finishDrag(Math.max(dy, dragOffsetYRef.current));
        };
        const handleMouseMove = (mouseEvent) => {
            if (dragStartY.current == null) return;
            const dy = mouseEvent.clientY - dragStartY.current;
            if (dy > 4) mouseEvent.preventDefault();
            setSheetDragOffset(Math.max(0, dy));
        };
        const handleMouseEnd = (mouseEvent) => {
            if (dragStartY.current == null) return;
            const dy = Math.max(0, mouseEvent.clientY - dragStartY.current);
            finishDrag(Math.max(dy, dragOffsetYRef.current));
        };
        window.addEventListener("pointermove", handleMove, { passive: false });
        window.addEventListener("pointerup", handleEnd);
        window.addEventListener("pointercancel", handleEnd);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseEnd);
        dragCleanupRef.current = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleEnd);
            window.removeEventListener("pointercancel", handleEnd);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseEnd);
        };
    }, [canStartSheetDrag, finishDrag, setSheetDragOffset]);

    const handleDragMouseDown = useCallback((event) => {
        if (event.button !== 0) return;
        if (!canStartSheetDrag(event)) return;
        if (dragStartY.current != null) return;
        event.preventDefault();
        dragStartY.current = event.clientY;
        dragOffsetYRef.current = 0;
        setIsSheetDragging(true);
        if (typeof dragCleanupRef.current === "function") {
            dragCleanupRef.current();
            dragCleanupRef.current = null;
        }
        const handleMove = (mouseEvent) => {
            if (dragStartY.current == null) return;
            const dy = mouseEvent.clientY - dragStartY.current;
            if (dy > 4) mouseEvent.preventDefault();
            setSheetDragOffset(Math.max(0, dy));
        };
        const handleEnd = (mouseEvent) => {
            if (dragStartY.current == null) return;
            const dy = Math.max(0, mouseEvent.clientY - dragStartY.current);
            finishDrag(Math.max(dy, dragOffsetYRef.current));
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleEnd);
        dragCleanupRef.current = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleEnd);
        };
    }, [canStartSheetDrag, finishDrag, setSheetDragOffset]);

    useEffect(() => {
        if (!open) return undefined;
        const handleWindowPointerDown = (event) => {
            if (dragStartY.current != null) return;
            if (!canStartSheetDrag(event)) return;
            handleDragPointerDown(event);
        };
        const handleWindowMouseDown = (event) => {
            if (dragStartY.current != null) return;
            if (!canStartSheetDrag(event)) return;
            handleDragMouseDown(event);
        };
        window.addEventListener("pointerdown", handleWindowPointerDown, true);
        window.addEventListener("mousedown", handleWindowMouseDown, true);
        return () => {
            window.removeEventListener("pointerdown", handleWindowPointerDown, true);
            window.removeEventListener("mousedown", handleWindowMouseDown, true);
        };
    }, [open, canStartSheetDrag, handleDragPointerDown, handleDragMouseDown]);

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
                onPointerDownCapture={handleDragPointerDown}
                onMouseDownCapture={handleDragMouseDown}
                style={{
                    transform: `translateY(${dragOffsetY}px)`,
                    transition: !isSheetDragging
                        ? `transform var(--duration-sheet-close) var(--easing-sheet)${isClosing ? "" : ""}`
                        : "none",
                    ...(isClosing ? { animation: "none", transform: "translateY(100%)", opacity: 0 } : null),
                }}
            >
                <button
                    type="button"
                    className="event-sheet-handle"
                    onPointerDown={handleDragPointerDown}
                    onMouseDown={handleDragMouseDown}
                    aria-label="아래로 끌어 닫기"
                    style={{ border: "none", background: "transparent" }}
                />
                <div
                    className="event-sheet-header"
                    onPointerDown={handleDragPointerDown}
                    onMouseDown={handleDragMouseDown}
                >
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
