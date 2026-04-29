// tests/unit/ChildDetailsStep.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildDetailsStep } from "../../src/components/multichild/PairingWizard/ChildDetailsStep.jsx";

const baseChild = { name: "", birthdate: "", color_hex: "#F779A8", photo_url: null };

describe("ChildDetailsStep", () => {
  it("이름 input 과 생년월일 picker 표시", () => {
    render(<ChildDetailsStep child={baseChild} index={0} onChange={() => {}} usedColors={[]} familyId="f1" />);
    expect(screen.getByLabelText(/이름/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /생년월일 선택/ })).toBeInTheDocument();
  });

  it("이름 입력 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseChild, name: "혜니" });
  });

  it("기존 생년월일 값을 picker 버튼이 한국어로 표시", () => {
    render(<ChildDetailsStep child={{ ...baseChild, birthdate: "2015-03-21" }} index={0} onChange={() => {}} usedColors={[]} familyId="f1" />);
    expect(screen.getByRole("button", { name: /2015년 3월 21일/ })).toBeInTheDocument();
  });

  it("picker 확인 시 YYYY-MM-DD 형식으로 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.click(screen.getByRole("button", { name: /생년월일 선택/ }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg.birthdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
