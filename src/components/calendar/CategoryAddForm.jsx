import { useState } from "react";
import { FF } from "../../lib/utils.js";

const CAT_EMOJI_PRESETS = ["🏫","📖","🎵","🎭","🏃","🧪","💻","🎸","🩰","✏️","🎯","🚌"];
const CAT_COLOR_PRESETS = [
    { color: "#6366F1", bg: "#EEF2FF" },
    { color: "#14B8A6", bg: "#CCFBF1" },
    { color: "#F97316", bg: "#FFF7ED" },
    { color: "#EF4444", bg: "#FEF2F2" },
    { color: "#8B5CF6", bg: "#F5F3FF" },
    { color: "#06B6D4", bg: "#ECFEFF" },
    { color: "#D946EF", bg: "#FAF5FF" },
    { color: "#84CC16", bg: "#F7FEE7" },
];

export default function CategoryAddForm({ onAdd, onClose }) {
    const [label, setLabel] = useState("");
    const [emoji, setEmoji] = useState("🏫");
    const [colorIdx, setColorIdx] = useState(0);

    const handleSave = () => {
        const name = label.trim();
        if (!name) return;
        const id = "custom_" + name.replace(/\s+/g, "_") + "_" + Date.now();
        const { color, bg } = CAT_COLOR_PRESETS[colorIdx];
        onAdd({ id, label: name, emoji, color, bg });
    };

    return (
        <div style={{ marginTop: 10, padding: 14, background: "#F9FAFB", borderRadius: 16, border: "1.5px solid #E5E7EB", fontFamily: FF }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>새 카테고리 추가</div>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="카테고리 이름 (예: 학교)"
                style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 14, fontFamily: FF, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>이모지</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {CAT_EMOJI_PRESETS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: emoji === e ? "2px solid #E879A0" : "1.5px solid #E5E7EB", background: emoji === e ? "#FFF0F7" : "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{e}</button>
                ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>색상</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {CAT_COLOR_PRESETS.map((c, i) => (
                    <button key={i} onClick={() => setColorIdx(i)}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: c.color, border: colorIdx === i ? "3px solid #374151" : "2px solid transparent", cursor: "pointer", outline: colorIdx === i ? "2px solid white" : "none" }} />
                ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSave} disabled={!label.trim()}
                    style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: label.trim() ? "linear-gradient(135deg,#E879A0,#BE185D)" : "#E5E7EB", color: "white", fontWeight: 800, fontSize: 13, cursor: label.trim() ? "pointer" : "default", fontFamily: FF }}>추가</button>
                <button onClick={onClose}
                    style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>취소</button>
            </div>
        </div>
    );
}
