// tests/unit/MiniMap.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MiniMap } from "../../src/components/multichild/HomeDashboard/MiniMap.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];
const positions = [
  { user_id: "c1", lat: 37.5, lng: 127.0 },
  { user_id: "c2", lat: 37.6, lng: 127.1 },
];

describe("MiniMap", () => {
  it("자녀 N명의 핀 렌더링", () => {
    const { container } = render(<MiniMap children={children} positions={positions} onTap={() => {}} />);
    expect(container.querySelectorAll("[data-pin]")).toHaveLength(2);
  });

  it("핀 색은 자녀 color_hex 와 일치", () => {
    const { container } = render(<MiniMap children={children} positions={positions} onTap={() => {}} />);
    const pins = container.querySelectorAll("[data-pin]");
    expect(pins[0].style.background).toContain("rgb(247, 121, 168)");
    expect(pins[1].style.background).toContain("rgb(59, 130, 246)");
  });

  it("탭 시 onTap 호출", () => {
    const onTap = vi.fn();
    render(<MiniMap children={children} positions={positions} onTap={onTap} />);
    fireEvent.click(screen.getByRole("button", { name: /지도/i }));
    expect(onTap).toHaveBeenCalled();
  });
});
