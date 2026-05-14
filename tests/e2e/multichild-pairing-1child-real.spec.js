import { test, expect } from "@playwright/test";
import { seedLegacyFamily, loginAsExistingParent, srFetch } from "./_helpers.js";

test.describe("multichild — 1-child mode UI (seeded family)", () => {
  // Email-auth signup cannot pass the families.insert RLS policy
  // (only Kakao sessions are permitted — see family-journey-real.spec.js:124).
  // We seed a 1-child family via service role then login as the parent.
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("자녀 1명 가족 → 홈 탭 hidden, 자녀 이름 표시", async ({ page }) => {
    const { parent_email, parent_password } = await seedLegacyFamily();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    // 1자녀 모드: 홈 탭 hidden
    await expect(page.locator("button:has-text('홈')")).not.toBeVisible();
    await expect(page.locator("text=혜니")).toBeVisible();
  });

  test("아이 앱 페어링 → 기존 1자녀 placeholder에 user_id 채움 + 부모 화면에 단일 자녀 유지", async ({ page }) => {
    const { parent_email, parent_password, child_id, family_id, pair_code } = await seedLegacyFamily();
    const pairSuffix = pair_code.replace(/^KID-/, "");

    const beforeRows = await srFetch(`/rest/v1/family_members?id=eq.${child_id}&select=id,user_id,role,name,child_order`);
    expect(beforeRows).toHaveLength(1);
    expect(beforeRows[0].user_id).toBeNull();
    expect(beforeRows[0].name).toBe("혜니");

    await page.goto("/");
    await page.getByRole("button", { name: "자녀로 시작" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("페어링 코드 8자리")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("페어링 코드 8자리").fill(pairSuffix);
    await page.getByRole("button", { name: "연결하기", exact: true }).click();

    await expect(page.getByText("연결됐어요!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: "아이 홈 요약" })).toBeVisible({ timeout: 20_000 });

    const childSession = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
          try {
            return JSON.parse(localStorage.getItem(key));
          } catch {
            return null;
          }
        }
      }
      return null;
    });
    expect(childSession?.user?.id).toBeTruthy();
    expect(childSession?.user?.is_anonymous).toBe(true);

    await expect.poll(async () => {
      const rows = await srFetch(`/rest/v1/family_members?family_id=eq.${family_id}&role=eq.child&select=id,user_id,role,name,child_order&order=child_order.asc`);
      return rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
      }));
    }, { timeout: 15_000 }).toEqual([
      {
        id: child_id,
        user_id: childSession.user.id,
        name: "혜니",
      },
    ]);

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await expect(page.locator("button:has-text('홈')")).not.toBeVisible();
    await expect(page.locator("text=혜니")).toBeVisible();

    const childRows = await srFetch(`/rest/v1/family_members?family_id=eq.${family_id}&role=eq.child&select=id,user_id,name`);
    expect(childRows).toHaveLength(1);
    expect(childRows[0].id).toBe(child_id);
    expect(childRows[0].user_id).toBe(childSession.user.id);
  });
});
