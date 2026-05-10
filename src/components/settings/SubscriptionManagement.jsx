// src/components/settings/SubscriptionManagement.jsx
// Premium Kawaii redesign — bunny mascot hero + plan grid + summary row.
// 기능(Qonversion 토글, deriveChildEntitlements, 가족 단위 합계) 보존.

import { useMemo, useState } from "react";
import { useChildSubscriptions, deriveChildEntitlements, totalMonthlyPrice } from "../../lib/childSubscriptions.js";
import { purchaseChildSlot } from "../../lib/qonversion.js";
import { CHILD_DEVICE_NOTE } from "../../lib/paywallCopy.js";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const PRICE_PER_CHILD_MONTHLY = 1500;
const ANNUAL_DISCOUNT_RATE = 0.33; // 4 months free 기준

function fmtKrw(n) {
    return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

function ChildSlot({ child, subscribed, busy, onToggle }) {
    const childName = child.name || "아이";
    const animalEmoji = child.emoji || "🐰";
    return (
        <button
            type="button"
            onClick={() => onToggle(child)}
            disabled={busy}
            aria-label={`${childName} ${subscribed ? "구독 해지" : "구독 시작"}`}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px 10px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 18,
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: busy ? 0.5 : 1,
                flex: 1,
                minWidth: 0,
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: subscribed ? "var(--brand-mint-soft, #DDF7EA)" : "#F0F7F2",
                    boxShadow: subscribed ? "0 4px 12px rgba(49,196,141,0.18)" : "none",
                    flexShrink: 0,
                }}
            >
                <AnimalIcon emoji={animalEmoji} size={42} aria-label="" />
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#202024", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
                    {childName}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: subscribed ? "var(--brand-mint-text, #087653)" : "#9A9AA0", marginTop: 2 }}>
                    {subscribed ? `${fmtKrw(PRICE_PER_CHILD_MONTHLY)}/월` : "무료"}
                </span>
            </span>
        </button>
    );
}

function PlanFeatureItem({ children }) {
    return (
        <li style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#202024", minWidth: 0 }}>
            <span
                aria-hidden="true"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--brand-mint, #31C48D)",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 900,
                    flexShrink: 0,
                }}
            >
                ✓
            </span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
        </li>
    );
}

