const DEFAULT_CATEGORIES = [
    { id: "school", label: "학원", emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" },
    { id: "sports", label: "운동", emoji: "⚽", color: "#34D399", bg: "#D1FAE5" },
    { id: "hobby", label: "취미", emoji: "🎨", color: "#F59E0B", bg: "#FEF3C7" },
    { id: "family", label: "가족", emoji: "👨‍👩‍👧", color: "#F87171", bg: "#FEE2E2" },
    { id: "friend", label: "친구", emoji: "👫", color: "#60A5FA", bg: "#DBEAFE" },
    { id: "other", label: "기타", emoji: "🌟", color: "#EC4899", bg: "#FCE7F3" },
];
const LS_CUSTOM_CATS = "hyeni-custom-categories";
function loadCategories() {
    try {
        const custom = JSON.parse(localStorage.getItem(LS_CUSTOM_CATS) || "[]");
        return [...DEFAULT_CATEGORIES, ...custom];
    } catch { return [...DEFAULT_CATEGORIES]; }
}
let CATEGORIES = loadCategories();
function saveCustomCategories(customs) {
    try { localStorage.setItem(LS_CUSTOM_CATS, JSON.stringify(customs)); } catch {}
    CATEGORIES = [...DEFAULT_CATEGORIES, ...customs];
}
function getCustomCategories() {
    try { return JSON.parse(localStorage.getItem(LS_CUSTOM_CATS) || "[]"); } catch { return []; }
}
const DEFAULT_CAT_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id));

const ACADEMY_PRESETS = [
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

const SCHEDULE_PRESETS = [
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "연기학원", emoji: "🎭", category: "hobby" },
    { label: "중국어", emoji: "🇨🇳", category: "school" },
    { label: "방과후 영어", emoji: "🔤", category: "school" },
    { label: "방과후 과학실험", emoji: "🔬", category: "school" },
    { label: "방과후 3D펜", emoji: "🖊️", category: "hobby" },
];

export { DEFAULT_CATEGORIES, LS_CUSTOM_CATS, loadCategories, saveCustomCategories, getCustomCategories, DEFAULT_CAT_IDS, ACADEMY_PRESETS, SCHEDULE_PRESETS };
export function getCategories() { return CATEGORIES; }
