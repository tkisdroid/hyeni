import { expect, test } from "@playwright/test";
import {
  installForceRingParentMocks,
  dismissEmergencyBannerIfPresent,
  holdLongPressTrigger,
} from "./_force-ring-fixtures.js";

test("force_ring trigger: long-press → modal → send → delivered status", async ({ page }) => {
  const calls = await installForceRingParentMocks(page, {
    quotaResponse: { allowed: true, quota: 1, used: 0, tier: "free" },
    pushNotifyResponse: {
      event_id: "evt-test-1",
      delivered: true,
      quota_remaining: 0,
    },
  });

  await page.goto("/");
  await dismissEmergencyBannerIfPresent(page);

  await expect(page.getByRole("heading", { name: /응급 강제 알람/ })).toBeVisible({
    timeout: 15_000,
  });

  await holdLongPressTrigger(page);

  await expect(page.getByText("정말 응급 신호를 보낼까요?")).toBeVisible();
  await page.fill("textarea", "도와줘");
  await page.getByRole("button", { name: "응급 신호 보내기" }).click();

  await expect(page.getByText(/전달됨/)).toBeVisible();

  expect(calls.pushNotify.length).toBeGreaterThanOrEqual(1);
  const last = calls.pushNotify[calls.pushNotify.length - 1];
  expect(last.action).toBe("force_ring");
  expect(last.message).toBe("도와줘");
});
