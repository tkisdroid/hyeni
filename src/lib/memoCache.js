// src/lib/memoCache.js
// localStorage-based memo replies cache. Extracted from App.jsx (Phase 5 #4 / A4).
//
// Storage layout:
//   key: `hyeni-memo-replies-v1-${familyId}`
//   value: JSON { [dateKey: string]: replies[] }
//
// "temp-*" id를 가진 optimistic-UI 항목은 캐시에 저장/복원하지 않음 (서버 ack
// 후 정식 id로 갈음되기 전까지는 disposable).

export function readMemoRepliesCache(familyId, dateKey) {
    if (!familyId || !dateKey || typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(`hyeni-memo-replies-v1-${familyId}`);
        const parsed = raw ? JSON.parse(raw) : {};
        const list = parsed?.[dateKey];
        if (!Array.isArray(list)) return [];
        return list.filter((item) => item && item.id && !String(item.id).startsWith("temp-"));
    } catch {
        return [];
    }
}

export function writeMemoRepliesCache(familyId, dateKey, replies) {
    if (!familyId || !dateKey || typeof window === "undefined") return;
    try {
        const key = `hyeni-memo-replies-v1-${familyId}`;
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[dateKey] = Array.isArray(replies)
            ? replies.filter((item) => item && item.id && !String(item.id).startsWith("temp-"))
            : [];
        localStorage.setItem(key, JSON.stringify(parsed));
    } catch {
        // ignore cache write failures
    }
}
