import { expect, test } from "@playwright/test";

test("real kakao oauth redirects out of the app", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /학부모/ }).click();
  await page.getByRole("button", { name: /카카오로 (시작|로그인)/ }).click();

  await expect(page).toHaveURL(/kakao\.com|supabase\.co\/auth\/v1\/authorize/i, {
    timeout: 20_000,
  });

  const unsupportedProvider = await page
    .getByText(/Unsupported provider|provider is not enabled/i)
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);
  test.skip(unsupportedProvider, "Kakao provider is disabled on this Supabase preview branch");

  await expect(
    page.getByText(/Log In|Kakao Account|kakao/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});
