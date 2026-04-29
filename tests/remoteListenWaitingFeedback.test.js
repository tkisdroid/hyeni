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
    expect(app).toContain("연결까지 시간이 오래 걸리고 있어요");
    expect(app).toContain("아이 기기 응답 대기 중");
    expect(app).toContain("clearRemoteAudioWaitingHint");
  });
});
