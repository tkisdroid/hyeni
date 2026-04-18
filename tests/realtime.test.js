import { describe, expect, it, vi } from "vitest";
import { sendBroadcastWhenReady, waitForChannelReady } from "../src/lib/realtime.js";

describe("realtime helpers", () => {
  it("waits until the realtime channel joins", async () => {
    const channel = { state: "closed" };

    setTimeout(() => {
      channel.state = "joined";
    }, 30);

    await expect(
      waitForChannelReady(channel, { timeoutMs: 200, pollMs: 10 }),
    ).resolves.toBe(true);
  });

  it("sends the broadcast after the channel becomes ready", async () => {
    const channel = {
      state: "closed",
      send: vi.fn().mockResolvedValue({ status: "ok" }),
    };

    setTimeout(() => {
      channel.state = "joined";
    }, 30);

    await expect(
      sendBroadcastWhenReady(
        channel,
        "kkuk",
        { senderId: "parent-1" },
        { timeoutMs: 200, pollMs: 10 },
      ),
    ).resolves.toBe(true);

    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "kkuk",
      payload: { senderId: "parent-1" },
    });
  });

  it("returns false if the channel never joins", async () => {
    const channel = {
      state: "closed",
      send: vi.fn(),
    };

    await expect(
      sendBroadcastWhenReady(channel, "kkuk", {}, { timeoutMs: 40, pollMs: 10 }),
    ).resolves.toBe(false);

    expect(channel.send).not.toHaveBeenCalled();
  });
});
