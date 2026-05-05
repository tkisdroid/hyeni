// src/lib/scheduleCategories.js
// 6 카테고리(학원/운동/취미/가족/친구/기타) + 학원 preset 목록.
// Hyeni 브랜드 핵심 상수 — CLAUDE.md "preserve hyeni-cat-*" 규칙 대상.
// Extracted from App.jsx (Phase 5 #4 / B5d).

export const CATEGORIES = [
    { id: "school", label: "학원", emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" },
    { id: "sports", label: "운동", emoji: "⚽", color: "#34D399", bg: "var(--status-positive-subtle)" },
    { id: "hobby", label: "취미", emoji: "🎨", color: "var(--status-cautionary)", bg: "var(--status-cautionary-subtle)" },
    { id: "family", label: "가족", emoji: "👨‍👩‍👧", color: "#F87171", bg: "var(--status-negative-subtle)" },
    { id: "friend", label: "친구", emoji: "👫", color: "#60A5FA", bg: "var(--bg-subtle)" },
    { id: "other", label: "기타", emoji: "🌟", color: "#EC4899", bg: "#FCE7F3" },
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
