import { describe, expect, test } from "vitest";
import { selectParentContacts } from "../src/lib/auth.js";

describe("selectParentContacts", () => {
  test("splits mom/dad parents into gendered slots", () => {
    const result = selectParentContacts([
      { role: "parent", gender: "mom", name: "엄마", phone: "010-1111-1111" },
      { role: "parent", gender: "dad", name: "아빠", phone: "010-2222-2222" },
    ]);
    expect(result).toEqual({
      mom: "010-1111-1111",
      dad: "010-2222-2222",
      others: [],
    });
  });

  test("routes gender-less parents into others", () => {
    const result = selectParentContacts([
      { role: "parent", gender: null, name: "보호자", phone: "010-3333-3333" },
    ]);
    expect(result.mom).toBe("");
    expect(result.dad).toBe("");
    expect(result.others).toEqual([{ name: "보호자", phone: "010-3333-3333" }]);
  });

  test("collects multiple co-guardians in member order", () => {
    const result = selectParentContacts([
      { role: "parent", gender: null, name: "할머니", phone: "010-4444-4444" },
      { role: "parent", gender: null, name: "이모", phone: "010-5555-5555" },
    ]);
    expect(result.others).toEqual([
      { name: "할머니", phone: "010-4444-4444" },
      { name: "이모", phone: "010-5555-5555" },
    ]);
  });

  test("drops parents with blank or missing phones", () => {
    const result = selectParentContacts([
      { role: "parent", gender: "mom", name: "엄마", phone: "   " },
      { role: "parent", gender: "dad", name: "아빠", phone: "" },
      { role: "parent", gender: null, name: "보호자" },
    ]);
    expect(result).toEqual({ mom: "", dad: "", others: [] });
  });

  test("trims surrounding whitespace from phone numbers", () => {
    const result = selectParentContacts([
      { role: "parent", gender: "mom", name: "엄마", phone: "  010-6666-6666  " },
    ]);
    expect(result.mom).toBe("010-6666-6666");
  });

  test("ignores child members", () => {
    const result = selectParentContacts([
      { role: "child", gender: null, name: "아이", phone: "010-7777-7777" },
      { role: "parent", gender: "mom", name: "엄마", phone: "010-8888-8888" },
    ]);
    expect(result.mom).toBe("010-8888-8888");
    expect(result.others).toEqual([]);
  });

  test("falls back to a default name for nameless guardians", () => {
    const result = selectParentContacts([
      { role: "parent", gender: null, name: "", phone: "010-9999-9999" },
    ]);
    expect(result.others).toEqual([{ name: "부모님", phone: "010-9999-9999" }]);
  });

  test("returns empty slots for non-array or empty input", () => {
    const empty = { mom: "", dad: "", others: [] };
    expect(selectParentContacts(undefined)).toEqual(empty);
    expect(selectParentContacts(null)).toEqual(empty);
    expect(selectParentContacts([])).toEqual(empty);
  });
});
