import { useRef, useState } from "react";
import { MapPin } from "lucide-react";

// Swipe-to-reveal width = 두 액션 버튼(수정/삭제) + 좌우 패딩
const ACTIONS_WIDTH = 144;
// 이 거리 이상 왼쪽으로 밀면 열린 상태로 스냅
const OPEN_THRESHOLD = 56;
// 이 거리 미만 이동은 스와이프가 아니라 탭으로 간주
const TAP_SLOP = 8;

/**
 * 부모 모드 일정 카드.
 * - 카드 탭: 일정 수정 모달 열기
 * - 카드를 왼쪽으로 스와이프: 뒤에서 "수정 / 삭제" 버튼 노출
 * 표시에 필요한 값은 모두 prop 으로 전달받는 순수 표현 컴포넌트.
 */
export function ParentScheduleCard({
    event,
    elementId,
    status,
    statusStyle,
    distanceLabel,
    whoLabel,
    timeLabel,
    fontFamily,
    onEdit,
    onDelete,
    onRoute,
}) {
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const startXRef = useRef(0);
    const startOffsetRef = useRef(0);
    const movedRef = useRef(false);

    const isOpen = offset <= -OPEN_THRESHOLD;

    const close = () => setOffset(0);

    const handlePointerDown = (pointerEvent) => {
        startXRef.current = pointerEvent.clientX;
        startOffsetRef.current = offset;
        movedRef.current = false;
        setDragging(true);
        try {
            pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        } catch {
            // setPointerCapture 미지원 환경 — 무시하고 진행
        }
    };

    const handlePointerMove = (pointerEvent) => {
        if (!dragging) return;
        const delta = pointerEvent.clientX - startXRef.current;
        if (Math.abs(delta) > TAP_SLOP) movedRef.current = true;
        const next = Math.min(0, Math.max(-ACTIONS_WIDTH, startOffsetRef.current + delta));
        setOffset(next);
    };

    const endDrag = () => {
        if (!dragging) return;
        setDragging(false);
        setOffset((current) => (current <= -OPEN_THRESHOLD ? -ACTIONS_WIDTH : 0));
    };

    const handleSurfaceClick = () => {
        if (movedRef.current) return;       // 스와이프였으면 탭으로 처리하지 않음
        if (offset !== 0) {                 // 열린 상태에서 탭하면 닫기만
            close();
            return;
        }
        onEdit();
    };

    const handleKeyDown = (keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
            keyboardEvent.preventDefault();
            onEdit();
        }
    };

    return (
        <div className="hyeni-sched-swipe">
            <div className="hyeni-sched-actions" aria-hidden={!isOpen}>
                <button
                    type="button"
                    className="hyeni-sched-action is-edit"
                    tabIndex={isOpen ? 0 : -1}
                    aria-label={`${event.title} 일정 수정`}
                    onClick={() => {
                        close();
                        onEdit();
                    }}
                >
                    <span aria-hidden="true">✏️</span>
                    <span>수정</span>
                </button>
                <button
                    type="button"
                    className="hyeni-sched-action is-delete"
                    tabIndex={isOpen ? 0 : -1}
                    aria-label={`${event.title} 일정 삭제`}
                    onClick={() => {
                        close();
                        onDelete();
                    }}
                >
                    <span aria-hidden="true">🗑️</span>
                    <span>삭제</span>
                </button>
            </div>

            <div
                id={elementId}
                role="button"
                tabIndex={0}
                aria-label={`${event.title} 편집 — 왼쪽으로 밀면 수정·삭제`}
                className={`hyeni-sched-surface hyeni-v5-event-card${status.current ? " is-current" : ""}${status.past ? " is-past" : ""}`}
                style={{
                    "--event-color": event.color || "var(--theme-accent)",
                    "--event-bg": event.bg || "var(--theme-accent-soft)",
                    fontFamily,
                    cursor: "pointer",
                    transform: `translateX(${offset}px)`,
                    transition: dragging ? "none" : "transform 0.22s var(--hyeni-ease-standard, ease)",
                    touchAction: "pan-y",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={handleSurfaceClick}
                onKeyDown={handleKeyDown}
            >
                <div className="hyeni-v5-event-icon">{event.emoji || "📌"}</div>
                <div className="hyeni-v5-event-body">
                    <div className="hyeni-v5-event-title">
                        <span className="hyeni-v5-event-title-text">{event.title}</span>
                        <span className="hyeni-v5-event-who">{whoLabel}</span>
                    </div>
                    <div className="hyeni-v5-event-meta">
                        <span className="hyeni-v5-event-time">{timeLabel}</span>
                        <span className="hyeni-v5-event-location">
                            {event.location?.address ? ` · ${event.location.address}` : " · 장소 미지정"}
                        </span>
                    </div>
                    <div className="hyeni-v5-event-chips">
                        {distanceLabel && (
                            <span className="hyeni-v5-chip distance" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <MapPin size={12} strokeWidth={1.75} />{distanceLabel}
                            </span>
                        )}
                        {event.memo && <span className="hyeni-v5-chip memo">📝 메모</span>}
                    </div>
                </div>
                <div className="hyeni-v5-event-tag" style={statusStyle || undefined}>{status.label}</div>
                {event.location && onRoute && (
                    <button
                        type="button"
                        aria-label={`${event.title} 경로 보기`}
                        title="경로 보기"
                        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onRoute();
                        }}
                        style={{
                            position: "absolute", top: 8, right: 10,
                            width: 28, height: 28, borderRadius: "50%",
                            border: "1px solid var(--bg-subtle)", background: "var(--bg-subtle)",
                            color: "#1D4ED8", fontSize: 13, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            zIndex: 1,
                        }}
                    >
                        🗺️
                    </button>
                )}
            </div>
        </div>
    );
}
