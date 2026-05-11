import React from "react";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const FONT = "var(--font-sans)";

export default function AcademyCard({
    list = [],
    presets = [],
    categories = [],
    daysLabel = ["일", "월", "화", "수", "목", "금", "토"],
    onAddNew,
    onAddPreset,
    onEdit,
    onRemove,
}) {
    const isEmpty = list.length === 0;
    const remainingPresets = presets.filter(p => !list.some(a => a.name === p.label));

    return (
        <section
            className="card"
            aria-labelledby="academy-card-title"
            style={{
                padding: "var(--space-5)",
                marginBottom: "var(--space-4)",
                fontFamily: FONT,
            }}
        >
            <header style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div aria-hidden="true" style={{ lineHeight: 1 }}>
                    <ThreeDIcon name="school" size={32} aria-label="" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2
                        id="academy-card-title"
                        style={{
                            margin: 0,
                            fontSize: 17,
                            fontWeight: "var(--weight-bold)",
                            color: "var(--fg-primary)",
                            letterSpacing: 0,
                        }}
                    >
                        학원·일정 관리
                    </h2>
                    <p
                        style={{
                            margin: "var(--space-1) 0 0",
                            fontSize: 13,
                            fontWeight: "var(--weight-medium)",
                            color: "var(--fg-secondary)",
                            lineHeight: 1.45,
                        }}
                    >
                        일정이 자동으로 캘린더에 들어와요
                    </p>
                </div>
            </header>

            {isEmpty ? (
                <div
                    role="region"
                    aria-label="학원 빠른 추가"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                        padding: "var(--space-4) 0",
                    }}
                >
                    <div
                        style={{
                            fontSize: 13,
                            color: "var(--fg-secondary)",
                            lineHeight: 1.5,
                        }}
                    >
                        학원·자녀 활동을 등록하면 일정이 자동으로 캘린더에 들어와요
                    </div>
                    {remainingPresets.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                            {remainingPresets.map(p => (
                                <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => onAddPreset?.(p)}
                                    style={{
                                        padding: "var(--space-2) var(--space-3)",
                                        borderRadius: "var(--radius-control)",
                                        border: "1px dashed var(--line-default)",
                                        background: "var(--bg-subtle)",
                                        fontSize: 13,
                                        fontWeight: "var(--weight-bold)",
                                        cursor: "pointer",
                                        fontFamily: FONT,
                                        color: "var(--fg-secondary)",
                                    }}
                                >
                                    {p.emoji} {p.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <ul
                    aria-label="등록된 학원 목록"
                    style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                    }}
                >
                    {list.map((academy, i) => {
                        const category = categories.find(c => c.id === academy.category);
                        return (
                            <li
                                key={i}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-3)",
                                    padding: "var(--space-3)",
                                    borderRadius: "var(--radius-control)",
                                    background: academy.bg || "var(--bg-subtle)",
                                    borderLeft: `3px solid ${academy.color || "var(--line-default)"}`,
                                }}
                            >
                                <div aria-hidden="true" style={{ fontSize: 22 }}>{academy.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: "var(--weight-bold)", fontSize: 14, color: "var(--fg-primary)" }}>
                                        {academy.name}
                                    </div>
                                    {category?.label && (
                                        <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>
                                            {category.label}
                                        </div>
                                    )}
                                    {academy.schedule?.days?.length > 0 && (
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--theme-accent-text)",
                                                fontWeight: "var(--weight-bold)",
                                                marginTop: 3,
                                            }}
                                        >
                                            📅 {academy.schedule.days.map(d => daysLabel[d]).join(", ")} {academy.schedule.startTime}~{academy.schedule.endTime}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: "var(--space-1)" }}>
                                    <button
                                        type="button"
                                        aria-label={`${academy.name} 수정`}
                                        onClick={() => onEdit?.(i)}
                                        style={{
                                            background: "var(--bg-base)",
                                            border: "1px solid var(--line-soft)",
                                            borderRadius: "var(--radius-md)",
                                            padding: "var(--space-1) var(--space-2)",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontFamily: FONT,
                                        }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`${academy.name} 삭제`}
                                        onClick={() => onRemove?.(i)}
                                        style={{
                                            background: "var(--bg-base)",
                                            border: "1px solid var(--line-soft)",
                                            borderRadius: "var(--radius-md)",
                                            padding: "var(--space-1) var(--space-2)",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            color: "var(--status-negative)",
                                            fontFamily: FONT,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-3)" }}>
                <button
                    type="button"
                    onClick={() => onAddNew?.()}
                    style={{
                        padding: "var(--space-2) var(--space-4)",
                        borderRadius: "var(--radius-control)",
                        border: "none",
                        background: "var(--theme-accent-soft)",
                        color: "var(--theme-accent-text)",
                        fontSize: 13,
                        fontWeight: "var(--weight-semibold)",
                        cursor: "pointer",
                        fontFamily: FONT,
                    }}
                >
                    + 학원
                </button>
            </div>
        </section>
    );
}
