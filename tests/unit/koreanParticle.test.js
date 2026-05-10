import { describe, it, expect } from "vitest";
import { withParticle } from "../../src/lib/koreanParticle.js";

describe("withParticle", () => {
  it("받침 있는 이름 뒤에 첫 번째 조사를 붙인다", () => {
    expect(withParticle("아린", "과", "와")).toBe("아린과");
    expect(withParticle("동현", "과", "와")).toBe("동현과");
    expect(withParticle("선영", "과", "와")).toBe("선영과");
  });

  it("받침 없는 이름 뒤에 두 번째 조사를 붙인다", () => {
    expect(withParticle("시우", "과", "와")).toBe("시우와");
    expect(withParticle("지우", "과", "와")).toBe("지우와");
    expect(withParticle("나리", "과", "와")).toBe("나리와");
  });

  it("을/를 분기에도 작동한다", () => {
    expect(withParticle("책", "을", "를")).toBe("책을");
    expect(withParticle("나비", "을", "를")).toBe("나비를");
  });

  it("빈 문자열·null은 빈 문자열을 반환한다", () => {
    expect(withParticle("", "과", "와")).toBe("");
    expect(withParticle(null, "과", "와")).toBe("");
    expect(withParticle(undefined, "과", "와")).toBe("");
  });

  it("Hangul 음절이 아닌 마지막 글자는 받침 없음으로 처리한다", () => {
    expect(withParticle("Tom", "과", "와")).toBe("Tom와");
    expect(withParticle("123", "과", "와")).toBe("123와");
  });
});
