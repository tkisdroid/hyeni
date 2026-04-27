import { expect, test } from "@playwright/test";
import {
  installForceRingParentMocks,
  dismissEmergencyBannerIfPresent,
  holdLongPressTrigger,
} from "./_force-ring-fixtures.js";

test("force_ring delivery failure shows fallback (tel: + 119)", async ({ page }) => {
  await installForceRingParentMocks(page, {
    quotaResponse: { allowed: true, quota: 1, used: 0, tier: "free" },
    pushNotifyResponse: {
      event_id: "evt-fail",
      delivered: false,
      error: "no_fcm_tokens",
    },
  });

  await page.goto("/");
  await dismissEmergencyBannerIfPresent(page);

  await expect(page.getByRole("heading", { name: /응급 강제 알람/ })).toBeVisible({
    timeout: 15_000,
  });

  await holdLongPressTrigger(page);
  await expect(page.getByText("정말 응급 신호를 보낼까요?")).toBeVisible();
  await page.fill("textarea", "어디 있어");
  await page.getByRole("button", { name: "응급 신호 보내기" }).click();

  await expect(page.getByText(/전달 실패/)).toBeVisible();
  await expect(page.getByText(/119/)).toBeVisible();
});
