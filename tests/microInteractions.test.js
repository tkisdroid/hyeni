import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appCss = readFileSync("src/App.css", "utf8");
const subscriptionManagementSource = readFileSync("src/components/settings/SubscriptionManagement.jsx", "utf8");
const childSettingsScreenSource = readFileSync("src/components/childMode/ChildSettingsScreen.jsx", "utf8");
const childPermissionWizardSource = readFileSync("src/components/onboarding/ChildPermissionWizard.jsx", "utf8");

describe("micro interaction system", () => {
  test("core app surfaces share the same motion tokens and reduced-motion guard", () => {
    expect(appCss).toContain("--hyeni-motion-base");
    expect(appCss).toContain("--hyeni-ease-pop");
    expect(appCss).toContain("@keyframes hyeni-micro-enter");
    expect(appCss).toContain("@keyframes hyeni-micro-pop");
    expect(appCss).toContain(".hyeni-micro-tap");
    expect(appCss).toContain(".hyeni-micro-icon");
    expect(appCss).toContain(".hyeni-app-shell .perm-step:has(button:hover)");
    expect(appCss).toContain(".hyeni-app-shell .hyeni-child-settings-row");
    expect(appCss).toContain(".hyeni-app-shell .hyeni-subscription-child-slot");
    expect(appCss).toContain("prefers-reduced-motion: reduce");
  });

  test("extracted settings and subscription surfaces opt into the shared motion classes", () => {
    expect(subscriptionManagementSource).toContain("hyeni-subscription-child-slot hyeni-micro-tap");
    expect(subscriptionManagementSource).toContain("hyeni-micro-icon");
    expect(childSettingsScreenSource).toContain("hyeni-child-settings-row");
    expect(childPermissionWizardSource).toContain("hyeni-app-shell child-permission-wizard");
    expect(childPermissionWizardSource).toContain("perm-step hyeni-micro-tap");
    expect(childPermissionWizardSource).toContain("btn btn-primary hyeni-micro-tap");
  });
});
