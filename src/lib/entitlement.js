import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { ALL_FEATURES } from "./features.js";
import { readEntitlementCache, writeEntitlementCache } from "./entitlementCache.js";
import { checkEntitlements } from "./qonversion.js";

const PREMIUM_STATUSES = new Set(["trial", "active", "grace"]);

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
  const [state, setState] = useState(() => {
    const cached = readEntitlementCache(familyId);
    return cached || deriveEntitlement(null);
  });
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  const applyRow = useCallback(
    (row) => {
      const next = deriveEntitlement(row);
      setState(next);
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

      if (error) throw error;
      if (data) return applyRow(data);

      const external = await checkEntitlements(familyId);
      const normalized = normalizeFromQonversion(external);
      if (!normalized) return applyRow(null);

      if (supabase.__mock?.enabled) {
        supabase.__mock.upsertFamilySubscription({
          family_id: familyId,
          status: normalized.status,
          trial_ends_at: normalized.trial_ends_at,
          current_period_end: normalized.current_period_end,
          product_id: normalized.product_id,
          qonversion_user_id: familyId,
        });
      }

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
      loading,
      refresh,
      canUse: (feature) => canUseFeature(state, feature),
    }),
    [loading, refresh, state]
  );
}
