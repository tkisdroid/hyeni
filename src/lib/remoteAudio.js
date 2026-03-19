export const REMOTE_AUDIO_CHUNK_MS = 2000;
export const REMOTE_AUDIO_DEFAULT_DURATION_SEC = 30;
export const REMOTE_AUDIO_MIME_TYPES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
];

export function getRemoteAudioMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return REMOTE_AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

export function stopRemoteAudioCapture() {
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
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
            if (!result) {
                reject(new Error("Failed to encode audio chunk"));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(reader.error || new Error("FileReader error"));
        reader.readAsDataURL(blob);
    });
}

export async function waitForRealtimeChannelReady(channel, timeoutMs = 20000) {
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

export async function startRemoteAudioCapture(channel, durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC) {
    if (!channel) throw new Error("Realtime channel unavailable");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Audio capture unavailable");
    if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder unavailable");

    await waitForRealtimeChannelReady(channel);
    stopRemoteAudioCapture();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getRemoteAudioMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const maxDurationMs = Math.max(5, durationSec || REMOTE_AUDIO_DEFAULT_DURATION_SEC) * 1000;

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
    window._remoteRecorderStopTimer = setTimeout(() => stopRemoteAudioCapture(), maxDurationMs);
    return true;
}
