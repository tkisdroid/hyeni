// tests/unit/memoCache.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { readMemoRepliesCache, writeMemoRepliesCache } from "../../src/lib/memoCache.js";

describe("memoCache", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe("readMemoRepliesCache", () => {
        it("familyId/dateKey 누락 시 빈 배열", () => {
            expect(readMemoRepliesCache("", "2026-05-05")).toEqual([]);
            expect(readMemoRepliesCache("f1", "")).toEqual([]);
        });

        it("저장 안 됐으면 빈 배열", () => {
            expect(readMemoRepliesCache("f1", "2026-05-05")).toEqual([]);
        });

        it("저장된 항목 복원", () => {
            const replies = [{ id: "r1", text: "hi" }, { id: "r2", text: "bye" }];
            writeMemoRepliesCache("f1", "2026-05-05", replies);
            expect(readMemoRepliesCache("f1", "2026-05-05")).toEqual(replies);
        });

        it("temp- prefix id는 캐시에서 제외", () => {
            const replies = [
                { id: "r1", text: "real" },
                { id: "temp-2", text: "optimistic" },
            ];
            writeMemoRepliesCache("f1", "2026-05-05", replies);
            const result = readMemoRepliesCache("f1", "2026-05-05");
            expect(result.length).toBe(1);
            expect(result[0].id).toBe("r1");
        });

        it("malformed JSON → 빈 배열", () => {
            localStorage.setItem("hyeni-memo-replies-v1-f1", "{not json");
            expect(readMemoRepliesCache("f1", "2026-05-05")).toEqual([]);
        });

        it("dateKey 별 저장 분리", () => {
            writeMemoRepliesCache("f1", "2026-05-05", [{ id: "a" }]);
            writeMemoRepliesCache("f1", "2026-05-04", [{ id: "b" }]);
            expect(readMemoRepliesCache("f1", "2026-05-05")[0].id).toBe("a");
            expect(readMemoRepliesCache("f1", "2026-05-04")[0].id).toBe("b");
        });

        it("familyId 별 저장 분리", () => {
            writeMemoRepliesCache("f1", "k", [{ id: "a" }]);
            writeMemoRepliesCache("f2", "k", [{ id: "b" }]);
            expect(readMemoRepliesCache("f1", "k")[0].id).toBe("a");
            expect(readMemoRepliesCache("f2", "k")[0].id).toBe("b");
        });
    });

    describe("writeMemoRepliesCache", () => {
        it("familyId/dateKey 누락 시 무시", () => {
            writeMemoRepliesCache("", "k", [{ id: "a" }]);
            writeMemoRepliesCache("f", "", [{ id: "a" }]);
            expect(localStorage.length).toBe(0);
        });

        it("array 아니면 빈 배열 저장", () => {
            writeMemoRepliesCache("f1", "k", null);
            expect(readMemoRepliesCache("f1", "k")).toEqual([]);
        });

        it("기존 데이터 보존하며 dateKey 갱신", () => {
            writeMemoRepliesCache("f1", "k1", [{ id: "a" }]);
            writeMemoRepliesCache("f1", "k2", [{ id: "b" }]);
            expect(readMemoRepliesCache("f1", "k1")[0].id).toBe("a");
            expect(readMemoRepliesCache("f1", "k2")[0].id).toBe("b");
        });

        it("temp-* 항목은 저장하지 않음", () => {
            writeMemoRepliesCache("f1", "k", [
                { id: "r1" },
                { id: "temp-x" },
            ]);
            const result = readMemoRepliesCache("f1", "k");
            expect(result.length).toBe(1);
            expect(result[0].id).toBe("r1");
        });
    });
});
