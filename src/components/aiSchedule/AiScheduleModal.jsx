// src/components/aiSchedule/AiScheduleModal.jsx
// 음성/이미지/텍스트 입력 → ai-voice-parse Edge Function → 일정 자동 등록.
// Extracted from App.jsx (Phase 5 #4 / B11).

import { useRef, useState } from "react";
import { generateUUID, getSession } from "../../lib/auth.js";
import { insertEvent, saveEventWithChildren } from "../../lib/sync.js";
import { sendInstantPush } from "../../lib/instantPush.js";
import { DESIGN, FF, makeSheetStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function AiScheduleModal({ academies, currentDate, familyId, authUser, events, eventSelection, onSave, onClose, startVoiceFn, onNavigateDate }) {
    const [inputText, setInputText] = useState("");
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [results, setResults] = useState(null);
    const [savedIds, setSavedIds] = useState(new Set());
    const fileInputRef = useRef(null);

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = () => setImageData(reader.result);
                reader.readAsDataURL(file);
                return;
            }
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImageData(reader.result);
        reader.readAsDataURL(file);
    };

    // Voice input using Web Speech API
    const startVoiceInput = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            // Fallback: use the parent's startVoice function
            if (startVoiceFn) { onClose(); startVoiceFn(); }
            return;
        }
        const recognition = new SR();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setVoiceListening(true);
        recognition.onresult = (e) => {
            const transcript = e.results[0]?.[0]?.transcript || "";
            setInputText(prev => prev ? prev + "\n" + transcript : transcript);
            setVoiceListening(false);
        };
        recognition.onerror = () => setVoiceListening(false);
        recognition.onend = () => setVoiceListening(false);
        recognition.start();
    };

    const analyze = async (text, image) => {
        const t = text || inputText.trim();
        const img = image || imageData;
        if (!t && !img) return;
        setLoading(true);
        setResults(null);
        try {
            const session = await getSession();
            const token = session?.access_token || SUPABASE_KEY;
            const url = `${SUPABASE_URL}/functions/v1/ai-voice-parse`;
            const todayEvs = (events || []).map(e => ({ id: e.id, title: e.title, time: e.time, memo: e.memo || "" }));
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_KEY },
                body: JSON.stringify({
                    text: t || "이미지에서 일정을 추출해주세요",
                    image: img || undefined,
                    mode: "paste",
                    academies: academies.map(a => ({ name: a.name, category: a.category })),
                    todayEvents: todayEvs,
                    currentDate,
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.action === "add_events" && data.events?.length > 0) {
                setResults(data);
            } else if (data.action === "add_event") {
                setResults({ action: "add_events", events: [data] });
            } else {
                setResults({ action: "unknown", message: data.message || "일정을 찾지 못했어요" });
            }
        } catch (err) {
            console.error("[AiSchedule]", err);
            setResults({ action: "unknown", message: "일정 정리 실패: " + err.message });
        } finally { setLoading(false); }
    };

    const CATS = { school: { emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" }, sports: { emoji: "⚽", color: "#34D399", bg: "var(--status-positive-subtle)" }, hobby: { emoji: "🎨", color: "var(--status-cautionary)", bg: "var(--status-cautionary-subtle)" }, family: { emoji: "👨‍👩‍👧", color: "#F87171", bg: "var(--status-negative-subtle)" }, friend: { emoji: "👫", color: "#60A5FA", bg: "var(--bg-subtle)" }, other: { emoji: "📌", color: "#EC4899", bg: "#FCE7F3" } };

    const saveOne = async (ev, idx) => {
        if (savedIds.has(idx)) return;
        const cat = CATS[ev.category] || CATS.other;
        const matchedAcademy = ev.academyName ? academies.find(a => a.name === ev.academyName) : null;
        const safeTime = (ev.time && ev.time !== "null") ? ev.time : "09:00";
        const safeMemo = (ev.memo && ev.memo !== "null") ? ev.memo : "";
        const normalizedSelection = {
            familyAll: !!eventSelection?.familyAll,
            childIds: Array.isArray(eventSelection?.childIds) ? eventSelection.childIds.filter(Boolean) : [],
        };
        const scopedEventFields = {
            is_family_event: !!normalizedSelection.familyAll,
            child_ids: normalizedSelection.familyAll ? [] : [...normalizedSelection.childIds],
        };
        const newEv = {
            id: generateUUID(), title: ev.title, time: safeTime,
            category: ev.category || "other", emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: safeMemo,
            location: matchedAcademy?.location || null, notifOverride: null,
            ...scopedEventFields,
        };
        const dk = `${ev.year ?? currentDate.year}-${ev.month ?? currentDate.month}-${ev.day ?? currentDate.day}`;
        onSave(newEv, dk);
        if (familyId && authUser) {
            try {
                if (normalizedSelection.familyAll || normalizedSelection.childIds.length > 0) {
                    await saveEventWithChildren({ ...newEv, dateKey: dk, familyId, userId: authUser.id }, normalizedSelection);
                } else {
                    await insertEvent(newEv, familyId, dk, authUser.id);
                }
                const m = (ev.month ?? currentDate.month) + 1;
                const d = ev.day ?? currentDate.day;
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `새 일정: ${newEv.emoji} ${ev.title}`,
                    message: `${m}월 ${d}일 ${newEv.time}에 "${ev.title}" 일정이 추가됐어요`,
                });
            } catch (err) { console.error("[AiSchedule] save error:", err); }
        }
        setSavedIds(prev => new Set([...prev, idx]));
    };

    const saveAll = async () => {
        if (!results?.events) return;
        for (let i = 0; i < results.events.length; i++) {
            if (!savedIds.has(i)) await saveOne(results.events[i], i);
        }
        // 저장 후 모달 닫기 + 첫 번째 일정의 날짜로 이동
        const first = results.events[0];
        if (first && onNavigateDate) {
            onNavigateDate(first.year ?? currentDate.year, first.month ?? currentDate.month, first.day ?? currentDate.day);
        }
        onClose();
    };

    const btnSt = { width: 64, height: 64, borderRadius: 20, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: FF, fontWeight: 700, fontSize: 10 };

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "24px 20px 32px", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)" }}>일정 빠른 입력</div>
                    <button onClick={onClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* 3가지 입력 방식 버튼 */}
                {!results && !loading && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                        <button onClick={startVoiceInput}
                            style={{ ...btnSt, background: voiceListening ? "var(--theme-accent)" : "var(--hyeni-theme-gradient)", color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)", animation: voiceListening ? "pulse 1s infinite" : "none" }}>
                            <ThreeDIcon name="broadcast" size={22} aria-label="" />
                            {voiceListening ? "듣는 중..." : "말하기"}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ ...btnSt, background: "var(--hyeni-theme-gradient)", color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
                            <span style={{ fontSize: 24 }}>📷</span>
                            이미지
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: "none" }} />
                        <button onClick={() => document.getElementById("ai-text-input")?.focus()}
                            style={{ ...btnSt, background: DESIGN.gradients.primary, color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
                            <span style={{ fontSize: 24 }}>✏️</span>
                            텍스트
                        </button>
                    </div>
                )}

                {/* 텍스트 입력 */}
                <textarea id="ai-text-input"
                    value={inputText} onChange={e => setInputText(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="카톡 공지, 알림장 등을 붙여넣거나 직접 입력하세요..."
                    style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 14, border: "2px solid #E5E7EB", fontSize: 14, fontFamily: FF, resize: "none", boxSizing: "border-box", outline: "none" }}
                />

                {/* 이미지 미리보기 */}
                {imageData && (
                    <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
                        <img src={imageData} alt="첨부 이미지" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 12, border: "2px solid #E5E7EB" }} />
                        <button onClick={() => setImageData(null)} aria-label="이미지 제거" style={{ position: "absolute", top: -10, right: -10, width: 32, height: 32, borderRadius: "50%", background: "var(--status-negative)", color: "var(--fg-on-primary)", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                )}

                {/* 분석 버튼 */}
                <button onClick={() => analyze()} disabled={loading || (!inputText.trim() && !imageData)}
                    style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 16, border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: FF, color: "white", background: loading ? "#9CA3AF" : "var(--hyeni-theme-gradient)", boxShadow: loading ? "none" : "var(--hyeni-theme-shadow-soft)" }}>
                    {loading ? "🔍 일정을 정리하고 있어요..." : "✅ 다 입력했어요^^"}
                </button>

                {/* Results */}
                {results && results.action === "add_events" && results.events?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)" }}>📋 정리된 일정 ({results.events.length}건)</div>
                            <button onClick={saveAll} style={{ padding: "6px 14px", borderRadius: 12, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>모두 등록</button>
                        </div>
                        {results.events.map((ev, i) => {
                            const cat = CATS[ev.category] || CATS.other;
                            const saved = savedIds.has(i);
                            const m = ev.month != null ? ev.month + 1 : (currentDate.month + 1);
                            const d = ev.day ?? currentDate.day;
                            return (
                                <div key={i} style={{ background: saved ? "var(--status-positive-subtle)" : "var(--theme-accent-soft)", borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: saved ? "2px solid var(--status-positive)" : "1.5px solid var(--theme-accent-line)", opacity: saved ? 0.7 : 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 24 }}>{cat.emoji}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--fg-primary)" }}>{ev.title}</div>
                                            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>
                                                {m}월 {d}일 {(ev.time && ev.time !== "null") ? ev.time : "시간 미정"}
                                                {ev.memo && ev.memo !== "null" && ` · ${ev.memo}`}
                                            </div>
                                        </div>
                                        <button onClick={async () => {
                                            await saveOne(ev, i);
                                            if (onNavigateDate) onNavigateDate(ev.year ?? currentDate.year, ev.month ?? currentDate.month, ev.day ?? currentDate.day);
                                            onClose();
                                        }} disabled={saved}
                                            style={{ padding: "6px 12px", borderRadius: 10, background: saved ? "var(--status-positive-subtle)" : "var(--hyeni-theme-gradient)", color: saved ? "var(--status-positive-strong)" : "white", border: "none", fontSize: 11, fontWeight: 800, cursor: saved ? "default" : "pointer", fontFamily: FF, flexShrink: 0 }}>
                                            {saved ? "✓" : "등록"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {results && results.action === "unknown" && (
                    <div style={{ marginTop: 16, textAlign: "center", padding: 20, background: "var(--status-cautionary-subtle)", borderRadius: 16 }}>
                        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
                            <HyeniMascot variant="thinking" size={64} aria-label="" />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{results.message}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
