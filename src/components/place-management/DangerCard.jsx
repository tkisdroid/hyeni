import React from "react";

const FONT = "var(--font-sans)";

export default function DangerCard({
    list = [],
    locked = false,
    dangerTypes = [],
    onAddNew,
    onRemove,
}) {
    const isEmpty = list.length === 0;

    return (
        <section
            className="card"
            aria-labelledby="danger-card-title"
            style={{
                padding: "var(--space-5)",
                marginBottom: "var(--space-4)",
                background: "var(--status-cautionary-subtle)",
                fontFamily: FONT,
            }}
        >
            <header style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div aria-hidden="true" style={{ fontSize: 28, lineHeight: 1 }}>⚠️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2
                        id="danger-card-title"
                        style={{
                            margin: 0,
                            fontSize: 17,
                            fontWeight: "var(--weight-bold)",
                            color: "var(--status-cautionary-strong)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        조심할 곳
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
                        아이가 근접 시 알림을 드려요
                    </p>
                </div>
                {locked && (
                    <div
                        aria-label="유료에서 무제한"
                        title="유료 계정은 무제한 등록"
                        style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            background: "var(--bg-base)",
                            color: "var(--fg-tertiary)",
                            fontWeight: "var(--weight-bold)",
                        }}
                    >
                        🔒
                    </div>
                )}
            </header>

            {isEmpty ? (
                <div
                    role="region"
                    aria-label="조심할 곳 빈 상태"
                    style={{
                        padding: "var(--space-4) 0",
                        fontSize: 13,
                        color: "var(--fg-secondary)",
                        lineHeight: 1.5,
                    }}
                >
                    공사장·큰길 같은 곳을 등록하면 아이가 근접할 때 푸시로 알려드려요
                </div>
            ) : (
                <ul
                    aria-label="조심할 곳 목록"
                    style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                    }}
                >
                    {list.map((zone) => {
                        const type = dangerTypes.find(t => t.id === zone.zone_type) || dangerTypes[dangerTypes.length - 1];
                        return (
                            <li
                                key={zone.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-3)",
                                    padding: "var(--space-3)",
                                    borderRadius: "var(--radius-control)",
                                    background: "var(--bg-base)",
                                    border: "1px solid var(--line-soft)",
                                }}
                            >
                                <div aria-hidden="true" style={{ fontSize: 22 }}>{type?.emoji || "⚠️"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: "var(--weight-bold)", fontSize: 14, color: "var(--fg-primary)" }}>
                                        {zone.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>
                                        {type?.label || "기타"} · 반경 {zone.radius_m || 200}m
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    aria-label={`${zone.name} 삭제`}
                                    onClick={() => onRemove?.(zone)}
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
                            </li>
                        );
                    })}
                </ul>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                {locked && (
                    <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}>
                        유료에서 무제한
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => onAddNew?.()}
                    style={{
                        padding: "var(--space-2) var(--space-4)",
                        borderRadius: "var(--radius-control)",
                        border: "none",
                        background: locked ? "var(--bg-muted)" : "var(--status-cautionary-strong)",
                        color: locked ? "var(--fg-tertiary)" : "var(--bg-base)",
                        fontSize: 13,
                        fontWeight: "var(--weight-semibold)",
                        cursor: "pointer",
                        fontFamily: FONT,
                    }}
                >
                    + 조심할 곳
                </button>
            </div>
        </section>
    );
}
