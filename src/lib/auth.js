import { supabase } from "./supabase.js";

const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY;
const NATIVE_OAUTH_REDIRECT_URL = "hyenicalendar://auth-callback";

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
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (native) {
    if (!data?.url) {
      throw new Error("카카오 로그인 URL을 생성하지 못했습니다.");
    }

    // Force the OAuth flow to leave the current app screen only temporarily.
    // The redirect target is the app's custom scheme, so Android should route
    // back into the native activity rather than staying in Chrome.
    window.location.assign(data.url);
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
export async function setupFamily(userId, parentName) {
  const { data: existing, error: existingError } = await supabase
    .from("families")
    .select("id, pair_code")
    .eq("parent_id", userId)
    .limit(1)
    .maybeSingle();
  if (existingError) console.warn("[setupFamily] existing family query failed:", existingError);

  if (existing) {
    const { error: memberError } = await supabase
      .from("family_members")
      .upsert({ family_id: existing.id, user_id: userId, role: "parent", name: parentName || "부모" }, { onConflict: "family_id,user_id" });
    if (memberError) {
      console.error("[setupFamily] parent membership upsert failed:", memberError);
    }
    return { familyId: existing.id, pairCode: existing.pair_code };
  }

  const pairCode = generatePairCode();
  const { data: family, error } = await supabase
    .from("families")
    .insert({ parent_id: userId, pair_code: pairCode, parent_name: parentName || "" })
    .select("id, pair_code")
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: userId, role: "parent", name: parentName || "부모" });
  if (memberError) {
    console.error("[setupFamily] parent membership insert failed:", memberError);
  }

  return { familyId: family.id, pairCode: family.pair_code };
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
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id")
    .eq("pair_code", normalizedCode)
    .limit(1)
    .maybeSingle();

  if (familyError) throw familyError;
  if (!family?.id) throw new Error("연동 코드를 찾지 못했습니다");

  const { error: memberError } = await supabase
    .from("family_members")
    .upsert(
      {
        family_id: family.id,
        user_id: userId,
        role: "parent",
        name: parentName || "부모",
      },
      { onConflict: "family_id,user_id" }
    );

  if (memberError) throw memberError;
  return family.id;
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
      .select("id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
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
      .select("user_id, role, name, emoji")
      .eq("family_id", parentFamily.id);

    return {
      familyId: parentFamily.id,
      pairCode: finalPairCode,
      parentName: parentFamily.parent_name,
      myRole: "parent",
      myName: parentFamily.parent_name || "부모",
      members: members || [],
      phones: { mom: parentFamily.mom_phone || "", dad: parentFamily.dad_phone || "" },
      pairCodeExpiresAt: parentFamily.pair_code_expires_at ? new Date(parentFamily.pair_code_expires_at) : null,
    };
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
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
    .select("user_id, role, name, emoji")
    .eq("family_id", membership.family_id);

  return {
    familyId: membership.family_id,
    pairCode: finalPairCode,
    parentName: family?.parent_name || "",
    myRole: membership.role,
    myName: membership.name,
    members: members || [],
    phones: { mom: family?.mom_phone || "", dad: family?.dad_phone || "" },
    pairCodeExpiresAt: family?.pair_code_expires_at ? new Date(family.pair_code_expires_at) : null,
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
export async function unpairChild(familyId, childUserId) {
  const { error } = await supabase
    .from("family_members")
    .delete()
    .eq("family_id", familyId)
    .eq("user_id", childUserId)
    .eq("role", "child");
  if (error) throw error;
}

// ── Auth state listener ─────────────────────────────────────────────────────
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return subscription;
}
