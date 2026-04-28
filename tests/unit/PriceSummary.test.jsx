// tests/unit/PriceSummary.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSummary } from "../../src/components/multichild/SubscriptionScreen/PriceSummary.jsx";

describe("PriceSummary", () => {
  it("0원이면 '구독 없음' 표시", () => {
    render(<PriceSummary totalKrw={0} subscribedCount={0} />);
    expect(screen.getByText(/구독 없음/)).toBeInTheDocument();
  });

  it("₩3,000 / 자녀 2명 표시", () => {
    render(<PriceSummary totalKrw={3000} subscribedCount={2} />);
    expect(screen.getByText("₩3,000/월")).toBeInTheDocument();
    expect(screen.getByText(/자녀 2명/)).toBeInTheDocument();
  });

  it("천 단위 콤마", () => {
    render(<PriceSummary totalKrw={7500} subscribedCount={5} />);
    expect(screen.getByText("₩7,500/월")).toBeInTheDocument();
  });
});
