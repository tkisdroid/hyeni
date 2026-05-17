// tests/unit/AlertCenterPopup.test.jsx
// 부모 알림센터 팝업 — child_setting_request 타입 표시 (Phase 3).
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AlertCenterPopup } from "../../src/components/alerts/AlertCenterPopup.jsx";

afterEach(() => {
    cleanup();
});

const settingRequestAlert = {
    id: "alert-1",
    alert_type: "child_setting_request",
    title: "테마 변경 요청",
    message: "혜니님이 테마 색깔을 바꾸고 싶어 해요.",
    severity: "info",
    read: false,
    created_at: "2026-05-18T09:00:00.000Z",
};

describe("AlertCenterPopup", () => {
    it("open=false면 렌더하지 않는다", () => {
        const { container } = render(<AlertCenterPopup open={false} alerts={[settingRequestAlert]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("child_setting_request 알림을 '요청' 라벨로 표시한다", () => {
        render(<AlertCenterPopup open alerts={[settingRequestAlert]} />);
        // raw alert_type 문자열이 아니라 사람이 읽을 수 있는 라벨이어야 한다.
        expect(screen.getByText("요청")).toBeInTheDocument();
        expect(screen.queryByText("child_setting_request")).toBeNull();
        expect(screen.getByText("테마 변경 요청")).toBeInTheDocument();
    });
});
