import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PairingModal } from "../../src/components/pairing/PairingModal.jsx";

const { uploadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: uploadMock,
      }),
    },
  },
}));

describe("PairingModal", () => {
  afterEach(() => {
    cleanup();
    uploadMock.mockReset();
    vi.restoreAllMocks();
  });

  it("uploads a changed child profile photo through Supabase Storage", async () => {
    uploadMock.mockResolvedValue({ data: { path: "family-1/child-2-photo.png" }, error: null });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const onPhotoChange = vi.fn().mockResolvedValue(undefined);

    render(
      <PairingModal
        myRole="parent"
        pairCode="ABC123"
        familyId="family-1"
        pairedMembers={[
          {
            id: "child-member-1",
            user_id: "child-user-1",
            role: "child",
            name: "하이",
            emoji: "🐰",
            child_order: 2,
          },
        ]}
        onUnpair={vi.fn()}
        onPhotoChange={onPhotoChange}
        onClose={vi.fn()}
        canManageFamily
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /프로필 수정/ }));

    const input = document.getElementById("pmodal-photo-child-member-1");
    const file = new File(["profile"], "profile.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(
        expect.stringMatching(/^family-1\/child-2-\d+\.png$/),
        file,
        { upsert: true }
      );
      expect(onPhotoChange).toHaveBeenCalledWith(
        "child-member-1",
        expect.stringMatching(/^family-1\/child-2-\d+\.png$/)
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
