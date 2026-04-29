import { describe, expect, it, beforeEach } from "vitest";
import { pushBackHandler, popBackHandler, dispatchBack } from "../src/lib/backHandler.js";

function drainStack() {
  // Pop everything currently registered so each test starts from empty.
  while (dispatchBack()) { /* keep popping until handlers stop consuming */ }
}

describe("backHandler stack", () => {
  beforeEach(() => {
    drainStack();
  });

  it("returns false when no handlers registered", () => {
    expect(dispatchBack()).toBe(false);
  });

  it("dispatches to most recently pushed handler first", () => {
    const log = [];
    const a = () => { log.push("a"); return false; };
    const b = () => { log.push("b"); return true; };
    pushBackHandler(a);
    pushBackHandler(b);

    expect(dispatchBack()).toBe(true);
    expect(log).toEqual(["b"]);

    popBackHandler(a);
    popBackHandler(b);
  });

  it("falls through to next handler when top returns false", () => {
    const log = [];
    const a = () => { log.push("a"); return true; };
    const b = () => { log.push("b"); return false; };
    pushBackHandler(a);
    pushBackHandler(b);

    expect(dispatchBack()).toBe(true);
    expect(log).toEqual(["b", "a"]);

    popBackHandler(a);
    popBackHandler(b);
  });

  it("popBackHandler removes the most recent matching registration", () => {
    const log = [];
    const a = () => { log.push("a"); return true; };
    pushBackHandler(a);
    popBackHandler(a);

    expect(dispatchBack()).toBe(false);
    expect(log).toEqual([]);
  });

  it("isolates handler errors so a thrown exception does not break the chain", () => {
    const log = [];
    const bad = () => { throw new Error("boom"); };
    const good = () => { log.push("good"); return true; };
    pushBackHandler(good);
    pushBackHandler(bad);

    expect(dispatchBack()).toBe(true);
    expect(log).toEqual(["good"]);

    popBackHandler(bad);
    popBackHandler(good);
  });
});
