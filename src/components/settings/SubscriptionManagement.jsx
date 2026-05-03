// src/components/settings/SubscriptionManagement.jsx
import { useState } from "react";
import { useChildSubscriptions, deriveChildEntitlements, totalMonthlyPrice } from "../../lib/childSubscriptions.js";
import { purchaseChildSlot } from "../../lib/qonversion.js";
import { CHILD_DEVICE_NOTE } from "../../lib/paywallCopy.js";
import { PerChildToggle } from "../multichild/SubscriptionScreen/PerChildToggle.jsx";
import { PriceSummary } from "../multichild/SubscriptionScreen/PriceSummary.jsx";

export function SubscriptionManagement({ role, familyId, childList = [] }) {
  if (role === "child") {
    return (
      <section style={{ background: "var(--hyeni-pink-soft)", borderRadius: 16, padding: "18px 16px", border: "1.5px solid var(--hyeni-pink-line)" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg-primary)" }}>구독 상태</div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--fg-secondary)", lineHeight: 1.6 }}>{CHILD_DEVICE_NOTE}</div>
      </section>
    );
  }

  const { subs, refresh } = useChildSubscriptions(familyId);
  const ents = deriveChildEntitlements(childList, subs);
  const total = totalMonthlyPrice(subs);
  const subscribedCount = Object.values(ents).filter((e) => e.tier === "premium").length;
  const [busyChildId, setBusyChildId] = useState(null);

  async function handleToggle(child, nextSubscribed) {
    setBusyChildId(child.id);
    try {
      if (nextSubscribed) {
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

  return (
    <section style={{ background: "var(--bg-base)", borderRadius: 16, padding: "20px 18px", boxShadow: "none", border: "1.5px solid var(--hyeni-pink-line)" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)", marginBottom: 4 }}>혜니 프리미엄</div>
      <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 18 }}>
        자녀별로 구독 ON/OFF 가능 · 자녀 1인당 ₩1,500/월
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {childList.map((c) => (
          <PerChildToggle
            key={c.id} child={c}
            subscribed={ents[c.id]?.tier === "premium"}
            busy={busyChildId === c.id}
            onToggle={(next) => handleToggle(c, next)}
          />
        ))}
      </div>

      <PriceSummary totalKrw={total} subscribedCount={subscribedCount} />
    </section>
  );
}
