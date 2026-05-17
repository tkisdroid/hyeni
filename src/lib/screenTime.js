// src/lib/screenTime.js
// 아이 화면 시간 표시용 소스 선택 — 기기 전체 화면켜짐 시간(native UsageStats) 우선,
// 측정 불가 시 혜니캘린더 앱 사용 시간으로 폴백한다.
// device status payload: deviceScreenOnMs / deviceScreenOnSource (native), screenOnMs (webview).

// status → { ms, scope }
//   scope "device" — 기기 전체 화면켜짐 시간 (UsageStats, 신뢰 가능)
//   scope "app"    — 혜니캘린더 앱 사용 시간 폴백 (권한 미허용 / 구버전 / 측정 불가)
export function resolveChildScreenTime(status) {
    const deviceMs = Number(status?.deviceScreenOnMs);
    if (status?.deviceScreenOnSource === "usage-stats"
        && Number.isFinite(deviceMs) && deviceMs >= 0) {
        return { ms: deviceMs, scope: "device" };
    }
    const appMs = Number(status?.screenOnMs);
    return { ms: Number.isFinite(appMs) && appMs >= 0 ? appMs : 0, scope: "app" };
}

// app(폴백) scope 일 때 측정 범위가 앱 한정임을 명시하는 라벨 접미사.
export function screenTimeScopeSuffix(scope) {
    return scope === "device" ? "" : " (앱 사용)";
}
