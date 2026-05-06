// tests/unit/PerChildToggle.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PerChildToggle } from "../../src/components/multichild/SubscriptionScreen/PerChildToggle.jsx";

const child = { user_id: "c1", name: "혜니", birthdate: "2015-03-21", color_hex: "#F779A8", photo_url: null };

describe("PerChildToggle", () => {
  it("이름, 출생연도, 가격 표시", () => {
    render(<PerChildToggle child={child} subscribed={false} onToggle={() => {}} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText(/2015년생/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "혜니 프로필" })).toHaveAttribute("data-avatar-state", "fallback");
  });

  it("subscribed=true → toggle ON, ₩1,500/월 표시", () => {
    render(<PerChildToggle child={child} subscribed={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByText("₩1,500/월")).toBeInTheDocument();
  });

  it("subscribed=false → '무료' 라벨", () => {
    render(<PerChildToggle child={child} subscribed={false} onToggle={() => {}} />);
    expect(screen.getByText("무료")).toBeInTheDocument();
  });

  it("toggle 클릭 시 onToggle(반대값)", () => {
    const onToggle = vi.fn();
    render(<PerChildToggle child={child} subscribed={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
