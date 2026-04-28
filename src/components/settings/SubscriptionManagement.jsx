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
      <section style={{ background: "#FFF9FC", borderRadius: 18, padding: "18px 16px", border: "1.5px solid #FFE4EF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>구독 상태</div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{CHILD_DEVICE_NOTE}</div>
      </section>
    );
  }

  const { subs, refresh } = useChildSubscriptions(familyId);
  const ents = deriveChildEntitlements(childList, subs);
  const total = totalMonthlyPrice(subs);
  const subscribedCount = Object.values(ents).filter((e) => e.tier === "premium").length;
  const [busyChildId, setBusyChildId] = useState(null);

  async function handleToggle(child, nextSubscribed) {
    setBusyChildId(child.user_id);
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
    <section style={{ background: "white", borderRadius: 22, padding: "20px 18px", boxShadow: "0 14px 34px rgba(180,120,150,0.12)", border: "1.5px solid #FFE4EF" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", marginBottom: 4 }}>혜니 프리미엄</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18 }}>
        자녀별로 구독 ON/OFF 가능 · 자녀 1인당 ₩1,500/월
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {childList.map((c) => (
          <PerChildToggle
            key={c.user_id} child={c}
            subscribed={ents[c.user_id]?.tier === "premium"}
            busy={busyChildId === c.user_id}
            onToggle={(next) => handleToggle(c, next)}
          />
        ))}
      </div>

      <PriceSummary totalKrw={total} subscribedCount={subscribedCount} />
    </section>
  );
}
