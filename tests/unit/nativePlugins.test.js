import { beforeEach, describe, expect, it, vi } from "vitest";

const registerPlugin = vi.fn((name) => new Proxy({ name }, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return vi.fn();
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
  registerPlugin,
}));

describe("native plugin cache", () => {
  beforeEach(async () => {
    registerPlugin.mockClear();
    const { clearNativePluginCacheForTests } = await import("../../src/lib/nativePlugins.js");
    clearNativePluginCacheForTests();
  });

  it("returns cached Capacitor plugin proxies without Promise thenable assimilation", async () => {
    const { getNativePlugin } = await import("../../src/lib/nativePlugins.js");

    const plugin = await getNativePlugin("BackgroundLocation");
    const cached = await getNativePlugin("BackgroundLocation");

    expect(plugin).toBe(cached);
    expect(plugin.name).toBe("BackgroundLocation");
    expect(plugin.then).toBeUndefined();
    expect(typeof plugin.checkStatus).toBe("function");
    expect(registerPlugin).toHaveBeenCalledTimes(1);
  });
});
