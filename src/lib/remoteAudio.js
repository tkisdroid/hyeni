// src/lib/remoteAudio.js
// 원격 청취(주변 소리 듣기) 관련 상수 + MIME helper.
// 부모(AmbientAudioRecorder) + 자녀(startRemoteAudioCapture) 양쪽에서 import.
// Extracted from App.jsx (Phase 5 #4 / B12).

export const REMOTE_AUDIO_CHUNK_MS = 1000;
export const REMOTE_AUDIO_DEFAULT_DURATION_SEC = 60;
export const REMOTE_AUDIO_WAITING_HELP_MS = 25_000;
export const REMOTE_AUDIO_LEVEL_BARS = [12, 18, 24, 20, 16];
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
