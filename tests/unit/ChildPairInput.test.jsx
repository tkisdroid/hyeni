import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChildPairInput } from "../../src/components/childMode/ChildPairInput.jsx";
import { joinFamily } from "../../src/lib/auth.js";
import { clearNativePluginCacheForTests } from "../../src/lib/nativePlugins.js";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  registerPlugin: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
  },
  registerPlugin: capacitorMocks.registerPlugin,
}));

vi.mock("../../src/lib/auth.js", () => ({
  joinFamily: vi.fn(),
}));

function mockMediaDevices(getUserMedia) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function mockBarcodeDetector(detect) {
  Object.defineProperty(window, "BarcodeDetector", {
    configurable: true,
    writable: true,
    value: class {
      async detect(target) {
        return detect(target);
      }
    },
  });
}

function mockMediaElement() {
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return this.__hyeniTestSrcObject || null;
    },
    set(value) {
      this.__hyeniTestSrcObject = value;
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
}

describe("ChildPairInput QR scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearNativePluginCacheForTests();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    mockMediaElement();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    joinFamily.mockResolvedValue({ family_id: "family-1" });
  });

  it("does not draw an overlapping placeholder over the custom code boxes", () => {
    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);

    expect(screen.getByLabelText("페어링 코드 8자리")).not.toHaveAttribute("placeholder");
    expect(screen.queryByPlaceholderText("XXXXXXXX")).not.toBeInTheDocument();
  });

  it("requests native camera permission before opening getUserMedia", async () => {
    const order = [];
    const cameraPlugin = {
      checkPermission: vi.fn(async () => {
        order.push("check");
        return { granted: false };
      }),
      requestPermission: vi.fn(async () => {
        order.push("request");
        return { granted: true };
      }),
      openAppSettings: vi.fn(),
    };
    const getUserMedia = vi.fn(async () => {
      order.push("camera");
      return { getTracks: () => [{ stop: vi.fn() }] };
    });
    capacitorMocks.registerPlugin.mockReturnValue(cameraPlugin);
    mockMediaDevices(getUserMedia);
    mockBarcodeDetector(async () => []);

    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /QR로 연결하기/ }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["check", "request", "camera"]);
    expect(cameraPlugin.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not open the camera when native camera permission is denied", async () => {
    const cameraPlugin = {
      checkPermission: vi.fn(async () => ({ granted: false })),
      requestPermission: vi.fn(async () => ({ granted: false })),
      openAppSettings: vi.fn(async () => ({ opened: true })),
    };
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
    capacitorMocks.registerPlugin.mockReturnValue(cameraPlugin);
    mockMediaDevices(getUserMedia);
    mockBarcodeDetector(async () => []);

    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /QR로 연결하기/ }));

    expect(await screen.findByText(/카메라 권한이 필요해요/)).toBeVisible();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "앱 설정 열기" }));
    await waitFor(() => expect(cameraPlugin.openAppSettings).toHaveBeenCalledTimes(1));
  });

  it("joins the family after scanning a valid QR pair code", async () => {
    let frameCallback;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback) => {
        frameCallback = callback;
        return 7;
      }),
    );
    const cameraPlugin = {
      checkPermission: vi.fn(async () => ({ granted: true })),
      requestPermission: vi.fn(),
      openAppSettings: vi.fn(),
    };
    const onPaired = vi.fn(async () => {});
    capacitorMocks.registerPlugin.mockReturnValue(cameraPlugin);
    mockMediaDevices(vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })));
    mockBarcodeDetector(async () => [{ rawValue: "https://hyenicalendar.com/join?pairCode=804DF582" }]);

    render(<ChildPairInput userId="child-user" onPaired={onPaired} />);
    fireEvent.click(screen.getByRole("button", { name: /QR로 연결하기/ }));

    await waitFor(() => expect(frameCallback).toBeTypeOf("function"));
    await frameCallback();

    await waitFor(() => expect(joinFamily).toHaveBeenCalledWith("KID-804DF582", "child-user", "아이"));
    expect(onPaired).toHaveBeenCalledTimes(1);
    expect(screen.getByText("연결됐어요!")).toBeVisible();
  });
});

describe("ChildPairInput — 입력 완료 버튼", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("코드가 비어 있으면 입력 완료 버튼이 비활성이고 진행 카운터를 보여준다", () => {
    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "입력 완료" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("0/8");
  });

  it("미완성(<8자리)이면 입력한 자릿수를 카운터로 표시한다", () => {
    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("페어링 코드 8자리"), { target: { value: "ABC" } });
    const btn = screen.getByRole("button", { name: "입력 완료" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("3/8");
  });

  it("8자리를 모두 입력하면 버튼이 활성화되고 라벨이 '입력 완료'로 바뀐다", () => {
    render(<ChildPairInput userId="child-user" onPaired={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("페어링 코드 8자리"), { target: { value: "ABCD1234" } });
    const btn = screen.getByRole("button", { name: "입력 완료" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent("입력 완료");
  });
});
