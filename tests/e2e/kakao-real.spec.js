import { expect, test } from "@playwright/test";

test("real kakao oauth redirects out of the app", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /학부모/ }).click();

  await expect(page).toHaveURL(/kakao\.com|supabase\.co\/auth\/v1\/authorize/i, {
    timeout: 20_000,
  });

  await expect(
    page.getByText(/Log In|Kakao Account|kakao/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});
