// src/components/auth/ParentSignupScreen.jsx
// 학부모 가입 화면 — phone OTP 단계 + 프로필 입력.
// Cartoon-warm 적용 (2026-05-08): HeartsBackground + cartoon-input +
// cartoon-role-chip (엄마/아빠/보호자 일러스트) + cartoon-pill--rose +
// cartoon-status. 모든 핸들러/state/codeSent 흐름 보존.

import { useState } from "react";
import { requestPhoneSignupCode, verifyPhoneSignupCode, checkLoginIdAvailability, isValidLoginId } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";
import { BirthdatePicker } from "../birthdate/BirthdatePicker.jsx";
import { HeartsBackground } from "../decoration/HeartsBackground.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const ROLE_OPTIONS = [
    { value: "엄마", icon: "parent-mom" },
    { value: "아빠", icon: "parent-dad" },
    { value: "보호자", icon: "parent-guardian" },
];

export function ParentSignupScreen({ onBack }) {
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [signup, setSignup] = useState({ name: "", loginId: "", password: "", passwordConfirm: "", gender: "", birthdate: "", phone: "" });
    const [otp, setOtp] = useState("");
    const [pendingSignup, setPendingSignup] = useState(null);
    const [idCheck, setIdCheck] = useState({ status: "idle", message: "" });
    const codeSent = !!pendingSignup && !pendingSignup.session;

    const passwordRuleOk = signup.password.length >= 6;
    const passwordMatchOk = signup.passwordConfirm.length > 0 && signup.password === signup.passwordConfirm;


    const handleCheckLoginId = async () => {
        if (codeSent || busy) return;
        const loginId = signup.loginId.trim().toLowerCase();
        if (!isValidLoginId(loginId)) {
            setIdCheck({ status: "invalid", message: "ID는 영문 소문자, 숫자, ., _, - 조합 4~24자로 입력해 주세요" });
            return;
        }
        setBusy("id-check");
        setIdCheck({ status: "checking", message: "중복 확인 중..." });
        try {
            const available = await checkLoginIdAvailability(loginId);
            if (available) setIdCheck({ status: "ok", message: "사용 가능한 ID예요" });
            else setIdCheck({ status: "dup", message: "이미 사용 중인 ID예요" });
        } catch (err) {
            setIdCheck({ status: "error", message: err?.message || "중복 확인에 실패했어요" });
        } finally {
            setBusy("");
        }
    };

    const handleRequestCode = async (event) => {
        event.preventDefault();
        setBusy("signup");
        setError("");
        setMessage("");
        setOtp("");
        setPendingSignup(null);
        rememberParentPairingIntent();
        try {
            const result = await requestPhoneSignupCode(signup);
            setPendingSignup(result);
            if (result.session) {
                setMessage("가입이 완료됐어요. 가족 설정을 이어가 주세요.");
            } else {
                setMessage("인증번호를 보냈어요. 문자로 받은 6자리를 입력해 주세요.");
            }
        } catch (err) {
            clearParentPairingIntent();
            console.error("[parent signup request]", err);
            setError(err?.message || "인증번호 요청에 실패했어요");
        } finally {
            setBusy("");
        }
    };

    const handleVerifyCode = async (event) => {
        event.preventDefault();
        if (!pendingSignup) return;
        setBusy("verify");
        setError("");
        setMessage("");
        rememberParentPairingIntent();
        try {
            await verifyPhoneSignupCode({
                phone: pendingSignup.phone,
                token: otp,
                profile: pendingSignup.profile,
            });
            setMessage("전화번호 인증이 완료됐어요. 가족 설정을 이어가 주세요.");
        } catch (err) {
            console.error("[parent signup verify]", err);
            setError(err?.message || "인증번호를 확인하지 못했어요");
            setBusy("");
        }
    };

    useBackHandler(() => {
        if (busy) return true;
        if (codeSent) {
            setPendingSignup(null);
            setOtp("");
            setError("");
            setMessage("");
            return true;
        }
        if (onBack) { onBack(); return true; }
        return false;
    });

    return (
        <HeartsBackground style={{ minHeight: "100dvh", fontFamily: "var(--font-sans)" }}>
            <div
                style={{
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
                }}
            >
                <div className="cartoon-topbar">
                    <button type="button" onClick={onBack} aria-label="뒤로" className="btn-icon-circle">←</button>
                    <div style={{ flex: 1 }} />
                </div>

                <div style={{ textAlign: "center", marginBottom: "var(--space-6)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "flex-end",
                            justifyContent: "center",
                            width: 120,
                            height: 96,
                            background: "var(--cartoon-bg-chip)",
                            borderRadius: "var(--cartoon-radius-frame)",
                            border: "1px solid var(--cartoon-line)",
                            marginBottom: "var(--space-3)",
                            overflow: "hidden",
                        }}
                    >
                        <AppBrandLogo size={80} radius={18} shadow={false} />
                    </span>
                    <h1 className="cartoon-title">학부모 가입</h1>
                    <p className="cartoon-subtitle">혜니캘린더에 처음 오셨군요</p>
                </div>

                <div style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
                    <form
                        onSubmit={codeSent ? handleVerifyCode : handleRequestCode}
                        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
                    >
                        <label className="cartoon-field">
                            <span className="cartoon-label">이름</span>
                            <input
                                value={signup.name}
                                onChange={(e) => setSignup((p) => ({ ...p, name: e.target.value }))}
                                autoComplete="name"
                                placeholder="홍길동"
                                maxLength={30}
                                disabled={codeSent}
                                className="input"
                            />
                        </label>
                        <label className="cartoon-field">
                            <span className="cartoon-label">아이디</span>
                            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                            <input
                                value={signup.loginId}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setSignup((p) => ({ ...p, loginId: next }));
                                    setIdCheck({ status: "idle", message: "" });
                                }}
                                autoComplete="username"
                                placeholder="parent01"
                                disabled={codeSent}
                                className="input"
                                style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-secondary" disabled={codeSent || !!busy} onClick={handleCheckLoginId} style={{ minHeight: 44, padding: "0 14px", whiteSpace: "nowrap" }}>중복확인</button>
                            </div>
                            {idCheck.message && <span className="cartoon-caption" style={{ color: idCheck.status === "ok" ? "#1C8245" : "#B87A00" }}>{idCheck.message}</span>}
                        </label>
                        <label className="cartoon-field">
                            <span className="cartoon-label">비밀번호</span>
                            <input
                                type="password"
                                value={signup.password}
                                onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))}
                                autoComplete="new-password"
                                placeholder="6자 이상"
                                disabled={codeSent}
                                className="input"
                            />
                        </label>
                        <div className="cartoon-caption" style={{ color: signup.password.length === 0 ? "#7A6770" : passwordRuleOk ? "#1C8245" : "#B87A00" }}>
                            {signup.password.length === 0 ? "비밀번호는 6자 이상 입력해 주세요" : passwordRuleOk ? "비밀번호 조건이 충족됐어요" : "비밀번호는 6자 이상이어야 해요"}
                        </div>
                        <label className="cartoon-field">
                            <span className="cartoon-label">비밀번호 확인</span>
                            <input
                                type="password"
                                value={signup.passwordConfirm}
                                onChange={(e) => setSignup((p) => ({ ...p, passwordConfirm: e.target.value }))}
                                autoComplete="new-password"
                                placeholder="비밀번호 재입력"
                                disabled={codeSent}
                                className="input"
                            />
                        </label>
                        <div className="cartoon-caption" style={{ color: signup.passwordConfirm.length === 0 ? "#7A6770" : passwordMatchOk ? "#1C8245" : "#B87A00" }}>
                            {signup.passwordConfirm.length === 0 ? "비밀번호를 한 번 더 입력해 주세요" : passwordMatchOk ? "비밀번호가 일치해요" : "비밀번호가 일치하지 않아요"}
                        </div>
                        <fieldset
                            disabled={codeSent}
                            style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", border: "none", padding: 0, margin: 0 }}
                        >
                            <legend className="cartoon-label" style={{ paddingBottom: "var(--space-1)" }}>역할</legend>
                            <div role="radiogroup" aria-label="역할" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
                                {ROLE_OPTIONS.map((opt) => {
                                    const selected = signup.gender === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            disabled={codeSent}
                                            onClick={() => setSignup((p) => ({ ...p, gender: opt.value }))}
                                            className="cartoon-role-chip"
                                        >
                                            <span className="cartoon-role-chip-frame">
                                                <ThreeDIcon name={opt.icon} size={36} aria-label={opt.value} />
                                            </span>
                                            <span>{opt.value}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <label className="cartoon-field">
                            <span className="cartoon-label">생년월일</span>
                            <BirthdatePicker
                                value={signup.birthdate}
                                onChange={(yyyymmdd) => setSignup((p) => ({ ...p, birthdate: yyyymmdd }))}
                                max={`${new Date().getFullYear()}-12-31`}
                                min="1900-01-01"
                                disabled={codeSent}
                                placeholder="생년월일 선택"
                                defaultYearOffset={30}
                            />
                        </label>
                        <label className="cartoon-field">
                            <span className="cartoon-label">전화번호</span>
                            <input
                                type="tel"
                                inputMode="tel"
                                value={signup.phone}
                                onChange={(e) => setSignup((p) => ({ ...p, phone: e.target.value }))}
                                autoComplete="tel"
                                placeholder="010-1234-5678"
                                disabled={codeSent}
                                className="input"
                            />
                        </label>
                        {codeSent && (
                            <label className="cartoon-field">
                                <span className="cartoon-label">인증번호</span>
                                <input
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="6자리"
                                    className="input"
                                />
                            </label>
                        )}
                        <button
                            type="submit"
                            disabled={!!busy}
                            className="btn btn-primary"
                            style={{ width: "100%", marginTop: "var(--space-2)", opacity: busy ? 0.65 : 1, cursor: busy ? "wait" : "pointer" }}
                        >
                            {busy === "signup" ? "인증번호 요청 중..." : busy === "verify" ? "확인 중..." : codeSent ? "인증번호 확인 후 가입" : "인증번호 받기"}
                        </button>
                        {codeSent && (
                            <button
                                type="button"
                                disabled={!!busy}
                                onClick={handleRequestCode}
                                className="btn btn-secondary"
                                style={{ width: "100%", opacity: busy ? 0.65 : 1, cursor: busy ? "wait" : "pointer" }}
                            >
                                인증번호 다시 받기
                            </button>
                        )}
                    </form>

                    {message && (
                        <div className="cartoon-status cartoon-status--positive" style={{ marginTop: "var(--space-4)" }}>
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="cartoon-status cartoon-status--cautionary" style={{ marginTop: "var(--space-4)" }}>
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </HeartsBackground>
    );
}
