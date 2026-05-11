import React from "react";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const FONT = "var(--font-sans)";

export default function SavedPlacesSection({
    list = [],
    locked = false,
    onAddNew,
    onAddSafe,
    onEdit,
    onRemove,
}) {
    const isEmpty = list.length === 0;

    return (
        <section
            aria-labelledby="saved-places-title"
            style={{
                marginBottom: "var(--space-4)",
                fontFamily: FONT,
            }}
        >
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    paddingBottom: "var(--space-2)",
                    borderBottom: "1px solid var(--line-soft)",
                    marginBottom: "var(--space-3)",
                }}
            >
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                        id="saved-places-title"
                        style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: "var(--weight-bold)",
                            color: "var(--fg-secondary)",
                            letterSpacing: "0.02em",
                        }}
                    >
                        자주 가는 장소 ({list.length})
                    </h3>
                    <p
                        style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "var(--fg-tertiary)",
                            fontWeight: "var(--weight-medium)",
                        }}
                    >
                        집·도서관처럼 일정과 길찾기에 자주 쓰는 장소
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="자주 가는 장소 추가"
                    onClick={() => onAddNew?.()}
                    style={{
                        padding: "var(--space-1) var(--space-3)",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--line-soft)",
                        background: locked ? "var(--bg-muted)" : "var(--bg-base)",
                        color: locked ? "var(--fg-tertiary)" : "var(--fg-secondary)",
                        fontSize: 12,
                        fontWeight: "var(--weight-semibold)",
                        cursor: "pointer",
                        fontFamily: FONT,
                        flexShrink: 0,
                    }}
                >
                    + 장소
                </button>
            </header>

            {locked && (
                <div
                    role="status"
                    style={{
                        fontSize: 11,
                        color: "var(--fg-tertiary)",
                        fontWeight: "var(--weight-medium)",
                        marginBottom: "var(--space-2)",
                    }}
                >
                    유료에서 무제한 — 안전장소는 무료에서도 무제한 등록 가능
                </div>
            )}

            {isEmpty ? (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-2)",
                        alignItems: "center",
                        padding: "var(--space-3) 0",
                    }}
                >
                    <span style={{ fontSize: 12, color: "var(--fg-tertiary)", marginRight: "var(--space-2)" }}>
                        아직 없어요
                    </span>
                    <button
                        type="button"
                        onClick={() => onAddSafe?.()}
                        style={{
                            padding: "var(--space-1) var(--space-3)",
                            borderRadius: "var(--radius-full)",
                            border: "1px dashed var(--status-positive-strong)",
                            background: "var(--status-positive-subtle)",
                            color: "var(--status-positive-strong)",
                            fontSize: 12,
                            fontWeight: "var(--weight-semibold)",
                            cursor: "pointer",
                            fontFamily: FONT,
                        }}
                    >
                        <span aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}>
                            <ThreeDIcon name="shield-heart" size={14} aria-label="" />
                        </span>
                        안전장소 추가
                    </button>
                </div>
            ) : (
                <ul
                    aria-label="자주 가는 장소 목록"
                    style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-2)",
                    }}
                >
                    {list.map((place, idx) => (
                        <li
                            key={place.id || idx}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "var(--space-1) var(--space-2) var(--space-1) var(--space-3)",
                                borderRadius: "var(--radius-full)",
                                border: "1px solid var(--line-soft)",
                                background: place.is_playdate_safe ? "var(--status-positive-subtle)" : "var(--bg-subtle)",
                                fontSize: 12,
                                fontWeight: "var(--weight-semibold)",
                                color: place.is_playdate_safe ? "var(--status-positive-strong)" : "var(--fg-primary)",
                                fontFamily: FONT,
                                minWidth: 0,
                                maxWidth: "100%",
                                overflow: "hidden",
                            }}
                        >
                            <span aria-hidden="true" style={{ display: "inline-flex", width: 16, height: 16, flexShrink: 0 }}>
                                <ThreeDIcon name={place.is_playdate_safe ? "shield-heart" : "pin"} size={16} aria-label="" />
                            </span>
                            <button
                                type="button"
                                aria-label={`${place.name} 수정`}
                                onClick={() => onEdit?.(idx)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    fontFamily: FONT,
                                    fontSize: 12,
                                    fontWeight: "var(--weight-semibold)",
                                    color: "inherit",
                                    flex: "1 1 auto",
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {place.name}
                            </button>
                            <button
                                type="button"
                                aria-label={`${place.name} 삭제`}
                                onClick={() => onRemove?.(idx)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: "0 var(--space-1)",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    color: "var(--fg-tertiary)",
                                fontFamily: FONT,
                                flexShrink: 0,
                            }}
                        >
                            ✕
                            </button>
                        </li>
                    ))}
                    <li>
                        <button
                            type="button"
                            aria-label="안전장소 추가"
                            onClick={() => onAddSafe?.()}
                            style={{
                                padding: "var(--space-1) var(--space-3)",
                                borderRadius: "var(--radius-full)",
                                border: "1px dashed var(--status-positive-strong)",
                                background: "var(--status-positive-subtle)",
                                color: "var(--status-positive-strong)",
                                fontSize: 12,
                                fontWeight: "var(--weight-semibold)",
                                cursor: "pointer",
                                fontFamily: FONT,
                            }}
                        >
                            <span aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 2 }}>
                                <ThreeDIcon name="shield-heart" size={14} aria-label="" />
                            </span>
                            +
                        </button>
                    </li>
                </ul>
            )}
        </section>
    );
}
