// tests/unit/ChildCountStep.test.jsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChildCountStep } from "../../src/components/multichild/PairingWizard/ChildCountStep.jsx";

afterEach(cleanup);

describe("ChildCountStep", () => {
  it("1~5 옵션 5개 버튼 렌더", () => {
    render(<ChildCountStep value={1} onChange={() => {}} onNext={() => {}} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole("button", { name: `${i}명` })).toBeInTheDocument();
    }
  });

  it("선택된 개수 aria-pressed=true", () => {
    render(<ChildCountStep value={3} onChange={() => {}} onNext={() => {}} />);
    expect(screen.getByRole("button", { name: "3명" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1명" })).toHaveAttribute("aria-pressed", "false");
  });

  it("개수 클릭 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildCountStep value={null} onChange={onChange} onNext={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "2명" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("선택 안 했으면 다음 버튼 disabled", () => {
    render(<ChildCountStep value={null} onChange={() => {}} onNext={() => {}} />);
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });
});
