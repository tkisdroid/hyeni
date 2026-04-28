// tests/integration/multichild-event-save.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCalls = [];
const deleteCalls = [];

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    from: (table) => ({
      insert: (rows) => {
        insertCalls.push({ table, rows });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "e1" }, error: null }) }) };
      },
      upsert: (row) => {
        insertCalls.push({ table, rows: row });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "e1", ...row }, error: null }) }) };
      },
      delete: () => ({
        eq: () => {
          deleteCalls.push({ table });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

beforeEach(() => { insertCalls.length = 0; deleteCalls.length = 0; });

import { saveEventWithChildren } from "../../src/lib/sync.js";

describe("saveEventWithChildren", () => {
  it("자녀 1명 선택 시 events_children 1행 생성", async () => {
    await saveEventWithChildren({ id: "e1", title: "학원", family_id: "f1" }, { childIds: ["c1"], familyAll: false });
    const childRows = insertCalls.find((c) => c.table === "events_children");
    expect(childRows.rows).toEqual([{ event_id: "e1", child_id: "c1" }]);
  });

  it("'가족 전체' 시 is_family_event=true + events_children 행 0개", async () => {
    await saveEventWithChildren({ id: "e1", title: "저녁식사", family_id: "f1" }, { childIds: [], familyAll: true });
    const eventRows = insertCalls.find((c) => c.table === "events");
    expect(eventRows.rows.is_family_event).toBe(true);
    const childRows = insertCalls.find((c) => c.table === "events_children");
    expect(childRows).toBeUndefined();
  });
});
