export function getMemoPreview({ memoReplies, currentMemo, formatRelativeTime } = {}) {
  const replies = Array.isArray(memoReplies) ? memoReplies : [];
  const latestReply = replies.length > 0 ? replies[replies.length - 1] : null;

  if (!latestReply) {
    return {
      text: currentMemo || "새 메모 없음",
      meta: "",
      count: replies.length,
    };
  }

  const roleLabel = latestReply.user_role === "parent" ? "부모" : "아이";
  const relativeTime = latestReply.created_at && typeof formatRelativeTime === "function"
    ? formatRelativeTime(latestReply.created_at)
    : "";

  return {
    text: latestReply.content || currentMemo || "새 메모 없음",
    meta: relativeTime ? `${roleLabel} · ${relativeTime}` : roleLabel,
    count: replies.length,
  };
}

export function getParentMemoQuickReplies() {
  return [
    { iconName: "chat-heart", label: "꾹 인사", text: "꾹 인사 보낼게 👋" },
    { iconName: "pin-heart", label: "어디야?", text: "지금 어디야?" },
    { iconName: "star-face", label: "스티커", text: "스티커 칭찬을 보냈어요 ⭐" },
  ];
}

export function getChildMemoQuickReplies() {
  return [
    { iconName: "check", label: "다녀왔어요", text: "다녀왔어요 👋" },
    { iconName: "heart", label: "사랑해요", text: "사랑해요 💗" },
    { iconName: "phone-lavender", label: "전화해요", text: "조금 있다 전화해요" },
  ];
}
