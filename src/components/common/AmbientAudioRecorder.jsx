import { useState, useRef, useEffect, useCallback } from "react";
import { FF, sendInstantPush } from "../../lib/utils.js";

function AmbientAudioRecorder({ channel, familyId: recFamilyId, senderUserId, onClose }) {
    const [status, setStatus] = useState("idle"); // idle, waiting, listening
    const [duration, setDuration] = useState(0);
    const [, setAudioChunks] = useState([]);
    const timerRef = useRef(null);
    const playbackRef = useRef(Promise.resolve());
    const waveHeights = [18, 24, 16, 28, 20];

    const startListening = () => {
        if (!channel) return;
        setStatus("waiting");
        setDuration(0);
        setAudioChunks([]);
        // 1. Broadcast for when child app is already open
        channel.send({ type: "broadcast", event: "remote_listen_start", payload: { duration: 30 } });
        // 2. FCM push to wake up child app if closed
        sendInstantPush({ action: "remote_listen", familyId: recFamilyId || "", senderUserId: senderUserId || "", title: "", message: "" });
        timerRef.current = setTimeout(() => stopListening(), 35000);
    };

    const stopListening = () => {
        if (channel) channel.send({ type: "broadcast", event: "remote_listen_stop", payload: {} });
        setStatus("idle");
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    // Play received audio chunk
    const playChunk = useCallback((base64, mimeType) => {
        playbackRef.current = playbackRef.current
            .catch(() => {})
            .then(async () => {
                try {
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    await new Promise((resolve, reject) => {
                        const cleanup = () => {
                            audio.onended = null;
                            audio.onerror = null;
                            URL.revokeObjectURL(url);
                        };
                        audio.onended = () => { cleanup(); resolve(); };
                        audio.onerror = () => { cleanup(); reject(new Error("audio playback failed")); };
                        const playPromise = audio.play();
                        if (playPromise?.catch) {
                            playPromise.catch((error) => {
                                cleanup();
                                reject(error);
                            });
                        }
                    });
                } catch (e) {
                    console.log("[Audio] chunk play error:", e.message);
                }
            });
    }, []);

    // Listen for audio chunks via custom event from Realtime
    useEffect(() => {
        const handleChunk = (e) => {
            if (status === "idle") return;
            setStatus("listening");
            setDuration(d => d + 2);
            setAudioChunks(prev => [...prev, e.detail]);
            playChunk(e.detail.data, e.detail.mimeType);
        };
        window.addEventListener("remote-audio-chunk", handleChunk);
        return () => window.removeEventListener("remote-audio-chunk", handleChunk);
    }, [status, playChunk]);

    useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget && status === "idle") onClose(); }}>
            <div style={{ background: "white", borderRadius: 28, padding: "24px 20px", width: "90%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{status === "listening" ? "🔊" : status === "waiting" ? "📡" : "🎤"}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#374151", marginBottom: 8 }}>
                    {status === "listening" ? "아이 주변 소리 듣는 중..." : status === "waiting" ? "아이 기기 연결 중..." : "주변 소리 듣기"}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
                    {status === "idle" ? "아이 기기의 마이크를 원격으로 켜서 주변 소리를 들을 수 있어요" : status === "waiting" ? "연결 대기 중" : `${duration}초 수신 중`}
                </div>
                {status === "listening" && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            {waveHeights.map((height, i) => <div key={i} style={{ width: 4, height, background: "#DC2626", borderRadius: 2, animation: "pulse 0.5s infinite", animationDelay: `${i * 0.1}s` }} />)}
                        </div>
                    </div>
                )}
                {status === "waiting" && (
                    <div style={{ marginBottom: 16, fontSize: 12, color: "#F59E0B", fontWeight: 700 }}>아이 기기를 깨우고 연결 중입니다. 몇 초 걸릴 수 있어요.</div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    {status === "idle" && (
                        <button onClick={startListening}
                            style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🎙️ 듣기 시작
                        </button>
                    )}
                    {(status === "listening" || status === "waiting") && (
                        <button onClick={stopListening}
                            style={{ flex: 1, padding: "14px", background: "#374151", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            ⏹️ 중지
                        </button>
                    )}
                    <button onClick={() => { stopListening(); onClose(); }}
                        style={{ padding: "14px 20px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>최대 30초 · 아이의 안전을 위해 사용해주세요</div>
            </div>
        </div>
    );
}

export default AmbientAudioRecorder;
