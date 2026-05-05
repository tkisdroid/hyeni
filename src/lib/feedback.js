// src/lib/feedback.js
// 피드백 전송 — Edge Function 우선, 실패시 mailto fallback.
// Extracted from App.jsx (Phase 5 #4 / B25).

import { getSession } from "./auth.js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const FEEDBACK_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/feedback-email` : "";

export const FEEDBACK_RECIPIENT = "tkisdroid@gmail.com";

export async function sendFeedbackSuggestion({ content, familyId, user, role }) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("제안 내용을 입력해 주세요");

    const payload = {
        familyId: familyId || null,
        senderUserId: user?.id || null,
        senderRole: role || null,
        senderName: user?.user_metadata?.name || user?.email || "익명 사용자",
        senderEmail: user?.email || "",
        content: trimmed,
        appOrigin: typeof window !== "undefined" ? window.location.origin : "",
    };

    if (FEEDBACK_FUNCTION_URL) {
        const session = await getSession().catch(() => null);
        const token = session?.access_token || "";
        const response = await fetch(FEEDBACK_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || "제안 전송에 실패했어요");
        }
        return { mode: body?.mock ? "mock" : "edge" };
    }

    if (typeof window !== "undefined") {
        const params = new URLSearchParams({
            subject: "[혜니캘린더] 기능 제안",
            body: [
                trimmed,
                "",
                `role: ${role || "unknown"}`,
                `familyId: ${familyId || "none"}`,
                `sender: ${user?.user_metadata?.name || user?.email || "anonymous"}`,
                `origin: ${window.location.origin}`,
            ].join("\n"),
        });
        window.location.assign(`mailto:${FEEDBACK_RECIPIENT}?${params.toString()}`);
        return { mode: "mailto" };
    }

    throw new Error("제안 전송 경로가 준비되지 않았어요");
}
