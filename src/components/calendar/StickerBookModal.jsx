import { useState } from "react";
import { FF } from "../../lib/utils.js";

export default function StickerBookModal({ stickers, summary, dateLabel, onClose, isParentMode, onGiveSticker }) {
    const earlyCount = summary?.early_count || 0;
    const onTimeCount = summary?.on_time_count || 0;
    const lateCount = summary?.late_count || 0;
    const [showGive, setShowGive] = useState(false);
    const [giveMsg, setGiveMsg] = useState("");
    const PRAISE = [
        { emoji: "🌟", title: "최고예요!" }, { emoji: "👏", title: "잘했어!" },
        { emoji: "💪", title: "대단해!" }, { emoji: "🎯", title: "정확해요!" },
        { emoji: "🌈", title: "멋져요!" }, { emoji: "💕", title: "사랑해!" },
        { emoji: "🏆", title: "챔피언!" }, { emoji: "✨", title: "빛나는 하루!" },
    ];

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: 460, maxHeight: "85vh", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
                {/* 헤더 + 요약 (고정) */}
                <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 28 }}>🏆</span>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: "#374151" }}>칭찬 스티커북</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{dateLabel}</div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF, fontSize: 13 }}>닫기</button>
                    </div>

                    {/* 요약 카운트 — 한 줄 컴팩트 */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {[
                            { emoji: "🌟", count: earlyCount, label: "일찍", bg: "#FEF3C7", color: "#F59E0B" },
                            { emoji: "⭐", count: onTimeCount, label: "정시", bg: "#EDE9FE", color: "#7C3AED" },
                            { emoji: "😢", count: lateCount, label: "아쉬워", bg: "#F3F4F6", color: "#9CA3AF" },
                            { emoji: "💕", count: stickers.filter(s => s.sticker_type === "praise").length, label: "칭찬", bg: "#FFF0F5", color: "#EC4899" },
                        ].map((item, i) => (
                            <div key={i} style={{ flex: 1, background: item.bg, borderRadius: 12, padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 16 }}>{item.emoji} <span style={{ fontWeight: 900, color: item.color }}>{item.count}</span></div>
                                <div style={{ fontSize: 9, color: item.color, fontWeight: 700, marginTop: 2 }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 스티커 목록 (스크롤 영역) */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", minHeight: 0 }}>
                    {stickers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#D1D5DB" }}>
                            <div style={{ fontSize: 32, marginBottom: 6 }}>🌙</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>아직 스티커가 없어요</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
                            {stickers.map((s, i) => (
                                <div key={s.id || i} style={{
                                    background: s.sticker_type === "early" ? "#FEF3C7" : s.sticker_type === "late" ? "#F3F4F6" : s.sticker_type === "praise" ? "#FFF0F5" : "#EDE9FE",
                                    borderRadius: 14, padding: "8px 6px", textAlign: "center",
                                    border: `1.5px solid ${s.sticker_type === "early" ? "#FCD34D" : s.sticker_type === "late" ? "#D1D5DB" : s.sticker_type === "praise" ? "#F9A8D4" : "#C4B5FD"}`,
                                    opacity: s.sticker_type === "late" ? 0.6 : 1,
                                }}>
                                    <div style={{ fontSize: 22 }}>{s.emoji}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 하단 고정: 칭찬 주기 + 닫기 */}
                <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
                    {isParentMode && onGiveSticker && !showGive && (
                        <button onClick={() => setShowGive(true)}
                            style={{ width: "100%", padding: "13px", marginBottom: 8, borderRadius: 16, border: "2px dashed #FCD34D", background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)", cursor: "pointer", fontSize: 14, fontWeight: 900, color: "#F59E0B", fontFamily: FF }}>
                            🌟 칭찬스티커 주기
                        </button>
                    )}
                    {isParentMode && onGiveSticker && showGive && (
                        <div style={{ background: "#FFFBEB", borderRadius: 16, padding: 12, border: "2px solid #FCD34D", marginBottom: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                                {PRAISE.map((ps, i) => (
                                    <button key={i} onClick={async () => {
                                        await onGiveSticker(ps.emoji, giveMsg.trim() || ps.title);
                                        setShowGive(false); setGiveMsg("");
                                    }}
                                        style={{ background: "white", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "8px 2px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: FF }}>
                                        <span style={{ fontSize: 20 }}>{ps.emoji}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: "#92400E" }}>{ps.title}</span>
                                    </button>
                                ))}
                            </div>
                            <input value={giveMsg} onChange={e => setGiveMsg(e.target.value)} placeholder="직접 메시지 (선택)"
                                style={{ width: "100%", marginTop: 8, padding: "7px 10px", borderRadius: 10, border: "1.5px solid #FCD34D", fontSize: 12, fontFamily: FF, boxSizing: "border-box", outline: "none" }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
