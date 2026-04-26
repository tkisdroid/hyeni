import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/App.jsx", "utf8");

describe("remote listen waiting feedback", () => {
  it("shows an actionable parent hint when the child device cannot auto-open remote listen", () => {
    expect(app).toContain("REMOTE_AUDIO_WAITING_HELP_MS");
    expect(app).toContain("remoteAudioWaitingHintTimerRef");
    expect(app).toContain("auto_waking_child");
    expect(app).toContain("waiting_for_child_notification");
    expect(app).toContain("failed");
    expect(app).toContain("아이 기기 설정 또는 OS 제한으로 자동 연결이 막혔어요");
    expect(app).toContain("OS가 자동 실행을 막아 알림 대기 중");
    expect(app).toContain("clearRemoteAudioWaitingHint");
  });
});
