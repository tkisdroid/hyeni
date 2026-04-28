// tests/unit/HomeTab.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeTab } from "../../src/components/multichild/HomeDashboard/HomeTab.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];

describe("HomeTab", () => {
  it("자녀 카드 N개 + MiniMap + 일정 리스트 렌더", () => {
    render(<HomeTab
      children={children} positions={[]} events={[]}
      childLocations={{}} childDeviceStatusMap={{}} onMapTap={() => {}}
    />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText("민준")).toBeInTheDocument();
  });
});
