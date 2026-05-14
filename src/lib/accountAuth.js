import { supabase } from "./supabase.js";

const LOGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{3,23}$/;

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeKakaoPhoneSpacing(value) {
  return String(value || "").replace(/^\+82\s*0?/, "+82 ");
}

export function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidLoginId(value) {
  return LOGIN_ID_RE.test(normalizeLoginId(value));
}

export function normalizePhoneForStorage(value) {
  const raw = normalizeKakaoPhoneSpacing(value).trim();
  const digits = digitsOnly(raw);

  if (raw.startsWith("+82") && /^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^010\d{8}$/.test(digits)) {
    return digits;
  }

  throw new Error("휴대폰 번호는 010으로 시작하는 11자리 번호여야 해요");
}

export function normalizePhoneForAuth(value) {
  const local = normalizePhoneForStorage(value);
  return `+82${local.slice(1)}`;
}

function maybeNormalizePhoneForAuth(value) {
  try {
    return normalizePhoneForAuth(value);
  } catch {
    return "";
  }
}

const GENDER_VALUES = new Set(["mom", "dad"]);
const KOREAN_GENDER_LABEL_TO_VALUE = { "엄마": "mom", "아빠": "dad" };

export function normalizeGender(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (GENDER_VALUES.has(raw)) return raw;
  if (KOREAN_GENDER_LABEL_TO_VALUE[raw]) return KOREAN_GENDER_LABEL_TO_VALUE[raw];
  return "";
}

export function normalizeBirthdate(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [yearStr, monthStr, dayStr] = raw.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (year < 1900) return "";
  const today = new Date();
  const todayYear = today.getFullYear();
  if (year > todayYear) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  if (date.getTime() > today.getTime()) return "";
  return raw;
}

export function getUserDisplayName(user, fallback = {}) {
  const metadata = user?.user_metadata || {};
  const identityData = (user?.identities || []).map((identity) => identity?.identity_data || {});
  const nested = [
    metadata.kakao_account,
    metadata.kakao_account?.profile,
    metadata.profile,
    ...identityData.flatMap((data) => [data.kakao_account, data.kakao_account?.profile, data.profile]),
  ].filter(Boolean);
  const candidates = [metadata, ...identityData, ...nested, fallback];

  for (const source of candidates) {
    const name = firstText(
      source?.name,
      source?.full_name,
      source?.display_name,
      source?.nickname,
      source?.preferred_username,
    );
    if (name) return name;
  }

  return "";
}

export function getUserPhone(user, fallback = {}) {
  const metadata = user?.user_metadata || {};
  const identityData = (user?.identities || []).map((identity) => identity?.identity_data || {});
  const nested = [
    metadata.kakao_account,
    metadata.profile,
    ...identityData.flatMap((data) => [data.kakao_account, data.profile]),
  ].filter(Boolean);
  const candidates = [
    { phone: user?.phone },
    metadata,
    ...identityData,
    ...nested,
    fallback,
  ];

  for (const source of candidates) {
    const phone = firstText(
      source?.phone,
      source?.phone_number,
      source?.phoneNumber,
      source?.mobile,
      source?.mobile_number,
    );
    const normalized = maybeNormalizePhoneForAuth(phone);
    if (normalized) return normalized;
  }

  return "";
}

export function getUserPhoneLocal(user, fallback = {}) {
  const phone = getUserPhone(user, fallback);
  if (!phone) return "";
  return normalizePhoneForStorage(phone);
}

export function getAuthProvider(user, fallback = {}) {
  return firstText(
    fallback.provider,
    user?.user_metadata?.auth_provider,
    user?.user_metadata?.provider,
    user?.app_metadata?.provider,
    user?.identities?.find((identity) => identity?.provider)?.provider,
    user?.phone ? "phone" : "",
  ) || "unknown";
}

export function buildAuthProfileFromUser(user, fallback = {}) {
  if (!user?.id) throw new Error("사용자 정보를 확인하지 못했어요");
  const loginId = normalizeLoginId(firstText(fallback.loginId, user?.user_metadata?.login_id));
  const phone = getUserPhone(user, fallback);
  const gender = normalizeGender(firstText(fallback.gender, user?.user_metadata?.gender));
  const birthdate = normalizeBirthdate(firstText(fallback.birthdate, user?.user_metadata?.birthdate));

  const profile = {
    user_id: user.id,
    login_id: isValidLoginId(loginId) ? loginId : null,
    display_name: getUserDisplayName(user, fallback) || "",
    phone: phone || null,
    provider: getAuthProvider(user, fallback),
  };

  if (gender) profile.gender = gender;
  if (birthdate) profile.birthdate = birthdate;

  return profile;
}

