// tests/unit/pairCode.test.js
import { describe, it, expect } from "vitest";
import { normalizePairCodeInput } from "../../src/lib/pairCode.js";

describe("normalizePairCodeInput", () => {
    it("이미 KID-XXXXXXXX 형식 (uppercase) 그대로", () => {
        expect(normalizePairCodeInput("KID-804DF582")).toBe("KID-804DF582");
    });

    it("소문자도 대문자로 정규화", () => {
        expect(normalizePairCodeInput("kid-804df582")).toBe("KID-804DF582");
    });

    it("8자리만 → KID- 접두 추가", () => {
        expect(normalizePairCodeInput("804DF582")).toBe("KID-804DF582");
    });

    it("URL의 ?pairCode=", () => {
        expect(normalizePairCodeInput("https://hyeni.app/join?pairCode=KID-804DF582")).toBe("KID-804DF582");
    });

    it("URL의 ?code=", () => {
        expect(normalizePairCodeInput("https://hyeni.app/join?code=804DF582")).toBe("KID-804DF582");
    });

    it("URL의 ?pairCode= 가 short code (8 chars)", () => {
        expect(normalizePairCodeInput("https://hyeni.app/join?pairCode=804DF582")).toBe("KID-804DF582");
    });

    it("주변 공백 제거", () => {
        expect(normalizePairCodeInput("  KID-ABC12345  ")).toBe("KID-ABC12345");
    });

    it("매치 없는 입력 → 빈 문자열", () => {
        expect(normalizePairCodeInput("hello")).toBe("");
        expect(normalizePairCodeInput("123")).toBe("");
        expect(normalizePairCodeInput("")).toBe("");
        expect(normalizePairCodeInput(null)).toBe("");
        expect(normalizePairCodeInput(undefined)).toBe("");
    });

    it("문자열 안에 KID-XXXXXXXX 가 있으면 그것만 추출", () => {
        expect(normalizePairCodeInput("text KID-ABCD1234 trailing")).toBe("KID-ABCD1234");
    });

    it("malformed URL은 fallthrough해서 8-char match 시도", () => {
        // URL 파싱 실패 → 빈 문자열로 fallback
        expect(normalizePairCodeInput("not a url just random text")).toBe("");
    });
});
