// src/lib/memoTime.js
// Memo timestamp/grouping utilities — pure functions extracted from App.jsx
// (Phase 5 #4 / A4).
//
// 책임: 메모 created_at 의 표시 형식, 날짜 구분선 라벨, 로컬 캘린더 day key,
// 메시지 그룹핑 (3분 윈도우 + 같은 사용자 + 같은 로컬 날짜).

export function getMemoTime(createdAt) {
    const now = Date.now();
    const ts = new Date(createdAt).getTime();
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "방금";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    // 1 hour or older → show absolute time
    const d = new Date(createdAt);
    const nowDate = new Date();
    const timePart = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === nowDate.toDateString()) return timePart;
    if (d.getFullYear() !== nowDate.getFullYear()) {
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${timePart}`;
    }
    const yesterday = new Date(nowDate); yesterday.setDate(nowDate.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `어제 ${timePart}`;
    return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${timePart}`;
}

/* UI-SPEC §4e — relative timestamp helper */
export function getRelativeTime(createdAt) {
    const now = Date.now();
    const ts = new Date(createdAt).getTime();
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "방금";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const d = new Date(createdAt);
    const nowDate = new Date();
    const timePart = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (d.getFullYear() !== nowDate.getFullYear()) {
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${timePart}`;
    }
    const yesterday = new Date(nowDate); yesterday.setDate(nowDate.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `어제 ${timePart}`;
    return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${timePart}`;
}

/* UI-SPEC §4a — date separator label helper */
export function getDateSeparatorLabel(createdAt) {
    const d = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "오늘";
    if (d.toDateString() === yesterday.toDateString()) return "어제";
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

/* UI-SPEC §4b — single-pass group builder: separators + bubbles in correct order */
/* Codex P2 fix: use LOCAL calendar day for grouping/separators — created_at is a UTC ISO
   string, and slicing the first 10 chars returns the UTC date. For users in KST (UTC+9)
   that misgroups 00:00-09:00 local-time messages as the previous UTC day and can render
   duplicate "오늘" separators. localDayKey() derives YYYY-MM-DD in the user's locale. */
export function localDayKey(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function memoDateKeyFromParts(year, month, day) {
    const date = new Date(year, month, day);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildMemoThreadDateKeys(year, month, day) {
    const previous = memoDateKeyFromParts(year, month, day - 1);
    const current = memoDateKeyFromParts(year, month, day);
    return previous === current ? [current] : [previous, current];
}

export function buildMessageItems(replies) {
    if (!replies || replies.length === 0) return [];
    const items = [];
    let prevDateKey = null;

    // First, figure out group membership for all replies
    const groupIds = new Array(replies.length).fill(0);
    for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const prev = i > 0 ? replies[i - 1] : null;
        const dk = localDayKey(r.created_at);
        const prevDk = prev ? localDayKey(prev.created_at) : null;
        const sameGroup = prev &&
            prev.user_id === r.user_id &&
            dk === prevDk &&
            (new Date(r.created_at).getTime() - new Date(prev.created_at).getTime()) <= 180000;
        groupIds[i] = sameGroup ? groupIds[i - 1] : i;
    }

    for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const dk = localDayKey(r.created_at);

        // Emit date separator on date change
        if (dk !== prevDateKey) {
            items.push({ type: "separator", label: getDateSeparatorLabel(r.created_at), key: `sep-${dk}-${i}` });
            prevDateKey = dk;
        }

        const gid = groupIds[i];
        const isFirstInGroup = groupIds[i - 1] !== gid || i === 0;
        const isLastInGroup = i === replies.length - 1 || groupIds[i + 1] !== gid;

        items.push({ type: "bubble", r, isFirstInGroup, isLastInGroup, key: r.id });
    }
    return items;
}