export function SubscriptionManagement({ role, familyId, childList = [], onClose }) {
    if (role === "child") {
        return (
            <section
                className="card"
                style={{
                    padding: "var(--space-5) var(--space-4)",
                }}
            >
                <div style={{ fontSize: 16, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>구독 상태</div>
                <div style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--fg-secondary)", lineHeight: "var(--leading-normal)", fontWeight: "var(--weight-medium)" }}>{CHILD_DEVICE_NOTE}</div>
            </section>
        );
    }

    const { subs, refresh } = useChildSubscriptions(familyId);
    const ents = deriveChildEntitlements(childList, subs);
    const total = totalMonthlyPrice(subs);
    const subscribedCount = Object.values(ents).filter((e) => e.tier === "premium").length;
    const [busyChildId, setBusyChildId] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState("annual");

    const subscribedSet = useMemo(() => {
        const s = new Set();
        childList.forEach((c) => { if (ents[c.id]?.tier === "premium") s.add(c.id); });
        return s;
    }, [childList, ents]);

    async function handleToggleChild(child) {
        const isSubscribed = subscribedSet.has(child.id);
        setBusyChildId(child.id);
        try {
            if (!isSubscribed) {
                await purchaseChildSlot(child.child_order);
            } else {
                window.open("https://play.google.com/store/account/subscriptions", "_blank");
            }
            await refresh();
        } catch (err) {
            console.error("[SubscriptionManagement] toggle failed:", err);
        } finally {
            setBusyChildId(null);
        }
    }

    const annualPricePerChild = Math.round(PRICE_PER_CHILD_MONTHLY * 12 * (1 - ANNUAL_DISCOUNT_RATE));
    const monthlyPriceForCount = subscribedCount * PRICE_PER_CHILD_MONTHLY;
    const annualPriceForCount = subscribedCount * annualPricePerChild;
    const summaryPrice = selectedPlan === "annual" ? annualPriceForCount : monthlyPriceForCount;
    const summaryLabel = subscribedCount === 0
        ? "구독 없음"
        : `${fmtKrw(summaryPrice)}${selectedPlan === "annual" ? "/년" : "/월"}`;

    return (
        <section
            aria-label="혜니 프리미엄 구독"
            style={{
                position: "relative",
                background: "linear-gradient(165deg, #FFFDF8 0%, var(--brand-rose-soft, #FFE2EC) 100%)",
                borderRadius: 28,
                padding: "26px 22px 22px",
                boxShadow: "0 18px 44px rgba(31, 24, 28, 0.12)",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 22,
                overflow: "hidden",
            }}
        >
            {/* 닫기 X — 좌상단 */}
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    style={{
                        position: "absolute",
                        top: 16,
                        left: 16,
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        background: "linear-gradient(135deg, #FFFFFF 0%, var(--brand-rose-soft, #FFE2EC) 100%)",
                        color: "var(--brand-rose-text, #B83262)",
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(31,24,28,0.08)",
                        zIndex: 2,
                        fontFamily: "inherit",
                    }}
                >
                    ✕
                </button>
            )}

            {/* Hero — 타이틀 + 마스코트 */}
            <header style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, paddingLeft: 56, minHeight: 110 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#202024", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 8 }}>
                        혜니 프리미엄
                        <span aria-hidden="true" style={{ opacity: 0.85, display: "inline-flex" }}>
                            <ThreeDIcon name="sparkle" size={20} aria-label="" />
                        </span>
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#5F6368", letterSpacing: "-0.01em" }}>
                        자녀 1인당 {fmtKrw(PRICE_PER_CHILD_MONTHLY)}/월 · 가족 단위 결제
                    </p>
                </div>
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        right: -6,
                        top: -8,
                        width: 120,
                        height: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <AnimalIcon name="rabbit" size={108} aria-label="" />
                    <span style={{ position: "absolute", bottom: -2, left: 6, transform: "rotate(-8deg)" }}>
                        <ThreeDIcon name="heart" size={36} aria-label="" />
                    </span>
                </div>
            </header>

            {/* 우리 가족 아이 */}
            <div>
                <h3 style={{ margin: "0 0 10px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "var(--brand-mint-text, #087653)", letterSpacing: "-0.01em" }}>
                    <ThreeDIcon name="friend-pair" size={20} aria-label="" />
                    우리 가족 아이
                </h3>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        padding: 10,
                        background: "#FFFFFF",
                        border: "1px solid var(--line-soft, #F1ECEE)",
                        borderRadius: 22,
                        boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                        flexWrap: "wrap",
                    }}
                >
                    {childList.length === 0 && (
                        <div style={{ flex: 1, padding: "12px 14px", fontSize: 13, color: "#9A9AA0", fontWeight: 700, textAlign: "center" }}>
                            연동된 자녀가 없어요
                        </div>
                    )}
                    {childList.map((c) => (
                        <ChildSlot
                            key={c.id}
                            child={c}
                            subscribed={subscribedSet.has(c.id)}
                            busy={busyChildId === c.id}
                            onToggle={handleToggleChild}
                        />
                    ))}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, fontWeight: 600, color: "#5F6368", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ThreeDIcon name="heart" size={14} aria-label="" />
                    아이 아이콘을 눌러 구독을 켜고 끌 수 있어요
                </p>
            </div>

            {/* 플랜 */}
            <div>
                <h3 style={{ margin: "0 0 10px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>
                    <ThreeDIcon name="crown" size={20} aria-label="" />
                    플랜
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, paddingTop: 14 }}>
                    {/* 월 플랜 */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan("monthly")}
                        aria-pressed={selectedPlan === "monthly"}
                        style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "14px 12px",
                            background: "#FFFFFF",
                            border: selectedPlan === "monthly" ? "2px solid var(--brand-rose, #F779A8)" : "1px solid var(--line-soft, #F1ECEE)",
                            borderRadius: 20,
                            boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                            overflow: "visible",
                            minWidth: 0,
                            boxSizing: "border-box",
                        }}
                    >
                        <span aria-hidden="true" style={{ position: "absolute", top: 10, right: 10 }}>
                            <ThreeDIcon name="heart" size={18} aria-label="" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#202024" }}>월 플랜</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "#202024", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                            {fmtKrw(PRICE_PER_CHILD_MONTHLY)}
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9A9AA0", whiteSpace: "nowrap" }}>/ 자녀 1인 · 월</span>
                        <span aria-hidden="true" style={{ display: "block", height: 1, background: "var(--line-soft, #F1ECEE)", margin: "4px 0" }} />
                        <ul style={{ display: "flex", flexDirection: "column", gap: 5, margin: 0, padding: 0, listStyle: "none" }}>
                            <PlanFeatureItem>언제든 해지</PlanFeatureItem>
                            <PlanFeatureItem>월 단위 청구</PlanFeatureItem>
                        </ul>
                    </button>

                    {/* 년 플랜 — 추천 */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan("annual")}
                        aria-pressed={selectedPlan === "annual"}
                        style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "14px 12px",
                            background: "var(--brand-mint-soft, #DDF7EA)",
                            border: `2px solid ${selectedPlan === "annual" ? "var(--brand-mint, #31C48D)" : "var(--brand-mint-line, #BCEBD8)"}`,
                            borderRadius: 20,
                            boxShadow: "0 12px 30px rgba(49, 196, 141, 0.18)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                            overflow: "visible",
                            minWidth: 0,
                            boxSizing: "border-box",
                        }}
                    >
                        <span
                            style={{
                                position: "absolute",
                                top: -10,
                                left: 10,
                                padding: "3px 10px",
                                background: "var(--brand-mint-deep, #15936B)",
                                color: "#FFFFFF",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "-0.01em",
                                boxShadow: "0 4px 10px rgba(21, 147, 107, 0.30)",
                                whiteSpace: "nowrap",
                            }}
                        >
                            추천
                        </span>
                        <span aria-hidden="true" style={{ position: "absolute", top: -14, right: -6, transform: "rotate(8deg)", lineHeight: 1, pointerEvents: "none" }}>
                            <ThreeDIcon name="crown" size={36} aria-label="" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#202024" }}>년 플랜</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "#202024", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                            {fmtKrw(annualPricePerChild)}
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand-mint-text, #087653)", whiteSpace: "nowrap" }}>/ 자녀 1인 · 년</span>
                        <span aria-hidden="true" style={{ display: "block", height: 1, background: "var(--brand-mint-line, #BCEBD8)", margin: "4px 0" }} />
                        <ul style={{ display: "flex", flexDirection: "column", gap: 5, margin: 0, padding: 0, listStyle: "none" }}>
                            <PlanFeatureItem>월 대비 33% 할인</PlanFeatureItem>
                            <PlanFeatureItem>4개월 무료</PlanFeatureItem>
                        </ul>
                    </button>
                </div>
            </div>

            {/* 합계 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "linear-gradient(135deg, var(--brand-rose-soft, #FFE2EC) 0%, #FFFDF8 100%)",
                    border: "1px solid var(--brand-rose-line, #FFD0DD)",
                    borderRadius: 999,
                    gap: 12,
                }}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#202024" }}>
                    <ThreeDIcon name="star-medal" size={28} aria-label="" />
                    합계
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: subscribedCount === 0 ? "var(--brand-rose-text, #B83262)" : "var(--brand-mint-text, #087653)", letterSpacing: "-0.01em" }}>
                    {summaryLabel}
                </span>
            </div>

            {/* footer 안내 */}
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#5F6368", textAlign: "center", lineHeight: 1.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ThreeDIcon name="heart" size={14} aria-label="" />
                자동 갱신은 언제든 해지할 수 있어요 · 갱신 24시간 전 알림
            </p>
        </section>
    );
}
