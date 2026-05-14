import { supabase } from "./supabase.js";
import { getUserDisplayName, getUserPhoneLocal, normalizePhoneForStorage } from "./accountAuth.js";
import { clearFamilyInfoCache } from "./familyInfoCache.js";
import { clearEntitlementCache } from "./entitlementCache.js";
import { openNativeBrowser } from "./nativeBrowser.js";

// Removed: KAKAO_REST_KEY constant was defined here but never read in this
// module. Agent05 L-001 — VITE_KAKAO_REST_KEY ships in the prod bundle and
// must be eliminated end-to-end via a Supabase Edge Function proxy. Removing
// the dead reference here cuts one ingest path; nativeLocationService.js
// and walkingRoute.js still consume the env var (deprecation warning added)
// pending the Edge proxy migration owned by fix-db.
const NATIVE_OAUTH_REDIRECT_URL = "hyenicalendar://auth-callback";
const CHILD_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d
const CHILD_PHOTO_SIGNED_URL_CACHE_SAFETY_MS = 5 * 60 * 1000;
const CHILD_PHOTO_CACHE_STORAGE_KEY = "hyeni-child-photo-signed-url-cache-v1";

// 이전에는 in-memory Map 만 사용해서 cold start 마다 supabase storage 에
// signed URL 을 다시 발급받았다. 7일 TTL 인데도 cold start 마다 URL 의 token
// 쿼리스트링이 바뀌어 CDN/브라우저 캐시 미스 → 프로필 사진이 매번 재다운로드.
// localStorage 에 영속화해 launch 간에도 같은 signed URL 을 재사용한다.
function loadPhotoCacheFromStorage() {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage?.getItem?.(CHILD_PHOTO_CACHE_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    const now = Date.now();
    const entries = Object.entries(parsed).filter(([, value]) =>
      value && typeof value.signedUrl === "string" && typeof value.expiresAt === "number" && value.expiresAt > now
    );
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function persistPhotoCacheToStorage(cache) {
  if (typeof window === "undefined") return;
  try {
    const obj = {};
    for (const [key, value] of cache) obj[key] = value;
    window.localStorage?.setItem?.(CHILD_PHOTO_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage may be full or unavailable — degrade silently.
  }
}

const childPhotoSignedUrlCache = loadPhotoCacheFromStorage();

// child-photos bucket is private, so getPublicUrl returns a URL anon GET cannot
// load. Extract storage path (works for stored publicUrl, signed URL, or raw
// path) and reissue a 7-day signed URL each time getMyFamily runs.
function extractChildPhotoStoragePath(urlOrPath) {
  if (typeof urlOrPath !== "string" || urlOrPath.length === 0) return null;
  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/child-photos\/([^?]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  if (urlOrPath.startsWith("http")) return null;
  return urlOrPath;
}

async function enrichMembersWithSignedPhotos(members) {
  if (!Array.isArray(members) || members.length === 0) return members;
  const membersWithPhotoPaths = members.filter((m) => extractChildPhotoStoragePath(m?.photo_url));
  if (membersWithPhotoPaths.length === 0) return members;
  const bucket = supabase.storage?.from?.("child-photos");
  if (!bucket?.createSignedUrl) return members;
  let cacheMutated = false;
  const enriched = await Promise.all(members.map(async (m) => {
    if (!m?.photo_url) return m;
    const path = extractChildPhotoStoragePath(m.photo_url);
    if (!path) return m;
    const cached = childPhotoSignedUrlCache.get(path);
    if (cached?.signedUrl && cached.expiresAt > Date.now()) {
      return { ...m, photo_url: cached.signedUrl };
    }

    let result = await bucket.createSignedUrl(path, CHILD_PHOTO_SIGNED_URL_TTL_SECONDS);
    if (result.error || !result.data?.signedUrl) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      result = await bucket.createSignedUrl(path, CHILD_PHOTO_SIGNED_URL_TTL_SECONDS);
    }

    if (result.error || !result.data?.signedUrl) {
      // Stale cache 폴백: safety margin 5분 지났어도 실제 TTL 여유 남아있어 표시 가능.
      // null 처리하면 프로필 사진이 갑자기 사라지는 회귀 발생.
      if (cached?.signedUrl) {
        console.warn("[getMyFamily] signed url refresh failed, reusing stale cached URL for", m.id);
        return { ...m, photo_url: cached.signedUrl };
      }
      console.warn("[getMyFamily] signed url failed for member", m.id, result.error?.message || "");
      if (childPhotoSignedUrlCache.delete(path)) cacheMutated = true;
      return { ...m, photo_url: null };
    }
    childPhotoSignedUrlCache.set(path, {
      signedUrl: result.data.signedUrl,
      expiresAt: Date.now() + (CHILD_PHOTO_SIGNED_URL_TTL_SECONDS * 1000) - CHILD_PHOTO_SIGNED_URL_CACHE_SAFETY_MS,
    });
    cacheMutated = true;
    return { ...m, photo_url: result.data.signedUrl };
  }));
  if (cacheMutated) persistPhotoCacheToStorage(childPhotoSignedUrlCache);
  return enriched;
}

// ── Helper: Safe UUID generator ───────────────────────────────────────────────
export function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for insecure contexts (like HTTP on mobile webviews)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ── Pair code generator ─────────────────────────────────────────────────────
function generatePairCode() {
  return "KID-" + generateUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
}

// ── Kakao OAuth login (parent) ──────────────────────────────────────────────
function isNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export async function kakaoLogin() {
  const native = isNative();
  const redirectTo = native ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;

  // scope 정책: 검수 불필요 항목만 요청. name/phone_number는 비즈니스 앱
  // 검수가 필요하지만, 가입 form 이름 입력 + 전화 OTP 인증으로 같은 정보를
  // 이미 받고 있어 카카오에서의 수집은 중복. Console에서도 동일 3개 항목만
  // 활성화 필요 (profile_nickname 필수, account_email/profile_image 선택).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      scopes: "profile_nickname account_email profile_image",
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (native) {
    if (!data?.url) {
      throw new Error("카카오 로그인 URL을 생성하지 못했습니다.");
    }

    await openNativeBrowser(data.url);
  }
}

// ── Google OAuth login (parent) ─────────────────────────────────────────────
// Supabase 빌트인 google provider 사용. kakaoLogin 과 동일 패턴.
// 운영 설정: Supabase 대시보드 → Auth → Providers → Google enable + GCP
// OAuth Client ID/Secret 등록 + redirectTo URL 화이트리스트.
export async function googleLogin() {
  const native = isNative();
  const redirectTo = native ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (native) {
    if (!data?.url) {
      throw new Error("구글 로그인 URL을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    await openNativeBrowser(data.url);
  }
}

// ── Naver OAuth login (parent) ──────────────────────────────────────────────
// Naver 는 Supabase 빌트인 provider 가 아니므로 커스텀 플로우.
// 1. 이 함수 — Naver OAuth URL open. state(nonce + target) 동봉.
// 2. Naver → Supabase Edge Function naver-auth/callback 으로 redirect
// 3. Edge GET handler — deep link/origin 으로 다시 redirect (code/state 동봉)
// 4. App.jsx appUrlOpen — code/state 받고 finishNaverLogin 호출
// 5. finishNaverLogin — Edge POST 로 magiclink token 받고 verifyOtp
//
// 운영 설정:
//   - Naver Developers 애플리케이션 등록
//   - Callback URL 등록: https://<project>.supabase.co/functions/v1/naver-auth
//   - .env: VITE_NAVER_CLIENT_ID (필수, public). Secret 은 Edge Function 만.
const NAVER_CLIENT_ID = (() => {
  try {
    return import.meta.env?.VITE_NAVER_CLIENT_ID || "";
  } catch {
    return "";
  }
})();
const NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_OAUTH_STATE_KEY = "hyeni-naver-oauth-state";

function generateNaverState(target) {
  const nonce = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = btoa(JSON.stringify({ nonce, target }));
  return { nonce, encoded: payload };
}

function getNaverEdgeFunctionUrl() {
  // SUPABASE_URL 은 supabase 클라이언트 설정에 있지만 직접 노출 안 됨.
  // import.meta.env 로부터 가져옴.
  const base = (() => {
    try {
      return import.meta.env?.VITE_SUPABASE_URL || "";
    } catch {
      return "";
    }
  })();
  if (!base) throw new Error("VITE_SUPABASE_URL 미설정");
  return `${base.replace(/\/+$/, "")}/functions/v1/naver-auth`;
}

export async function naverLogin() {
  if (!NAVER_CLIENT_ID) {
    throw new Error("네이버 로그인 설정이 아직 안 됐어요. 운영자에게 문의해 주세요!");
  }

  const native = isNative();
  const target = native ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;
  const { nonce, encoded } = generateNaverState(target);

  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(NAVER_OAUTH_STATE_KEY, nonce);
    }
  } catch { /* sessionStorage unavailable */ }

  const callbackUrl = getNaverEdgeFunctionUrl();
  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: NAVER_CLIENT_ID,
    redirect_uri: callbackUrl,
    state: encoded,
  });
  const url = `${NAVER_AUTHORIZE_URL}?${authorizeParams.toString()}`;

  if (native) {
    await openNativeBrowser(url);
  } else {
    window.location.href = url;
  }
}

// 콜백에서 호출. App.jsx appUrlOpen / 페이지 로드 핸들러가 이 함수를 부른다.
export async function finishNaverLogin({ code, state }) {
  if (!code) throw new Error("네이버 인증 코드가 없어요. 다시 시도해 주세요!");

  // state 검증 (CSRF 방어)
  let savedNonce = "";
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      savedNonce = window.sessionStorage.getItem(NAVER_OAUTH_STATE_KEY) || "";
      window.sessionStorage.removeItem(NAVER_OAUTH_STATE_KEY);
    }
  } catch { /* ignore */ }

  if (savedNonce && state && savedNonce !== state) {
    throw new Error("네이버 로그인 인증 정보가 어긋났어요. 보안을 위해 처음부터 다시 해주세요!");
  }

  const native = isNative();
  const targetRedirect = native ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;
  const callbackUrl = getNaverEdgeFunctionUrl();

  const resp = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      state: state || savedNonce,
      redirect_uri: callbackUrl,
      target: targetRedirect,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    const friendly = parsed?.message
      || (parsed?.error === "naver_not_configured"
        ? "네이버 로그인 설정이 아직 안 됐어요. 운영자에게 문의해 주세요!"
        : "네이버 로그인이 잠시 멈췄어요. 다시 해볼까요?");
    throw new Error(friendly);
  }

  const data = await resp.json();
  if (!data?.email || !data?.token) {
    throw new Error("네이버 로그인 응답이 이상해요. 다시 시도해 주세요!");
  }

  // verifyOtp 로 세션 활성화. supabase-js 가 자동으로 access/refresh token 보관.
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.token,
    type: "magiclink",
  });
  if (otpError) throw otpError;
}

