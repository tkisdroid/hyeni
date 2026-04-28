import { describe, it, expect } from "vitest";
import { deriveChildren } from "../../src/lib/childrenContext.js";

describe("deriveChildren", () => {
  it("paired_children 0개 → isMultiChild=false, list=[]", () => {
    const result = deriveChildren({ members: [{ role: "parent", user_id: "p1" }] });
    expect(result.isMultiChild).toBe(false);
    expect(result.list).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("paired_children 1개 → isMultiChild=false, list=[child]", () => {
    const result = deriveChildren({
      members: [
        { role: "parent", user_id: "p1" },
        { role: "child", user_id: "c1", name: "혜니", color_hex: "#F779A8", child_order: 1 },
      ],
    });
    expect(result.isMultiChild).toBe(false);
    expect(result.count).toBe(1);
    expect(result.list[0].name).toBe("혜니");
  });

  it("paired_children 2개 → isMultiChild=true, child_order 오름차순", () => {
    const result = deriveChildren({
      members: [
        { role: "child", user_id: "c2", name: "민준", child_order: 2 },
        { role: "child", user_id: "c1", name: "혜니", child_order: 1 },
        { role: "parent", user_id: "p1" },
      ],
    });
    expect(result.isMultiChild).toBe(true);
    expect(result.list[0].name).toBe("혜니");
    expect(result.list[1].name).toBe("민준");
  });

  it("color_hex 누락된 자녀는 자동 색 할당", () => {
    const result = deriveChildren({
      members: [
        { role: "child", user_id: "c1", name: "혜니", child_order: 1 },
        { role: "child", user_id: "c2", name: "민준", child_order: 2, color_hex: "#3B82F6" },
      ],
    });
    expect(result.list[0].color_hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.list[0].color_hex).not.toBe(result.list[1].color_hex);
  });

  it("familyInfo가 null 이면 빈 결과", () => {
    expect(deriveChildren(null).count).toBe(0);
  });
});
