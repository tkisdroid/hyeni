import { describe, expect, test } from "vitest";
import { getChildMemoQuickReplies, getMemoPreview } from "../src/lib/memoDisplay.js";

describe("memo display helpers", () => {
  test("uses the latest memo reply for preview text and role meta", () => {
    const preview = getMemoPreview({
      memoReplies: [
        { content: "준비물 챙겼어", user_role: "parent", created_at: "2026-04-26T01:00:00.000Z" },
        { content: "네 챙겼어요", user_role: "child", created_at: "2026-04-26T01:05:00.000Z" },
      ],
      currentMemo: "오래된 메모",
      formatRelativeTime: () => "방금",
    });

    expect(preview).toEqual({
      text: "네 챙겼어요",
      meta: "아이 · 방금",
      count: 2,
    });
  });

  test("falls back to the saved memo or empty copy", () => {
    expect(getMemoPreview({ memoReplies: [], currentMemo: "오늘 우산 챙기기" }).text).toBe("오늘 우산 챙기기");
    expect(getMemoPreview({ memoReplies: [], currentMemo: "" }).text).toBe("새 메모 없음");
  });

  test("provides child-friendly quick replies", () => {
    expect(getChildMemoQuickReplies()).toEqual([
      { icon: "👋", label: "다녀왔어요", text: "다녀왔어요 👋" },
      { icon: "💗", label: "사랑해요", text: "사랑해요 💗" },
      { icon: "📞", label: "전화해요", text: "조금 있다 전화해요" },
    ]);
  });
});
