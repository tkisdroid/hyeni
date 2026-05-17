// tests/unit/ChildDeviceCard.test.jsx
// 화면 시간 표시 — 기기 전체(device) vs 앱 사용(app) 폴백 라벨 (Phase 3).
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChildDeviceCard } from "../../src/components/contact/ChildDeviceCard.jsx";

afterEach(() => {
    cleanup();
});

const child = { name: "혜니", color_hex: "#F779A8" };

describe("ChildDeviceCard — 화면 시간 라벨", () => {
    it("usage-stats 소스면 '화면 시간' 라벨(접미사 없음)", () => {
        render(
            <ChildDeviceCard
                child={child}
                status={{ deviceScreenOnMs: 7_200_000, deviceScreenOnSource: "usage-stats", screenOnMs: 60_000 }}
            />,
        );
        expect(screen.getByText("화면 시간")).toBeInTheDocument();
        expect(screen.queryByText("화면 시간 (앱 사용)")).toBeNull();
    });

    it("기기 측정 불가 시 '화면 시간 (앱 사용)' 폴백 라벨", () => {
        render(
            <ChildDeviceCard
                child={child}
                status={{ deviceScreenOnSource: "unavailable_permission", screenOnMs: 600_000 }}
            />,
        );
        expect(screen.getByText("화면 시간 (앱 사용)")).toBeInTheDocument();
    });
});
