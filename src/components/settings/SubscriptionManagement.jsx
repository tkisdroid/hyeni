// src/components/settings/SubscriptionManagement.jsx
// Phase 4 spec section 4.2 — plan-grid (월/년) + avatar stepper.
// 기존 Qonversion 핸들러 보존, 시각만 Minimal-Pro 톤으로 정비.

import { useMemo, useState } from "react";
import { useChildSubscriptions, deriveChildEntitlements, totalMonthlyPrice } from "../../lib/childSubscriptions.js";
import { purchaseChildSlot } from "../../lib/qonversion.js";
import { CHILD_DEVICE_NOTE } from "../../lib/paywallCopy.js";
import { PriceSummary } from "../multichild/SubscriptionScreen/PriceSummary.jsx";

const PRICE_PER_CHILD_MONTHLY = 1500;
const ANNUAL_DISCOUNT_RATE = 0.33; // 4 months free 기준

function fmtKrw(n) {
    return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

export function SubscriptionManagement({ role, familyId, childList = [] }) {
    if (role === "child") {
        return (
            <section
                style={{
                    background: "var(--bg-base)",
                    borderRadius: "var(--radius-card)",
                    padding: "var(--space-5) var(--space-4)",
                    border: "1px solid var(--line-soft)",
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

    const monthlyPriceForCount = subscribedCount * PRICE_PER_CHILD_MONTHLY;
    const annualPriceForCount = Math.round(monthlyPriceForCount * 12 * (1 - ANNUAL_DISCOUNT_RATE));

    return (
        <section
            style={{
                background: "var(--bg-base)",
                borderRadius: "var(--radius-card)",
                padding: "var(--space-5) var(--space-4)",
                border: "1px solid var(--line-soft)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
            }}
        >
            <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>혜니 프리미엄</h2>
                <p style={{ margin: "var(--space-1) 0 0", fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>
                    자녀 1인당 {fmtKrw(PRICE_PER_CHILD_MONTHLY)}/월 · 가족 단위 결제
                </p>
            </div>

            {/* avatar stepper — 우리 가족 아이 */}
            <div>
                <h3 className="settings-section-header" style={{ margin: "0 0 var(--space-2)" }}>우리 가족 아이</h3>
                <div className="avatar-stepper">
                    {childList.map((c) => {
                        const subscribed = subscribedSet.has(c.id);
                        const busy = busyChildId === c.id;
                        const initial = (c.name || "?").slice(0, 1);
                        const color = c.color_hex || "var(--theme-accent)";
                        return (
                            <button
                                key={c.id}
                                type="button"
                                className="avatar-stepper-slot"
                                data-child-id={c.id}
                                data-filled={subscribed ? "true" : "false"}
                                style={{ "--child-color": color, opacity: busy ? 0.6 : 1 }}
                                onClick={() => handleToggleChild(c)}
                                disabled={busy}
                                aria-label={`${c.name || "아이"} ${subscribed ? "구독 해지" : "구독 시작"}`}
                                title={`${c.name || "아이"}${subscribed ? " · 구독중" : ""}`}
                            >
                                {initial}
                            </button>
                        );
                    })}
                </div>
                <p style={{ margin: "var(--space-2) 0 0", fontSize: 11, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}>
                    아이 아이콘을 눌러 구독을 켜고 끌 수 있어요
                </p>
            </div>

            {/* Plan grid */}
            <div>
                <h3 className="settings-section-header" style={{ margin: "0 0 var(--space-2)" }}>플랜</h3>
                <div className="plan-grid">
                    <button
                        type="button"
                        className="plan-card"
                        data-selected={selectedPlan === "monthly" ? "true" : "false"}
                        onClick={() => setSelectedPlan("monthly")}
                    >
                        <span className="plan-card-name">월 플랜</span>
                        <span className="plan-card-price">{fmtKrw(PRICE_PER_CHILD_MONTHLY)}</span>
                        <span className="plan-card-price-period">/ 자녀 1인 · 월</span>
                        <ul className="plan-card-features">
                            <li className="plan-card-feature">언제든 해지</li>
                            <li className="plan-card-feature">월 단위 청구</li>
                        </ul>
                    </button>
                    <button
                        type="button"
                        className="plan-card"
                        data-recommended="true"
                        data-selected={selectedPlan === "annual" ? "true" : "false"}
                        onClick={() => setSelectedPlan("annual")}
                    >
                        <span className="plan-card-badge">추천</span>
                        <span className="plan-card-name">년 플랜</span>
                        <span className="plan-card-price">{fmtKrw(PRICE_PER_CHILD_MONTHLY * 12 * (1 - ANNUAL_DISCOUNT_RATE))}</span>
                        <span className="plan-card-price-period">/ 자녀 1인 · 년</span>
                        <ul className="plan-card-features">
                            <li className="plan-card-feature">월 대비 33% 할인</li>
                            <li className="plan-card-feature">4개월 무료</li>
                        </ul>
                    </button>
                </div>
            </div>

            {/* Price summary preserved (기존 PriceSummary) */}
            <PriceSummary totalKrw={selectedPlan === "annual" ? annualPriceForCount : monthlyPriceForCount} subscribedCount={subscribedCount} />

            <p style={{ margin: 0, fontSize: 12, color: "var(--fg-tertiary)", textAlign: "center", fontWeight: "var(--weight-medium)", lineHeight: "var(--leading-normal)" }}>
                자동 갱신은 언제든 해지할 수 있어요 · 갱신 24시간 전 알림
            </p>
        </section>
    );
}
