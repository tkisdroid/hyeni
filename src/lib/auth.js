import { supabase } from "./supabase.js";
import { getUserDisplayName, getUserPhoneLocal, normalizePhoneForStorage } from "./accountAuth.js";

const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY;
const NATIVE_OAUTH_REDIRECT_URL = "hyenicalendar://auth-callback";
const CHILD_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d
const CHILD_PHOTO_SIGNED_URL_CACHE_SAFETY_MS = 5 * 60 * 1000;
const childPhotoSignedUrlCache = new Map();

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
  return Promise.all(members.map(async (m) => {
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
      childPhotoSignedUrlCache.delete(path);
      return { ...m, photo_url: null };
    }
    childPhotoSignedUrlCache.set(path, {
      signedUrl: result.data.signedUrl,
      expiresAt: Date.now() + (CHILD_PHOTO_SIGNED_URL_TTL_SECONDS * 1000) - CHILD_PHOTO_SIGNED_URL_CACHE_SAFETY_MS,
    });
    return { ...m, photo_url: result.data.signedUrl };
  }));
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      scopes: "profile_nickname name phone_number",
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (native) {
    if (!data?.url) {
      throw new Error("카카오 로그인 URL을 생성하지 못했습니다.");
    }

    // Open in Chrome Custom Tabs so the WebView stays mounted. The deep-link
    // callback (see App.jsx appUrlOpen handler) calls Browser.close().
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url: data.url,
      windowName: "_self",
      presentationStyle: "popover",
    });
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
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url: data.url,
      windowName: "_self",
      presentationStyle: "popover",
    });
  }
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

// ── Logout ──────────────────────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
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
