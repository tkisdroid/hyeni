// src/lib/remoteListenHealth.js
// 자녀 기기 원격 청취 준비 상태 평가 — 마이크/알림/네트워크/배터리 등 13개 health step.
// CHILD_SAFETY_SETUP_STEPS 와 라벨 우선순위 일치.
// Extracted from App.jsx (Phase 5 #4 / B9).

export const REMOTE_LISTEN_HEALTH_STEPS = Object.freeze([
    { key: "recordAudio", severity: "blocker", label: "마이크 권한 필요", detail: "아이 기기에서 마이크 권한을 허용해야 캡처를 시작할 수 있어요.", missing: (health) => health?.recordAudio !== true },
    { key: "postNotif", severity: "blocker", label: "알림 권한 꺼짐", detail: "앱이 닫혀 있거나 잠금 화면일 때 연결 요청을 받을 수 없어요.", missing: (health) => health?.postNotif !== true },
    { key: "channelOk", severity: "blocker", label: "연결 알림 채널 꺼짐", detail: "자동 실행이 막히면 연결 알림 fallback도 보이지 않을 수 있어요.", missing: (health) => health?.channelOk !== true || health?.remoteListenChannelBlocked === true },
    { key: "networkConnected", severity: "blocker", label: "네트워크 끊김", detail: "아이 기기가 오프라인이면 요청 수신과 오디오 전송이 실패해요.", missing: (health) => health?.networkConnected === false || health?.networkValidated === false },
    { key: "fullScreen", severity: "advisory", label: "전체화면 알림 제한", detail: "잠금 화면에서는 알림 fallback으로 연결을 이어가요.", missing: (health) => health?.fullScreen !== true },
    { key: "battery", severity: "advisory", label: "배터리 최적화 제한", detail: "절전 정책이 FCM 수신이나 foreground service 시작을 늦출 수 있지만 연결은 계속 시도해요.", missing: (health) => health?.battery !== true },
    { key: "powerSaveMode", severity: "advisory", label: "절전 모드 켜짐", detail: "절전 모드는 백그라운드 네트워크와 foreground service 시작을 지연시킬 수 있어요.", missing: (health) => health?.powerSaveMode === true },
    { key: "backgroundRestricted", severity: "advisory", label: "백그라운드 제한", detail: "Android 백그라운드 제한이 켜져 있어도 foreground 연결 화면과 알림 fallback을 시도해요.", missing: (health) => health?.backgroundRestricted === true },
    { key: "locationOk", severity: "advisory", label: "위치 항상 허용 필요", detail: "위치와 상태 보고가 제한될 수 있지만 원격청취 연결 자체는 계속 시도해요.", missing: (health) => health?.locationOk !== true },
    { key: "dndMode", severity: "advisory", label: "방해 금지 모드 영향", detail: "마이크 캡처 자체를 막지는 않지만 알림/화면 깨우기가 제한될 수 있어요.", missing: (health) => !!health?.dndMode && !["all", "unknown"].includes(health.dndMode) },
    { key: "ringerMode", severity: "advisory", label: "무음 모드", detail: "마이크 캡처 자체를 막지는 않지만 알림음 안내가 들리지 않을 수 있어요.", missing: (health) => ["silent", "vibrate"].includes(health?.ringerMode) },
    { key: "screenInteractive", severity: "advisory", label: "화면 꺼짐/잠금", detail: "foreground service와 연결 화면으로 유지하되, OS가 표시를 지연할 수 있어요.", missing: (health) => health?.screenInteractive === false || health?.keyguardLocked === true },
    { key: "foldState", severity: "advisory", label: "폴더블 접힘 상태 확인", detail: "접힌 화면에서는 전체화면 알림과 사용자의 즉시 확인이 늦어질 수 있어요.", missing: (health) => health?.foldState === "possibly_folded" },
]);

export function summarizeRemoteListenHealth(health) {
    if (!health || typeof health !== "object") {
        return { ready: false, missing: [], blockers: [], advisory: [], hasReport: false };
    }
    const missing = REMOTE_LISTEN_HEALTH_STEPS.filter((s) => s.missing(health));
    const blockers = missing.filter((s) => s.severity === "blocker");
    const advisory = missing.filter((s) => s.severity !== "blocker");
    return { ready: blockers.length === 0, missing, blockers, advisory, hasReport: true };
}

export function resolveChildRemoteListenHealth(child, childDeviceStatusMap = {}) {
    const storedHealth = child?.device_health && typeof child.device_health === "object"
        ? child.device_health
        : null;
    const liveStatus = child?.user_id ? childDeviceStatusMap?.[child.user_id] : null;
    const liveHealth = liveStatus?.device_health && typeof liveStatus.device_health === "object"
        ? liveStatus.device_health
        : (liveStatus && typeof liveStatus === "object" ? liveStatus : null);
    if (!storedHealth && !liveHealth) return null;
    return {
        ...(storedHealth || {}),
        ...(liveHealth || {}),
    };
}
