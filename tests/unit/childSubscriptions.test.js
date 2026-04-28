// tests/unit/childSubscriptions.test.js
import { describe, it, expect, vi } from "vitest";

// childSubscriptions.js imports ../supabase.js which throws if env is missing.
// These pure-function tests don't touch the client, so a stub is enough.
vi.mock("../../src/lib/supabase.js", () => ({ supabase: {} }));

const { deriveChildEntitlements, totalMonthlyPrice, canChildUseFeature } = await import(
  "../../src/lib/childSubscriptions.js"
);

// subscriptions.child_id is family_members.id (per M3 schema + backfill).
// Children are keyed by family_members.id in the result, NOT by user_id.
describe("deriveChildEntitlements", () => {
  it("subscriptions 행이 없으면 모든 자녀 free", () => {
    const result = deriveChildEntitlements([
      { id: "fm1", user_id: "u1" }, { id: "fm2", user_id: "u2" }
    ], []);
    expect(result.fm1.tier).toBe("free");
    expect(result.fm2.tier).toBe("free");
  });

  it("active subscription 있는 자녀는 premium", () => {
    const result = deriveChildEntitlements(
      [{ id: "fm1", user_id: "u1" }],
      [{ child_id: "fm1", status: "active", price_krw: 1500, product_id: "hyeni_child_slot_1" }]
    );
    expect(result.fm1.tier).toBe("premium");
    expect(result.fm1.priceKrw).toBe(1500);
  });

  it("expired/canceled 자녀는 free", () => {
    const result = deriveChildEntitlements(
      [{ id: "fm1", user_id: "u1" }, { id: "fm2", user_id: "u2" }],
      [
        { child_id: "fm1", status: "expired", price_krw: 1500 },
        { child_id: "fm2", status: "canceled", price_krw: 1500 },
      ]
    );
    expect(result.fm1.tier).toBe("free");
    expect(result.fm2.tier).toBe("free");
  });

  it("grace period 자녀는 premium 유지", () => {
    const result = deriveChildEntitlements(
      [{ id: "fm1", user_id: "u1" }],
      [{ child_id: "fm1", status: "grace", price_krw: 1500 }]
    );
    expect(result.fm1.tier).toBe("premium");
  });

  it("regression: subscription의 child_id를 user_id로 잘못 매칭하지 않음", () => {
    // 이전 버그: subByChild.get(child.user_id) — subscription의 child_id가
    // family_members.id인데 user_id로 lookup해서 항상 free fallback.
    const result = deriveChildEntitlements(
      [{ id: "fm1", user_id: "u1" }],
      [{ child_id: "u1", status: "active", price_krw: 1500 }]  // user_id 값으로 설정 (잘못됨)
    );
    // 의도: child_id="u1"은 family_members.id "fm1"과 매칭되지 않으므로 free
    expect(result.fm1.tier).toBe("free");
  });
});

describe("totalMonthlyPrice", () => {
  it("active 자녀 합계 = N × 1500", () => {
    expect(totalMonthlyPrice([
      { status: "active", price_krw: 1500 },
      { status: "active", price_krw: 1500 },
      { status: "expired", price_krw: 1500 },
    ])).toBe(3000);
  });

  it("active 0명이면 0", () => {
    expect(totalMonthlyPrice([])).toBe(0);
  });
});

describe("canChildUseFeature", () => {
  it("free 자녀: SOS / 위치 1회 / 음성 실시간 / 오늘 일정 OK", () => {
    const ent = { tier: "free" };
    expect(canChildUseFeature(ent, "sos_send")).toBe(true);
    expect(canChildUseFeature(ent, "location_one_shot")).toBe(true);
    expect(canChildUseFeature(ent, "voice_message_realtime")).toBe(true);
    expect(canChildUseFeature(ent, "today_events_view")).toBe(true);
  });

  it("free 자녀: 디바이스 안전 지표 / Force-Ring 차단", () => {
    const ent = { tier: "free" };
    expect(canChildUseFeature(ent, "device_safety_stats")).toBe(false);
    expect(canChildUseFeature(ent, "force_ring")).toBe(false);
  });

  it("premium 자녀: 모든 기능 OK", () => {
    const ent = { tier: "premium" };
    expect(canChildUseFeature(ent, "device_safety_stats")).toBe(true);
    expect(canChildUseFeature(ent, "force_ring")).toBe(true);
    expect(canChildUseFeature(ent, "sos_send")).toBe(true);
  });
});
