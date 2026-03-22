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

    // Open OAuth in Custom Chrome Tab (in-app browser) so the WebView
    // stays intact. The deep link redirect closes the tab automatically.
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url });
  }
}

// ── Magic Link login (email) ────────────────────────────────────────────────
export async function magicLinkLogin(email) {
  const native = isNative();
  const redirectTo = native ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return true;
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
  if (!userId) throw new Error("userId is required");
  const normalizedName = parentName || "부모";

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_or_get_family", {
    p_user_id: userId,
    p_parent_name: normalizedName,
  });

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const familyId = row?.family_id || row?.result_family_id;
    const pairCode = row?.pair_code || row?.result_pair_code;
    if (familyId) {
      return { familyId, pairCode };
    }
  } else if (rpcError.code !== "42883") {
    throw rpcError;
  }

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
      .upsert({ family_id: existing.id, user_id: userId, role: "parent", name: normalizedName }, { onConflict: "family_id,user_id" });
    if (memberError) {
      console.error("[setupFamily] parent membership upsert failed:", memberError);
    }
    return { familyId: existing.id, pairCode: existing.pair_code };
  }

  const pairCode = generatePairCode();
  const { data: family, error } = await supabase
    .from("families")
    .insert({ parent_id: userId, pair_code: pairCode, parent_name: normalizedName })
    .select("id, pair_code")
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: userId, role: "parent", name: normalizedName });
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
  // join_family RPC를 사용하고, 이후 역할을 parent로 업데이트
  const familyId = await joinFamily(pairCode, userId, parentName || "부모");
  if (familyId) {
    await supabase
      .from("family_members")
      .update({ role: "parent" })
      .eq("family_id", familyId)
      .eq("user_id", userId);
  }
  return familyId;
}

// ── Get family info for current user ────────────────────────────────────────

async function healPairCode(familyId, existingCode) {
  if (existingCode) return existingCode;
  const healed = generatePairCode();
  try {
    await supabase.from("families").update({ pair_code: healed }).eq("id", familyId);
  } catch (e) {
    console.error("Failed to auto-heal pair code:", e);
  }
  return healed;
}

async function fetchFamilyMembers(familyId) {
  const { data } = await supabase
    .from("family_members")
    .select("user_id, role, name, emoji")
    .eq("family_id", familyId);
  return data || [];
}

function buildFamilyResult(familyId, family, pairCode, role, name, members) {
  return {
    familyId,
    pairCode,
    parentName: family?.parent_name || "",
    myRole: role,
    myName: name,
    members,
    phones: { mom: family?.mom_phone || "", dad: family?.dad_phone || "" },
  };
}

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
      .select("id, pair_code, parent_name, mom_phone, dad_phone")
      .eq("parent_id", userId)
      .limit(1)
      .maybeSingle();

    if (parentFamilyError) throw parentFamilyError;
    if (!parentFamily) return null;

    const pairCode = await healPairCode(parentFamily.id, parentFamily.pair_code);
    const members = await fetchFamilyMembers(parentFamily.id);
    return buildFamilyResult(parentFamily.id, parentFamily, pairCode, "parent", parentFamily.parent_name || "부모", members);
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id, pair_code, parent_name, mom_phone, dad_phone")
    .eq("id", membership.family_id)
    .single();
  if (familyError) console.warn("[getMyFamily] family query failed:", familyError);

  const pairCode = membership.role === "parent"
    ? await healPairCode(membership.family_id, family?.pair_code)
    : (family?.pair_code || "");
  const members = await fetchFamilyMembers(membership.family_id);
  return buildFamilyResult(membership.family_id, family, pairCode, membership.role, membership.name, members);
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
