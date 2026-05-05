// src/lib/instantPush.js
// FCM/APNS 푸시 즉시 전송 helper.
// Idempotency-Key 헤더 + 800ms 1회 retry. push_idempotency 서버 dedup 의존.
// Extracted from App.jsx (Phase 5 #4 / B10).

import { getSession } from "./auth.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";

export function createPushIdempotencyKey(preferredKey = "") {
    const key = typeof preferredKey === "string" ? preferredKey.trim() : "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?::[a-z0-9_-]+)?$/i.test(key)) {
        return key;
    }
    return crypto.randomUUID();
}

export async function sendInstantPush({ action, familyId, senderUserId, title, message, idempotencyKey: preferredIdempotencyKey, ...extraData }) {
    if (!familyId) return;
    const url = PUSH_FUNCTION_URL;
    if (!url) return;
    const idempotencyKey = createPushIdempotencyKey(preferredIdempotencyKey);
    const payload = JSON.stringify({
        action, familyId, senderUserId, title, message,
        ...extraData,
        idempotency_key: idempotencyKey,
    });
    const session = await getSession().catch(() => null);
    const token = session?.access_token || "";

    const attempt = async () => {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
            body: payload,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response;
    };

    try {
        await attempt();
        return;
    } catch (err) {
        // One retry, 800ms delay, same UUID — server dedup handles it.
        try {
            await new Promise((resolve) => setTimeout(resolve, 800));
            await attempt();
            return;
        } catch (err2) {
            console.warn(`[Push] send ${idempotencyKey} failed: ${err2.message || err.message}`);
        }
    }
}
