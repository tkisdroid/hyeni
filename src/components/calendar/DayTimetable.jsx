import { useState } from "react";
import { FF, haversineM } from "../../lib/utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// Memo Section with send, replies, read indicator
// ─────────────────────────────────────────────────────────────────────────────
function MemoSection({ memoValue, replies, onReplySubmit, readBy, myUserId, isParentMode }) {
    const [inputText, setInputText] = useState("");
    const [sent, setSent] = useState(false);

    const handleSend = () => {
        if (!inputText.trim()) return;
        onReplySubmit?.(inputText.trim());
        setInputText("");
        setSent(true);
        setTimeout(() => setSent(false), 2000);
    };

    const othersRead = (readBy || []).filter(id => id !== myUserId).length > 0;
    const hasMessages = replies && replies.length > 0;
    const hasMemo = (memoValue || "").trim().length > 0 && memoValue !== "💬";

    return (
        <div style={{ marginTop: 18, background: "white", borderRadius: 20, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>💬 오늘의 메모</div>
                {othersRead && <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>✓ 읽음</div>}
            </div>

            {/* Messages */}
            <div style={{ padding: "12px 16px", minHeight: 60, maxHeight: 320, overflowY: "auto" }}>
                {/* 기존 메모가 있으면 상단에 표시 */}
                {hasMemo && (
                    <div style={{ background: "#FFF0F7", borderRadius: 16, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, color: "#374151", fontFamily: FF, borderLeft: "3px solid #E879A0", marginBottom: hasMessages ? 12 : 0, whiteSpace: "pre-wrap" }}>
                        {memoValue}
                    </div>
                )}

                {hasMessages ? replies.map(r => {
                    const isMe = r.user_id === myUserId;
                    return (
                        <div key={r.id} style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-start" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 14, background: r.user_role === "parent" ? "#DBEAFE" : "#FCE7F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{r.user_role === "parent" ? "👩" : "🐰"}</div>
                            <div style={{ maxWidth: "75%" }}>
                                <div style={{ background: isMe ? "#E879A0" : "#F3F4F6", color: isMe ? "white" : "#374151", borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "10px 14px", fontSize: 14, lineHeight: 1.5, fontFamily: FF }}>{r.content}</div>
                                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                                    {new Date(r.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                        </div>
                    );
                }) : (!hasMemo && (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "#D1D5DB", fontSize: 13 }}>오늘의 메모를 남겨보세요 💬</div>
                ))}
            </div>

            {/* Input */}
            <div style={{ padding: "8px 10px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 6, alignItems: "center", background: "#FAFAFA" }}>
                <input
                    type="text"
                    placeholder="메모를 입력하세요..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
                    style={{ flex: 1, minWidth: 0, border: "1.5px solid #E5E7EB", borderRadius: 18, padding: "8px 12px", fontSize: 13, fontFamily: FF, outline: "none", background: "white", boxSizing: "border-box" }}
                />
                <button onClick={handleSend} disabled={!inputText.trim() || sent}
                    style={{ padding: "8px 12px", borderRadius: 18, background: sent ? "#10B981" : inputText.trim() ? "linear-gradient(135deg,#E879A0,#BE185D)" : "#E5E7EB", color: "white", border: "none", cursor: inputText.trim() ? "pointer" : "default", fontWeight: 800, fontSize: 11, fontFamily: FF, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {sent ? "✓" : "보내기"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Timetable (kid-friendly)
// ─────────────────────────────────────────────────────────────────────────────
export default function DayTimetable({ events, dateLabel, isToday = false, isFuture = false, childPos, mapReady: _mapReady, arrivedSet, firedEmergencies, onRoute, onDelete, onEditLoc, memoValue, onMemoChange, onMemoBlur, onMemoSend, stickers, memoReplies, onReplySubmit, memoReadBy, myUserId, isParentMode }) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (events.length === 0) return (
        <div style={{ fontFamily: FF }}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{isParentMode ? "🌙" : "🎉"}</div>
                <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: isParentMode ? "#D1D5DB" : "#F9A8D4" }}>{isParentMode ? "아직 일정이 없어요" : "오늘은 자유시간이야!"}</div>
                <div style={{ fontSize: isParentMode ? 13 : 14, color: "#E5E7EB", marginTop: 4 }}>{isParentMode ? "위에서 추가해 보세요!" : "신나게 놀자~ 🐰"}</div>
            </div>
            <MemoSection memoValue={memoValue} onMemoChange={onMemoChange} onMemoBlur={onMemoBlur} onMemoSend={onMemoSend} replies={memoReplies} onReplySubmit={onReplySubmit} readBy={memoReadBy} myUserId={myUserId} isParentMode={isParentMode} />
        </div>
    );

    return (
        <div style={{ fontFamily: FF }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>{dateLabel}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{events.length}개 일정</div>
                </div>
                {childPos
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: "#34D399", background: "#D1FAE5", padding: "5px 12px", borderRadius: 12 }}>💕 엄마가 항상 함께하고 있어요</div>
                    : <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "5px 12px", borderRadius: 12 }}>위치 없음</div>}
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 3, background: "linear-gradient(to bottom, #F9A8D4, #A78BFA, #60A5FA)", borderRadius: 4 }} />

                {events.map((ev, i) => {
                    const [h, m] = ev.time.split(":").map(Number);
                    const evMin = h * 60 + m;
                    const endMin = ev.endTime ? (() => { const [eh, em] = ev.endTime.split(":").map(Number); return eh * 60 + em; })() : evMin + 60;
                    const isPast = isToday ? nowMin > endMin : !isFuture;  // 오늘이면 시간비교, 과거 날짜면 전부 past
                    const isCurrent = isToday && nowMin >= evMin - 10 && nowMin <= endMin;  // 오늘만 "지금!" 표시
                    const arrived = arrivedSet.has(ev.id);
                    const emergency = ev.location && !arrived && firedEmergencies.has(ev.id);
                    const friendlyTime = isParentMode ? ev.time : `${h >= 12 ? "오후" : "오전"} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`;
                    const friendlyEndTime = ev.endTime ? (isParentMode ? ev.endTime : (() => { const [eh, em] = ev.endTime.split(":").map(Number); return `${eh >= 12 ? "오후" : "오전"} ${eh > 12 ? eh - 12 : eh === 0 ? 12 : eh}:${String(em).padStart(2, "0")}`; })()) : null;

                    const dist = childPos && ev.location
                        ? haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng)
                        : null;
                    const distLabel = dist !== null
                        ? dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`
                        : null;

                    return (
                        <div key={ev.id} style={{ position: "relative", marginBottom: i < events.length - 1 ? 16 : 0 }}>
                            {/* Dot on timeline */}
                            <div style={{
                                position: "absolute", left: -22, top: 14, width: 14, height: 14, borderRadius: "50%",
                                background: isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : "white",
                                border: `3px solid ${isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : ev.color}`,
                                boxShadow: isCurrent ? `0 0 0 4px ${ev.color}33` : "none",
                                zIndex: 2
                            }} />

                            {/* Event card */}
                            <div
                                onClick={() => ev.location ? onRoute(ev) : null}
                                style={{
                                    background: isCurrent ? `linear-gradient(135deg,${ev.bg},white)` : "white",
                                    borderRadius: 20, padding: "14px 16px",
                                    border: isCurrent ? `2px solid ${ev.color}` : "2px solid #F3F4F6",
                                    cursor: ev.location ? "pointer" : "default",
                                    transition: "all 0.2s",
                                    opacity: isPast && !isCurrent ? 0.6 : 1,
                                    position: "relative"
                                }}>

                                {/* Time badge */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        background: isCurrent ? ev.color : ev.bg,
                                        color: isCurrent ? "white" : ev.color,
                                        padding: isParentMode ? "4px 12px" : "6px 14px", borderRadius: 12, fontSize: isParentMode ? 13 : 15, fontWeight: 800
                                    }}>
                                        {friendlyTime}{friendlyEndTime ? ` ~ ${friendlyEndTime}` : ""}
                                    </div>
                                    {isCurrent && (isParentMode
                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, animation: "pulse 1.5s infinite" }}>지금!</span>
                                        : <span style={{ fontSize: 13, fontWeight: 800, color: "white", background: ev.color, padding: "3px 10px", borderRadius: 10, animation: "pulse 1.5s infinite" }}>지금 갈 시간! 🏃</span>
                                    )}
                                    {isFuture && !isCurrent && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#8B5CF6", background: "#EDE9FE", padding: "2px 8px", borderRadius: 8 }}>예정</span>
                                    )}
                                    {arrived && <span style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: "#059669" }}>✅ 도착</span>}
                                    {emergency && isParentMode && <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", animation: "pulse 1s infinite" }}>🚨 미도착</span>}
                                </div>

                                {/* Content */}
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ width: isParentMode ? 44 : 50, height: isParentMode ? 44 : 50, borderRadius: isParentMode ? 14 : 16, background: ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isParentMode ? 24 : 28, flexShrink: 0 }}>{ev.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: "#1F2937" }}>{ev.title}</div>
                                        {ev.location && (
                                            <div style={{ fontSize: isParentMode ? 12 : 13, color: "#6B7280", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                                <span>📍</span>
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.location.address}</span>
                                            </div>
                                        )}
                                        {ev.memo && <div style={{ fontSize: isParentMode ? 11 : 12, color: "#9CA3AF", marginTop: 2 }}>📝 {ev.memo}</div>}
                                    </div>
                                </div>

                                {/* Distance + action row */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                    {ev.location && distLabel && (
                                        <div style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: ev.color, background: ev.bg, padding: isParentMode ? "4px 10px" : "6px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
                                            🚶 {distLabel}
                                        </div>
                                    )}
                                    {ev.location && !distLabel && !isParentMode && (
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", background: "#F3F4F6", padding: "5px 10px", borderRadius: 10 }}>
                                            📍 위치 확인 중...
                                        </div>
                                    )}
                                    {ev.location && (
                                        <button onClick={(e) => { e.stopPropagation(); onRoute(ev); }}
                                            style={{ fontSize: isParentMode ? 12 : 14, fontWeight: 800, color: "white", background: `linear-gradient(135deg, ${ev.color}, ${ev.color}cc)`, padding: isParentMode ? "6px 14px" : "8px 16px", borderRadius: isParentMode ? 12 : 14, border: "none", cursor: "pointer", fontFamily: FF, boxShadow: `0 2px 8px ${ev.color}44`, display: "flex", alignItems: "center", gap: 4 }}>
                                            🧭 길찾기
                                        </button>
                                    )}
                                    {!ev.location && isParentMode && (
                                        <button onClick={(e) => { e.stopPropagation(); onEditLoc(ev.id); }}
                                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 10, background: "#FFF0F7", border: "1.5px dashed #F9A8D4", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                            📍 장소 추가
                                        </button>
                                    )}
                                    {!ev.location && !isParentMode && (
                                        <div style={{ fontSize: 12, color: "#D1D5DB", fontWeight: 600 }}>📍 장소 미설정 (부모님이 추가해요)</div>
                                    )}
                                </div>

                                {/* Delete button - parent only */}
                                {isParentMode && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                                        style={{ position: "absolute", right: 10, top: 10, background: "rgba(0,0,0,0.04)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 12, color: "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF }}>✕</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stickers earned today */}
            {stickers && stickers.length > 0 && (
                <div style={{ marginTop: 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A22)", borderRadius: 20, padding: 14, border: "2px solid #FCD34D" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 8 }}>🏆 오늘 받은 칭찬스티커</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {stickers.map((s, i) => (
                            <div key={s.id || i} style={{
                                background: "white", borderRadius: 12, padding: "6px 10px",
                                display: "flex", alignItems: "center", gap: 4,
                                border: "1.5px solid #FCD34D", boxShadow: "0 2px 4px rgba(252,211,77,0.2)",
                            }}>
                                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Memo */}
            <MemoSection
                memoValue={memoValue}
                onMemoChange={onMemoChange}
                onMemoBlur={onMemoBlur}
                onMemoSend={onMemoSend}
                replies={memoReplies}
                onReplySubmit={onReplySubmit}
                readBy={memoReadBy}
                myUserId={myUserId}
                isParentMode={isParentMode}
            />
        </div>
    );
}
