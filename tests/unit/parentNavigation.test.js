import { describe, it, expect } from "vitest";
import {
  pickInitialActiveView,
  shouldAutoPinSingleChild,
  isSelectedChildIdStale,
  shouldRedirectMultichildToHome,
  pickMemoTargetChildUserId,
} from "../../src/lib/parentNavigation.js";

describe("pickInitialActiveView — initial view 결정", () => {
  it("부모 + 자녀 2명 → home (선택 hub)", () => {
    expect(pickInitialActiveView({ isParent: true, childCount: 2 })).toBe("home");
  });
  it("부모 + 자녀 3명 → home", () => {
    expect(pickInitialActiveView({ isParent: true, childCount: 3 })).toBe("home");
  });
  it("부모 + 단일 자녀 → calendar (홈 탭 hidden)", () => {
    expect(pickInitialActiveView({ isParent: true, childCount: 1 })).toBe("calendar");
  });
  it("부모 + 자녀 0명(미페어링) → calendar (자녀 모드 fallback과 동일)", () => {
    expect(pickInitialActiveView({ isParent: true, childCount: 0 })).toBe("calendar");
  });
  it("자녀 모드 + 자녀 2명 가족이라도 → calendar (자녀는 본인 화면만)", () => {
    expect(pickInitialActiveView({ isParent: false, childCount: 2 })).toBe("calendar");
  });
  it("자녀 모드 + 단일 자녀 → calendar", () => {
    expect(pickInitialActiveView({ isParent: false, childCount: 1 })).toBe("calendar");
  });
});

describe("shouldAutoPinSingleChild — 단일 자녀 자동 pin", () => {
  it("단일 자녀 + 미선택 → true (auto pin 발동)", () => {
    expect(shouldAutoPinSingleChild({
      pairedChildren: [{ id: "c1" }],
      selectedChildId: null,
    })).toBe(true);
  });
  it("단일 자녀 + 이미 선택됨 → false (덮어쓰지 않음)", () => {
    expect(shouldAutoPinSingleChild({
      pairedChildren: [{ id: "c1" }],
      selectedChildId: "c1",
    })).toBe(false);
  });
  it("multichild + 미선택 → false (사용자 명시 선택 대기)", () => {
    expect(shouldAutoPinSingleChild({
      pairedChildren: [{ id: "c1" }, { id: "c2" }],
      selectedChildId: null,
    })).toBe(false);
  });
  it("자녀 0명 → false", () => {
    expect(shouldAutoPinSingleChild({
      pairedChildren: [],
      selectedChildId: null,
    })).toBe(false);
  });
  it("pairedChildren undefined → false (방어)", () => {
    expect(shouldAutoPinSingleChild({
      pairedChildren: undefined,
      selectedChildId: null,
    })).toBe(false);
  });
});

describe("isSelectedChildIdStale — selectedChildId family 이탈 감지", () => {
  it("선택된 자녀가 pairedChildren에 없으면 stale → true", () => {
    expect(isSelectedChildIdStale({
      pairedChildren: [{ id: "c1" }, { id: "c2" }],
      selectedChildId: "c-removed",
    })).toBe(true);
  });
  it("선택된 자녀가 pairedChildren에 있으면 → false", () => {
    expect(isSelectedChildIdStale({
      pairedChildren: [{ id: "c1" }, { id: "c2" }],
      selectedChildId: "c1",
    })).toBe(false);
  });
  it("selectedChildId 자체가 null이면 stale 아님 → false", () => {
    expect(isSelectedChildIdStale({
      pairedChildren: [{ id: "c1" }],
      selectedChildId: null,
    })).toBe(false);
  });
  it("pairedChildren empty + selectedChildId 있으면 stale → true", () => {
    expect(isSelectedChildIdStale({
      pairedChildren: [],
      selectedChildId: "c1",
    })).toBe(true);
  });
  it("pairedChildren undefined → false (방어)", () => {
    expect(isSelectedChildIdStale({
      pairedChildren: undefined,
      selectedChildId: "c1",
    })).toBe(false);
  });
});

