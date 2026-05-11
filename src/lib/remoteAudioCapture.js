// src/lib/remoteAudioCapture.js
// 원격 오디오 캡처 — 자녀 기기에서 부모 요청에 따라 마이크 녹음 + Realtime broadcast.
// Native AmbientListen 플러그인 우선, fallback으로 WebView MediaRecorder.
// 세션 audit 행 (remote_listen_sessions) + window._remote* 전역 상태 관리.
// Extracted from App.jsx (Phase 5 #4 / B26).

import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";
import { blobToBase64 } from "./blobBase64.js";
import { isMissingNativePluginError } from "./errorChecks.js";
import { getAmbientListenPlugin } from "./nativePlugins.js";
import {
    REMOTE_AUDIO_CHUNK_MS,
    REMOTE_AUDIO_DEFAULT_DURATION_SEC,
    getRemoteAudioMimeType,
} from "./remoteAudio.js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Phase 5 · RL-01 / RL-04: close the current remote_listen_sessions row (if any)
// with ended_at / duration_ms / end_reason. Safe to call when no row exists — it
// silently no-ops. Uses window._remoteListenSessionId set by startRemoteAudioCapture.
export async function closeRemoteListenSessionRow(endReason) {
    const sessionId = window._remoteListenSessionId;
    if (!sessionId) return;
    window._remoteListenSessionId = null; // single-shot close
    const startedAtEpoch = window._remoteListenStartedAt || Date.now();
    const durationMs = Math.max(0, Date.now() - startedAtEpoch);
    window._remoteListenStartedAt = null;
    try {
        await supabase.from("remote_listen_sessions")
            .update({
                ended_at: new Date().toISOString(),
                duration_ms: durationMs,
                end_reason: endReason || "unspecified",
            })
            .eq("id", sessionId);
    } catch (err) {
        console.error("[RL-01] failed to close session row:", err);
    }
}

export function stopRemoteAudioCapture(endReason, options = {}) {
    if (window._remoteRecorderStopTimer) {
        clearTimeout(window._remoteRecorderStopTimer);
        window._remoteRecorderStopTimer = null;
    }
    if (window._remoteRecorder?.state === "recording") {
        try { window._remoteRecorder.stop(); } catch { /* ignore */ }
    }
    if (window._remoteStream) {
        try { window._remoteStream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
    }
    window._remoteRecorder = null;
    window._remoteStream = null;
    if (!options.skipNative) {
        void stopNativeRemoteAudioCapture(endReason);
    }
    // Phase 5 RL-01: close the session audit row. Fire-and-forget; errors logged.
    void closeRemoteListenSessionRow(endReason);
}

async function waitForRealtimeChannelReady(channel, timeoutMs = 20000) {
    if (!channel) throw new Error("Realtime channel unavailable");
    if (channel.state === "joined") return;

    await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (channel.state === "joined") {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                clearInterval(timer);
                reject(new Error("Realtime channel join timeout"));
            }
        }, 300);
    });
}

async function startNativeRemoteAudioCapture(durationSec, options = {}) {
    try {
        const AmbientListen = await getAmbientListenPlugin();
        if (!AmbientListen) return false;
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            throw new Error("Supabase config unavailable");
        }

        const session = await getSession().catch(() => null);
        await AmbientListen.start({
            userId: options.childUserId || "",
            familyId: options.familyId || "",
            initiatorUserId: options.initiatorUserId || "",
            requestId: options.requestId || "",
            supabaseUrl: SUPABASE_URL,
            supabaseKey: SUPABASE_KEY,
            accessToken: session?.access_token || "",
            durationSec: Math.max(5, durationSec || REMOTE_AUDIO_DEFAULT_DURATION_SEC),
        });
        console.log("[Audio] Native ambient listen service started");
        return true;
    } catch (error) {
        if (isMissingNativePluginError(error)) {
            console.warn("[Audio] Native ambient listen plugin unavailable, falling back to WebView recorder:", error?.message || error);
            return false;
        }
        throw error;
    }
}

async function stopNativeRemoteAudioCapture(endReason) {
    try {
        const AmbientListen = await getAmbientListenPlugin();
        if (!AmbientListen) return false;
        await AmbientListen.stop({ reason: endReason || "stopped" });
        return true;
    } catch (error) {
        if (!isMissingNativePluginError(error)) {
            console.warn("[Audio] Native ambient listen stop skipped:", error?.message || error);
        }
        return false;
    }
}

