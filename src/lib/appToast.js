// src/lib/appToast.js
// 앱 전역 토스트 — 깊은 컴포넌트에서 native alert() 대신 디자인된 토스트를 띄우기 위한 pub/sub.
// App.jsx 가 setAppToastHandler 로 기존 showNotif 를 연결한다.

let handler = null;

// App.jsx 가 mount 시 호출. 반환된 함수로 unmount 시 해제.
export function setAppToastHandler(fn) {
    handler = typeof fn === "function" ? fn : null;
    return () => {
        if (handler === fn) handler = null;
    };
}

// 어디서든 호출 가능. type: "success" | "error" (showNotif 와 동일 규약).
// 핸들러 미등록 시 false 반환 (앱 부팅 직후 등 — 조용히 무시).
export function appToast(message, type = "error") {
    const text = typeof message === "string" ? message : String(message ?? "");
    if (!text) return false;
    if (handler) {
        handler(text, type);
        return true;
    }
    console.warn("[appToast] handler 미등록:", text);
    return false;
}
