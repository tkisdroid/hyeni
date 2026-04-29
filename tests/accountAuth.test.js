import { describe, expect, it } from "vitest";
import {
  buildAuthProfileFromUser,
  normalizeBirthdate,
  normalizeGender,
  normalizePhoneForAuth,
  normalizePhoneForStorage,
  requestPhoneSignupCode,
  signInWithLoginId,
  validateParentSignupForm,
} from "../src/lib/accountAuth.js";

describe("parent account auth helpers", () => {
  it("normalizes Korean parent phone numbers for Supabase Auth and storage", () => {
    expect(normalizePhoneForAuth("010-1234-5678")).toBe("+821012345678");
    expect(normalizePhoneForAuth("+82 10-1234-5678")).toBe("+821012345678");
    expect(normalizePhoneForStorage("+82 10-1234-5678")).toBe("01012345678");
  });

  it("validates the signup form before requesting an SMS code", () => {
    const result = validateParentSignupForm({
      name: " 홍길동 ",
      loginId: " Parent_01 ",
      password: "secret1",
      passwordConfirm: "secret1",
      gender: "엄마",
      birthdate: "1985-03-14",
      phone: "010-1234-5678",
    });

    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      name: "홍길동",
      loginId: "parent_01",
      password: "secret1",
      gender: "mom",
      birthdate: "1985-03-14",
      phoneAuth: "+821012345678",
      phoneStorage: "01012345678",
    });
  });

  it("rejects invalid IDs and password mismatches", () => {
    const result = validateParentSignupForm({
      name: "홍길동",
      loginId: "가나다",
      password: "secret1",
      passwordConfirm: "secret2",
      gender: "엄마",
      birthdate: "1985-03-14",
      phone: "01012345678",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.loginId).toContain("영문");
    expect(result.errors.passwordConfirm).toContain("일치");
  });

  it("normalizes Korean gender labels to mom/dad and rejects others", () => {
    expect(normalizeGender("엄마")).toBe("mom");
    expect(normalizeGender("아빠")).toBe("dad");
    expect(normalizeGender("mom")).toBe("mom");
    expect(normalizeGender("dad")).toBe("dad");
    expect(normalizeGender("")).toBe("");
    expect(normalizeGender("기타")).toBe("");
    expect(normalizeGender(null)).toBe("");
  });

  it("validates birthdate is a real YYYY-MM-DD date in range", () => {
    expect(normalizeBirthdate("1985-03-14")).toBe("1985-03-14");
    expect(normalizeBirthdate("1985-3-14")).toBe("");
    expect(normalizeBirthdate("1985-13-01")).toBe("");
    expect(normalizeBirthdate("1985-02-30")).toBe("");
    expect(normalizeBirthdate("1899-12-31")).toBe("");
    expect(normalizeBirthdate("3000-01-01")).toBe("");
    expect(normalizeBirthdate("")).toBe("");
    expect(normalizeBirthdate(null)).toBe("");
  });

  it("rejects signup form when gender is missing or invalid", () => {
    const result = validateParentSignupForm({
      name: "홍길동",
      loginId: "parent01",
      password: "secret1",
      passwordConfirm: "secret1",
      gender: "",
      birthdate: "1985-03-14",
      phone: "010-1234-5678",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.gender).toBeTruthy();
  });

  it("rejects signup form when birthdate is missing or malformed", () => {
    const result = validateParentSignupForm({
      name: "홍길동",
      loginId: "parent01",
      password: "secret1",
      passwordConfirm: "secret1",
      gender: "아빠",
      birthdate: "not-a-date",
      phone: "010-1234-5678",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.birthdate).toBeTruthy();
  });

  it("builds a DB profile from Kakao metadata without guessing missing fields", () => {
    const profile = buildAuthProfileFromUser({
      id: "user-1",
      phone: "",
      app_metadata: { provider: "kakao" },
      user_metadata: {
        name: "홍길동",
        phone_number: "+82 10-1234-5678",
      },
      identities: [
        {
          provider: "kakao",
          identity_data: {
            name: "카카오이름",
            phone_number: "+82 10-9999-0000",
          },
        },
      ],
    });

    expect(profile).toEqual({
      user_id: "user-1",
      login_id: null,
      display_name: "홍길동",
      phone: "+821012345678",
      provider: "kakao",
    });
  });

  it("requests signup through Supabase phone/password auth with metadata", async () => {
    let signUpPayload = null;
    const fakeClient = {
      auth: {
        signUp: async (payload) => {
          signUpPayload = payload;
          return {
            data: {
              user: { id: "user-2", phone: payload.phone, user_metadata: payload.options.data },
              session: null,
            },
            error: null,
          };
        },
      },
    };

    const result = await requestPhoneSignupCode({
      name: "홍길동",
      loginId: "Parent01",
      password: "secret1",
      passwordConfirm: "secret1",
      gender: "엄마",
      birthdate: "1985-03-14",
      phone: "010-1234-5678",
    }, fakeClient);

    expect(signUpPayload).toEqual({
      phone: "+821012345678",
      password: "secret1",
      options: {
        channel: "sms",
        data: {
          auth_provider: "phone",
          login_id: "parent01",
          name: "홍길동",
          phone: "01012345678",
          gender: "mom",
          birthdate: "1985-03-14",
        },
      },
    });
    expect(result.phone).toBe("+821012345678");
    expect(result.profile.login_id).toBe("parent01");
    expect(result.profile.gender).toBe("mom");
    expect(result.profile.birthdate).toBe("1985-03-14");
  });

  it("checks login ID availability before sending an SMS", async () => {
    let signUpCalled = false;
    const fakeClient = {
      rpc: async (name, args) => {
        expect(name).toBe("is_login_id_available");
        expect(args).toEqual({ p_login_id: "parent01" });
        return { data: false, error: null };
      },
      auth: {
        signUp: async () => {
          signUpCalled = true;
          return { data: {}, error: null };
        },
      },
    };

    await expect(requestPhoneSignupCode({
      name: "홍길동",
      loginId: "Parent01",
      password: "secret1",
      passwordConfirm: "secret1",
      gender: "엄마",
      birthdate: "1985-03-14",
      phone: "010-1234-5678",
    }, fakeClient)).rejects.toThrow("이미 사용 중인 ID");

    expect(signUpCalled).toBe(false);
  });

  it("logs in with ID/password by resolving the stored phone number", async () => {
    const calls = [];
    const fakeClient = {
      rpc: async (name, args) => {
        calls.push(["rpc", name, args]);
        return { data: "+821012345678", error: null };
      },
      auth: {
        signInWithPassword: async (payload) => {
          calls.push(["signInWithPassword", payload]);
          return {
            data: {
              user: { id: "user-3", phone: payload.phone, user_metadata: { login_id: "parent01" } },
              session: { access_token: "token" },
            },
            error: null,
          };
        },
      },
      from: () => ({
        upsert: async (row) => {
          calls.push(["upsert", row]);
          return { error: null };
        },
      }),
    };

    await signInWithLoginId({ loginId: "Parent01", password: "secret1" }, fakeClient);

    expect(calls[0]).toEqual(["rpc", "lookup_auth_phone_by_login_id", { p_login_id: "parent01" }]);
    expect(calls[1]).toEqual(["signInWithPassword", { phone: "+821012345678", password: "secret1" }]);
    expect(calls[2][1]).toMatchObject({ user_id: "user-3", login_id: "parent01", phone: "+821012345678" });
  });
});
