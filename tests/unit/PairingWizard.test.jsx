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
  it("Step 0 → 1 → 2 → 3 → 4 전체 흐름 (가족명 → 디바이스 → 자녀수 → 자녀상세 → 페어링코드)", async () => {
    const onComplete = vi.fn();
    render(<PairingWizard userId="u1" parentName="부모" onComplete={onComplete} />);

    // Step 0: family name
    fireEvent.change(screen.getByLabelText(/가족 이름/i), { target: { value: "혜니네" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Step 1: device type (Phase 4 spec 4.1 신규)
    fireEvent.click(screen.getByRole("button", { name: /자기 폰/ }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Step 2: child count
    fireEvent.click(screen.getByRole("button", { name: "1명" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Step 3: child details
    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    fireEvent.click(screen.getByRole("button", { name: /생년월일 선택/ }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Step 4: pair code 표시
    await waitFor(() => {
      expect(screen.getByText(/KID-ABC123/)).toBeInTheDocument();
    });
  });
});
