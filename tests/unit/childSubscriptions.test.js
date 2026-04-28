// tests/unit/childSubscriptions.test.js
import { describe, it, expect } from "vitest";
import { deriveChildEntitlements, totalMonthlyPrice, canChildUseFeature } from "../../src/lib/childSubscriptions.js";

describe("deriveChildEntitlements", () => {
  it("subscriptions 행이 없으면 모든 자녀 free", () => {
    const result = deriveChildEntitlements([
      { user_id: "c1" }, { user_id: "c2" }
    ], []);
    expect(result.c1.tier).toBe("free");
    expect(result.c2.tier).toBe("free");
  });

  it("active subscription 있는 자녀는 premium", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }],
      [{ child_id: "c1", status: "active", price_krw: 1500, product_id: "hyeni_child_slot_1" }]
    );
    expect(result.c1.tier).toBe("premium");
    expect(result.c1.priceKrw).toBe(1500);
  });

  it("expired/canceled 자녀는 free", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }, { user_id: "c2" }],
      [
        { child_id: "c1", status: "expired", price_krw: 1500 },
        { child_id: "c2", status: "canceled", price_krw: 1500 },
      ]
    );
    expect(result.c1.tier).toBe("free");
    expect(result.c2.tier).toBe("free");
  });

  it("grace period 자녀는 premium 유지", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }],
      [{ child_id: "c1", status: "grace", price_krw: 1500 }]
    );
    expect(result.c1.tier).toBe("premium");
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
