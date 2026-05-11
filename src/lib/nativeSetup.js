// src/lib/nativeSetup.js
// 자녀 기기 native setup 권한 체크리스트 — 마이크 / 알림 / 채널 / 전체화면 / 배터리 / 위치 / 서비스.
// Extracted from App.jsx (Phase 5 #4 / B22).

export const REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen_v2";

export function getNativeSetupAction(health) {
    if (!health) return null;
    if (!health.recordAudioGranted) {
        return { target: "appDetails", label: "마이크 권한 허용" };
    }
    if (!health.postPermissionGranted || !health.notificationsEnabled || !health.channelsEnabled) {
        return { target: "notifications", label: "알림 권한 열기" };
    }
    if (health.remoteListenChannelEnabled === false) {
        return { target: "remoteListenChannel", label: "연결 알림 켜기", channelId: REMOTE_LISTEN_CHANNEL_ID };
    }
    if (!health.fullScreenIntentAllowed) {
        return { target: "fullScreen", label: "전체화면 알림 허용" };
    }
    if (!health.batteryOptimizationsIgnored) {
        return { target: "battery", label: "배터리 예외 허용" };
    }
    if (!health.exactAlarmAllowed) {
        return { target: "exactAlarm", label: "정확한 알림 허용" };
    }
    return null;
}

export const CHILD_SAFETY_SETUP_STEPS = Object.freeze([
    {
        id: "microphone",
        title: "마이크 권한",
        description: "부모님이 요청했을 때만 1분 주변 소리 연결을 시작할 수 있어요.",
        target: "appDetails",
        actionLabel: "권한 열기",
        isReady: (health) => health?.recordAudioGranted === true,
    },
    {
        id: "notifications",
        title: "알림 권한",
        description: "앱을 닫아도 일정과 안전 연결 알림을 바로 받을 수 있어요.",
        target: "notifications",
        actionLabel: "알림 켜기",
        isReady: (health) => !!health && health.postPermissionGranted === true && health.notificationsEnabled === true && health.channelsEnabled === true,
    },
    {
        id: "remoteListenChannel",
        title: "연결 알림",
        description: "자동 실행이 막혀도 아이 기기에 연결 알림을 남겨 바로 확인할 수 있어요.",
        target: "remoteListenChannel",
        channelId: REMOTE_LISTEN_CHANNEL_ID,
        actionLabel: "채널 열기",
        isReady: (health) => health?.remoteListenChannelEnabled !== false,
    },
    {
        id: "fullScreen",
        title: "전체화면 알림",
        description: "잠금 화면에서도 중요한 연결 화면을 놓치지 않도록 도와줘요.",
        target: "fullScreen",
        actionLabel: "허용하기",
        isReady: (health) => health?.fullScreenIntentAllowed === true,
    },
    {
        id: "battery",
        title: "배터리 예외",
        description: "절전 모드가 위치 확인과 응급 연결을 끊지 않도록 예외 처리해요.",
        target: "battery",
        actionLabel: "예외 허용",
        isReady: (health) => health?.batteryOptimizationsIgnored === true,
    },
    {
        id: "backgroundLocation",
        title: "위치 항상 허용",
        // Play Store Background Location Disclosure Policy: 백그라운드 위치 사용 이유 명시.
        description: "앱이 닫혀 있을 때도 부모님이 자녀 안전을 확인할 수 있도록 위치를 백그라운드에서 전송해요.",
        target: "appLocation",
        actionLabel: "위치 권한",
        isReady: (_health, bgLocationGranted) => bgLocationGranted === true,
    },
    {
        id: "locationService",
        title: "위치 서비스",
        description: "위치와 상태 업데이트가 끊기지 않도록 안전 서비스를 다시 켜요.",
        target: "locationService",
        actionLabel: "다시 시작",
        isReady: (health) => health?.locationServiceRunning === true,
    },
]);

export function getChildSafetySetupSteps(health, bgLocationGranted) {
    return CHILD_SAFETY_SETUP_STEPS.map((step) => ({
        ...step,
        ready: step.isReady(health, bgLocationGranted),
    }));
}
