import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { ALL_FEATURES } from "./features.js";
import { readEntitlementCache, writeEntitlementCache } from "./entitlementCache.js";
import { checkEntitlements } from "./qonversion.js";

const PREMIUM_STATUSES = new Set(["trial", "active", "grace"]);

export function isMissingSubscriptionSchemaError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  if (code === "PGRST205" || code === "42P01" || code === "42703") {
    return true;
  }
  return /family_subscription/i.test(message)
    && /(schema cache|does not exist|could not find the table|column)/i.test(message);
}

export function computeTrialDaysLeft(trialEndsAtIso) {
  if (!trialEndsAtIso) return null;
  const diff = new Date(trialEndsAtIso).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400_000);
}

export function deriveEntitlement(row) {
  if (!row) {
    return {
      tier: "free",
      status: "expired",
      isTrial: false,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      productId: null,
      features: [],
    };
  }

  const status = row.status || "expired";
  const tier = PREMIUM_STATUSES.has(status) ? "premium" : "free";
  const trialEndsAt = row.trial_ends_at || null;
  const currentPeriodEnd = row.current_period_end ? new Date(row.current_period_end) : null;

  return {
    tier,
    status,
    isTrial: status === "trial",
    trialDaysLeft: status === "trial" ? computeTrialDaysLeft(trialEndsAt) : null,
    productId: row.product_id || null,
    currentPeriodEnd,
    trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
    features: tier === "premium" ? ALL_FEATURES : [],
  };
}

export function canUseFeature(entitlement, feature) {
  if (!entitlement || !feature) return false;
  return entitlement.tier === "premium" && entitlement.features.includes(feature);
}

function normalizeFromQonversion(entitlement) {
  if (!entitlement?.isActive) return null;
  return {
    status: entitlement.status || (entitlement.isTrial ? "trial" : "active"),
    trial_ends_at: entitlement.trialEndsAt?.toISOString?.() || null,
    current_period_end: entitlement.currentPeriodEnd?.toISOString?.() || null,
    product_id: entitlement.productId || "premium_monthly",
  };
}

export function useEntitlement(familyId) {
  // ready=false 상태에서는 tier 가 unknown 으로 간주되어야 한다.
  // false 인 동안 consumer 는 "premium 만 가능" 류 메시지를 노출하면 안 됨.
  // refresh 가 한번 완료되거나 캐시 hit 가 적용되면 ready=true.
  const [state, setState] = useState(() => {
    const cached = readEntitlementCache(familyId);
    return cached || deriveEntitlement(null);
  });
  const [ready, setReady] = useState(() => Boolean(readEntitlementCache(familyId)));
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  // useState 의 lazy initializer 는 첫 렌더에서만 실행된다. 첫 렌더 시
  // familyId 가 아직 로드되지 않은 경우 (auth 후에 결정), 캐시된 premium
  // 값을 놓치고 free 로 굳어지는 회귀가 있었다 (locationGateHint 깜빡임의
  // 원인). familyId 가 늦게 들어오면 다시 캐시를 읽어 동기적으로 적용.
  useEffect(() => {
    if (!familyId) return;
    const cached = readEntitlementCache(familyId);
    if (cached) {
      setState(cached);
      setReady(true);
    }
  }, [familyId]);

  const applyRow = useCallback(
    (row) => {
      const next = deriveEntitlement(row);
      setState(next);
      setReady(true);
      if (familyId) writeEntitlementCache(familyId, next);
      return next;
    },
    [familyId]
  );

  const refresh = useCallback(async () => {
    if (!familyId) {
      return applyRow(null);
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("family_subscription")
        .select("status, trial_ends_at, current_period_end, product_id")
        .eq("family_id", familyId)
        .limit(1)
        .maybeSingle();

      if (error && !isMissingSubscriptionSchemaError(error)) {
        throw error;
      }
      if (data) return applyRow(data);

      const external = await checkEntitlements(familyId);
      const normalized = normalizeFromQonversion(external);
      if (!normalized) return applyRow(null);

      return applyRow(normalized);
    } catch (error) {
      console.warn("[entitlement] refresh failed:", error);
      return applyRow(null);
    } finally {
      setLoading(false);
    }
  }, [applyRow, familyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!familyId) return undefined;

    const channel = supabase
      .channel(`family-subscription-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_subscription",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            applyRow(null);
            return;
          }
          applyRow(payload.new || null);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [applyRow, familyId]);

  return useMemo(
    () => ({
      ...state,
      ready,
      loading,
      refresh,
      canUse: (feature) => canUseFeature(state, feature),
    }),
    [loading, ready, refresh, state]
  );
}
