import { describe, it, expect } from "vitest";
import { formatDeviceDuration } from "../../src/lib/deviceFormat.js";

describe("formatDeviceDuration", () => {
  it("returns '0분' for zero, negative, NaN, and undefined", () => {
    expect(formatDeviceDuration(0)).toBe("0분");
    expect(formatDeviceDuration(-1)).toBe("0분");
    expect(formatDeviceDuration(NaN)).toBe("0분");
    expect(formatDeviceDuration(undefined)).toBe("0분");
  });

  it("rounds sub-minute durations up to '1분' so an active session is never reported as 0", () => {
    expect(formatDeviceDuration(1)).toBe("1분");
    expect(formatDeviceDuration(30_000)).toBe("1분");
  });

  it("renders minutes only when under one hour", () => {
    expect(formatDeviceDuration(60_000)).toBe("1분");
    expect(formatDeviceDuration(45 * 60_000)).toBe("45분");
    expect(formatDeviceDuration(59 * 60_000 + 59_000)).toBe("59분");
  });

  it("renders hours only on exact-hour durations", () => {
    expect(formatDeviceDuration(60 * 60_000)).toBe("1시간");
    expect(formatDeviceDuration(2 * 60 * 60_000)).toBe("2시간");
  });

  it("renders hours + minutes when both are non-zero", () => {
    expect(formatDeviceDuration(61 * 60_000)).toBe("1시간 1분");
    expect(formatDeviceDuration(150 * 60_000)).toBe("2시간 30분");
    expect(formatDeviceDuration(5 * 60 * 60_000 + 17 * 60_000)).toBe("5시간 17분");
  });
});
