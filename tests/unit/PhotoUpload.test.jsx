// tests/unit/PhotoUpload.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoUpload } from "../../src/components/multichild/PairingWizard/PhotoUpload.jsx";

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test/photo.jpg" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://test/photo.jpg" } }),
      }),
    },
  },
}));

describe("PhotoUpload", () => {
  it("초기에 placeholder 텍스트", () => {
    render(<PhotoUpload value={null} onChange={() => {}} familyId="f1" childOrder={1} />);
    expect(screen.getByText(/사진 추가/i)).toBeInTheDocument();
  });

  it("value 있으면 이미지 표시", () => {
    render(<PhotoUpload value="https://test/photo.jpg" onChange={() => {}} familyId="f1" childOrder={1} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://test/photo.jpg");
  });

  it("파일 선택 시 onChange 호출", async () => {
    const onChange = vi.fn();
    render(<PhotoUpload value={null} onChange={onChange} familyId="f1" childOrder={1} />);
    const input = screen.getByLabelText(/사진 추가/i);
    const file = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).toHaveBeenCalledWith("https://test/photo.jpg");
  });
});
