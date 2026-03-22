import { supabase } from "./supabase.js";
import { getErrorLogs, getDeviceInfo } from "./errorLogger.js";

const COOLDOWN_MS = 60_000; // 1분 쿨다운
const MAX_LOG_BYTES = 10_000; // 에러 로그 10KB 제한
let lastSentAt = 0;

function truncateLogs(logs) {
  const json = JSON.stringify(logs);
  if (json.length <= MAX_LOG_BYTES) return logs;
  // 최신 로그부터 유지하면서 크기 맞추기
  const trimmed = [...logs];
  while (JSON.stringify(trimmed).length > MAX_LOG_BYTES && trimmed.length > 1) {
    trimmed.shift();
  }
  return trimmed;
}

const VALID_TYPES = ["bug", "suggestion", "other"];

export async function submitFeedback({ userId, familyId, type, message, currentScreen }) {
  if (!userId) throw new Error("로그인이 필요합니다");
  if (!VALID_TYPES.includes(type)) throw new Error("유효하지 않은 피드백 유형입니다");
  if (!message || !message.trim()) throw new Error("내용을 입력해주세요");
  if (message.trim().length > 2000) throw new Error("피드백은 2000자 이내로 입력해주세요");

  const now = Date.now();
  if (now - lastSentAt < COOLDOWN_MS) {
    throw new Error("잠시 후 다시 시도해주세요 (1분 제한)");
  }

  const errorLogs = truncateLogs(getErrorLogs());
  const deviceInfo = getDeviceInfo();

  const { error } = await supabase.from("user_feedback").insert({
    user_id: userId,
    family_id: familyId || null,
    type: type || "other",
    message: message.trim(),
    error_logs: errorLogs.length > 0 ? errorLogs : null,
    device_info: deviceInfo,
    current_screen: currentScreen || null,
  });

  if (error) throw error;
  lastSentAt = Date.now();
}

export function buildKakaoShareText({ type, message, deviceInfo, errorLogs }) {
  const typeLabels = { bug: "버그 신고", suggestion: "제안", other: "기타" };
  const label = typeLabels[type] || "기타";

  let text = `[혜니 캘린더 피드백]\n유형: ${label}\n내용: ${message}`;

  if (deviceInfo) {
    text += `\n기기: ${deviceInfo.platform || "unknown"}`;
    text += `\n화면: ${deviceInfo.viewportWidth}x${deviceInfo.viewportHeight}`;
    text += deviceInfo.isNative ? " (네이티브)" : " (웹)";
  }

  if (errorLogs && errorLogs.length > 0) {
    const latest = errorLogs[errorLogs.length - 1];
    text += `\n최근에러: ${latest.message || "N/A"}`;
  }

  // 카카오톡 공유 텍스트 길이 제한
  if (text.length > 1000) {
    text = text.substring(0, 997) + "...";
  }

  return text;
}

export function shareViaKakao({ type, message }) {
  const deviceInfo = getDeviceInfo();
  const errorLogs = getErrorLogs();
  const text = buildKakaoShareText({ type, message, deviceInfo, errorLogs });

  // Web Share API fallback for native + web
  if (navigator.share) {
    navigator.share({ title: "혜니 캘린더 피드백", text }).catch(() => {
      // 사용자가 취소했거나 지원하지 않는 경우 무시
    });
    return true;
  }

  // 카카오톡 커스텀 URL scheme fallback
  const encoded = encodeURIComponent(text);
  window.open(`https://story.kakao.com/s/share?url=&content=${encoded}`, "_blank");
  return true;
}
