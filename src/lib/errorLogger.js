// ── Error Logger: captures runtime errors for feedback reports ───────────────

const MAX_LOGS = 20;
let errorLogs = [];

function addLog(entry) {
  const newEntry = { ...entry, timestamp: new Date().toISOString() };
  const newLogs = [...errorLogs, newEntry];
  errorLogs = newLogs.length > MAX_LOGS ? newLogs.slice(1) : newLogs;
}

function handleWindowError(event) {
  addLog({
    type: "error",
    message: event.message || String(event),
    source: event.filename || "",
    line: event.lineno || 0,
    col: event.colno || 0,
    stack: event.error?.stack || "",
  });
}

function handleUnhandledRejection(event) {
  const reason = event.reason;
  addLog({
    type: "unhandledrejection",
    message: reason?.message || String(reason),
    stack: reason?.stack || "",
  });
}

export function initErrorLogger() {
  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
}

export function teardownErrorLogger() {
  window.removeEventListener("error", handleWindowError);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);
}

export function getErrorLogs() {
  return [...errorLogs];
}

export function addErrorLog(error) {
  addLog({
    type: "caught",
    message: error?.message || String(error),
    stack: error?.stack || "",
  });
}

export function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  return {
    userAgent: ua,
    platform: navigator.platform || "",
    language: navigator.language || "",
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    viewportWidth: window.innerWidth || 0,
    viewportHeight: window.innerHeight || 0,
    isNative: !!(window.Capacitor?.isNativePlatform?.()),
    online: navigator.onLine,
  };
}
