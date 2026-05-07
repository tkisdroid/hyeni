// src/components/audio/AmbientAudioRecorder.jsx
// 부모 → 자녀 원격 청취 (주변 소리 듣기) 모달.
// FCM push로 자녀 앱 깨운 뒤 Realtime broadcast로 audio chunk 수신 → WebAudio 재생.
// Premium-only · 최대 1분.
// Extracted from App.jsx (Phase 5 #4 / B12).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateUUID } from "../../lib/auth.js";
import { sendBroadcastWhenReady } from "../../lib/realtime.js";
import { sendInstantPush } from "../../lib/instantPush.js";
import {
    summarizeRemoteListenHealth,
    resolveChildRemoteListenHealth,
} from "../../lib/remoteListenHealth.js";
import { buildSelectedChildCommandPayload } from "../../lib/selectedChildIsolation.js";
import {
    REMOTE_AUDIO_CHUNK_MS,
    REMOTE_AUDIO_DEFAULT_DURATION_SEC,
    REMOTE_AUDIO_LEVEL_BARS,
    REMOTE_AUDIO_WAITING_HELP_MS,
} from "../../lib/remoteAudio.js";
import { DESIGN, FF, makeCardStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";

export function AmbientAudioRecorder({ channel, familyId: recFamilyId, senderUserId, onClose, pairedChildren = [], targetChildUserId = null, childDeviceStatusMap = {} }) {
    const [status, setStatus] = useState("idle"); // idle, pushing, auto_waking_child, waiting_for_child_notification, listening, failed
    const [duration, setDuration] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    const [, setAudioChunks] = useState([]);
    const timerRef = useRef(null);
    const playbackRef = useRef(Promise.resolve());
    const audioContextRef = useRef(null);
    const nextPlayAtRef = useRef(0);
    const remoteAudioCurrentRequestIdRef = useRef(null);
    const remoteAudioCurrentTargetUserIdRef = useRef(null);
    const remoteAudioSeenChunksRef = useRef(new Set());
    const startInFlightRef = useRef(false);
    const playbackGenerationRef = useRef(0);
    const activeSourcesRef = useRef(new Set());
    const activeAudioElementsRef = useRef(new Set());
    const remoteAudioWaitingHintTimerRef = useRef(null);
    const remoteListenDiagnostics = useMemo(() => {
        const children = (Array.isArray(pairedChildren) ? pairedChildren : [])
            .filter((c) => c?.role === "child" && c?.user_id);
        const targets = targetChildUserId
            ? children.filter((c) => c.user_id === targetChildUserId)
            : children;
        return targets.flatMap((child) => {
            const summary = summarizeRemoteListenHealth(resolveChildRemoteListenHealth(child, childDeviceStatusMap));
            if (summary.ready && summary.advisory.length === 0) return [];
            if (!summary.hasReport) {
                return [{
                    childName: child.name || "아이",
                    severity: "advisory",
                    label: "아이 기기 상태 미보고",
                    detail: "자녀 앱이 아직 권한/기기 상태를 보고하지 않았지만 연결은 시도할 수 있어요.",
                }];
            }
            return [...summary.blockers, ...summary.advisory].map((item) => ({
                childName: child.name || "아이",
                severity: item.severity || "advisory",
                label: item.label,
                detail: item.detail,
            }));
        });
    }, [pairedChildren, targetChildUserId, childDeviceStatusMap]);

    const clearRemoteAudioWaitingHint = useCallback(() => {
        if (remoteAudioWaitingHintTimerRef.current) {
            clearTimeout(remoteAudioWaitingHintTimerRef.current);
            remoteAudioWaitingHintTimerRef.current = null;
        }
    }, []);

    const stopActivePlayback = useCallback(() => {
        playbackGenerationRef.current += 1;
        nextPlayAtRef.current = 0;
        for (const source of activeSourcesRef.current) {
            try { source.stop(0); } catch { /* source may already be stopped */ }
        }
        activeSourcesRef.current.clear();
        for (const audio of activeAudioElementsRef.current) {
            try {
                audio.pause();
                audio.src = "";
                audio.load?.();
            } catch { /* ignore stopped fallback audio */ }
        }
        activeAudioElementsRef.current.clear();
        playbackRef.current = Promise.resolve();
    }, []);

    const startListening = async () => {
        if (startInFlightRef.current || (status !== "idle" && status !== "failed")) return;
        setErrorMessage("");
        if (!recFamilyId || !senderUserId) {
            setErrorMessage("가족 연결 정보가 없어 주변음성듣기를 시작할 수 없어요.");
            setStatus("failed");
            return;
        }
        // Pre-flight on the published device_health snapshot so we can warn
        // before sending an FCM that the child can't act on. We do NOT block —
        // the child's snapshot may be stale, and force-stopping a parent who
        // accepts the risk is worse UX. Show the missing items, then continue.
        const preflightChildren = (Array.isArray(pairedChildren) ? pairedChildren : [])
            .filter((c) => c?.role === "child" && c?.user_id);
        const targetCandidates = targetChildUserId
            ? preflightChildren.filter((c) => c.user_id === targetChildUserId)
            : preflightChildren;
        if (targetCandidates.length > 0) {
            const blockedNames = [];
            for (const c of targetCandidates) {
                const summary = summarizeRemoteListenHealth(resolveChildRemoteListenHealth(c, childDeviceStatusMap));
                if (summary.blockers.length > 0) {
                    const detail = summary.blockers.map((s) => s.label).join(", ");
                    blockedNames.push(`${c.name || "아이"} (${detail})`);
                }
            }
            if (blockedNames.length > 0) {
                setErrorMessage(
                    "아이 기기 설정 확인 필요: " + blockedNames.join(" / ") +
                    ". 권한이나 네트워크가 복구되면 다시 연결을 시도할 수 있어요."
                );
            }
        }
        startInFlightRef.current = true;
        stopActivePlayback();
        const durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC;
        const requestId = generateUUID();
        const targetPayload = buildSelectedChildCommandPayload({ selectedChild: { user_id: targetChildUserId } });
        remoteAudioCurrentRequestIdRef.current = requestId;
        remoteAudioCurrentTargetUserIdRef.current = targetPayload.targetUserId || null;
        remoteAudioSeenChunksRef.current.clear();
        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (AudioContextCtor && !audioContextRef.current) {
                audioContextRef.current = new AudioContextCtor();
            }
            audioContextRef.current?.resume?.();
            nextPlayAtRef.current = audioContextRef.current?.currentTime || 0;
        } catch (error) {
            console.warn("[Audio] AudioContext unlock failed:", error?.message || error);
        }
        setStatus("pushing");
        setDuration(0);
        setAudioChunks([]);
        clearRemoteAudioWaitingHint();
        remoteAudioWaitingHintTimerRef.current = setTimeout(() => {
            setStatus(prev => (prev === "listening" || prev === "idle" ? prev : "waiting_for_child_notification"));
            setErrorMessage(prev => prev || "연결까지 시간이 오래 걸리고 있어요. 아이 기기 화면을 깨우거나 알림을 확인해 주세요.");
        }, REMOTE_AUDIO_WAITING_HELP_MS);
        // 1. Broadcast for when child app is already open
        const startPayload = {
            duration: durationSec,
            durationSec,
            initiatorUserId: senderUserId,
            initiator_user_id: senderUserId,
            requestId,
            targetRole: "child",
            ...targetPayload,
        };
        // 2. FCM push to wake up child app if closed
        let pushPromise = Promise.resolve();
        try {
            pushPromise = sendInstantPush({
                action: "remote_listen",
                familyId: recFamilyId,
                senderUserId,
                title: "",
                message: "",
                durationSec,
                requestId,
                targetRole: "child",
                ...targetPayload,
                idempotencyKey: requestId,
            });
            setStatus("auto_waking_child");
            const realtimeSent = await sendBroadcastWhenReady(
                channel,
                "remote_listen_start",
                startPayload,
                { timeoutMs: 4000, pollMs: 80 }
            );
            if (!realtimeSent) {
                // Channel wasn't joined yet on parent side. Stay in "auto_waking_child"
                // so the user sees "연결 시도 중" instead of the alarming "OS blocked"
                // copy — the child app may still wake up via the FCM push and the
                // first audio chunk will flip status to "listening" naturally.
            }
        } catch (error) {
            console.warn("[Audio] remote_listen_start broadcast failed:", error?.message || error);
            // Same rationale as above — keep optimistic state.
        } finally {
            await pushPromise.catch((error) => {
                console.warn("[Audio] remote listen push failed:", error?.message || error);
                setStatus(prev => (prev === "listening" ? prev : "failed"));
                setErrorMessage("연결 요청 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
            });
            startInFlightRef.current = false;
        }
        timerRef.current = setTimeout(() => stopListening(), (durationSec + 5) * 1000);
    };

    const stopListening = () => {
        startInFlightRef.current = false;
        clearRemoteAudioWaitingHint();
        const requestId = remoteAudioCurrentRequestIdRef.current;
        const stopTargetPayload = buildSelectedChildCommandPayload({
            selectedChild: { user_id: remoteAudioCurrentTargetUserIdRef.current || targetChildUserId || null },
        });
        const targetUserId = remoteAudioCurrentTargetUserIdRef.current || targetChildUserId || null;
        if (channel) channel.send({ type: "broadcast", event: "remote_listen_stop", payload: { requestId, ...stopTargetPayload } });
        if (recFamilyId && senderUserId && requestId) {
            void sendInstantPush({
                action: "remote_listen_stop",
                familyId: recFamilyId,
                senderUserId,
                title: "",
                message: "",
                requestId,
                targetRole: "child",
                targetUserId,
                idempotencyKey: `${requestId}:stop`,
            });
        }
        setErrorMessage("");
        setStatus("idle");
        stopActivePlayback();
        remoteAudioCurrentRequestIdRef.current = null;
        remoteAudioCurrentTargetUserIdRef.current = null;
        remoteAudioSeenChunksRef.current.clear();
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch { /* ignore */ }
            audioContextRef.current = null;
        }
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    // Play received audio chunk
    const playChunk = useCallback((base64, mimeType) => {
        const playbackGeneration = playbackGenerationRef.current;
        playbackRef.current = playbackRef.current
            .catch(() => {})
            .then(async () => {
                try {
                    if (playbackGeneration !== playbackGenerationRef.current) return;
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const audioContext = audioContextRef.current;

                    // Native AmbientListenService (Android) sends PCM 16 LE
                    // wrapped in WAV. Web Audio createBuffer + BufferSource
                    // played but routed to a stream that did not respect the
                    // device media-volume slider on Capacitor WebView, so
                    // chunks scheduled correctly yet produced silence.
                    // HTMLAudioElement plays through STREAM_MUSIC and follows
                    // the media-volume slider — switch to it for native WAV.
                    const looksWav =
                        (typeof mimeType === "string" && mimeType.includes("wav"))
                        || (bytes.length > 44
                            && bytes[0] === 0x52 && bytes[1] === 0x49
                            && bytes[2] === 0x46 && bytes[3] === 0x46);
                    if (looksWav) {
                        const blob = new Blob([bytes], { type: "audio/wav" });
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio();
                        audio.preload = "auto";
                        audio.src = url;
                        activeAudioElementsRef.current.add(audio);
                        await new Promise((resolve) => {
                            const cleanup = () => {
                                activeAudioElementsRef.current.delete(audio);
                                audio.onended = null;
                                audio.onerror = null;
                                URL.revokeObjectURL(url);
                            };
                            audio.onended = () => { cleanup(); resolve(); };
                            audio.onerror = (e) => {
                                console.warn("[Audio] <audio> playback error", e?.message || "");
                                cleanup();
                                resolve();
                            };
                            if (playbackGeneration !== playbackGenerationRef.current) {
                                cleanup();
                                resolve();
                                return;
                            }
                            const p = audio.play();
                            if (p?.catch) {
                                p.catch((err) => {
                                    console.warn("[Audio] <audio>.play() rejected:", err?.message || err);
                                    cleanup();
                                    resolve();
                                });
                            }
                        });
                        return;
                    }

                    if (audioContext && audioContext.state !== "closed") {
                        if (playbackGeneration !== playbackGenerationRef.current) return;
                        if (audioContext.state === "suspended") {
                            await audioContext.resume();
                        }

                        try {
                            if (playbackGeneration !== playbackGenerationRef.current) return;
                            const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                            if (playbackGeneration !== playbackGenerationRef.current) return;
                            const source = audioContext.createBufferSource();
                            const startAt = Math.max(audioContext.currentTime + 0.02, nextPlayAtRef.current || 0);
                            nextPlayAtRef.current = startAt + audioBuffer.duration;
                            source.buffer = audioBuffer;
                            source.connect(audioContext.destination);
                            activeSourcesRef.current.add(source);
                            source.onended = () => activeSourcesRef.current.delete(source);
                            source.start(startAt);
                            return;
                        } catch (webAudioError) {
                            console.warn("[Audio] WebAudio playback fallback:", webAudioError?.message || webAudioError);
                        }
                    }
                    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    activeAudioElementsRef.current.add(audio);
                    // Always resolve — rejecting here breaks the sequential
                    // playbackRef chain and silently drops every subsequent
                    // chunk. Errors are surfaced via console.warn instead.
                    await new Promise((resolve) => {
                        const cleanup = () => {
                            activeAudioElementsRef.current.delete(audio);
                            audio.onended = null;
                            audio.onerror = null;
                            URL.revokeObjectURL(url);
                        };
                        audio.onended = () => { cleanup(); resolve(); };
                        audio.onerror = (err) => {
                            console.warn("[Audio] <audio> fallback playback error:", err?.message || "");
                            cleanup();
                            resolve();
                        };
                        if (playbackGeneration !== playbackGenerationRef.current) {
                            cleanup();
                            resolve();
                            return;
                        }
                        const playPromise = audio.play();
                        if (playPromise?.catch) {
                            playPromise.catch((error) => {
                                console.warn("[Audio] <audio> fallback play() rejected:", error?.message || error);
                                cleanup();
                                resolve();
                            });
                        }
                    });
                } catch (e) {
                    console.warn("[Audio] chunk play error:", e?.message || e);
                }
            });
    }, []);

    // Listen for audio chunks via custom event from Realtime
    useEffect(() => {
        const handleChunk = (e) => {
            if (status === "idle") return;
            const detail = e.detail || {};
            const currentRequestId = remoteAudioCurrentRequestIdRef.current;
            if (detail.requestId && currentRequestId && detail.requestId !== currentRequestId) return;
            const sequence = Number.isFinite(Number(detail.sequenceNumber)) ? Number(detail.sequenceNumber) : "";
            const fallbackSource = detail.source || detail.mimeType || "audio";
            const chunkKey = [
                detail.requestId || currentRequestId || "legacy",
                detail.childUserId || "",
                sequence === "" ? fallbackSource : "seq",
                sequence === "" ? String(detail.data || "").slice(0, 96) : sequence,
            ].join(":");
            if (remoteAudioSeenChunksRef.current.has(chunkKey)) return;
            remoteAudioSeenChunksRef.current.add(chunkKey);
            if (remoteAudioSeenChunksRef.current.size > 180) {
                remoteAudioSeenChunksRef.current = new Set(Array.from(remoteAudioSeenChunksRef.current).slice(-120));
            }
            clearRemoteAudioWaitingHint();
            setErrorMessage("");
            setStatus("listening");
            const chunkMs = Number(detail?.durationMs) || REMOTE_AUDIO_CHUNK_MS;
            setDuration(d => d + Math.max(1, Math.round(chunkMs / 1000)));
            setAudioChunks(prev => [...prev, detail]);
            playChunk(detail.data, detail.mimeType);
        };
        window.addEventListener("remote-audio-chunk", handleChunk);
        return () => window.removeEventListener("remote-audio-chunk", handleChunk);
    }, [status, playChunk, clearRemoteAudioWaitingHint]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearRemoteAudioWaitingHint();
            stopActivePlayback();
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch { /* ignore */ }
                audioContextRef.current = null;
            }
        };
    }, [stopActivePlayback, clearRemoteAudioWaitingHint]);

    const isConnecting = status === "pushing" || status === "auto_waking_child" || status === "waiting_for_child_notification";
    const canStartListening = status === "idle" || status === "failed";
    const showRemoteListenDiagnostics = status !== "listening" && remoteListenDiagnostics.length > 0;
    const statusCopy = {
        idle: { icon: "🎤", title: "주변 소리 듣기", description: "프리미엄 회원은 아이 기기의 마이크를 1분간 원격으로 켜서 주변 소리를 들을 수 있어요", hint: "" },
        pushing: { icon: "📡", title: "연결 요청 전송 중", description: "아이 기기에 FCM 요청을 보내고 있어요", hint: "잠시만 기다려 주세요." },
        auto_waking_child: { icon: "📲", title: "아이 기기 자동 연결 시도 중", description: "전체화면 연결 화면을 자동으로 띄우고 있어요", hint: "기기 상태에 따라 몇 초 걸릴 수 있어요." },
        waiting_for_child_notification: { icon: "🔔", title: "아이 기기 응답 대기 중", description: "아이 기기에 알림이 도착했어요. 화면을 깨우면 즉시 연결됩니다", hint: "1분 이상 응답이 없으면 잠금화면 알림이나 배터리 제한 설정을 확인해 주세요." },
        listening: { icon: "🔊", title: "아이 주변 소리 듣는 중...", description: `${duration}초 수신 중`, hint: "" },
        failed: { icon: "⚠️", title: "연결 요청 실패", description: "네트워크 또는 권한 상태를 확인한 뒤 다시 시도해 주세요", hint: "" },
    }[status] || { icon: "🎤", title: "주변 소리 듣기", description: "", hint: "" };

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget && status === "idle") onClose(); }}>
            <div style={makeCardStyle({ padding: "24px 20px", width: "90%", maxWidth: 360, textAlign: "center" })}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{statusCopy.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)", marginBottom: 8 }}>
                    {statusCopy.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 16 }}>
                    {statusCopy.description}
                </div>
                {status === "listening" && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            {REMOTE_AUDIO_LEVEL_BARS.map((height, i) => <div key={i} style={{ width: 4, height, background: "var(--status-cautionary-strong)", borderRadius: 2, animation: "pulse 0.5s infinite", animationDelay: `${i * 0.1}s` }} />)}
                        </div>
                    </div>
                )}
                {isConnecting && statusCopy.hint && (
                    <div style={{ marginBottom: 16, fontSize: 12, color: "var(--status-cautionary)", fontWeight: 700, lineHeight: 1.45 }}>{statusCopy.hint}</div>
                )}
                {errorMessage && (
                    <div role="alert" style={{ marginBottom: 16, fontSize: 12, color: "var(--status-cautionary-strong)", fontWeight: 800, lineHeight: 1.45 }}>
                        {errorMessage}
                    </div>
                )}
                {showRemoteListenDiagnostics && (
                    <div
                        aria-label="아이 기기 원격 듣기 진단"
                        style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 7, textAlign: "left" }}
                    >
                        {remoteListenDiagnostics.map((item, idx) => (
                            <div
                                key={`${item.childName}-${item.label}-${idx}`}
                                style={{
                                    borderRadius: 12,
                                    background: item.severity === "blocker" ? "var(--status-cautionary-subtle)" : "var(--bg-muted)",
                                    border: item.severity === "blocker" ? "1px solid #FCD34D" : "1px solid var(--line-soft)",
                                    padding: "8px 10px",
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 900, color: item.severity === "blocker" ? "var(--status-cautionary-strong)" : "var(--fg-primary)" }}>
                                    {item.childName} · {item.severity === "blocker" ? "설정 필요" : "참고"} · {item.label}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: item.severity === "blocker" ? "#8A5A00" : "var(--fg-secondary)", lineHeight: 1.35 }}>
                                    {item.detail}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    {canStartListening && (
                        <button onClick={startListening}
                            style={{ flex: 1, padding: "14px", background: DESIGN.gradients.primary, color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            {status === "failed" ? "다시 시도" : "🎙️ 듣기 시작"}
                        </button>
                    )}
                    {(status === "listening" || isConnecting) && (
                        <button onClick={stopListening}
                            style={{ flex: 1, padding: "14px", background: "#374151", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            ⏹️ 중지
                        </button>
                    )}
                    <button onClick={() => { stopListening(); onClose(); }}
                        style={{ padding: "14px 20px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 12 }}>최대 1분 · 프리미엄 전용 · 아이의 안전을 위해 사용해주세요</div>
            </div>
        </div>
    );
}
