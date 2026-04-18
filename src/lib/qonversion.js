import {
  EntitlementsCacheLifetime,
  Environment,
  LaunchMode,
  Qonversion,
  QonversionConfigBuilder,
} from "@qonversion/capacitor-plugin";
import { supabase } from "./supabase.js";

const APP_PACKAGE_NAME = "com.hyeni.calendar";
const DEFAULT_ENTITLEMENT_ID = "premium";
const GPB_MANAGE_URL = "https://play.google.com/store/account/subscriptions";
const QONVERSION_PROJECT_KEY = readEnv("VITE_QONVERSION_PROJECT_KEY");
const QONVERSION_ENVIRONMENT = readEnv("VITE_QONVERSION_ENVIRONMENT");
const QONVERSION_PROXY_URL = readEnv("VITE_QONVERSION_PROXY_URL");
const QONVERSION_ENTITLEMENT_ID =
  readEnv("VITE_QONVERSION_ENTITLEMENT_ID") || DEFAULT_ENTITLEMENT_ID;
const QONVERSION_KIDS_MODE = readEnv("VITE_QONVERSION_KIDS_MODE");

let sharedInstance = null;
let initAttempted = false;
let initErrorMessage = "";

function readEnv(key) {
  const value = import.meta.env?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function isNativeRuntime() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

function shouldUseNativeQonversion() {
  return isNativeRuntime() && !!QONVERSION_PROJECT_KEY;
}

function shouldEnableKidsMode() {
  const normalized = QONVERSION_KIDS_MODE.toLowerCase();
  if (!normalized) return true;
  return !["0", "false", "off", "no"].includes(normalized);
}

function resolveEnvironment() {
  if (QONVERSION_ENVIRONMENT.toLowerCase() === "sandbox") {
    return Environment.SANDBOX;
  }
  if (QONVERSION_ENVIRONMENT.toLowerCase() === "production") {
    return Environment.PRODUCTION;
  }
  return import.meta.env.DEV ? Environment.SANDBOX : Environment.PRODUCTION;
}

function buildInitErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "unknown_error";
}

function buildQonversionConfig() {
  const builder = new QonversionConfigBuilder(
    QONVERSION_PROJECT_KEY,
    LaunchMode.SUBSCRIPTION_MANAGEMENT
  );
  builder.setEnvironment(resolveEnvironment());
  builder.setEntitlementsCacheLifetime(EntitlementsCacheLifetime.MONTH);

  if (QONVERSION_PROXY_URL) {
    builder.setProxyURL(QONVERSION_PROXY_URL);
  }
  if (shouldEnableKidsMode()) {
    builder.enableKidsMode();
  }

  return builder.build();
}

function getQonversionInstance() {
  if (!shouldUseNativeQonversion()) {
    return null;
  }
  if (sharedInstance) {
    return sharedInstance;
  }
  if (initAttempted) {
    return null;
  }

  initAttempted = true;

  try {
    sharedInstance = Qonversion.initialize(buildQonversionConfig());
    initErrorMessage = "";
    return sharedInstance;
  } catch (error) {
    initErrorMessage = buildInitErrorMessage(error);
    console.warn("[qonversion] initialize failed:", error);
    sharedInstance = null;
    return null;
  }
}

function buildUnavailableMessage() {
  if (!QONVERSION_PROJECT_KEY) {
    return "Qonversion 프로젝트 키가 설정되지 않았습니다.";
  }
  if (!isNativeRuntime()) {
    return "구독 결제는 Android 앱 빌드에서만 시작할 수 있습니다.";
  }
  if (initErrorMessage) {
    return `Qonversion 초기화에 실패했습니다: ${initErrorMessage}`;
  }
  return "Qonversion 네이티브 플러그인을 사용할 수 없습니다.";
}

function normalizeMockSubscription(row) {
  const status = row?.status || "expired";
  const isPremium = ["trial", "active", "grace"].includes(status);
  return {
    isActive: isPremium,
    isTrial: status === "trial",
    status,
    productId: row?.product_id || "premium_monthly",
    tier: isPremium ? "premium" : "free",
    expiresAt: row?.current_period_end ? new Date(row.current_period_end) : null,
    trialEndsAt: row?.trial_ends_at ? new Date(row.trial_ends_at) : null,
    currentPeriodEnd: row?.current_period_end ? new Date(row.current_period_end) : null,
  };
}

function normalizeNativeEntitlement(entitlement) {
  if (!entitlement?.isActive) {
    return null;
  }

  const renewState = entitlement.renewState || "";
  const isTrial = !!entitlement.trialStartDate && entitlement.renewsCount === 0;
  const status = isTrial
    ? "trial"
    : renewState === "billing_issue"
      ? "grace"
      : "active";

  return {
    isActive: true,
    isTrial,
    status,
    productId: entitlement.productId || "premium_monthly",
    tier: "premium",
    expiresAt: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
    trialEndsAt: entitlement.expirationDate && isTrial
      ? new Date(entitlement.expirationDate)
      : null,
    currentPeriodEnd: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
    renewState,
  };
}

