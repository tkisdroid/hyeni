// tests/unit/ChildDetailsStep.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildDetailsStep } from "../../src/components/multichild/PairingWizard/ChildDetailsStep.jsx";

const baseChild = { name: "", birthdate: "", color_hex: "#F779A8", photo_url: null };

describe("ChildDetailsStep", () => {
  it("이름과 생년월일 input 표시", () => {
    render(<ChildDetailsStep child={baseChild} index={0} onChange={() => {}} usedColors={[]} familyId="f1" />);
    expect(screen.getByLabelText(/이름/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/생년월일/i)).toBeInTheDocument();
  });

  it("이름 입력 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseChild, name: "혜니" });
  });

  it("생년월일 YYYY-MM-DD 입력", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.change(screen.getByLabelText(/생년월일/i), { target: { value: "2015-03-21" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseChild, birthdate: "2015-03-21" });
  });
});
