import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsExistingParent, seedFamilyWith2Children, srFetch, SUPABASE_TEST_URL } from "./_helpers.js";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test.describe("profile images with real Supabase Storage", () => {
  test.skip(
    !SUPABASE_TEST_URL || !SERVICE_ROLE_KEY,
    "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required",
  );

  test("private child photo paths load through signed URLs and missing objects fall back", async ({ page }) => {
    const seed = await seedFamilyWith2Children();
    const storage = createClient(SUPABASE_TEST_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).storage.from("child-photos");
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const validPath = `${seed.family_id}/e2e-profile-${suffix}.png`;
    const missingPath = `${seed.family_id}/missing-profile-${suffix}.png`;

    const { error: uploadError } = await storage.upload(validPath, ONE_PIXEL_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    expect(uploadError, uploadError?.message || "storage upload failed").toBeFalsy();

    try {
      await srFetch(`/rest/v1/family_members?id=eq.${seed.child1_id}`, {
        method: "PATCH",
        body: JSON.stringify({ photo_url: validPath }),
      });
      await srFetch(`/rest/v1/family_members?id=eq.${seed.child2_id}`, {
        method: "PATCH",
        body: JSON.stringify({ photo_url: missingPath }),
      });

      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await loginAsExistingParent(page, seed.parent_email, seed.parent_password);
      await page.goto("/");
      await expect(page.getByRole("group", { name: "자녀 빠른 전환" })).toBeVisible({ timeout: 15000 });

      const quickSwitch = page.getByRole("group", { name: "자녀 빠른 전환" });
      const loadedCard = quickSwitch.getByRole("button", { name: "혜니", exact: true }).first();
      const loadedAvatar = loadedCard.locator("[data-child-avatar]").first();
      await expect(loadedAvatar).toHaveAttribute("data-avatar-state", "loaded", { timeout: 15000 });
      await expect(loadedCard.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/child-photos\//);

      const fallbackCard = quickSwitch.getByRole("button", { name: "민준", exact: true }).first();
      const fallbackAvatar = fallbackCard.locator("[data-child-avatar]").first();
      await expect(fallbackAvatar).toHaveAttribute("data-avatar-state", "fallback", { timeout: 15000 });
      await expect(fallbackCard.locator("img")).toHaveCount(0);

      expect(pageErrors).toEqual([]);
    } finally {
      await storage.remove([validPath]).catch(() => {});
    }
  });
});
