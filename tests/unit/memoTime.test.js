// tests/unit/memoTime.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    getMemoTime,
    getRelativeTime,
    getDateSeparatorLabel,
    localDayKey,
    memoDateKeyFromParts,
    buildMemoThreadDateKeys,
    buildMessageItems,
} from "../../src/lib/memoTime.js";

const fixedNow = new Date(2026, 4, 5, 14, 0, 0); // 2026-05-05 14:00 local

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getMemoTime", () => {
    it("60초 미만 → '방금'", () => {
        const ts = new Date(fixedNow.getTime() - 30 * 1000).toISOString();
        expect(getMemoTime(ts)).toBe("방금");
    });

    it("1~59분 전 → 'N분 전'", () => {
        const ts = new Date(fixedNow.getTime() - 5 * 60_000).toISOString();
        expect(getMemoTime(ts)).toBe("5분 전");
    });

    it("오늘 1시간 이상 전 → 시각 (HH:MM)", () => {
        const ts = new Date(2026, 4, 5, 9, 30).toISOString();
        const result = getMemoTime(ts);
        expect(result).toMatch(/09:30|9:30/);
    });

    it("어제 → '어제 HH:MM'", () => {
        const ts = new Date(2026, 4, 4, 14, 0).toISOString();
        expect(getMemoTime(ts)).toMatch(/^어제\s/);
    });

    it("작년 → 'YYYY. M. D. HH:MM'", () => {
        const ts = new Date(2025, 0, 1, 10, 0).toISOString();
        const result = getMemoTime(ts);
        expect(result).toMatch(/^2025\. /);
    });
});

describe("getRelativeTime", () => {
    it("60초 미만 → 방금", () => {
        const ts = new Date(fixedNow.getTime() - 10 * 1000).toISOString();
        expect(getRelativeTime(ts)).toBe("방금");
    });

    it("분 단위", () => {
        const ts = new Date(fixedNow.getTime() - 7 * 60_000).toISOString();
        expect(getRelativeTime(ts)).toBe("7분 전");
    });

    it("시간 단위 (24시간 미만)", () => {
        const ts = new Date(fixedNow.getTime() - 3 * 60 * 60_000).toISOString();
        expect(getRelativeTime(ts)).toBe("3시간 전");
    });

    it("어제 → '어제 HH:MM'", () => {
        const ts = new Date(2026, 4, 4, 14, 0).toISOString();
        expect(getRelativeTime(ts)).toMatch(/^어제\s/);
    });
});

describe("getDateSeparatorLabel", () => {
    it("오늘", () => {
        expect(getDateSeparatorLabel(fixedNow.toISOString())).toBe("오늘");
    });

    it("어제", () => {
        const ts = new Date(2026, 4, 4, 10, 0).toISOString();
        expect(getDateSeparatorLabel(ts)).toBe("어제");
    });

    it("그 외 → 월/일/요일", () => {
        const ts = new Date(2026, 4, 1, 10, 0).toISOString();
        const label = getDateSeparatorLabel(ts);
        expect(label).toContain("5월");
    });
});

describe("localDayKey", () => {
    it("YYYY-MM-DD (로컬)", () => {
        const ts = new Date(2026, 4, 5, 23, 0).toISOString();
        expect(localDayKey(ts)).toBe("2026-05-05");
    });

    it("invalid → 빈 문자열", () => {
        expect(localDayKey(null)).toBe("");
        expect(localDayKey("")).toBe("");
        expect(localDayKey("not-a-date")).toBe("");
    });

    it("월/일 zero-pad", () => {
        const ts = new Date(2026, 0, 5).toISOString();
        expect(localDayKey(ts)).toBe("2026-01-05");
    });
});

describe("memoDateKeyFromParts / buildMemoThreadDateKeys", () => {
    it("memoDateKeyFromParts: M (0-index) - D format", () => {
        // month is 0-indexed; output uses date.getMonth() raw
        const result = memoDateKeyFromParts(2026, 4, 5);
        expect(result).toBe("2026-4-5");
    });

    it("buildMemoThreadDateKeys: 일반 케이스 → [previous, current]", () => {
        const result = buildMemoThreadDateKeys(2026, 4, 15);
        expect(result.length).toBe(2);
        expect(result[1]).toBe("2026-4-15");
    });

    it("month 1일 → 전 달 마지막 날 자동 처리 (Date 정규화)", () => {
        const result = buildMemoThreadDateKeys(2026, 4, 1);
        expect(result.length).toBe(2);
        // previous = day=0 → 전월 마지막 날
        expect(result[0]).toBe("2026-3-30");
        expect(result[1]).toBe("2026-4-1");
    });
});

describe("buildMessageItems", () => {
    const baseTime = new Date(2026, 4, 5, 14, 0).getTime();

    it("빈 입력 → 빈 배열", () => {
        expect(buildMessageItems([])).toEqual([]);
        expect(buildMessageItems(null)).toEqual([]);
    });

    it("같은 사용자 + 3분 이내 + 같은 날 → 같은 그룹", () => {
        const replies = [
            { id: "1", user_id: "u1", created_at: new Date(baseTime).toISOString() },
            { id: "2", user_id: "u1", created_at: new Date(baseTime + 60_000).toISOString() },
            { id: "3", user_id: "u1", created_at: new Date(baseTime + 120_000).toISOString() },
        ];
        const items = buildMessageItems(replies);
        const bubbles = items.filter(item => item.type === "bubble");
        expect(bubbles[0].isFirstInGroup).toBe(true);
        expect(bubbles[1].isFirstInGroup).toBe(false);
        expect(bubbles[2].isLastInGroup).toBe(true);
    });

    it("다른 사용자 → 새 그룹", () => {
        const replies = [
            { id: "1", user_id: "u1", created_at: new Date(baseTime).toISOString() },
            { id: "2", user_id: "u2", created_at: new Date(baseTime + 60_000).toISOString() },
        ];
        const items = buildMessageItems(replies);
        const bubbles = items.filter(item => item.type === "bubble");
        expect(bubbles[1].isFirstInGroup).toBe(true);
    });

    it("3분 초과 → 새 그룹", () => {
        const replies = [
            { id: "1", user_id: "u1", created_at: new Date(baseTime).toISOString() },
            { id: "2", user_id: "u1", created_at: new Date(baseTime + 4 * 60_000).toISOString() },
        ];
        const items = buildMessageItems(replies);
        const bubbles = items.filter(item => item.type === "bubble");
        expect(bubbles[1].isFirstInGroup).toBe(true);
    });

    it("날짜 변경 시 separator 삽입", () => {
        const replies = [
            { id: "1", user_id: "u1", created_at: new Date(2026, 4, 4, 14, 0).toISOString() },
            { id: "2", user_id: "u1", created_at: new Date(2026, 4, 5, 14, 0).toISOString() },
        ];
        const items = buildMessageItems(replies);
        const seps = items.filter(item => item.type === "separator");
        expect(seps.length).toBe(2);
        expect(seps[0].label).toBe("어제");
        expect(seps[1].label).toBe("오늘");
    });

    it("첫 항목 앞에는 항상 separator", () => {
        const replies = [
            { id: "1", user_id: "u1", created_at: fixedNow.toISOString() },
        ];
        const items = buildMessageItems(replies);
        expect(items[0].type).toBe("separator");
        expect(items[1].type).toBe("bubble");
    });
});