function pickPremiumEntitlement(entitlements) {
  if (!entitlements) {
    return null;
  }

  if (typeof entitlements.get === "function") {
    const direct = entitlements.get(QONVERSION_ENTITLEMENT_ID);
    if (direct?.isActive) {
      return direct;
    }
  }

  const values = typeof entitlements.values === "function"
    ? Array.from(entitlements.values())
    : [];

  return values.find((item) => item?.id === QONVERSION_ENTITLEMENT_ID && item?.isActive)
    || values.find((item) => item?.isActive)
    || null;
}

async function getNativeProduct(instance, productId) {
  const products = await instance.products();
  const direct = products?.get?.(productId);
  if (direct) {
    return direct;
  }

  const matched = Array.from(products?.values?.() || []).find(
    (product) => product?.qonversionId === productId
  );
  if (matched) {
    return matched;
  }

  throw new Error(
    `Qonversion 상품(${productId})을 찾지 못했습니다. Dashboard의 Product ID와 Base Plan 연결을 확인해주세요.`
  );
}

export async function identify(userId) {
  const instance = getQonversionInstance();
  if (instance) {
    try {
      await instance.identify(userId);
    } catch (error) {
      console.warn("[qonversion] identify failed:", error);
    }
    return;
  }

  if (supabase.__mock?.enabled) {
    try {
      window.localStorage.setItem("hyeni-qonversion-user-id", userId || "");
    } catch {
      // ignore
    }
  }
}

export async function checkEntitlements(familyId) {
  const instance = getQonversionInstance();
  if (instance) {
    try {
      const entitlements = await instance.checkEntitlements();
      return normalizeNativeEntitlement(pickPremiumEntitlement(entitlements));
    } catch (error) {
      console.warn("[qonversion] checkEntitlements failed:", error);
    }
  }

  if (supabase.__mock?.enabled && familyId) {
    return normalizeMockSubscription(supabase.__mock.getFamilySubscription(familyId));
  }

  return normalizeMockSubscription(null);
}

export async function purchase(productId, { familyId } = {}) {
  const instance = getQonversionInstance();
  if (instance) {
    const product = await getNativeProduct(instance, productId);
    const result = await instance.purchase(product);

    if (result?.isCanceled) {
      throw new Error("구독이 취소되었어요.");
    }
    if (result?.isPending) {
      throw new Error("구독 승인이 대기 중입니다.");
    }
    if (result?.isError) {
      const description = result.error?.description || result.error?.additionalMessage || "";
      throw new Error(description || "구독 처리 중 오류가 발생했어요.");
    }

    return {
      success: !!result?.isSuccess,
      productId,
      entitlements: result?.entitlements || null,
      source: result?.source || null,
      storeTransaction: result?.storeTransaction || null,
    };
  }

  if (!supabase.__mock?.enabled) {
    throw new Error(buildUnavailableMessage());
  }

  if (!familyId) {
    throw new Error("구독을 시작할 가족 정보가 없습니다");
  }

  const now = new Date();
  const trialEndsAt = addDays(7);
  const currentPeriodEnd =
    productId === "premium_yearly" ? addDays(365) : addDays(30);

  supabase.__mock.upsertFamilySubscription({
    family_id: familyId,
    status: "trial",
    product_id: productId || "premium_monthly",
    qonversion_user_id: familyId,
    started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
  });

  return {
    success: true,
    productId,
    trialEndsAt,
    currentPeriodEnd,
  };
}

export async function restore(familyId) {
  const instance = getQonversionInstance();
  if (instance) {
    const entitlements = await instance.restore();
    return normalizeNativeEntitlement(pickPremiumEntitlement(entitlements));
  }

  if (supabase.__mock?.enabled && familyId) {
    return normalizeMockSubscription(supabase.__mock.getFamilySubscription(familyId));
  }

  return normalizeMockSubscription(null);
}

export async function refreshMockSubscription(familyId, patch) {
  if (!supabase.__mock?.enabled || !familyId) return null;
  const current = supabase.__mock.getFamilySubscription(familyId) || {
    family_id: familyId,
    product_id: patch?.product_id || "premium_monthly",
  };
  supabase.__mock.upsertFamilySubscription({ ...current, ...patch, family_id: familyId });
  return normalizeMockSubscription(supabase.__mock.getFamilySubscription(familyId));
}

export function manageSubscriptionLink(productId = "premium_monthly") {
  const params = new URLSearchParams({ package: APP_PACKAGE_NAME });
  if (productId) {
    params.set("sku", productId);
  }
  return `${GPB_MANAGE_URL}?${params.toString()}`;
}