export function validateParentSignupForm(input) {
  const name = String(input?.name || "").trim();
  const loginId = normalizeLoginId(input?.loginId);
  const password = String(input?.password || "");
  const passwordConfirm = String(input?.passwordConfirm || "");
  const gender = normalizeGender(input?.gender);
  const birthdate = normalizeBirthdate(input?.birthdate);
  const errors = {};
  let phoneAuth = "";
  let phoneStorage = "";

  if (!name) errors.name = "이름을 입력해 주세요";
  if (!isValidLoginId(loginId)) {
    errors.loginId = "ID는 영문 소문자, 숫자, ., _, - 조합 4~24자로 입력해 주세요";
  }
  if (password.length < 6) errors.password = "비밀번호는 6자 이상이어야 해요";
  if (password !== passwordConfirm) errors.passwordConfirm = "비밀번호 확인이 일치하지 않아요";
  if (!gender) errors.gender = "엄마 또는 아빠를 선택해 주세요";
  if (!birthdate) errors.birthdate = "생년월일을 YYYY-MM-DD 형식으로 입력해 주세요";

  try {
    phoneAuth = normalizePhoneForAuth(input?.phone);
    phoneStorage = normalizePhoneForStorage(input?.phone);
  } catch (error) {
    errors.phone = error.message;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values: null };

  return {
    ok: true,
    errors: {},
    values: { name, loginId, password, gender, birthdate, phoneAuth, phoneStorage },
  };
}

function firstValidationError(errors) {
  return errors.name || errors.loginId || errors.password || errors.passwordConfirm
    || errors.gender || errors.birthdate || errors.phone || "입력값을 확인해 주세요";
}

export async function syncAuthProfile(user, fallback = {}, client = supabase) {
  const profile = buildAuthProfileFromUser(user, fallback);
  const { error } = await client
    .from("user_profiles")
    .upsert(profile, { onConflict: "user_id" });
  if (error) throw error;
  return profile;
}


export async function checkLoginIdAvailability(loginId, client = supabase) {
  const normalizedLoginId = normalizeLoginId(loginId);
  if (!isValidLoginId(normalizedLoginId)) {
    throw new Error("ID는 영문 소문자, 숫자, ., _, - 조합 4~24자로 입력해 주세요");
  }

  const { data: available, error } = await client.rpc("is_login_id_available", {
    p_login_id: normalizedLoginId,
  });
  if (error) throw error;
  return available !== false;
}

export async function requestPhoneSignupCode(input, client = supabase) {
  const validation = validateParentSignupForm(input);
  if (!validation.ok) throw new Error(firstValidationError(validation.errors));

  const { name, loginId, password, gender, birthdate, phoneAuth, phoneStorage } = validation.values;
  const idAvailable = await checkLoginIdAvailability(loginId, client);
  if (!idAvailable) throw new Error("이미 사용 중인 ID예요");

  const metadata = {
    auth_provider: "phone",
    login_id: loginId,
    name,
    phone: phoneStorage,
    gender,
    birthdate,
  };

  const { data, error } = await client.auth.signUp({
    phone: phoneAuth,
    password,
    options: {
      channel: "sms",
      data: metadata,
    },
  });
  if (error) throw error;

  const profile = {
    user_id: data?.user?.id || null,
    login_id: loginId,
    display_name: name,
    phone: phoneAuth,
    provider: "phone",
    gender,
    birthdate,
  };

  if (data?.session && data?.user?.id) {
    await syncAuthProfile(
      data.user,
      { ...profile, name, phone: phoneAuth, loginId, provider: "phone", gender, birthdate },
      client,
    );
  }

  return {
    user: data?.user || null,
    session: data?.session || null,
    phone: phoneAuth,
    phoneStorage,
    profile,
  };
}

export async function verifyPhoneSignupCode({ phone, token, profile }, client = supabase) {
  const phoneAuth = normalizePhoneForAuth(phone);
  const normalizedToken = String(token || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error("인증번호 6자리를 입력해 주세요");
  }

  const { data, error } = await client.auth.verifyOtp({
    phone: phoneAuth,
    token: normalizedToken,
    type: "sms",
  });
  if (error) throw error;
  if (!data?.user) throw new Error("인증 후 사용자 정보를 확인하지 못했어요");

  await syncAuthProfile(data.user, {
    loginId: profile?.login_id,
    name: profile?.display_name,
    phone: profile?.phone || phoneAuth,
    provider: "phone",
    gender: profile?.gender,
    birthdate: profile?.birthdate,
  }, client);

  return data;
}

export async function signInWithLoginId({ loginId, password }, client = supabase) {
  const normalizedLoginId = normalizeLoginId(loginId);
  if (!isValidLoginId(normalizedLoginId) || !password) {
    throw new Error("ID 또는 비밀번호를 확인해 주세요");
  }

  const { data: phone, error: lookupError } = await client.rpc("lookup_auth_phone_by_login_id", {
    p_login_id: normalizedLoginId,
  });
  if (lookupError) throw lookupError;
  if (!phone) throw new Error("ID 또는 비밀번호를 확인해 주세요");

  const { data, error } = await client.auth.signInWithPassword({
    phone: normalizePhoneForAuth(phone),
    password,
  });
  if (error) throw error;

  if (data?.user) {
    await syncAuthProfile(data.user, { loginId: normalizedLoginId, phone, provider: "phone" }, client);
  }

  return data;
}
