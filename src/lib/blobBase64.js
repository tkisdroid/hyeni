// src/lib/blobBase64.js
// Blob -> base64 (data URL의 data: 부분만 떼어 반환). FileReader 기반.
// Extracted from App.jsx (Phase 5 #4 / B24).

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
