// src/components/settings/ParentSettingsScreen.jsx
// Phase 4 spec section 4.5 — 부모 설정 통합 7 그룹.
// 위험 영역은 amber (로그아웃·연결해제·구독해지) → red (계정삭제만) 단계.
// 흩어진 모달들 → 1 화면으로 통합.

import { useBackHandler } from "../../lib/backHandler.js";

const Toggle = ({ value, onChange, ariaLabel }) => (
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
                transition: "left var(--duration-fast) var(--easing-standard)",
            }}
        />
    </button>
);

function Row({ icon, label, onClick, trailing, children, danger, severity }) {
    const Comp = onClick ? "button" : "div";
    return (
        <Comp
            type={onClick ? "button" : undefined}
            className={`settings-row${danger ? " settings-danger-row" : ""}`}
            data-severity={severity}
            onClick={onClick}
        >
            {icon && <span className="settings-row-icon" aria-hidden="true">{icon}</span>}
            <span className="settings-row-label">{label}</span>
            {trailing && <span className="settings-row-trailing">{trailing}</span>}
            {onClick && !children && <span className="settings-row-chev" aria-hidden="true">›</span>}
            {children}
        </Comp>
    );
}

function Section({ title, children, danger }) {
    return (
        <section className={`settings-section${danger ? " settings-danger-section" : ""}`}>
            {title && <h2 className="settings-section-header">{title}</h2>}
            <div className="settings-card">{children}</div>
        </section>
    );
}

const NOTIF_MINUTE_OPTIONS = [
    { value: 30, label: "30분 전" },
    { value: 15, label: "15분 전" },
    { value: 10, label: "10분 전" },
    { value: 5, label: "5분 전" },
    { value: 0, label: "시작 시" },
];

function MinutesBeforeSelector({ value = [15, 5], onChange }) {
    const set = new Set(Array.isArray(value) ? value : []);
    const toggle = (mins) => {
        const next = new Set(set);
        if (next.has(mins)) next.delete(mins);
        else next.add(mins);
        const sorted = Array.from(next).sort((a, b) => b - a);
        if (typeof onChange === "function") onChange(sorted);
    };
    return (
        <div
            role="group"
            aria-label="알림 시간 선택"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-4) var(--space-3)",
            }}
        >
            {NOTIF_MINUTE_OPTIONS.map((opt) => {
                const active = set.has(opt.value);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(opt.value)}
                        aria-pressed={active}
                        className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
                        style={{ height: 32, padding: "0 var(--space-3)", fontSize: 13 }}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

export function ParentSettingsScreen({
    onBack,
    parentName = "",
    parentEmail = "",
    parentPhone = "",
    childCount = 0,
    onEditAccount,
    onAddChild,
    onManageChildren,
    notifyEvents = true,
    notifyChildLocation = true,
    notifyPlaydate = true,
    onChangeNotifyEvents,
    onChangeNotifyChildLocation,
    onChangeNotifyPlaydate,
    notifMinutesBefore = [15, 5],
    onChangeNotifMinutes,
    subscriptionPlanLabel = "무료",
    onOpenSubscription,
    onOpenPlaceManager,
    onOpenPhoneSettings,
    onDataDownload,
    onPrivacyPolicy,
    onOpenFAQ,
    onContactSupport,
    appVersion = "",
    onLogout,
    onUnlinkChild,
    onCancelSubscription,
    onDeleteAccount,
}) {
    useBackHandler(() => {
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });
    return (
        <div className="settings-screen" aria-label="부모 설정">
            <header className="settings-header">
                <button type="button" className="settings-back" onClick={onBack} aria-label="뒤로">←</button>
                <h1 className="settings-title">설정</h1>
            </header>
            <div className="settings-body">
                {/* 1. 내 계정 */}
                <Section title="내 계정">
                    <Row icon="👤" label="이름" trailing={parentName || "—"} onClick={onEditAccount} />
                    {parentEmail && <Row icon="📧" label="이메일" trailing={parentEmail} />}
                    <Row icon="📞" label="전화번호" trailing={parentPhone || "미등록"} onClick={onOpenPhoneSettings} />
                </Section>

                {/* 2. 자녀 관리 */}
                <Section title="자녀 관리">
                    <Row icon="👨‍👩‍👧" label="우리 아이" trailing={`${childCount}명`} onClick={onManageChildren} />
                    {typeof onAddChild === "function" && <Row icon="➕" label="아이 추가하기" onClick={onAddChild} />}
                </Section>

                {/* 3. 알림 */}
                <Section title="알림">
                    <Row icon="🔔" label="일정 알림">
                        <Toggle value={notifyEvents} onChange={onChangeNotifyEvents || (() => {})} ariaLabel="일정 알림" />
                    </Row>
                    {notifyEvents && (
                        <>
                            <Row icon="🕐" label="알림 시간" trailing={<span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>아이 모든 일정에 적용</span>} />
                            <MinutesBeforeSelector
                                value={notifMinutesBefore}
                                onChange={onChangeNotifMinutes}
                            />
                        </>
                    )}
                    <Row icon="📍" label="자녀 위치 알림">
                        <Toggle value={notifyChildLocation} onChange={onChangeNotifyChildLocation || (() => {})} ariaLabel="자녀 위치 알림" />
                    </Row>
                    <Row icon="👫" label="친구놀이 알림">
                        <Toggle value={notifyPlaydate} onChange={onChangeNotifyPlaydate || (() => {})} ariaLabel="친구놀이 알림" />
                    </Row>
                </Section>

                {/* 4. 구독 */}
                <Section title="구독">
                    <Row icon="💳" label="현재 플랜" trailing={subscriptionPlanLabel} onClick={onOpenSubscription} />
                </Section>

                {/* 5. 데이터·개인정보 */}
                <Section title="데이터·개인정보">
                    <Row icon="📍" label="장소 관리" onClick={onOpenPlaceManager} />
                    {typeof onDataDownload === "function" && <Row icon="⬇️" label="내 데이터 다운로드" onClick={onDataDownload} />}
                    {typeof onPrivacyPolicy === "function" && <Row icon="🔒" label="개인정보 처리방침" onClick={onPrivacyPolicy} />}
                </Section>

                {/* 6. 도움말 */}
                <Section title="도움말">
                    {typeof onOpenFAQ === "function" && <Row icon="❓" label="자주 묻는 질문" onClick={onOpenFAQ} />}
                    {typeof onContactSupport === "function" && <Row icon="💬" label="문의하기" onClick={onContactSupport} />}
                    {appVersion && <Row icon="ℹ️" label="버전" trailing={appVersion} />}
                </Section>

                {/* 7. 위험 영역 — amber → red */}
                <Section title="위험 영역" danger>
                    {typeof onLogout === "function" && (
                        <Row icon="🚪" label="로그아웃" onClick={onLogout} danger />
                    )}
                    {typeof onUnlinkChild === "function" && (
                        <Row icon="🔌" label="자녀 연결 해제" onClick={onUnlinkChild} danger />
                    )}
                    {typeof onCancelSubscription === "function" && (
                        <Row icon="❌" label="구독 해지" onClick={onCancelSubscription} danger />
                    )}
                </Section>
                {typeof onDeleteAccount === "function" && (
                    <Section danger>
                        <Row icon="🗑" label="계정 삭제" onClick={onDeleteAccount} danger severity="critical" />
                    </Section>
                )}
            </div>
        </div>
    );
}
