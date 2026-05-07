// src/components/auth/ParentSignupScreen.jsx
// 학부모 가입 화면 — phone OTP 단계 + 프로필 입력.
// 2026-05-07 cartoon DS migration. 로직/prop 보존.

import { useState } from "react";
import { requestPhoneSignupCode, verifyPhoneSignupCode } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";
import { BirthdatePicker } from "../birthdate/BirthdatePicker.jsx";

export function ParentSignupScreen({ onBack }) {
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [signup, setSignup] = useState({ name: "", loginId: "", password: "", passwordConfirm: "", gender: "", birthdate: "", phone: "" });
    const [otp, setOtp] = useState("");
    const [pendingSignup, setPendingSignup] = useState(null);
    const codeSent = !!pendingSignup && !pendingSignup.session;

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

    const genderOptions = [
        { value: "엄마", emoji: "🤱" },
        { value: "아빠", emoji: "👨" },
        { value: "보호자", emoji: "👤" },
    ];

    return (
        <div className="hy-auth">
            <div className="hy-auth__header">
                <button type="button" onClick={onBack} aria-label="뒤로" className="hy-auth__back">←</button>
                <AppBrandLogo size={56} radius={16} />
                <span className="hy-auth__back-spacer" aria-hidden="true" />
            </div>

            <div className="hy-auth__hero">
                <h1 className="hy-auth__title">학부모 가입</h1>
                <p className="hy-auth__subtitle">혜니캘린더에 처음 오셨군요</p>
            </div>

            <div className="hy-auth__body">
                <form onSubmit={codeSent ? handleVerifyCode : handleRequestCode} className="hy-auth__form">
                    <label className="hy-field">
                        <span className="hy-field__label">이름</span>
                        <input value={signup.name} onChange={(e) => setSignup((p) => ({ ...p, name: e.target.value }))} autoComplete="name" placeholder="홍길동" maxLength={30} disabled={codeSent} className="hy-field__input" />
                    </label>
                    <label className="hy-field">
                        <span className="hy-field__label">아이디</span>
                        <input value={signup.loginId} onChange={(e) => setSignup((p) => ({ ...p, loginId: e.target.value }))} autoComplete="username" placeholder="parent01" disabled={codeSent} className="hy-field__input" />
                    </label>
                    <label className="hy-field">
                        <span className="hy-field__label">비밀번호</span>
                        <input type="password" value={signup.password} onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" placeholder="6자 이상" disabled={codeSent} className="hy-field__input" />
                    </label>
                    <label className="hy-field">
                        <span className="hy-field__label">비밀번호 확인</span>
                        <input type="password" value={signup.passwordConfirm} onChange={(e) => setSignup((p) => ({ ...p, passwordConfirm: e.target.value }))} autoComplete="new-password" placeholder="비밀번호 재입력" disabled={codeSent} className="hy-field__input" />
                    </label>

                    <fieldset disabled={codeSent} className="hy-fieldset">
                        <legend>역할</legend>
                        <div role="radiogroup" aria-label="역할" className="hy-radio-group">
                            {genderOptions.map((option) => {
                                const selected = signup.gender === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={codeSent}
                                        onClick={() => setSignup((p) => ({ ...p, gender: option.value }))}
                                        className="hy-radio-pill"
                                    >
                                        <span aria-hidden="true">{option.emoji}</span>
                                        <span>{option.value}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <label className="hy-field">
                        <span className="hy-field__label">생년월일</span>
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

                    <label className="hy-field">
                        <span className="hy-field__label">전화번호</span>
                        <input type="tel" inputMode="tel" value={signup.phone} onChange={(e) => setSignup((p) => ({ ...p, phone: e.target.value }))} autoComplete="tel" placeholder="010-1234-5678" disabled={codeSent} className="hy-field__input" />
                    </label>

                    {codeSent && (
                        <label className="hy-field">
                            <span className="hy-field__label">인증번호</span>
                            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6자리" className="hy-field__input" />
                        </label>
                    )}

                    <button type="submit" disabled={!!busy} className="hy-button hy-button--primary">
                        {busy === "signup" ? "인증번호 요청 중..." : busy === "verify" ? "확인 중..." : codeSent ? "인증번호 확인 후 가입" : "인증번호 받기"}
                    </button>
                    {codeSent && (
                        <button type="button" disabled={!!busy} onClick={handleRequestCode} className="hy-button hy-button--outline">
                            인증번호 다시 받기
                        </button>
                    )}
                </form>

                {message && <div className="hy-message hy-message--positive">{message}</div>}
                {error && <div className="hy-message hy-message--negative">{error}</div>}
            </div>
        </div>
    );
}
