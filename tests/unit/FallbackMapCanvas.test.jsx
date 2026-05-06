import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FallbackMapCanvas } from "../../src/components/map/FallbackMapCanvas.jsx";

describe("FallbackMapCanvas", () => {
  it("uses the cropped Hyeni image for default child map markers", () => {
    render(
      <FallbackMapCanvas
        center={{ lat: 37.5665, lng: 126.978 }}
        children={[{ lat: 37.5665, lng: 126.978, name: "혜니", color: "#F779A8" }]}
      />,
    );

    const markerButton = screen.getByRole("button", { name: /혜니/ });
    const fallbackImage = markerButton.querySelector("[data-hyeni-default-child-image]");
    expect(fallbackImage).toBeInTheDocument();
    expect(fallbackImage).toHaveAttribute("data-hyeni-default-child-image-crop", "face-no-icecream");
    expect(fallbackImage.getAttribute("src")).toContain("new_logo");
  });
});
