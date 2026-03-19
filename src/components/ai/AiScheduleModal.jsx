import { useState, useRef } from "react";
import { FF, SUPABASE_URL, SUPABASE_KEY, sendInstantPush } from "../../lib/utils.js";
import { getSession, generateUUID } from "../../lib/auth.js";
import { insertEvent } from "../../lib/sync.js";

function AiScheduleModal({ academies, currentDate, familyId, authUser, eventMap, onSave, onClose, startVoiceFn, onNavigateDate }) {
    const [inputText, setInputText] = useState("");
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [results, setResults] = useState(null);
    const [savedIds, setSavedIds] = useState(new Set());
    const fileInputRef = useRef(null);
    const currentDateKey = `${currentDate.year}-${currentDate.month}-${currentDate.day}`;

    // 이미지 압축: max 1280px, JPEG 0.7 품질 (~100-300KB)
    const compressImage = (file) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 1280;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
                const ratio = Math.min(MAX / width, MAX / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = () => reject(new Error("이미지를 읽을 수 없어요"));
        img.src = URL.createObjectURL(file);
    });

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                compressImage(file).then(setImageData).catch(() => {});
                return;
            }
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        compressImage(file).then(setImageData).catch(() => {});
    };

    // Voice input — native SpeechPlugin first, then Web Speech API fallback
    const startVoiceInput = async () => {
        // Try native Capacitor SpeechRecognition (Android WebView)
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const SpeechRecognition = registerPlugin("SpeechRecognition");
                setVoiceListening(true);
                try {
                    const result = await SpeechRecognition.start({ language: "ko-KR" });
                    setVoiceListening(false);
                    const transcript = result?.transcript || "";
                    if (transcript) {
                        setInputText(prev => prev ? prev + "\n" + transcript : transcript);
                    }
                } catch (err) {
                    setVoiceListening(false);
                    console.error("[AiSchedule] native speech error:", err);
                }
                return;
            }
        } catch { /* not native platform */ }

        // Fallback: Web Speech API (Chrome browser)
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
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
            const todayEvs = (eventMap?.[currentDateKey] || []).map(e => ({ id: e.id, title: e.title, time: e.time, memo: e.memo || "" }));
            const body = JSON.stringify({
                text: t || "이미지에서 일정을 추출해주세요",
                image: img || undefined,
                mode: "paste",
                academies: academies.map(a => ({ name: a.name, category: a.category })),
                todayEvents: todayEvs,
                currentDate,
            });
            const bodySizeMB = new Blob([body]).size / (1024 * 1024);
            if (bodySizeMB > 4) throw new Error("이미지가 너무 커요. 더 작은 이미지를 사용해주세요");
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_KEY },
                body,
            });
            if (!resp.ok) {
                const status = resp.status;
                if (status === 413) throw new Error("이미지가 너무 커요");
                if (status === 504) throw new Error("분석 시간 초과. 다시 시도해주세요");
                throw new Error(`서버 오류 (${status})`);
            }
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
            setResults({ action: "unknown", message: "AI 분석 실패: " + err.message });
        } finally { setLoading(false); }
    };

    const CATS = { school: { emoji: "📚", color: "#E879A0", bg: "#FFF0F5" }, sports: { emoji: "⚽", color: "#F59E0B", bg: "#FFFBEB" }, hobby: { emoji: "🎨", color: "#8B5CF6", bg: "#F5F3FF" }, family: { emoji: "👨‍👩‍👧", color: "#10B981", bg: "#ECFDF5" }, friend: { emoji: "👫", color: "#3B82F6", bg: "#EFF6FF" }, other: { emoji: "📌", color: "#6B7280", bg: "#F9FAFB" } };

    const saveOne = async (ev, idx) => {
        if (savedIds.has(idx)) return;
        const cat = CATS[ev.category] || CATS.other;
        const matchedAcademy = ev.academyName ? academies.find(a => a.name === ev.academyName) : null;
        const safeTime = (ev.time && ev.time !== "null") ? ev.time : "09:00";
        const safeMemo = (ev.memo && ev.memo !== "null") ? ev.memo : "";
        const dk = `${ev.year ?? currentDate.year}-${ev.month ?? currentDate.month}-${ev.day ?? currentDate.day}`;
        const newEv = {
            id: generateUUID(), title: ev.title, time: safeTime,
            category: ev.category || "other", emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: safeMemo,
            location: matchedAcademy?.location || null, notifOverride: null,
        };
        const existingOnDate = (eventMap?.[dk] || []).some(existing => existing.title === newEv.title && existing.time === newEv.time);
        if (existingOnDate) {
            setSavedIds(prev => new Set([...prev, idx]));
            return;
        }
        onSave(newEv, dk);
        if (familyId && authUser) {
            try {
                await insertEvent(newEv, familyId, dk, authUser.id);
                const m = (ev.month ?? currentDate.month) + 1;
                const d = ev.day ?? currentDate.day;
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `🤖 새 일정: ${newEv.emoji} ${ev.title}`,
                    message: `${m}월 ${d}일 ${newEv.time}에 "${ev.title}" 일정이 추가됐어요 (AI)`,
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>🤖 AI로 일정입력</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* 3가지 입력 방식 버튼 */}
                {!results && !loading && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                        <button onClick={startVoiceInput}
                            style={{ ...btnSt, background: voiceListening ? "#E879A0" : "linear-gradient(135deg,#F9A8D4,#E879A0)", color: "white", boxShadow: "0 4px 12px rgba(232,121,160,0.3)", animation: voiceListening ? "pulse 1s infinite" : "none" }}>
                            <span style={{ fontSize: 24 }}>🎤</span>
                            {voiceListening ? "듣는 중..." : "음성"}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ ...btnSt, background: "linear-gradient(135deg,#93C5FD,#3B82F6)", color: "white", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
                            <span style={{ fontSize: 24 }}>📷</span>
                            이미지
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
                        <button onClick={() => document.getElementById("ai-text-input")?.focus()}
                            style={{ ...btnSt, background: "linear-gradient(135deg,#A78BFA,#7C3AED)", color: "white", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
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
                        <button onClick={() => setImageData(null)} style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#EF4444", color: "white", border: "none", fontSize: 12, cursor: "pointer", fontWeight: 800 }}>✕</button>
                    </div>
                )}

                {/* 분석 버튼 */}
                <button onClick={() => analyze()} disabled={loading || (!inputText.trim() && !imageData)}
                    style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 16, border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: FF, color: "white", background: loading ? "#9CA3AF" : "linear-gradient(135deg, #8B5CF6, #6D28D9)", boxShadow: loading ? "none" : "0 4px 16px rgba(109,40,217,0.3)" }}>
                    {loading ? "🔍 AI가 분석하고 있어요..." : "✅ 다 입력했어요^^"}
                </button>

                {/* Results */}
                {results && results.action === "add_events" && results.events?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>📋 추출된 일정 ({results.events.length}건)</div>
                            <button onClick={saveAll} style={{ padding: "6px 14px", borderRadius: 12, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>모두 등록</button>
                        </div>
                        {results.events.map((ev, i) => {
                            const cat = CATS[ev.category] || CATS.other;
                            const saved = savedIds.has(i);
                            const m = ev.month != null ? ev.month + 1 : (currentDate.month + 1);
                            const d = ev.day ?? currentDate.day;
                            return (
                                <div key={i} style={{ background: saved ? "#F0FDF4" : cat.bg, borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: saved ? "2px solid #6EE7B7" : `1.5px solid #E5E7EB`, opacity: saved ? 0.7 : 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 24 }}>{cat.emoji}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{ev.title}</div>
                                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                                {m}월 {d}일 {(ev.time && ev.time !== "null") ? ev.time : "시간 미정"}
                                                {ev.memo && ev.memo !== "null" && ` · ${ev.memo}`}
                                            </div>
                                        </div>
                                        <button onClick={async () => {
                                            await saveOne(ev, i);
                                            if (onNavigateDate) onNavigateDate(ev.year ?? currentDate.year, ev.month ?? currentDate.month, ev.day ?? currentDate.day);
                                            onClose();
                                        }} disabled={saved}
                                            style={{ padding: "6px 12px", borderRadius: 10, background: saved ? "#D1FAE5" : cat.color, color: saved ? "#065F46" : "white", border: "none", fontSize: 11, fontWeight: 800, cursor: saved ? "default" : "pointer", fontFamily: FF, flexShrink: 0 }}>
                                            {saved ? "✓" : "등록"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {results && results.action === "unknown" && (
                    <div style={{ marginTop: 16, textAlign: "center", padding: 20, background: "#FEF3C7", borderRadius: 16 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>{results.message}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AiScheduleModal;
