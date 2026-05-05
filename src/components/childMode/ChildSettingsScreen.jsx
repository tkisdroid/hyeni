// src/components/childMode/ChildSettingsScreen.jsx
// Phase 3 spec section 4.5 — 자녀 설정 (신규).
// 자녀가 직접 만질 수 있는 최소 셋: 테마 / 알림 / 마스코트 표시 / 계정 read-only / 로그아웃
// Theme picker는 lib/theme.js의 canonical THEME_PALETTE를 단일 source로 사용.

import { useBackHandler } from "../../lib/backHandler.js";
import { THEME_PALETTE as THEME_DICT } from "../../lib/theme.js";

const THEME_OPTIONS = Object.entries(THEME_DICT).map(([hex, t]) => ({
    color: hex,
    accent: t.accent,
    label: t.label || hex,
}));

function Toggle({ value, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            aria-label={ariaLabel}
            onClick={() => onChange(!value)}
            style={{
                width: 52, height: 30,
                borderRadius: "var(--radius-pill)",
                background: value ? "var(--theme-accent)" : "var(--bg-muted)",
                border: "none", cursor: "pointer",
                position: "relative", flexShrink: 0,
                transition: "background var(--duration-fast) var(--easing-standard)",
            }}
        >
            <span
                style={{
                    position: "absolute",
                    top: 3, left: value ? 25 : 3,
                    width: 24, height: 24,
                    borderRadius: "var(--radius-full)",
                    background: "var(--bg-base)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    transition: "left var(--duration-fast) var(--easing-cheer)",
                }}
            />
        </button>
    );
}

function Row({ icon, label, children }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderBottom: "1px solid var(--line-subtle)",
            }}
        >
            <span aria-hidden="true" style={{ fontSize: 18, width: 28, textAlign: "center" }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: "var(--weight-semibold)", color: "var(--fg-primary)" }}>{label}</span>
            {children}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section style={{ marginBottom: "var(--space-5)" }}>
            <h2
                className="t-section-label"
                style={{ marginLeft: "var(--space-4)", marginBottom: "var(--space-2)" }}
            >
                {title}
            </h2>
            <div
                style={{
                    background: "var(--bg-base)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-card)",
                    overflow: "hidden",
                }}
            >
                {children}
            </div>
        </section>
    );
}

export function ChildSettingsScreen({
    onBack,
    currentTheme = "pink",
    onChangeTheme,
    soundEnabled = true,
    onChangeSound,
    showMascot = true,
    onChangeShowMascot,
    childName = "",
    parentNames = "",
    onRequestParentChange,
    onLogout,
    themeLocked = false,
}) {
    useBackHandler(() => {
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });
    return (
        <div
            className="hyeni-child-settings-screen"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 400,
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                fontFamily: "var(--font-sans)",
            }}
        >
            <header
                style={{
                    background: "var(--bg-base)",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4) var(--space-3)",
                    borderBottom: "1px solid var(--line-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexShrink: 0,
                }}
            >
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로"
                    style={{
                        width: 36, height: 36,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--line-soft)",
                        background: "var(--bg-base)",
                        cursor: "pointer",
                        fontFamily: "inherit", fontSize: 16,
                        color: "var(--fg-secondary)",
                    }}
                >
                    ←
                </button>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>설정</h1>
            </header>

            <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) 0 var(--space-6)" }}>
                <Section title="테마">
                    <div style={{ padding: "var(--space-4)" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-secondary)", marginBottom: "var(--space-3)", fontWeight: "var(--weight-medium)" }}>
                            {themeLocked ? "부모님이 잠궜어. 변경하려면 부모님께 부탁해줘." : "내 테마 색을 골라봐"}
                        </p>
                        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            {THEME_OPTIONS.map((t) => {
                                const active = t.color === currentTheme;
                                return (
                                    <button
                                        key={t.color}
                                        type="button"
                                        onClick={() => !themeLocked && onChangeTheme?.(t.color)}
                                        disabled={themeLocked}
                                        aria-label={`${t.label} 테마${active ? " (선택됨)" : ""}`}
                                        style={{
                                            width: 44, height: 44,
                                            borderRadius: "var(--radius-full)",
                                            background: t.color,
                                            border: active ? "3px solid var(--fg-primary)" : "1px solid var(--line-soft)",
                                            cursor: themeLocked ? "not-allowed" : "pointer",
                                            opacity: themeLocked ? 0.4 : 1,
                                            padding: 0,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </Section>

                <Section title="앱 설정">
                    <Row icon="🔔" label="소리·진동">
                        <Toggle value={soundEnabled} onChange={onChangeSound || (() => {})} ariaLabel="소리·진동" />
                    </Row>
                    <Row icon="🐰" label="마스코트 보여주기">
                        <Toggle value={showMascot} onChange={onChangeShowMascot || (() => {})} ariaLabel="마스코트 보여주기" />
                    </Row>
                </Section>

                <Section title="계정">
                    <Row icon="👤" label="이름">
                        <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{childName || "—"}</span>
                    </Row>
                    <Row icon="👨‍👩‍👧" label="부모">
                        <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{parentNames || "—"}</span>
                    </Row>
                    {typeof onRequestParentChange === "function" && (
                        <div style={{ padding: "var(--space-3) var(--space-4)" }}>
                            <button
                                type="button"
                                onClick={onRequestParentChange}
                                style={{
                                    width: "100%",
                                    padding: "var(--space-3)",
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--theme-accent)",
                                    background: "var(--theme-accent-soft)",
                                    color: "var(--theme-accent-text)",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontSize: 13,
                                    fontWeight: "var(--weight-bold)",
                                }}
                            >
                                부모님께 변경 요청
                            </button>
                        </div>
                    )}
                </Section>

                {typeof onLogout === "function" && (
                    <div style={{ padding: "var(--space-4)", textAlign: "center" }}>
                        <button
                            type="button"
                            onClick={onLogout}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--fg-tertiary)",
                                fontSize: 13,
                                fontWeight: "var(--weight-medium)",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textDecoration: "underline",
                                textUnderlineOffset: "3px",
                            }}
                        >
                            로그아웃
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
