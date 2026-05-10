// src/components/multichild/HomeDashboard/ChildSummaryCard.jsx
// Phase 2 spec section 3.1 — density prop 추가 (full / row / mini).
// 자녀 수에 따라 변형: 1자녀 = full, 2-3 = row, 4+ = mini.

import { ChildAvatar } from "./ChildAvatar.jsx";
import { ThreeDIcon } from "../../icons/ThreeDIcon.jsx";

const DOT_COLORS = { green: "var(--status-positive)", yellow: "var(--status-cautionary)", red: "var(--status-negative)" };
const DOT_LABELS = ["배터리", "최근 위치", "앱 사용 가능"];
const DOT_STATE_LABELS = { green: "정상", yellow: "주의", red: "위험" };
const HOME_LOCATION_REGION_LABELS = new Set([
    "서울", "서울시", "서울특별시",
    "부산", "부산시", "부산광역시",
    "대구", "대구시", "대구광역시",
    "인천", "인천시", "인천광역시",
    "광주", "광주시", "광주광역시",
    "대전", "대전시", "대전광역시",
    "울산", "울산시", "울산광역시",
    "세종", "세종시", "세종특별자치시",
    "경기", "경기도",
    "강원", "강원도", "강원특별자치도",
    "충북", "충청북도",
    "충남", "충청남도",
    "전북", "전라북도", "전북특별자치도",
    "전남", "전라남도",
    "경북", "경상북도",
    "경남", "경상남도",
    "제주", "제주도", "제주특별자치도",
]);

function formatHomeLocationLabel(location) {
    const raw = String(location || "").trim().replace(/\s+/g, " ");
    if (!raw) return "";

    const parts = raw.split(" ").filter(Boolean);
    while (parts.length > 1 && HOME_LOCATION_REGION_LABELS.has(parts[0])) {
        parts.shift();
    }
    while (parts.length > 1 && /시$/.test(parts[0])) {
        parts.shift();
    }

    return parts.join(" ") || raw;
}

function deriveWorstColor(safetyDots = []) {
    if (safetyDots.includes("red")) return "red";
    if (safetyDots.includes("yellow")) return "yellow";
    return "green";
}

export function ChildSummaryCard({ child, location, safetyDots = [], screenLabel, batteryLevel = null, onClick, density = "full" }) {
    const interactive = typeof onClick === "function";
    const Wrapper = interactive ? "button" : "div";
    const worstColor = deriveWorstColor(safetyDots);
    const displayLocation = formatHomeLocationLabel(location);
    const childColor = child.color_hex || "var(--theme-accent)";

    const commonProps = {
        type: interactive ? "button" : undefined,
        onClick: interactive ? () => onClick(child.id) : undefined,
        "aria-label": interactive ? `${child.name} 보기` : undefined,
    };

    if (density === "mini") {
        // 4+ 자녀 — 가로 스크롤 mini square 카드
        return (
            <Wrapper
                {...commonProps}
                className={interactive ? "card card-interactive" : "card"}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    width: "var(--child-card-mini-size)",
                    height: "var(--child-card-mini-size)",
                    padding: "var(--space-2)",
                    textAlign: "center",
                    font: "inherit",
                    flexShrink: 0,
                    position: "relative",
                    borderTop: `4px solid ${childColor}`,
                    borderBottomLeftRadius: "var(--radius-md)",
                    borderBottomRightRadius: "var(--radius-md)",
                    borderTopLeftRadius: "var(--radius-md)",
                    borderTopRightRadius: "var(--radius-md)",
                }}
            >
                <ChildAvatar child={child} size={36} fontSize={14} />
                {safetyDots.length > 0 && (
                    <div
                        aria-label={`안전 상태 ${DOT_STATE_LABELS[worstColor]}`}
                        style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 6,
                            height: 6,
                            borderRadius: "var(--radius-full)",
                            background: DOT_COLORS[worstColor] || "var(--line-default)",
                        }}
                    />
                )}
            </Wrapper>
        );
    }

    if (density === "row") {
        const safeStateLabel = DOT_STATE_LABELS[worstColor] || "정상";
        const statusFill = DOT_COLORS[worstColor] || "var(--status-positive)";
        return (
            <Wrapper
                {...commonProps}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 10px",
                    background: "#FFFFFF",
                    border: "1px solid #EFEEEA",
                    borderRadius: 16,
                    textAlign: "left",
                    width: "100%",
                    minWidth: 0,
                    font: "inherit",
                    cursor: interactive ? "pointer" : "default",
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: `2px solid ${childColor}`,
                        background: "#FFFFFF",
                        flexShrink: 0,
                        overflow: "hidden",
                        boxSizing: "border-box",
                    }}
                >
                    <ChildAvatar child={child} size={34} fontSize={14} />
                </span>

                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#595959",
                        flexShrink: 1,
                        marginLeft: "auto",
                        whiteSpace: "nowrap",
                    }}
                >
                    <ThreeDIcon name="battery" size={14} aria-label="" />
                    {batteryLevel != null ? `${batteryLevel}%` : "—"}
                </span>

                <span
                    aria-label={`안전 상태 ${safeStateLabel}`}
                    title={safeStateLabel}
                    style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: statusFill,
                        flexShrink: 0,
                        boxShadow: "0 0 0 2px rgba(255,255,255,1), 0 0 0 3px rgba(0,0,0,0.04)",
                    }}
                />
            </Wrapper>
        );
    }

    // density === "full" (1자녀, 기본)
    return (
        <Wrapper
            {...commonProps}
            className={interactive ? "card card-interactive" : "card"}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 16,
                textAlign: "left",
                width: "100%",
                font: "inherit",
                borderLeft: `4px solid ${childColor}`,
                transition: "transform 0.12s ease",
            }}
        >
            <ChildAvatar child={child} size={52} fontSize={18} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{child.name}</div>
                <div
                    style={{
                        fontSize: 13,
                        color: "var(--fg-secondary)",
                        marginTop: 3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: "var(--weight-medium)",
                    }}
                >
                    📍 {displayLocation || "위치 확인 중..."}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 3, fontWeight: "var(--weight-medium)" }}>
                    오늘 화면켜짐 {screenLabel || "0분"}
                </div>
            </div>
            {safetyDots.length > 0 && (
                <div
                    aria-label={`안전 상태 ${DOT_STATE_LABELS[worstColor]}`}
                    title={safetyDots.map((c, i) => `${DOT_LABELS[i]}: ${DOT_STATE_LABELS[c] || "확인 불가"}`).join("\n")}
                    style={{ display: "flex", gap: 4, flexShrink: 0 }}
                >
                    {safetyDots.map((color, i) => (
                        <div
                            key={i}
                            data-safety-dot
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "var(--radius-full)",
                                background: DOT_COLORS[color] || "var(--line-default)",
                            }}
                        />
                    ))}
                </div>
            )}
        </Wrapper>
    );
}