// ── Anonymous login (child) ─────────────────────────────────────────────────
export async function anonymousLogin() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) console.warn("[anonymousLogin] getSession failed:", sessionError);
  if (session) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

// ── Get current session/user ────────────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 로그아웃 시 모든 per-account 캐시를 즉시 비워 다음 세션이 이전 사용자
// 데이터로 부팅되지 않도록 한다 (signed photo URL, familyInfo blob,
// entitlement tier). signOut 의 SIGNED_OUT 이벤트는 비동기라 그 콜백
// 이전에 프로세스가 종료되는 경우 stale 데이터가 localStorage 에 남는다.
export function clearChildPhotoCache() {
  childPhotoSignedUrlCache.clear();
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem?.(CHILD_PHOTO_CACHE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Logout ──────────────────────────────────────────────────────────────────
export async function logout() {
  try {
    await supabase.auth.signOut();
  } finally {
    clearChildPhotoCache();
    clearFamilyInfoCache();
    clearEntitlementCache();
  }
}

// ── Setup family (parent, after login) ──────────────────────────────────────
export async function setupFamily(userId, parentName, options = {}) {
  const { familyName = "", plannedChildCount = 1, children = [], parentPhone = "", parentGender = "" } = options;
  const normalizedParentPhone = (() => {
    try {
      return parentPhone ? normalizePhoneForStorage(parentPhone) : "";
    } catch {
      return "";
    }
  })();
  // Route the signing-up parent's phone to their gender's slot. "dad" → dad_phone,
  // anything else (mom/empty/legacy) → mom_phone — keeps contact card consistent
  // with the gender they picked at signup.
  const phoneColumn = parentGender === "dad" ? "dad_phone" : "mom_phone";

  const { data: existing, error: existingError } = await supabase
    .from("families")
    .select("id, pair_code, planned_child_count, mom_phone, dad_phone")
    .eq("parent_id", userId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  let family;
  if (existing) {
    family = existing;
    const updates = {};
    if (plannedChildCount && plannedChildCount !== existing.planned_child_count) {
      updates.planned_child_count = plannedChildCount;
    }
    if (parentName) {
      updates.parent_name = parentName;
    }
    if (familyName) {
      updates.name = familyName;
    }
    if (normalizedParentPhone && !existing[phoneColumn]) {
      updates[phoneColumn] = normalizedParentPhone;
    }
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from("families")
        .update(updates)
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
  } else {
    const insertRow = {
      parent_id: userId,
      pair_code: generatePairCode(),
      planned_child_count: plannedChildCount,
      parent_name: parentName || "부모",
      name: familyName,
    };
    insertRow[phoneColumn] = normalizedParentPhone;
    const { data: created, error: createError } = await supabase
      .from("families")
      .insert(insertRow)
      .select("id, pair_code")
      .single();
    if (createError) throw createError;
    family = created;
  }

  const { error: memberError } = await supabase.from("family_members").upsert(
    { family_id: family.id, user_id: userId, role: "parent", name: parentName || "부모" },
    { onConflict: "family_id,user_id" }
  );
  if (memberError) throw memberError;

  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    const { error: childError } = await supabase.from("family_members").insert({
      family_id: family.id,
      user_id: null,
      role: "child",
      name: c.name,
      birthdate: c.birthdate || null,
      color_hex: c.color_hex,
      photo_url: c.photo_url || null,
      child_order: i + 1,
    });
    if (childError) throw childError;
  }

  return family;
}

export function getParentNameFromUser(user) {
  return getUserDisplayName(user) || "부모";
}

export function getParentPhoneFromUser(user) {
  return getUserPhoneLocal(user);
}

// Returns "mom" | "dad" | "" — based on user_metadata.gender saved at signup.
// Used by setupFamily to route the signing-up parent's phone to the right slot.
export function getParentGenderFromUser(user) {
  const raw = user?.user_metadata?.gender;
  if (raw === "mom" || raw === "dad") return raw;
  if (raw === "엄마") return "mom";
  if (raw === "아빠") return "dad";
  return "";
}

// ── Join family (child, via pair code) ──────────────────────────────────────
export async function joinFamily(pairCode, userId, childName) {
  if (!pairCode || typeof pairCode !== "string") throw new Error("연동 코드를 입력해주세요");
  const { data, error } = await supabase.rpc("join_family", {
    p_pair_code: pairCode.toUpperCase().trim(),
    p_user_id: userId,
    p_name: childName || "아이",
  });

  if (error) throw error;
  return data;
}

// ── Join family as second parent (via pair code) ────────────────────────────
export async function joinFamilyAsParent(pairCode, userId, parentName) {
  if (!pairCode || typeof pairCode !== "string") throw new Error("연동 코드를 입력해주세요");
  const normalizedCode = pairCode.toUpperCase().trim();
  const { data, error } = await supabase.rpc("join_family_as_parent", {
    p_pair_code: normalizedCode,
    p_user_id: userId,
    p_name: parentName || "부모",
  });

  if (error) throw error;
  if (!data) throw new Error("연동 코드를 찾지 못했습니다");
  return data;
}

// ── Get family info for current user ────────────────────────────────────────
export async function getMyFamily(userId) {
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, name")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const { data: parentFamily, error: parentFamilyError } = await supabase
      .from("families")
      .select("id, parent_id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
      .eq("parent_id", userId)
      .limit(1)
      .maybeSingle();

    if (parentFamilyError) throw parentFamilyError;
    if (!parentFamily) return null;

    let finalPairCode = parentFamily.pair_code;
    if (!finalPairCode) {
      finalPairCode = "KID-" + generateUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
      try {
        await supabase.from("families").update({ pair_code: finalPairCode }).eq("id", parentFamily.id);
      } catch (e) {
        console.error("Failed to auto-heal pair code:", e);
      }
    }

    const { data: members } = await supabase
      .from("family_members")
      .select("id, user_id, role, name, emoji, child_order, color_hex, birthdate, photo_url, device_label, device_health")
      .eq("family_id", parentFamily.id);

    const enrichedMembers = await enrichMembersWithSignedPhotos(members || []);

    return {
      familyId: parentFamily.id,
      pairCode: finalPairCode,
      parentName: parentFamily.parent_name,
      myRole: "parent",
      myName: parentFamily.parent_name || "부모",
      members: enrichedMembers,
      phones: { mom: parentFamily.mom_phone || "", dad: parentFamily.dad_phone || "" },
      pairCodeExpiresAt: parentFamily.pair_code_expires_at ? new Date(parentFamily.pair_code_expires_at) : null,
      primaryParentId: parentFamily.parent_id,
      isPrimaryParent: parentFamily.parent_id === userId,
      isCoParent: false,
    };
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id, parent_id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
    .eq("id", membership.family_id)
    .single();
  if (familyError) console.warn("[getMyFamily] family query failed:", familyError);

  let finalPairCode = family?.pair_code || "";
  if (!finalPairCode && membership.role === "parent") {
    finalPairCode = "KID-" + generateUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    try {
      await supabase.from("families").update({ pair_code: finalPairCode }).eq("id", membership.family_id);
    } catch (e) {
      console.error("Failed to auto-heal pair code:", e);
    }
  }

  const { data: members } = await supabase
    .from("family_members")
    .select("id, user_id, role, name, emoji, child_order, color_hex, birthdate, photo_url, device_label, device_health")
    .eq("family_id", membership.family_id);

  const enrichedMembers = await enrichMembersWithSignedPhotos(members || []);
  const parentMembers = enrichedMembers.filter((member) => member?.role === "parent" && member?.user_id);
  const explicitPrimaryParentId = family?.parent_id || "";
  const inferredPrimaryParentId = explicitPrimaryParentId
    || (membership.role === "parent" && parentMembers.length === 1 ? parentMembers[0].user_id : "");
  const isPrimaryParent = membership.role === "parent" && !!inferredPrimaryParentId && inferredPrimaryParentId === userId;
  const isCoParent = membership.role === "parent" && !!inferredPrimaryParentId && inferredPrimaryParentId !== userId;

  return {
    familyId: membership.family_id,
    pairCode: finalPairCode,
    parentName: family?.parent_name || "",
    myRole: membership.role,
    myName: membership.name,
    members: enrichedMembers,
    phones: { mom: family?.mom_phone || "", dad: family?.dad_phone || "" },
    pairCodeExpiresAt: family?.pair_code_expires_at ? new Date(family.pair_code_expires_at) : null,
    primaryParentId: inferredPrimaryParentId,
    isPrimaryParent,
    isCoParent,
  };
}

// ── Regenerate pair code (parent only — enforced server-side by regenerate_pair_code RPC) ──
export async function regeneratePairCode(familyId) {
  if (!familyId) throw new Error("familyId가 필요해요");
  const { data, error } = await supabase.rpc("regenerate_pair_code", { p_family_id: familyId });
  if (error) throw error;
  // RPC returns TABLE(pair_code text, pair_code_expires_at timestamptz) — array of 1 row
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.pair_code) throw new Error("새 연동 코드 생성에 실패했어요");
  return {
    pairCode: row.pair_code,
    pairCodeExpiresAt: row.pair_code_expires_at ? new Date(row.pair_code_expires_at) : null,
  };
}

// ── Parent phone numbers ─────────────────────────────────────────────────────
export async function saveParentPhones(familyId, momPhone, dadPhone) {
  const { error } = await supabase
    .from("families")
    .update({ mom_phone: momPhone || "", dad_phone: dadPhone || "" })
    .eq("id", familyId);
  if (error) throw error;
}

// 본인 프로필(이름/전화번호/캐릭터) 업데이트 — family_members + auth metadata 동시 반영.
// fields: { name?: string, phone?: string, emoji?: string }
export async function updateMyProfile(familyId, userId, fields) {
  if (!familyId || !userId || !fields) throw new Error("familyId/userId/fields required");
  const memberPatch = {};
  if (typeof fields.name === "string") memberPatch.name = fields.name.trim();
  if (typeof fields.phone === "string") memberPatch.phone = fields.phone.trim();
  if (typeof fields.emoji === "string") memberPatch.emoji = fields.emoji.trim();
  if (Object.keys(memberPatch).length === 0) return;
  const { error: memberErr } = await supabase
    .from("family_members")
    .update(memberPatch)
    .eq("family_id", familyId)
    .eq("user_id", userId);
  if (memberErr) throw memberErr;
  if (typeof fields.name === "string") {
    const { error: authErr } = await supabase.auth.updateUser({ data: { name: fields.name.trim() } });
    if (authErr) console.warn("[updateMyProfile] auth metadata update failed:", authErr);
  }
}

export async function getParentPhones(familyId) {
  const { data, error } = await supabase
    .from("families")
    .select("mom_phone, dad_phone")
    .eq("id", familyId)
    .single();
  if (error) return { mom: "", dad: "" };
  return { mom: data.mom_phone || "", dad: data.dad_phone || "" };
}

// ── Unpair (parent removes child, or child leaves) ──────────────────────────
// Routes through the SECURITY DEFINER unpair_child RPC so user-tied tables
// (fcm_tokens, push_subscriptions, child_locations, pending_notifications,
// child_audio_chunks) get cleaned alongside the family_members delete. Without
// the RPC, parent's JWT cannot pierce those tables' user-self RLS, leaving
// stale rows that keep pushing to the unpaired child's phone.
export async function unpairChild(familyId, childUserId) {
  if (!familyId || !childUserId) throw new Error("familyId/childUserId required");
  const { error } = await supabase.rpc("unpair_child", {
    p_family_id: familyId,
    p_child_user_id: childUserId,
  });
  if (error) {
    // Fallback to the legacy minimal delete if the RPC isn't deployed yet
    // (older Supabase branch / deploy lag). Surface a warning so the gap is
    // visible during rollout.
    if (error.code === "PGRST202" || /does not exist/i.test(error.message || "")) {
      console.warn("[unpairChild] unpair_child RPC missing; falling back to family_members.delete only");
      const { error: legacyErr } = await supabase
        .from("family_members")
        .delete()
        .eq("family_id", familyId)
        .eq("user_id", childUserId)
        .eq("role", "child");
      if (legacyErr) throw legacyErr;
      return;
    }
    throw error;
  }
}

// ── Auth state listener ─────────────────────────────────────────────────────
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return subscription;
}
