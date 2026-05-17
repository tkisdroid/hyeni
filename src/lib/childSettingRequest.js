// src/lib/childSettingRequest.js
// 자녀 설정 변경 요청 — 자녀가 직접 못 바꾸는 메뉴(테마/캐릭터/소리/마스코트)를
// 부모에게 푸시 + parent_alerts 기록으로 요청한다. 승인·자동적용 없는 정보 전달형.
// Phase 1 — child settings change-request model.

import { sendInstantPush } from "./instantPush.js";
import { supabase } from "./supabase.js";

// 요청 메뉴별 카피.
//   childLabel    — 자녀 화면 표기 (반말 톤은 화면 컴포넌트가 문장으로 감싼다)
//   parentTitle   — 부모 푸시·알림 제목 (존댓말)
//   parentMessage — 부모 푸시·알림 본문 (존댓말, 자녀 이름 주입)
export const SETTING_REQUEST_META = {
    theme: {
        childLabel: "테마 색깔",
        parentTitle: "테마 변경 요청",
        parentMessage: (childName) => `${childName}님이 테마 색깔을 바꾸고 싶어 해요.`,
    },
    character: {
        childLabel: "캐릭터",
        parentTitle: "캐릭터 변경 요청",
        parentMessage: (childName) => `${childName}님이 캐릭터를 바꾸고 싶어 해요.`,
    },
    sound: {
        childLabel: "소리·진동",
        parentTitle: "소리·진동 설정 변경 요청",
        parentMessage: (childName) => `${childName}님이 소리·진동 설정을 바꾸고 싶어 해요.`,
    },
    mascot: {
        childLabel: "마스코트 보여주기",
        parentTitle: "마스코트 설정 변경 요청",
        parentMessage: (childName) => `${childName}님이 마스코트 표시 설정을 바꾸고 싶어 해요.`,
    },
};

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY_PREFIX = "hyeni-setting-request-";

export function isValidMenuKey(menuKey) {
    return typeof menuKey === "string"
        && Object.prototype.hasOwnProperty.call(SETTING_REQUEST_META, menuKey);
}

function readLastSentAt(menuKey) {
    try {
        const raw = window.localStorage.getItem(COOLDOWN_KEY_PREFIX + menuKey);
        const ts = raw ? Number(raw) : 0;
        return Number.isFinite(ts) ? ts : 0;
    } catch {
        return 0;
    }
}

// 메뉴별 60초 쿨다운 검사. { allowed, remainingSec } 반환.
export function checkRequestCooldown(menuKey, now = Date.now()) {
    if (!isValidMenuKey(menuKey)) return { allowed: false, remainingSec: 0 };
    const elapsed = now - readLastSentAt(menuKey);
    if (elapsed >= COOLDOWN_MS) return { allowed: true, remainingSec: 0 };
    return { allowed: false, remainingSec: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
}

// 요청 성공 시각 기록 — 이후 60초간 같은 메뉴 재요청 차단.
export function markRequestSent(menuKey, now = Date.now()) {
    if (!isValidMenuKey(menuKey)) return;
    try {
        window.localStorage.setItem(COOLDOWN_KEY_PREFIX + menuKey, String(now));
    } catch {
        // localStorage 불가 시 쿨다운만 비활성 — 요청 자체는 정상 진행
    }
}

// 자녀 → 부모 설정 변경 요청 전송.
// RPC 기록을 진실원으로 삼는다: RPC 실패는 throw, 푸시 실패는 허용(best-effort).
export async function sendChildSettingRequest({ menuKey, familyId, senderUserId, childName }) {
    if (!isValidMenuKey(menuKey)) {
        throw new Error(`알 수 없는 설정 메뉴: ${menuKey}`);
    }
    if (!familyId) {
        throw new Error("가족 정보가 없어 요청을 보낼 수 없습니다.");
    }
    const meta = SETTING_REQUEST_META[menuKey];
    const name = (typeof childName === "string" && childName.trim()) ? childName.trim() : "아이";
    const title = meta.parentTitle;
    const message = meta.parentMessage(name);

    // 푸시 — 실패해도 요청 기록은 계속 진행 (best-effort, sendInstantPush 자체가 throw하지 않음)
    await sendInstantPush({
        action: "parent_alert",
        familyId,
        senderUserId,
        severity: "info",
        alertType: "child_setting_request",
        title,
        message,
    });

    // parent_alerts 기록 — App.jsx의 insert_parent_alert 호출 패턴 복제.
    // p_event_id 생략으로 (text/uuid) overload 모호성 회피 (Phase 0 경고).
    const { error } = await supabase.rpc("insert_parent_alert", {
        p_family_id: familyId,
        p_alert_type: "child_setting_request",
        p_title: title,
        p_message: message,
        p_severity: "info",
    });
    if (error) {
        throw new Error(error.message || "변경 요청 기록에 실패했습니다.");
    }
    return true;
}
