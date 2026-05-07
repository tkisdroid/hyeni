// src/components/settings/PlaceManagerScreen.jsx
// Phase 4 spec section 4.4 — 장소 관리 통합 4 카테고리 collapsible.
// 집·학원·자주 가는 곳·조심할 곳 (조심할 곳은 amber, 강한 빨강 금지).
// 기존 sync.js CRUD 핸들러를 prop으로 받음 — 자체 호출 X.

import { useEffect, useMemo, useState } from "react";
import { useBackHandler } from "../../lib/backHandler.js";

const CATEGORIES_DEF = [
    { id: "home",    icon: "🏠", label: "집" },
    { id: "academy", icon: "🎒", label: "학원" },
    { id: "saved",   icon: "🌳", label: "자주 가는 곳" },
    { id: "caution", icon: "⚠️", label: "조심할 곳", caution: true },
];

function findHomeFromSaved(savedPlaces) {
    return savedPlaces.find((p) => /집|home/i.test(p?.name || "") || p?.is_home);
}

function PlaceRow({ place, color }) {
    const meta = place?.address || place?.location?.address || place?.dong || "";
    return (
        <div className="place-row">
            <span className="place-row-dot" style={{ "--rail": color || "var(--theme-accent)" }} aria-hidden="true" />
            <span className="place-row-name">{place?.name || place?.title || "이름 없음"}</span>
            {meta && <span className="place-row-meta">{meta}</span>}
        </div>
    );
}

function Section({ id, icon, label, caution, places, color, openId, onToggle, onAdd }) {
    const open = openId === id;
    const count = places.length;
    return (
        <div className="place-section" data-open={open ? "true" : "false"}>
            <button
                type="button"
                className="place-section-head"
                data-caution={caution ? "true" : undefined}
                aria-expanded={open}
                onClick={() => onToggle(id)}
            >
                <span className="place-section-icon" aria-hidden="true">{icon}</span>
                <span className="place-section-label">{label}</span>
                <span className="place-section-count">{count}</span>
                <span className="place-section-chev" aria-hidden="true">▾</span>
            </button>
            {open && (
                <>
                    {count === 0 ? (
                        <div className="place-row-empty">아직 등록된 장소가 없어요</div>
                    ) : (
                        places.map((p, i) => (
                            <PlaceRow key={p?.id || i} place={p} color={color} />
                        ))
                    )}
                    {typeof onAdd === "function" && (
                        <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--cartoon-line)" }}>
                            <button
                                type="button"
                                onClick={() => onAdd(id)}
                                className="cartoon-pill cartoon-pill--white"
                                style={{
                                    width: "100%",
                                    height: 40,
                                    fontSize: 13,
                                    border: "1px dashed var(--cartoon-line-strong)",
                                }}
                            >
                                + {label} 추가
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export function PlaceManagerScreen({
    onBack,
    savedPlaces = [],
    academies = [],
    dangerZones = [],
    onAdd,
    bottomNavigation = null,
}) {
    const [openId, setOpenId] = useState("academy");
    useBackHandler(() => {
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });

    const homePlaces = useMemo(() => {
        const home = findHomeFromSaved(savedPlaces);
        return home ? [home] : [];
    }, [savedPlaces]);

    const otherSavedPlaces = useMemo(() => {
        const home = findHomeFromSaved(savedPlaces);
        return home ? savedPlaces.filter((p) => p !== home) : savedPlaces;
    }, [savedPlaces]);

    const sections = [
        { ...CATEGORIES_DEF[0], places: homePlaces, color: "var(--hyeni-cat-sports)" },
        { ...CATEGORIES_DEF[1], places: academies, color: "var(--hyeni-cat-school)" },
        { ...CATEGORIES_DEF[2], places: otherSavedPlaces, color: "var(--hyeni-cat-friend)" },
        { ...CATEGORIES_DEF[3], places: dangerZones, color: "var(--status-cautionary)" },
    ];

    return (
        <div className="settings-screen" aria-label="장소 관리" data-has-bottom-nav={bottomNavigation ? "true" : undefined}>
            <header className="settings-header">
                <button type="button" className="settings-back" onClick={onBack} aria-label="뒤로">←</button>
                <h1 className="settings-title">장소 관리</h1>
            </header>
            <div className="settings-body">
                <div className="settings-section" style={{ paddingTop: 0 }}>
                    {sections.map((s) => (
                        <Section
                            key={s.id}
                            id={s.id}
                            icon={s.icon}
                            label={s.label}
                            caution={s.caution}
                            places={s.places}
                            color={s.color}
                            openId={openId}
                            onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
                            onAdd={onAdd}
                        />
                    ))}
                </div>
            </div>
            {bottomNavigation && (
                <div className="settings-bottom-nav" aria-label="장소 관리 하단 바로가기">
                    {bottomNavigation}
                </div>
            )}
        </div>
    );
}
