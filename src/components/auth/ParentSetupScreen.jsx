// src/components/auth/ParentSetupScreen.jsx
// "가족 연결을 시작해요" — first parent gate for create vs join with code.
// Extracted from App.jsx (Phase 5 #4 / B3).
//
// Props:
//   onCreateFamily: () => Promise<void>
//   onJoinAsParent: (normalizedCode: string) => Promise<void>

import { useState } from "react";
import { normalizePairCodeInput } from "../../lib/pairCode.js";
import {
    DESIGN,
    FF,
    makeCardStyle,
} from "../../lib/styleHelpers.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";

export function ParentSetupScreen({ onCreateFamily, onJoinAsParent }) {
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
    const [mode, setMode] = useState(null); // null | "create" | "join"
    const [busy, setBusy] = useState(false);
    const normalizedJoinCode = normalizePairCodeInput(joinCode) || normalizePairCodeInput(`KID-${joinCode}`);
    const canJoin = !busy && !!normalizedJoinCode;

    const handleJoinCodeChange = (event) => {
        setJoinError("");
        const rawValue = event.target.value;
        const normalized = normalizePairCodeInput(rawValue);
        if (normalized) {
            setJoinCode(normalized);
            return;
        }

        const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (cleaned.startsWith("KID-")) {
            setJoinCode(cleaned.slice(0, 12));
            return;
        }

        const compact = cleaned.replace(/-/g, "");
        if ("KID".startsWith(compact)) {
            setJoinCode(compact);
            return;
        }
        if (compact.startsWith("KID")) {
            setJoinCode(`KID-${compact.slice(3, 11)}`);
            return;
        }

        setJoinCode(compact.slice(0, 8));
    };

    const handleCreateClick = async () => {
        setBusy(true);
        try {
            await onCreateFamily();
        } finally {
            setBusy(false);
        }
    };

    const handleJoinClick = async () => {
        if (!normalizedJoinCode) {
            setJoinError("KID-로 시작하는 8자리 연동코드를 입력해 주세요");
            return;
        }

        setBusy(true);
        setJoinError("");
        try {
            await onJoinAsParent(normalizedJoinCode);
        } catch (err) {
            const rawMessage = err?.message || "";
            const message = rawMessage.includes("Invalid pair code") || rawMessage.includes("연동 코드를 찾지 못했습니다")
                ? "연동코드를 찾지 못했어요. 코드를 다시 확인해 주세요"
                : rawMessage.includes("Too many")
                    ? "시도 횟수가 많아요. 1시간 후 다시 시도해 주세요"
                    : rawMessage || "합류에 실패했어요. 연동코드를 확인해 주세요";
            setJoinError(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="hyeni-app-shell" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: DESIGN.gradients.shell, fontFamily: FF, padding: 20 }}>
            <div style={makeCardStyle({ padding: "32px 24px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "var(--hyeni-theme-shadow)" })}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                    <AppBrandLogo size={76} radius={22} />
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: "var(--theme-accent-text)", marginBottom: 6, letterSpacing: 0 }}>가족 연결을 시작해요</div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 26, lineHeight: 1.55, fontWeight: 600 }}>
                    새 가족을 만들거나<br/>이미 받은 연동코드로 합류하세요
                </div>

                {!mode && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button onClick={() => setMode("create")}
                            className="btn btn-primary-mint"
                            style={{ width: "100%", justifyContent: "space-between", padding: "0 var(--space-5)" }}>
                            <span>새 가족 만들기</span>
                            <span aria-hidden="true">→</span>
                        </button>
                        <button onClick={() => setMode("join")}
                            className="btn btn-secondary"
                            style={{ width: "100%", justifyContent: "space-between", padding: "0 var(--space-5)" }}>
                            <span>기존 가족에 합류</span>
                            <span aria-hidden="true">→</span>
                        </button>
                    </div>
                )}

                {mode === "create" && (
                    <div>
                        <div style={{ fontSize: 14, color: "var(--fg-primary)", marginBottom: 16, fontWeight: 600 }}>
                            새 가족을 만들면 연동코드가 생성됩니다.<br/>이 코드로 배우자와 아이가 합류할 수 있어요.
                        </div>
                        <button disabled={busy} onClick={handleCreateClick}
                            className="btn btn-primary-mint">
                            {busy ? "생성 중..." : "가족 만들기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "var(--fg-tertiary)", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}

                {mode === "join" && (
                    <div>
                        <div style={{ fontSize: 14, color: "var(--fg-primary)", marginBottom: 12, fontWeight: 600 }}>
                            배우자에게 받은 연동코드를 입력하세요
                        </div>
                        <div style={{ marginBottom: joinError ? 8 : 12 }}>
                            <input value={joinCode} onChange={handleJoinCodeChange}
                                placeholder="KID-804DF582 또는 804DF582"
                                style={{ width: "100%", padding: "11px 14px", border: `2px solid ${joinError ? "var(--status-danger)" : "var(--line-default)"}`, borderRadius: "var(--radius-input)", fontSize: 16, fontWeight: 800, fontFamily: "monospace", textAlign: "center", letterSpacing: 1, boxSizing: "border-box", outline: "none", color: "var(--fg-primary)", background: "var(--bg-card)" }} />
                        </div>
                        {joinError && <div style={{ fontSize: 13, color: "var(--status-cautionary-strong)", fontWeight: 700, marginBottom: 12 }}>{joinError}</div>}
                        <button disabled={!canJoin} onClick={handleJoinClick}
                            className="btn btn-primary-mint">
                            {busy ? "합류 중..." : "합류하기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "var(--fg-tertiary)", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
