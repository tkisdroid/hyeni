import { describe, expect, it, vi } from "vitest";
import {
  findUserByPhone,
  requestOAuthBridgeOtp,
  verifyOAuthBridgeOtp,
  mergeOAuthIntoPhoneUser,
  markProviderLinked,
} from "../src/lib/accountAuth.js";

function makeClient(overrides = {}) {
  return {
    rpc: vi.fn(async (name) => {
      if (overrides.rpc?.[name]) return overrides.rpc[name];
      return { data: null, error: null };
    }),
    auth: {
      signInWithOtp: vi.fn(async () => overrides.signInWithOtp ?? { data: {}, error: null }),
      verifyOtp: vi.fn(async () => overrides.verifyOtp ?? { data: { user: { id: "phone-uid" }, session: { access_token: "tok" } }, error: null }),
    },
    functions: {
      invoke: vi.fn(async () => overrides.invoke ?? { data: { ok: true, linked: true, provider: "kakao" }, error: null }),
    },
  };
}

describe("findUserByPhone", () => {
  it("returns the user_id when RPC finds a match", async () => {
    const client = makeClient({ rpc: { find_user_by_phone: { data: "user-abc", error: null } } });
    await expect(findUserByPhone("010-1234-5678", client)).resolves.toBe("user-abc");
    expect(client.rpc).toHaveBeenCalledWith("find_user_by_phone", { p_phone: "+821012345678" });
  });
  it("returns null when no match", async () => {
    const client = makeClient({ rpc: { find_user_by_phone: { data: null, error: null } } });
    await expect(findUserByPhone("010-1234-5678", client)).resolves.toBeNull();
  });
  it("throws on invalid phone", async () => {
    const client = makeClient();
    await expect(findUserByPhone("nope", client)).rejects.toThrow();
  });
});

describe("requestOAuthBridgeOtp", () => {
  it("sends SMS OTP without creating a user (shouldCreateUser:false)", async () => {
    const client = makeClient();
    await requestOAuthBridgeOtp("010-1234-5678", client);
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      options: { channel: "sms", shouldCreateUser: false },
    });
  });
});

describe("verifyOAuthBridgeOtp", () => {
  it("verifies SMS OTP and returns the phone user id", async () => {
    const client = makeClient();
    const result = await verifyOAuthBridgeOtp("010-1234-5678", "123456", client);
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      token: "123456",
      type: "sms",
    });
    expect(result.userId).toBe("phone-uid");
  });
  it("rejects non-6-digit tokens", async () => {
    const client = makeClient();
    await expect(verifyOAuthBridgeOtp("010-1234-5678", "12", client)).rejects.toThrow();
  });
});

describe("mergeOAuthIntoPhoneUser", () => {
  it("invokes the Edge Function with provider + oauth_user_id", async () => {
    const client = makeClient();
    const result = await mergeOAuthIntoPhoneUser({ oauthUserId: "oauth-uid", provider: "kakao" }, client);
    expect(client.functions.invoke).toHaveBeenCalledWith("merge-oauth-into-phone", {
      body: { oauth_user_id: "oauth-uid", provider: "kakao" },
    });
    expect(result.ok).toBe(true);
  });
  it("throws when Edge Function returns ok:false", async () => {
    const client = makeClient({ invoke: { data: { ok: false, error: "phone_user_already_linked" }, error: null } });
    await expect(mergeOAuthIntoPhoneUser({ oauthUserId: "oauth-uid", provider: "kakao" }, client))
      .rejects.toThrow(/phone_user_already_linked/);
  });
});

describe("markProviderLinked", () => {
  it("calls the mark_linked_provider RPC with the payload", async () => {
    const client = makeClient();
    await markProviderLinked({ userId: "phone-uid", provider: "kakao", payload: { providerId: "kakao-123" } }, client);
    expect(client.rpc).toHaveBeenCalledWith("mark_linked_provider", {
      p_user_id: "phone-uid",
      p_provider: "kakao",
      p_payload: { providerId: "kakao-123" },
    });
  });
});
