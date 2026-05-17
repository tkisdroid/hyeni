// src/lib/appConfirm.js
// 앱 전역 확인 다이얼로그 — native window.confirm 대신 디자인된 AppConfirmDialog 를 띄운다.
// Promise<boolean> 을 반환해 window.confirm 과 1:1 로 대체 가능.
// AppConfirmHost 가 setAppConfirmHandler 로 구독한다.

let handler = null;

// AppConfirmHost 가 mount 시 호출. 반환된 함수로 unmount 시 해제.
export function setAppConfirmHandler(fn) {
    handler = typeof fn === "function" ? fn : null;
    return () => {
        if (handler === fn) handler = null;
    };
}

// options: { title, message, confirmLabel, cancelLabel, tone, icon }
// 확인 → true, 취소 또는 핸들러 미등록 → false.
export function appConfirm(options = {}) {
    return new Promise((resolve) => {
        if (!handler) {
            console.warn("[appConfirm] handler 미등록 — 취소로 처리");
            resolve(false);
            return;
        }
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(!!result);
        };
        handler({
            title: options.title || "확인",
            message: options.message || "계속 진행할까요?",
            confirmLabel: options.confirmLabel || "확인",
            cancelLabel: options.cancelLabel || "취소",
            tone: options.tone || "default",
            icon: options.icon || "",
            resolve: finish,
        });
    });
}
