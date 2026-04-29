// tests/unit/PairingWizard.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PairingWizard } from "../../src/components/multichild/PairingWizard/PairingWizard.jsx";

vi.mock("../../src/lib/auth.js", () => ({
  setupFamily: vi.fn().mockResolvedValue({ id: "f1", pair_code: "KID-ABC123" }),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

describe("PairingWizard", () => {
  it("Step 1 → 2 → 3 → 4 → 5 전체 흐름", async () => {
    const onComplete = vi.fn();
    render(<PairingWizard userId="u1" parentName="부모" onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/가족 이름/i), { target: { value: "혜니네" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.click(screen.getByRole("button", { name: "1명" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    fireEvent.click(screen.getByRole("button", { name: /생년월일 선택/ }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByText(/KID-ABC123/)).toBeInTheDocument();
    });
  });
});
