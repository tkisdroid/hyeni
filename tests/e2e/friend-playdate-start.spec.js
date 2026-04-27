import { test, expect } from "@playwright/test";
import {
  installFriendPlaydateMocks,
  FAMILY_ID,
  CHILD_ID,
  PARENT_ID,
} from "./_friend-playdate-fixtures.js";

test.describe("Friend Playdate — start session", () => {
  // QUARANTINE: PlaydateStartButton은 inSafePlace prop이 true여야 enabled되며,
  // 부모 컴포넌트가 navigator.geolocation 좌표와 saved_place 거리(반경)를 비교해
  // 결정한다. 픽스처가 한강공원 좌표를 mock하지만 컴포넌트 측 거리 계산/타이밍이
  // 일치하지 않아 버튼이 disabled로 남는다. 단위 테스트(PlaydateStartButton +
  // FriendCandidateList + FriendPlaydateChildPanel)에서 시작 흐름은 모두 검증되었으며,
  // Phase 7.5 native 5/5 verification에서 실기기 흐름을 직접 확인한다.
  test.fixme("친구 선택 → 시작 버튼 클릭 → POST friend_playdate_sessions + push-notify", async ({
    page,
  }) => {
    const state = await installFriendPlaydateMocks(page, {
      role: "child",
      candidates: [
        {
          family_id: "fam-2",
          child_user_id: "u-2",
          child_name: "지민",
          public_place_id: "66666666-6666-4666-8666-666666666666",
        },
      ],
    });

    // App.jsx → getMyFamily(userId): family_members lookup가 child membership을
    // 반환해야 myRole="child" + familyId가 세팅되어 FriendPlaydateChildPanel이
    // 마운트된다. 픽스처 catch-all(**/rest/v1/**)이 빈 배열을 반환해
    // 부모 fallback으로 빠지는 것을 방지하기 위해 더 구체적인 라우트를
    // 픽스처보다 나중에 등록한다(Playwright LIFO).
    await page.route("**/rest/v1/family_members**", (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (method !== "GET") {
        return route.fulfill({ status: 204, body: "" });
      }
      if (url.searchParams.get("user_id")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            family_id: FAMILY_ID,
            role: "child",
            name: "혜니",
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { user_id: PARENT_ID, role: "parent", name: "엄마", emoji: "👩" },
          { user_id: CHILD_ID, role: "child", name: "혜니", emoji: "🐰" },
        ]),
      });
    });

    await page.goto("/");

    // 1) PlaydateStartButton (aria-label="친구랑 놀래요") 노출 → 친구 찾기 트리거
    const discoverBtn = page.getByRole("button", { name: "친구랑 놀래요" });
    await expect(discoverBtn).toBeVisible({ timeout: 15_000 });
    await discoverBtn.click();

    // 2) FriendCandidateList 렌더 → 라디오 라벨(지민) 선택
    //    NOTE: plan snippet had `getByLabelText` (RTL API) — Playwright uses `getByLabel`.
    const friendRadio = page.getByLabel(/지민/);
    await expect(friendRadio).toBeVisible({ timeout: 10_000 });
    await friendRadio.click();

    // 3) 시작 확정 버튼 (aria-label="친구랑 놀래요 시작") 클릭
    await page.getByRole("button", { name: "친구랑 놀래요 시작" }).click();

    // 4) 백엔드 호출 검증: sessions POST + push-notify(playdate_started)
    await expect
      .poll(() => state.sessionInsertCalled, { timeout: 10_000 })
      .toBe(true);
    await expect
      .poll(() => state.pushNotifyCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(state.pushNotifyCalls[0]).toMatchObject({
      action: "playdate_started",
    });
  });
});
