// src/components/childMode/ChildSettingsScreen.jsx
// 자녀 설정 화면 — 변경 요청 모델 (Phase 2).
// 이름(별명)만 자녀가 직접 수정. 테마/캐릭터/소리·진동/마스코트는 직접 컨트롤을 두지 않고
// 메뉴별 "변경 요청"으로 부모에게 푸시 + 알림센터 기록을 보낸다. 자녀 화면이므로 반말 톤.

import { useBackHandler } from "../../lib/backHandler.js";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";
import { SETTING_REQUEST_META } from "../../lib/childSettingRequest.js";

// 변경 요청 Row 구성 — SETTING_REQUEST_META 의 메뉴 순서를 단일 source 로 사용.
const REQUEST_MENUS = [
    { key: "theme", icon: "🎨" },
    { key: "character", icon: "🐰" },
    { key: "sound", icon: "🔔" },
    { key: "mascot", icon: "✨" },
];

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
            <h2 className="t-section-label" style={{ marginBottom: "var(--space-2)" }}>{title}</h2>
            <div className="card" style={{ overflow: "hidden" }}>
                {children}
            </div>
        </section>
    );
}

export function ChildSettingsScreen({
    onBack,
    childName = "",
    parentNames = "",
    onEditName,
    onRequestChange,
    onLogout,
}) {
    useBackHandler(() => {
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });

    const canEditName = typeof onEditName === "function";
    const canRequest = typeof onRequestChange === "function";

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
                <button type="button" onClick={onBack} aria-label="뒤로" className="btn-icon-circle">←</button>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>설정</h1>
            </header>

            <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) 0 var(--space-6)" }}>
                <Section title="계정">
                    {canEditName ? (
                        <button
                            type="button"
                            onClick={onEditName}
                            className="hyeni-child-settings-row"
                            aria-label={`이름 수정 (현재 ${childName || "미설정"})`}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-3)",
                                padding: "var(--space-4)",
                                background: "transparent",
                                border: "none",
                                borderBottom: "1px solid var(--line-subtle)",
                                cursor: "pointer",
                                fontFamily: "var(--font-sans)",
                                textAlign: "left",
                            }}
                        >
                            <span aria-hidden="true" style={{ fontSize: 18, width: 28, textAlign: "center" }}>
                                <ThreeDIcon name="crown" size={20} aria-label="" />
                            </span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: "var(--weight-semibold)", color: "var(--fg-primary)" }}>이름</span>
                            <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{childName || "—"}</span>
                            <span aria-hidden="true" style={{ fontSize: 13, color: "var(--fg-tertiary)", marginLeft: "var(--space-1)" }}>수정 ›</span>
                        </button>
                    ) : (
                        <Row icon={<ThreeDIcon name="crown" size={20} aria-label="" />} label="이름">
                            <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{childName || "—"}</span>
                        </Row>
                    )}
                    <Row icon={<ThreeDIcon name="friend-pair" size={20} aria-label="" />} label="부모">
                        <span style={{ fontSize: 14, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>{parentNames || "—"}</span>
                    </Row>
                </Section>

                <Section title="변경 요청">
                    <p style={{ margin: 0, padding: "var(--space-4) var(--space-4) var(--space-2)", fontSize: 12, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)", lineHeight: 1.5 }}>
                        이 설정들은 부모님이 바꿀 수 있어. 바꾸고 싶으면 요청을 보내봐.
                    </p>
                    {REQUEST_MENUS.map(({ key, icon }) => (
                        <Row key={key} icon={icon} label={SETTING_REQUEST_META[key].childLabel}>
                            <button
                                type="button"
                                onClick={() => onRequestChange?.(key)}
                                disabled={!canRequest}
                                className="btn btn-secondary btn-sm"
                                aria-label={`${SETTING_REQUEST_META[key].childLabel} 변경 요청`}
                                style={{ height: 34, fontSize: 12.5, paddingLeft: "var(--space-3)", paddingRight: "var(--space-3)" }}
                            >
                                변경 요청
                            </button>
                        </Row>
                    ))}
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
