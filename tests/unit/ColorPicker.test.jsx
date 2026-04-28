// tests/unit/ColorPicker.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "../../src/components/multichild/PairingWizard/ColorPicker.jsx";

describe("ColorPicker", () => {
  it("6개 색 버튼 렌더", () => {
    render(<ColorPicker selected="#F779A8" usedColors={[]} onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("이미 사용된 색은 aria-disabled=true", () => {
    render(<ColorPicker selected="#F779A8" usedColors={["#3B82F6"]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /파랑/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("색 클릭 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ColorPicker selected="#F779A8" usedColors={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /초록/ }));
    expect(onChange).toHaveBeenCalledWith("#10B981");
  });

  it("사용된 색 클릭 시 onChange 호출되지 않음", () => {
    const onChange = vi.fn();
    render(<ColorPicker selected="#F779A8" usedColors={["#3B82F6"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /파랑/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
