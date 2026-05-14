// src/components/childMode/ChildSettingsScreen.jsx
// Phase 3 spec section 4.5 — 자녀 설정 (신규).
// 자녀가 직접 만질 수 있는 최소 셋: 테마 / 알림 / 마스코트 표시 / 계정 read-only / 로그아웃
// Theme picker는 lib/theme.js의 canonical THEME_PALETTE를 단일 source로 사용.

import { useState } from "react";
import { useBackHandler } from "../../lib/backHandler.js";
import { THEME_PALETTE as THEME_DICT } from "../../lib/theme.js";
import { AnimalIcon, ANIMAL_EMOJI, ANIMAL_NAMES } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const THEME_OPTIONS = Object.entries(THEME_DICT).map(([hex, t]) => ({
    color: hex,
    accent: t.accent,
    label: t.label || hex,
}));

const ANIMAL_LABELS = {
    rabbit: "토끼",
    cat: "고양이",
    fox: "여우",
    dog: "강아지",
    chick: "병아리",
    bear: "곰",
    panda: "판다",
    tiger: "호랑이",
};

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
                    background: "var(--cartoon-bg-card)",
                    boxShadow: "var(--cartoon-shadow-thumb)",
                    transition: "left var(--duration-fast) var(--easing-cheer)",
                }}
            />
        </button>
    );
}

function Row({ icon, label, children }) {
    return (
        <div
            className="hyeni-child-settings-row"
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
        <section style={{ marginBottom: "var(--space-5)", padding: "0 var(--space-4)" }}>
            <h2
                className="t-section-label"
                style={{ marginBottom: "var(--space-2)" }}
            >
                {title}
            </h2>
            <div className="card" style={{ overflow: "hidden" }}>
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
    currentEmoji = "🐰",
    onChangeEmoji,
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
    // micro interaction — 색상 버튼 클릭 시 잠깐 bounce + 활성 버튼은 항상 scale 1.1 + halo + 체크
    const [recentlyChanged, setRecentlyChanged] = useState(null);
    const handleThemeClick = (color) => {
        if (themeLocked) return;
        onChangeTheme?.(color);
        setRecentlyChanged(color);
        window.setTimeout(() => setRecentlyChanged((prev) => (prev === color ? null : prev)), 600);
    };
    return (
        <div
            className="hyeni-child-settings-screen"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 400,
                background: "var(--cartoon-bg-cream)",
                display: "flex",
                flexDirection: "column",
                fontFamily: "var(--font-sans)",
            }}
        >
            <header
                style={{
                    background: "var(--cartoon-bg-card)",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4) var(--space-3)",
                    borderBottom: "1px solid var(--cartoon-line)",
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
                    className="btn-icon-circle"
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
                        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", padding: "var(--space-2) 0" }}>
                            {THEME_OPTIONS.map((t) => {
                                const active = t.color === currentTheme;
                                const justPicked = recentlyChanged === t.color;
                                const scale = justPicked ? 1.22 : active ? 1.1 : 1;
                                return (
                                    <button
                                        key={t.color}
                                        type="button"
                                        onClick={() => handleThemeClick(t.color)}
                                        disabled={themeLocked}
                                        aria-label={`${t.label} 테마${active ? " (선택됨)" : ""}`}
                                        aria-pressed={active}
                                        style={{
                                            width: 44, height: 44,
                                            borderRadius: "var(--radius-full)",
                                            background: t.color,
                                            border: active ? "3px solid var(--fg-primary)" : "1px solid var(--line-soft)",
                                            cursor: themeLocked ? "not-allowed" : "pointer",
                                            opacity: themeLocked ? 0.4 : 1,
                                            padding: 0,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#FFFFFF",
                                            fontSize: 20,
                                            fontWeight: 900,
                                            lineHeight: 1,
                                            textShadow: "0 1px 2px rgba(0,0,0,0.28)",
                                            transform: `scale(${scale})`,
                                            transition: "transform var(--duration-mascot-bounce, 600ms) var(--easing-soft-bounce, cubic-bezier(0.34, 1.56, 0.64, 1)), border-color 200ms ease, box-shadow 200ms ease",
                                            boxShadow: active
                                                ? `0 0 0 6px color-mix(in srgb, ${t.color} 28%, transparent), 0 6px 14px color-mix(in srgb, ${t.color} 35%, transparent)`
                                                : "none",
                                        }}
                                    >
                                        {active ? <span aria-hidden="true">✓</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Section>

                <Section title="캐릭터">
                    <div style={{ padding: "var(--space-4)" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-secondary)", marginBottom: "var(--space-3)", fontWeight: "var(--weight-medium)" }}>
                            내 화면에 보이는 동물 친구를 골라봐
                        </p>
                        <div
                            role="radiogroup"
                            aria-label="동물 캐릭터 선택"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                gap: "var(--space-3)",
                            }}
                        >
                            {ANIMAL_NAMES.map((name) => {
                                const emoji = ANIMAL_EMOJI[name];
                                const active = emoji === currentEmoji;
                                const label = ANIMAL_LABELS[name] || name;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        aria-label={`${label} 캐릭터${active ? " (선택됨)" : ""}`}
                                        onClick={() => onChangeEmoji?.(emoji)}
                                        style={{
                                            minWidth: 44,
                                            minHeight: 52,
                                            borderRadius: "var(--radius-lg)",
                                            border: active ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                                            background: active ? "var(--theme-accent-soft)" : "var(--cartoon-bg-card)",
                                            display: "inline-flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 4,
                                            cursor: "pointer",
                                            boxShadow: active ? "0 8px 18px color-mix(in srgb, var(--theme-accent) 18%, transparent)" : "none",
                                            transform: active ? "translateY(-1px)" : "none",
                                            transition: "transform var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard)",
                                            fontFamily: "var(--font-sans)",
                                        }}
                                    >
                                        <AnimalIcon name={name} emoji={emoji} size={34} aria-label="" />
                                        <span style={{ fontSize: 10, fontWeight: "var(--weight-bold)", color: active ? "var(--theme-accent-text)" : "var(--fg-secondary)" }}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Section>

                <Section title="앱 설정">
                    <Row icon={<ThreeDIcon name="bell" size={20} aria-label="" />} label="소리·진동">
                        <Toggle value={soundEnabled} onChange={onChangeSound || (() => {})} ariaLabel="소리·진동" />
                    </Row>
                    <Row icon={<ThreeDIcon name="star-face" size={20} aria-label="" />} label="마스코트 보여주기">
                        <Toggle value={showMascot} onChange={onChangeShowMascot || (() => {})} ariaLabel="마스코트 보여주기" />
                    </Row>
                </Section>

                <Section title="계정">
                    <Row icon={<ThreeDIcon name="crown" size={20} aria-label="" />} label="이름">
                        <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{childName || "—"}</span>
                    </Row>
                    <Row icon={<ThreeDIcon name="friend-pair" size={20} aria-label="" />} label="부모">
                        <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{parentNames || "—"}</span>
                    </Row>
                    {typeof onRequestParentChange === "function" && (
                        <div style={{ padding: "var(--space-3) var(--space-4)" }}>
                            <button
                                type="button"
                                onClick={onRequestParentChange}
                                className="btn btn-primary btn-sm"
                                style={{ width: "100%", height: 40, fontSize: 13 }}
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
                            className="cartoon-link"
                            style={{ fontSize: 13, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}
                        >
                            로그아웃
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
