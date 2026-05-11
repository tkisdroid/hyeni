// src/lib/scheduleCategories.js
// 6 카테고리(학원/운동/취미/가족/친구/기타) + 학원 preset 목록.
// Hyeni 브랜드 핵심 상수 — CLAUDE.md "preserve hyeni-cat-*" 규칙 대상.
// Extracted from App.jsx (Phase 5 #4 / B5d).

// iconKey maps each category to a 3D WebP asset under src/assets/3d/category/.
// `friend` intentionally has iconKey null → CategoryIcon falls back to emoji.
export const CATEGORIES = [
    { id: "school", label: "학원", emoji: "📚", iconKey: "school", color: "var(--hyeni-cat-school)", bg: "var(--hyeni-cat-school-bg)" },
    { id: "sports", label: "운동", emoji: "⚽", iconKey: "sports", color: "var(--hyeni-cat-sports)", bg: "var(--hyeni-cat-sports-bg)" },
    { id: "hobby", label: "취미", emoji: "🎨", iconKey: "hobby", color: "var(--status-cautionary)", bg: "var(--status-cautionary-subtle)" },
    { id: "family", label: "가족", emoji: "👨‍👩‍👧", iconKey: "family", color: "var(--hyeni-cat-family)", bg: "var(--hyeni-cat-family-bg)" },
    { id: "friend", label: "친구", emoji: "👫", iconKey: null, color: "var(--hyeni-cat-friend)", bg: "var(--hyeni-cat-friend-bg)" },
    { id: "other", label: "기타", emoji: "🌟", iconKey: "other", color: "var(--hyeni-cat-other)", bg: "var(--hyeni-cat-other-bg)" },
];

export const ACADEMY_PRESETS = [
    { label: "영어학원", emoji: "🔤", category: "school" },
    { label: "수학학원", emoji: "🔢", category: "school" },
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "축구교실", emoji: "⚽", category: "sports" },
    { label: "수영", emoji: "🏊", category: "sports" },
    { label: "미술학원", emoji: "🎨", category: "hobby" },
    { label: "코딩학원", emoji: "💻", category: "school" },
    { label: "무용", emoji: "💃", category: "hobby" },
    { label: "독서논술", emoji: "📖", category: "school" },
];
