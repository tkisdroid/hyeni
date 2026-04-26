import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const icon = readFileSync("android/app/src/main/res/drawable/ic_hyeni_notification.xml", "utf8");
const notificationHelper = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/NotificationHelper.java",
  "utf8",
);

describe("Android notification icon", () => {
  test("uses one simple heart path for status bar notifications", () => {
    expect(icon.match(/<path\b/g) || []).toHaveLength(1);
    expect(icon).toContain('android:pathData="M12,21');
  });

  test("general and emergency notifications share the app notification icon", () => {
    expect(notificationHelper).toContain(".setSmallIcon(R.drawable.ic_hyeni_notification)");
    expect(notificationHelper).toContain("CHANNEL_SCHEDULE");
    expect(notificationHelper).toContain("CHANNEL_EMERGENCY");
  });
});
