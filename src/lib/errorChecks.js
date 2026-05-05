// src/lib/errorChecks.js
// 작은 에러 분류 helpers — 프로필 테마 RPC 미적용 / 네이티브 플러그인 미사용.
// Extracted from App.jsx (Phase 5 #4 / B24).

export const PROFILE_THEME_RPC_MISSING_MESSAGE = "테마 색상 저장 서버 함수가 아직 반영되지 않았어요. 서버 migration 적용 후 다시 저장해 주세요.";

export function isMissingProfileThemeRpcError(error) {
    const message = String(error?.message || error?.details || error?.hint || "");
    return error?.code === "PGRST202"
        || message.includes("set_family_member_profile_by_id")
        || message.includes("Could not find the function");
}

export function isMissingNativePluginError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("not implemented")
        || message.includes("not available")
        || message.includes("plugin") && message.includes("ambientlisten");
}