export async function startRemoteAudioCapture(channel, durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC, options = {}) {
    if (!channel) throw new Error("Realtime channel unavailable");

    const { familyId, initiatorUserId = null, childUserId = null, requestId = "" } = options;

    // Phase 5 D-B07: consult the remote_listen_enabled kill switch before
    // starting. If the flag is FALSE for this family, refuse to start and throw
    // — the child will never acquire getUserMedia and the parent receives
    // nothing. Flag is nullable / default true; only a hard FALSE disables.
    if (familyId) {
        try {
            const { data: flagRow } = await supabase
                .from("family_subscription")
                .select("remote_listen_enabled")
                .eq("family_id", familyId)
                .maybeSingle();
            if (flagRow && flagRow.remote_listen_enabled === false) {
                throw new Error("remote_listen_disabled_by_family");
            }
        } catch (err) {
            if (err?.message === "remote_listen_disabled_by_family") throw err;
            // Fetch errors are non-fatal — default behaviour is allowed.
            console.warn("[RL flag] lookup failed, defaulting to enabled:", err);
        }
    }

    await waitForRealtimeChannelReady(channel);
    stopRemoteAudioCapture("restart", { skipNative: true });
    await stopNativeRemoteAudioCapture("restart");
    const maxDurationMs = Math.max(5, durationSec || REMOTE_AUDIO_DEFAULT_DURATION_SEC) * 1000;

    // Phase 5 RL-01: open an audit row BEFORE the microphone capture begins, so
    // even a crash inside getUserMedia() leaves a started/never-ended row that
    // the beforeunload fallback can close on next boot.
    window._remoteListenSessionId = null;
    window._remoteListenStartedAt = Date.now();
    if (familyId) {
        try {
            const { data: sessionRow } = await supabase
                .from("remote_listen_sessions")
                .insert({
                    family_id: familyId,
                    initiator_user_id: initiatorUserId,
                    child_user_id: childUserId,
                    started_at: new Date().toISOString(),
                })
                .select("id")
                .single();
            if (sessionRow?.id) window._remoteListenSessionId = sessionRow.id;
        } catch (err) {
            console.error("[RL-01] failed to open session row:", err);
        }
    }

    const nativeStarted = await startNativeRemoteAudioCapture(durationSec, {
        familyId,
        initiatorUserId,
        childUserId,
        requestId,
    });
    if (nativeStarted) {
        window._remoteRecorderStopTimer = setTimeout(() => stopRemoteAudioCapture("timeout"), maxDurationMs);
        return true;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        void closeRemoteListenSessionRow("capture_unavailable");
        throw new Error("Audio capture unavailable");
    }
    if (typeof MediaRecorder === "undefined") {
        void closeRemoteListenSessionRow("recorder_unavailable");
        throw new Error("MediaRecorder unavailable");
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micErr) {
        // Mic denied / unavailable → close the session row we just opened.
        void closeRemoteListenSessionRow("permission_denied");
        throw micErr;
    }
    const mimeType = getRemoteAudioMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recorder.ondataavailable = async (event) => {
        if (!event.data?.size) return;
        try {
            const base64 = await blobToBase64(event.data);
            channel.send({
                type: "broadcast",
                event: "audio_chunk",
                payload: {
                    data: base64,
                    mimeType: event.data.type || mimeType || "audio/webm",
                    durationMs: REMOTE_AUDIO_CHUNK_MS,
                    requestId,
                    source: "web-mediarecorder",
                }
            });
        } catch (error) {
            console.error("[Audio] Failed to encode/send chunk:", error);
        }
    };

    recorder.onstop = () => {
        if (window._remoteStream === stream) {
            try { stream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
            window._remoteStream = null;
        }
        if (window._remoteRecorder === recorder) {
            window._remoteRecorder = null;
        }
    };

    recorder.start(REMOTE_AUDIO_CHUNK_MS);
    window._remoteRecorder = recorder;
    window._remoteStream = stream;
    window._remoteRecorderStopTimer = setTimeout(() => stopRemoteAudioCapture("timeout"), maxDurationMs);
    return true;
}
