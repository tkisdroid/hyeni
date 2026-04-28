import { expect, test } from "@playwright/test";
import {
  installForceRingParentMocks,
  dismissEmergencyBannerIfPresent,
  openForceRingPage,
} from "./_force-ring-fixtures.js";

test("force_ring quota exceeded: panel reflects 0 remaining", async ({ page }) => {
  await installForceRingParentMocks(page, {
    quotaResponse: { allowed: false, quota: 1, used: 1, tier: "free" },
    pushNotifyResponse: {
      error: "force_ring_quota_exceeded",
      quota: 1,
      used: 1,
      tier: "free",
    },
    pushNotifyStatus: 429,
  });

  await page.goto("/");
  await dismissEmergencyBannerIfPresent(page);
  await openForceRingPage(page);
  await expect(page.getByText(/오늘 남은 횟수: 0 \/ 1/)).toBeVisible();

  const trigger = page.getByRole("button", { name: /5초 누르고 있기/ });
  await expect(trigger).toBeDisabled();
});
