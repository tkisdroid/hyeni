import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChildCallCard } from "../src/components/contact/ChildCallCard.jsx";

afterEach(() => {
  cleanup();
});

// Each target renders an <a> with aria-label `${label}에게 전화`, so links are
// queried by accessible name — robust against the label also appearing in the
// card's meta summary line.
describe("ChildCallCard", () => {
  it("renders mom + dad slots as tel: links", () => {
    render(<ChildCallCard phones={{ mom: "010-1111-2222", dad: "010-3333-4444" }} />);
    const mom = screen.getByRole("link", { name: "엄마에게 전화" });
    const dad = screen.getByRole("link", { name: "아빠에게 전화" });
    expect(mom).toHaveAttribute("href", "tel:01011112222");
    expect(dad).toHaveAttribute("href", "tel:01033334444");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("renders gender-less guardians from others with their name", () => {
    render(
      <ChildCallCard
        phones={{ mom: "", dad: "", others: [{ name: "할머니", phone: "010-5555-6666" }] }}
      />,
    );
    const link = screen.getByRole("link", { name: "할머니에게 전화" });
    expect(link).toHaveAttribute("href", "tel:01055556666");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders mom slot and others together", () => {
    render(
      <ChildCallCard
        phones={{ mom: "010-1111-2222", dad: "", others: [{ name: "이모", phone: "010-7777-8888" }] }}
      />,
    );
    expect(screen.getByRole("link", { name: "엄마에게 전화" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이모에게 전화" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows the empty state when no contacts are available", () => {
    render(<ChildCallCard phones={{ mom: "", dad: "", others: [] }} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("연락처 없음", { selector: ".child-call-card__empty" }))
      .toBeInTheDocument();
  });

  it("drops phone numbers shorter than 8 characters", () => {
    render(
      <ChildCallCard
        phones={{ mom: "0101", dad: "010-3333-4444", others: [{ name: "삼촌", phone: "123" }] }}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("아빠에게 전화");
  });
});