describe("shouldRedirectMultichildToHome — multichild guard", () => {
  it("multichild 부모 + 미선택 + non-home view → 강제 redirect", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: true,
      isMultiChild: true,
      selectedChildId: null,
      activeView: "calendar",
    })).toBe(true);
  });
  it("multichild 부모 + 미선택 + memo view → 강제 redirect", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: true,
      isMultiChild: true,
      selectedChildId: null,
      activeView: "memo",
    })).toBe(true);
  });
  it("multichild 부모 + 미선택 + 이미 home → redirect 불필요", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: true,
      isMultiChild: true,
      selectedChildId: null,
      activeView: "home",
    })).toBe(false);
  });
  it("multichild 부모 + 자녀 선택됨 → context 있으므로 redirect 불필요", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: true,
      isMultiChild: true,
      selectedChildId: "c1",
      activeView: "calendar",
    })).toBe(false);
  });
  it("단일 자녀 부모 → isMultiChild false → 항상 false (단일 자녀 보호)", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: true,
      isMultiChild: false,
      selectedChildId: null,
      activeView: "calendar",
    })).toBe(false);
  });
  it("자녀 모드 → 항상 false (자녀 화면에는 적용 안 됨)", () => {
    expect(shouldRedirectMultichildToHome({
      isParent: false,
      isMultiChild: true,
      selectedChildId: null,
      activeView: "calendar",
    })).toBe(false);
  });
});

describe("pickMemoTargetChildUserId — memo push routing", () => {
  it("부모 + selectedChild user_id 있음 → 그 user_id (정상 케이스)", () => {
    expect(pickMemoTargetChildUserId({
      isParent: true,
      selectedChildUserId: "user-혜니",
      pairedChildren: [{ user_id: "user-혜니" }, { user_id: "user-아이" }],
      authUserId: "user-부모",
    })).toBe("user-혜니");
  });
  it("부모 + selectedChild 없음 + 단일 자녀 → fallback pairedChildren[0].user_id", () => {
    expect(pickMemoTargetChildUserId({
      isParent: true,
      selectedChildUserId: null,
      pairedChildren: [{ user_id: "user-혜니" }],
      authUserId: "user-부모",
    })).toBe("user-혜니");
  });
  it("부모 + selectedChild 없음 + multichild → fallback 첫 자녀 (timing window 보호)", () => {
    expect(pickMemoTargetChildUserId({
      isParent: true,
      selectedChildUserId: null,
      pairedChildren: [{ user_id: "user-혜니" }, { user_id: "user-아이" }],
      authUserId: "user-부모",
    })).toBe("user-혜니");
  });
  it("부모 + 모두 없음 → null (server는 routing 적용 안 하고 family 전체 fallback)", () => {
    expect(pickMemoTargetChildUserId({
      isParent: true,
      selectedChildUserId: null,
      pairedChildren: [],
      authUserId: "user-부모",
    })).toBeNull();
  });
  it("자녀 모드 → 본인 authUserId (다른 자녀 device 제외용)", () => {
    expect(pickMemoTargetChildUserId({
      isParent: false,
      selectedChildUserId: null,
      pairedChildren: [{ user_id: "user-혜니" }, { user_id: "user-아이" }],
      authUserId: "user-혜니",
    })).toBe("user-혜니");
  });
  it("자녀 모드 + authUserId 없음 → null (extreme edge)", () => {
    expect(pickMemoTargetChildUserId({
      isParent: false,
      selectedChildUserId: null,
      pairedChildren: [],
      authUserId: null,
    })).toBeNull();
  });
  it("부모 + pairedChildren[0]에 user_id 누락 → null fallback", () => {
    expect(pickMemoTargetChildUserId({
      isParent: true,
      selectedChildUserId: null,
      pairedChildren: [{ id: "c1" /* user_id missing */ }],
      authUserId: "user-부모",
    })).toBeNull();
  });
});
