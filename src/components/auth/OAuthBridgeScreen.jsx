import { useState, useCallback, useMemo } from "react";
import {
  findUserByPhone,
  requestOAuthBridgeOtp,
  verifyOAuthBridgeOtp,
  mergeOAuthIntoPhoneUser,
  markProviderLinked,
  getUserDisplayName,
  normalizePhoneForStorage,
} from "../../lib/accountAuth.js";
import { logout } from "../../lib/auth.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";

// 5-state machine. OAuth 사용자가 진입했을 때만 mount 된다. onLinked 콜백은
// bridge 완료 후 호출 — App.jsx 가 새 phone session 으로 handleAuthUser 를
// 다시 실행한다.
//
// states:
//   prompt        — "처음이세요? / 이미 가입했어요"
//   otp           — 전화번호 + OTP 입력
//   match-confirm — 매칭된 phone user 이름 표시 + 연결 컨펌
//   linking       — Edge Function 호출 중 (스피너)
//   done          — 성공 메시지 후 onLinked
const PROMPT = "prompt";
const OTP = "otp";
const MATCH_CONFIRM = "match-confirm";
const LINKING = "linking";
const DONE = "done";

export function OAuthBridgeScreen({ oauthUser, onLinked, onSignupNew }) {
  const provider = oauthUser?.app_metadata?.provider || "kakao";
  const providerLabel = provider === "google" ? "구글" : "카카오";
  const oauthDisplayName = getUserDisplayName(oauthUser) || providerLabel;

  const [state, setState] = useState(PROMPT);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [matchedUserId, setMatchedUserId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setOtpSent(false);
    setOtpToken("");
    setMatchedUserId(null);
    setError("");
  }, []);

  const handleSendOtp = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const candidateUserId = await findUserByPhone(phone);
      if (!candidateUserId) {
        setError(`이 전화번호로 가입된 계정이 없어요. 새로 가입하려면 아래 "새로 가입할게요" 를 눌러주세요.`);
        return;
      }
      await requestOAuthBridgeOtp(phone);
      setMatchedUserId(candidateUserId);
      setOtpSent(true);
    } catch (err) {
      setError(err?.message || "전화번호 인증 요청에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const { userId } = await verifyOAuthBridgeOtp(phone, otpToken);
      if (userId !== matchedUserId) {
        setError("인증된 사용자 정보가 어긋났어요. 다시 시도해 주세요.");
        return;
      }
      setState(MATCH_CONFIRM);
    } catch (err) {
      setError(err?.message || "인증번호 확인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [phone, otpToken, matchedUserId]);

  const handleConfirmLink = useCallback(async () => {
    setError("");
    setBusy(true);
    setState(LINKING);
    try {
      const result = await mergeOAuthIntoPhoneUser({
        oauthUserId: oauthUser.id,
        provider,
      });
      await markProviderLinked({
        userId: matchedUserId,
        provider,
        payload: { linkedAt: new Date().toISOString() },
      });
      setState(DONE);
      onLinked?.({ userId: matchedUserId, provider, mergeResult: result });
    } catch (err) {
      setError(err?.message || "연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setState(MATCH_CONFIRM);
    } finally {
      setBusy(false);
    }
  }, [oauthUser?.id, provider, matchedUserId, onLinked]);

  const handleCancel = useCallback(async () => {
    try { await logout(); } catch { /* logout 실패해도 진행 */ }
    reset();
    setState(PROMPT);
  }, [reset]);

  const headline = useMemo(() => {
    if (state === PROMPT) return `${providerLabel}로 처음 오셨나요?`;
    if (state === OTP) return otpSent ? "인증번호를 입력해 주세요" : "전화번호를 입력해 주세요";
    if (state === MATCH_CONFIRM) return `이 ${providerLabel}을(를) 연결할까요?`;
    if (state === LINKING) return "연결 중이에요";
    if (state === DONE) return "연결이 완료됐어요";
    return "";
  }, [state, otpSent, providerLabel]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10" style={{ background: "var(--bg-base)" }}>
      <AppBrandLogo />
      <div className="w-full max-w-sm mt-6 card p-6" style={{ background: "var(--bg-surface)" }}>
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--fg-primary)" }}>{headline}</h1>

        {state === PROMPT && (
          <>
            <p className="text-sm mb-6" style={{ color: "var(--fg-secondary)" }}>
              혜니캘린더에 이미 가입한 적이 있다면 전화번호로 본인 확인 후 {providerLabel} 계정을 연결할 수 있어요.
            </p>
            <button type="button" className="btn-primary w-full mb-3" onClick={() => setState(OTP)}>
              이미 가입했어요 — 연결할게요
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => onSignupNew?.(oauthUser)}>
              새로 가입할게요
            </button>
            <button type="button" className="text-sm mt-4 underline" style={{ color: "var(--fg-secondary)" }} onClick={handleCancel}>
              취소하고 로그아웃
            </button>
          </>
        )}

        {state === OTP && (
          <>
            {!otpSent ? (
              <>
                <label className="text-sm block mb-1" style={{ color: "var(--fg-secondary)" }}>전화번호</label>
                <input
                  className="input w-full mb-3"
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn-primary w-full" disabled={busy || !phone} onClick={handleSendOtp}>
                  {busy ? "확인 중..." : "인증번호 받기"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: "var(--fg-secondary)" }}>
                  {normalizePhoneForStorage(phone)} 로 보낸 6자리 인증번호를 입력해 주세요.
                </p>
                <input
                  className="input w-full mb-3"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn-primary w-full mb-2" disabled={busy || otpToken.length !== 6} onClick={handleVerifyOtp}>
                  {busy ? "확인 중..." : "인증 확인"}
                </button>
                <button type="button" className="btn-secondary w-full" disabled={busy} onClick={reset}>
                  전화번호 다시 입력
                </button>
              </>
            )}
          </>
        )}

        {state === MATCH_CONFIRM && (
          <>
            <p className="text-sm mb-6" style={{ color: "var(--fg-secondary)" }}>
              이 {providerLabel} 계정({oauthDisplayName})을 입력하신 전화번호의 기존 계정에 연결할게요.
              한 번 연결되면 다음부터는 {providerLabel} 버튼만 눌러도 같은 계정으로 들어와요.
            </p>
            <button type="button" className="btn-primary w-full mb-2" disabled={busy} onClick={handleConfirmLink}>
              {busy ? "연결 중..." : `${providerLabel} 연결하기`}
            </button>
            <button type="button" className="btn-secondary w-full" disabled={busy} onClick={handleCancel}>
              취소
            </button>
          </>
        )}

        {state === LINKING && (
          <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>잠시만 기다려 주세요...</p>
        )}

        {state === DONE && (
          <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>
            잠시 후 홈으로 이동해요.
          </p>
        )}

        {error && (
          <p className="text-sm mt-4" style={{ color: "var(--accent-warn, #b45309)" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

export default OAuthBridgeScreen;
