import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChildAvatar } from "../../src/components/multichild/HomeDashboard/ChildAvatar.jsx";

describe("ChildAvatar", () => {
  it("keeps a readable profile image label by default", () => {
    render(<ChildAvatar child={{ name: "혜니", color_hex: "#F779A8" }} />);

    expect(screen.getByRole("img", { name: "혜니 프로필" })).toHaveAttribute("data-avatar-state", "fallback");
  });

  it("uses the cropped Hyeni image as the child default profile without the ice cream area", () => {
    render(<ChildAvatar child={{ name: "혜니", color_hex: "#F779A8" }} />);

    const avatar = screen.getByRole("img", { name: "혜니 프로필" });
    const fallbackImage = avatar.querySelector("[data-hyeni-default-child-image]");
    expect(fallbackImage).toBeInTheDocument();
    expect(fallbackImage).toHaveAttribute("data-hyeni-default-child-image-crop", "face-no-icecream");
    expect(fallbackImage.getAttribute("src")).toContain("new_logo");
  });

  it("can be decorative inside text-labeled buttons", () => {
    render(
      <button type="button">
        <ChildAvatar child={{ name: "민이", color_hex: "#7DC9F1" }} decorative />
        <span>민이</span>
      </button>,
    );

    expect(screen.queryByRole("img", { name: "민이 프로필" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "민이" })).toBeInTheDocument();
  });
});
