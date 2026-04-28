// src/lib/childSubscriptions.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";

const PREMIUM_STATUSES = new Set(["active", "grace"]);
const FREE_FEATURES = new Set([
  "sos_send", "sos_receive",
  "location_one_shot", "voice_message_realtime",
  "today_events_view",
]);

export function deriveChildEntitlements(children, subscriptions) {
  // subscriptions.child_id is family_members.id (per M3 backfill + FK target).
  // Key the result map by the same family_members.id so callers must look up
  // with child.id, not child.user_id (the previous bug — silently always free).
  const subByChild = new Map((subscriptions || []).map((s) => [s.child_id, s]));
  const result = {};
  for (const child of children) {
    const sub = subByChild.get(child.id);
    const isPremium = sub && PREMIUM_STATUSES.has(sub.status);
    result[child.id] = {
      tier: isPremium ? "premium" : "free",
      status: sub?.status || "expired",
      priceKrw: sub?.price_krw || 1500,
      productId: sub?.product_id || null,
      expiresAt: sub?.expires_at ? new Date(sub.expires_at) : null,
    };
  }
  return result;
}

export function totalMonthlyPrice(subscriptions) {
  return (subscriptions || [])
    .filter((s) => PREMIUM_STATUSES.has(s.status))
    .reduce((sum, s) => sum + (s.price_krw || 0), 0);
}

export function canChildUseFeature(childEntitlement, feature) {
  if (!childEntitlement) return false;
  if (FREE_FEATURES.has(feature)) return true;
  return childEntitlement.tier === "premium";
}

export function useChildSubscriptions(familyId) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("family_id", familyId);
      setSubs(data || []);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!familyId) return undefined;
    const channel = supabase.channel(`subs-${familyId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `family_id=eq.${familyId}` },
        () => refresh()
      )
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [familyId, refresh]);

  return useMemo(() => ({ subs, loading, refresh }), [subs, loading, refresh]);
}
