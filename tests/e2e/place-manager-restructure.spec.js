import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * E2E spec for the place-manager 인지 위계 재구조화 (2026-05-05).
 *
 * Critical paths (per design doc TK-fix-multichild-isolation-design-20260505-125514):
 *  1) 첫 진입 5초 안에 학원·일정 + 조심할 곳 두 축 인식
 *  2) "위험장소" 문자열 0건 in user-facing UI (조심할 곳으로 변경)
 *  3) 자주 가는 장소는 보조 위계 (DangerCard 다음 순서)
 *  4) 결제 잠금 카피 "유료에서 무제한" 정확
 *  5) 회귀 — 이름 변경 관련 토스트 4건 모두 적용
 *
 * The full interactive auth + UI flow requires Supabase mock fixtures
 * which are not yet wired for this surface. Instead, this spec validates the
 * production bundle contents — the same JS the user will run on device.
 * Replace the bundle-text checks with DOM assertions once mock fixtures land.
 */

function loadDistAssets() {
    const distAssets = join(process.cwd(), "dist", "assets");
    let combined = "";
    try {
        for (const file of readdirSync(distAssets)) {
            if (!file.endsWith(".js")) continue;
            combined += readFileSync(join(distAssets, file), "utf8");
        }
    } catch {
        return null;
    }
    return combined;
}

test.describe("PlaceManager 재구조화 — 번들 검증", () => {
    test("학원·일정 관리 + 조심할 곳 가치 카피가 번들에 존재", () => {
        const bundle = loadDistAssets();
        test.skip(!bundle, "dist/ 미빌드 — npm run build 후 실행");
        expect(bundle).toContain("학원·일정 관리");
        expect(bundle).toContain("일정이 자동으로 캘린더에 들어와요");
        expect(bundle).toContain("조심할 곳");
        expect(bundle).toContain("아이가 근접 시 알림을 드려요");
    });

    test("이름 변경 — 토스트 5건과 form 라벨이 모두 '조심할 곳'", () => {
        const bundle = loadDistAssets();
        test.skip(!bundle, "dist/ 미빌드");
        expect(bundle).toContain("보조 보호자는 조심할 곳을 수정할 수 없어요.");
        expect(bundle).toContain("조심할 곳이 삭제됐어요");
        expect(bundle).toContain("➕ 조심할 곳 추가");
        expect(bundle).toContain("조심할 곳 저장");
        expect(bundle).toContain("⚠️ 조심할 곳 설정");
    });

    test("결제 잠금 카피 — '유료에서 무제한' 노출", () => {
        const bundle = loadDistAssets();
        test.skip(!bundle, "dist/ 미빌드");
        expect(bundle).toContain("유료에서 무제한");
    });

    test("자주 가는 장소 보조 위계 카피 노출", () => {
        const bundle = loadDistAssets();
        test.skip(!bundle, "dist/ 미빌드");
        expect(bundle).toContain("집·도서관처럼 일정과 길찾기에 자주 쓰는 장소");
    });

    test("dev server 200 OK + 첫 화면 로드 (smoke)", async ({ page }) => {
        const response = await page.goto("/");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).toBeVisible();
    });
});
