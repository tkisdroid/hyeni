// src/lib/aiChat.js
// AI 캐릭터 채팅 — 클라이언트 측 래퍼.
// 모든 일일 한도·차감·로그는 Edge Function 이 수행하므로 여기서는 단순 invoke + 조회만.

import { supabase } from "./supabase.js";

function todayDateKST() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

/**
 * 가족의 AI 채팅 설정 한 행 조회. 없으면 null.
 * @returns {Promise<{enabled:boolean, daily_limit:number, credit_balance:number}|null>}
 */
export async function loadChatSettings(familyId) {
    if (!familyId) return null;
    const { data, error } = await supabase
        .from("ai_chat_settings")
        .select("enabled, daily_limit, credit_balance, updated_at")
        .eq("family_id", familyId)
        .maybeSingle();
    if (error) {
        console.error("[aiChat] loadChatSettings", error);
        return null;
    }
    return data || null;
}

/**
 * 부모가 설정을 저장(없으면 생성, 있으면 갱신).
 */
export async function saveChatSettings(familyId, patch, updatedBy) {
    if (!familyId) throw new Error("familyId required");
    const row = {
        family_id: familyId,
        enabled: patch.enabled ?? false,
        daily_limit: Math.max(0, Math.min(100, Math.round(patch.daily_limit ?? 10))),
        ...(patch.credit_balance != null ? { credit_balance: Math.max(0, Math.round(patch.credit_balance)) } : {}),
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
        .from("ai_chat_settings")
        .upsert(row, { onConflict: "family_id" });
    if (error) {
        console.error("[aiChat] saveChatSettings", error);
        throw error;
    }
}

/**
 * 오늘 자녀의 사용량.
 */
export async function loadTodayUsage({ familyId, childUserId, dateKey = todayDateKST() }) {
    if (!familyId || !childUserId) return { count: 0, usage_date: dateKey };
    const { data, error } = await supabase
        .from("ai_chat_usage")
        .select("count, usage_date")
        .eq("family_id", familyId)
        .eq("child_user_id", childUserId)
        .eq("usage_date", dateKey)
        .maybeSingle();
    if (error) {
        console.error("[aiChat] loadTodayUsage", error);
        return { count: 0, usage_date: dateKey };
    }
    return data || { count: 0, usage_date: dateKey };
}

/**
 * 자녀의 최근 메시지 N개(오름차순 반환).
 */
export async function loadRecentMessages({ familyId, childUserId, limit = 20 }) {
    if (!familyId || !childUserId) return [];
    const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, animal_character, flagged, created_at")
        .eq("family_id", familyId)
        .eq("child_user_id", childUserId)
        .neq("role", "system")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) {
        console.error("[aiChat] loadRecentMessages", error);
        return [];
    }
    return (data || []).slice().reverse();
}

/**
 * 메시지 전송. Edge Function 이 인증/한도/저장을 모두 처리.
 * 반환:
 *   { ok: true, reply, remaining, dailyLimit, creditBalance, character, characterName, flagged }
 *   { ok: false, error: 'daily_limit_reached'|'feature_disabled'|'not_child'|'ai_failure'|... , remaining?, dailyLimit?, creditBalance? }
 */
export async function sendChildChat(message) {
    const text = (message || "").toString().trim();
    if (!text) return { ok: false, error: "empty_message" };

    const { data, error } = await supabase.functions.invoke("ai-child-chat", {
        body: { message: text, usageDate: todayDateKST() },
    });

    if (error) {
        let parsed = null;
        try {
            const resp = error?.context?.response;
            if (resp && typeof resp.json === "function") parsed = await resp.json();
        } catch { /* ignore */ }
        const status = error?.context?.response?.status ?? 0;
        if (parsed && parsed.error) {
            return { ok: false, status, ...parsed };
        }
        console.error("[aiChat] sendChildChat failed", error);
        return { ok: false, status, error: "network_failure" };
    }

    return { ok: true, ...data };
}
