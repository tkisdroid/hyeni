// tests/unit/parentPairingIntent.test.js
import { describe, it, expect, beforeEach } from "vitest";
import {
    rememberParentPairingIntent,
    clearParentPairingIntent,
    hasParentPairingIntent,
} from "../../src/lib/parentPairingIntent.js";

describe("parentPairingIntent", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it("초기 상태: hasParentPairingIntent === false", () => {
        expect(hasParentPairingIntent()).toBe(false);
    });

    it("remember → has=true → clear → has=false", () => {
        rememberParentPairingIntent();
        expect(hasParentPairingIntent()).toBe(true);
        clearParentPairingIntent();
        expect(hasParentPairingIntent()).toBe(false);
    });

    it("clear는 멱등 (없을 때 호출 OK)", () => {
        expect(() => clearParentPairingIntent()).not.toThrow();
        expect(hasParentPairingIntent()).toBe(false);
    });

    it("remember는 멱등 (여러 번 호출 OK)", () => {
        rememberParentPairingIntent();
        rememberParentPairingIntent();
        expect(hasParentPairingIntent()).toBe(true);
    });

    it("sessionStorage 키는 kids-app:parent-pairing-intent", () => {
        rememberParentPairingIntent();
        expect(sessionStorage.getItem("kids-app:parent-pairing-intent")).toBe("1");
    });
});
