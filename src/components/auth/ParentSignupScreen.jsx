// src/components/auth/ParentSignupScreen.jsx
// 학부모 가입 화면 — phone OTP 단계 + 프로필 입력.
// Extracted from App.jsx (Phase 5 #4 / B4).

import { useState } from "react";
import { requestPhoneSignupCode, verifyPhoneSignupCode } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
import { FF } from "../../lib/styleHelpers.js";
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

    const fieldWrapStyle = { display: "flex", flexDirection: "column", gap: "var(--space-2)" };
    const labelStyle = { fontSize: 12, fontWeight: "var(--weight-bold)", color: "var(--fg-secondary)" };

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
        <div
            className="hyeni-app-shell"
            style={{
                minHeight: "100dvh",
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                fontFamily: FF,
                padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로"
                    style={{
                        width: 36, height: 36,
                        borderRadius: "var(--radius-control)",
                        border: "1px solid var(--line-soft)",
                        background: "var(--bg-base)",
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: "var(--weight-bold)",
                        color: "var(--fg-secondary)",
                        fontFamily: FF,
                    }}
                >
                    ←
                </button>
                <div style={{ display: "flex", justifyContent: "center", flex: 1 }}>
                    <AppBrandLogo size={56} radius={16} />
                </div>
                <div style={{ width: 36 }} />
            </div>

            <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
                <h1 className="t-screen-title">학부모 가입</h1>
                <p className="t-screen-subtitle" style={{ marginTop: "var(--space-2)" }}>혜니캘린더에 처음 오셨군요</p>
            </div>

            <div style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
                <form onSubmit={codeSent ? handleVerifyCode : handleRequestCode} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>이름</span>
                        <input value={signup.name} onChange={(e) => setSignup((p) => ({ ...p, name: e.target.value }))} autoComplete="name" placeholder="홍길동" maxLength={30} disabled={codeSent} className="input" />
                    </label>
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>아이디</span>
                        <input value={signup.loginId} onChange={(e) => setSignup((p) => ({ ...p, loginId: e.target.value }))} autoComplete="username" placeholder="parent01" disabled={codeSent} className="input" />
                    </label>
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>비밀번호</span>
                        <input type="password" value={signup.password} onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" placeholder="6자 이상" disabled={codeSent} className="input" />
                    </label>
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>비밀번호 확인</span>
                        <input type="password" value={signup.passwordConfirm} onChange={(e) => setSignup((p) => ({ ...p, passwordConfirm: e.target.value }))} autoComplete="new-password" placeholder="비밀번호 재입력" disabled={codeSent} className="input" />
                    </label>
                    <fieldset disabled={codeSent} style={{ ...fieldWrapStyle, border: "none", padding: 0, margin: 0 }}>
                        <legend style={labelStyle}>역할</legend>
                        <div role="radiogroup" aria-label="역할" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
                            {[
                                { value: "엄마", emoji: "🤱" },
                                { value: "아빠", emoji: "👨" },
                                { value: "보호자", emoji: "👤" },
                            ].map((option) => {
                                const selected = signup.gender === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={codeSent}
                                        onClick={() => setSignup((p) => ({ ...p, gender: option.value }))}
                                        style={{
                                            padding: "var(--space-3) var(--space-2)",
                                            borderRadius: "var(--radius-control)",
                                            border: `1px solid ${selected ? "var(--theme-accent)" : "var(--line-soft)"}`,
                                            background: selected ? "var(--theme-accent-soft)" : "var(--bg-base)",
                                            color: selected ? "var(--theme-accent-text)" : "var(--fg-secondary)",
                                            fontWeight: "var(--weight-semibold)",
                                            fontFamily: FF,
                                            cursor: codeSent ? "not-allowed" : "pointer",
                                            fontSize: 14,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "var(--space-1)",
                                        }}
                                    >
                                        <span aria-hidden="true">{option.emoji}</span>
                                        <span>{option.value}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>생년월일</span>
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
                    <label style={fieldWrapStyle}>
                        <span style={labelStyle}>전화번호</span>
                        <input type="tel" inputMode="tel" value={signup.phone} onChange={(e) => setSignup((p) => ({ ...p, phone: e.target.value }))} autoComplete="tel" placeholder="010-1234-5678" disabled={codeSent} className="input" />
                    </label>
                    {codeSent && (
                        <label style={fieldWrapStyle}>
                            <span style={labelStyle}>인증번호</span>
                            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6자리" className="input" />
                        </label>
                    )}
                    <button type="submit" disabled={!!busy} className="btn btn-primary" style={{ marginTop: "var(--space-2)", opacity: busy ? 0.65 : 1, cursor: busy ? "wait" : "pointer" }}>
                        {busy === "signup" ? "인증번호 요청 중..." : busy === "verify" ? "확인 중..." : codeSent ? "인증번호 확인 후 가입" : "인증번호 받기"}
                    </button>
                    {codeSent && (
                        <button type="button" disabled={!!busy} onClick={handleRequestCode} className="btn btn-secondary" style={{ opacity: busy ? 0.65 : 1, cursor: busy ? "wait" : "pointer" }}>
                            인증번호 다시 받기
                        </button>
                    )}
                </form>

                {message && (
                    <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--status-positive-subtle)", color: "var(--status-positive-strong)", fontSize: 13, fontWeight: "var(--weight-bold)", lineHeight: 1.45 }}>
                        {message}
                    </div>
                )}
                {error && (
                    <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", fontSize: 13, fontWeight: "var(--weight-bold)", lineHeight: 1.45 }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
