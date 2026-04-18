import { expect, test } from "@playwright/test";

test("real kakao maps sdk loads on app boot", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      errorText: request.failure()?.errorText || "unknown",
    });
  });

  await page.goto("/");
  await page.waitForTimeout(8_000);

  const state = await page.evaluate(() => {
    const script = Array.from(document.scripts).find((entry) =>
      entry.src.includes("dapi.kakao.com/v2/maps/sdk.js"),
    );
    return {
      hasKakao: Boolean(window.kakao?.maps?.LatLng && window.kakao?.maps?.load),
      scriptUrl: script?.src || "",
    };
  });

  expect(
    state.hasKakao,
    `Kakao Maps SDK was not ready. scriptUrl=${state.scriptUrl} failedRequests=${JSON.stringify(failedRequests)} consoleErrors=${JSON.stringify(consoleErrors)} pageErrors=${JSON.stringify(pageErrors)}`,
  ).toBe(true);
  expect(state.scriptUrl).toContain("dapi.kakao.com/v2/maps/sdk.js");
  expect(state.scriptUrl).toContain("autoload=false");
  expect(state.scriptUrl).toContain("libraries=services");
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) => !message.includes("favicon")),
  ).toEqual([]);
});
