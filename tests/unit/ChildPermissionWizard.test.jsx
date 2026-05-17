// tests/unit/ChildPermissionWizard.test.jsx
// 선택(optional) 권한 항목이 완료 게이트를 막지 않는지 검증 (Phase 2).
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChildPermissionWizard } from "../../src/components/onboarding/ChildPermissionWizard.jsx";

afterEach(() => {
    cleanup();
});

const requiredStep = (id, ready) => ({
    id, ready, title: `필수 ${id}`, description: "설명", actionLabel: "허용",
});
const optionalStep = (ready) => ({
    id: "screenTime", ready, optional: true,
    title: "화면 시간 측정", description: "선택 항목", actionLabel: "권한 열기",
});

describe("ChildPermissionWizard — 선택 권한 게이트", () => {
    it("필수 항목이 모두 ready 면 선택 항목이 미완료여도 '시작하기'를 보여준다", () => {
        render(
            <ChildPermissionWizard
                steps={[requiredStep("a", true), requiredStep("b", true), optionalStep(false)]}
                onAction={() => {}}
                onAllowAll={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByText("시작하기")).toBeInTheDocument();
        expect(screen.queryByText("나중에 할래")).toBeNull();
    });

    it("필수 항목이 미완료면 '나중에 할래'를 보여준다", () => {
        render(
            <ChildPermissionWizard
                steps={[requiredStep("a", true), requiredStep("b", false), optionalStep(true)]}
                onAction={() => {}}
                onAllowAll={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByText("나중에 할래")).toBeInTheDocument();
    });

    it("진행률은 필수 항목만 센다 (2/2 완료 = 선택 미완료여도 100%)", () => {
        render(
            <ChildPermissionWizard
                steps={[requiredStep("a", true), requiredStep("b", true), optionalStep(false)]}
                onAction={() => {}}
                onAllowAll={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByText("2 / 2 완료")).toBeInTheDocument();
    });

    it("선택 항목은 목록에 '선택' 배지와 함께 표시된다", () => {
        render(
            <ChildPermissionWizard
                steps={[requiredStep("a", true), optionalStep(false)]}
                onAction={() => {}}
                onAllowAll={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(screen.getByText("화면 시간 측정")).toBeInTheDocument();
        expect(screen.getByText("선택")).toBeInTheDocument();
    });
});
