// src/components/place-management/AcademyManager.jsx
// 장소관리 통합 화면 — 학원/조심할 곳/저장 장소 추가·수정·삭제.
// Extracted from App.jsx (Phase 5 #4 / B5d).

import { useEffect, useMemo, useState } from "react";
import { generateUUID } from "../../lib/auth.js";
import { FF } from "../../lib/styleHelpers.js";
import { CATEGORIES, ACADEMY_PRESETS } from "../../lib/scheduleCategories.js";
import { MapPicker } from "../map/MapPicker.jsx";
import AcademyCard from "./AcademyCard.jsx";
import DangerCard from "./DangerCard.jsx";
import SavedPlacesSection from "./SavedPlacesSection.jsx";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

function StatTile({ icon, label, count, accent }) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                padding: "12px 12px 14px",
                background: "#FFFFFF",
                border: "1px solid var(--line-soft, #F1ECEE)",
                borderRadius: 18,
                boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31,24,28,0.06))",
                minWidth: 0,
            }}
        >
            <div style={{ width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {icon}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#5F6368" }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: accent || "#202024", letterSpacing: "-0.02em" }}>
                {count}<span style={{ fontSize: 12, marginLeft: 2, color: "#5F6368" }}>개</span>
            </div>
        </div>
    );
}

export function AcademyManager({
    academies,
    savedPlaces = [],
    dangerZones = [],
    savedPlacesLocked = false,
    dangerZonesLocked = false,
    onSave,
    onSavedPlacesSave,
    onSavedPlacesLocked,
    onDangerZoneAdd,
    onDangerZoneDelete,
    onDangerZonesLocked,
    onClose,
    currentPos,
    bottomNavigation = null
}) {
    const [list, setList] = useState(academies);
    const [savedList, setSavedList] = useState(savedPlaces);
    const [dangerList, setDangerList] = useState(dangerZones);
    const [activeFilter, setActiveFilter] = useState("academy"); // academy | danger | safe | frequent
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", category: "school", emoji: "📚", location: null, schedule: null });
    const [showSavedForm, setShowSavedForm] = useState(false);
    const [showSavedMap, setShowSavedMap] = useState(false);
    const [savedEditIdx, setSavedEditIdx] = useState(null);
    const [savedForm, setSavedForm] = useState({ name: "", location: null, is_playdate_safe: false, public_place_id: null });
    const [showDangerForm, setShowDangerForm] = useState(false);
    const [showDangerMap, setShowDangerMap] = useState(false);
    const [dangerSaving, setDangerSaving] = useState(false);
    const [managerSaving, setManagerSaving] = useState(false);
    const [dangerForm, setDangerForm] = useState({ name: "", location: null, radius_m: 200, zone_type: "custom" });
    const DAYS_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
    const DANGER_TYPES = [
        { id: "construction", label: "공사장", emoji: "🚧", color: "var(--status-cautionary)" },
        { id: "entertainment", label: "유흥가", emoji: "🎰", color: "var(--status-negative)" },
        { id: "water", label: "수변지역", emoji: "🌊", color: "#3B82F6" },
        { id: "custom", label: "직접 설정", emoji: "⚠️", color: "var(--status-negative)" },
    ];
    const academyListChanged = JSON.stringify(list) !== JSON.stringify(academies);
    const savedPlacesChanged = JSON.stringify(savedList) !== JSON.stringify(savedPlaces);
    const hasBottomNavigation = !!bottomNavigation;

    useEffect(() => {
        setDangerList(dangerZones);
    }, [dangerZones]);

    const openNew = (preset = null) => {
        setForm(preset ? { name: preset.label, category: preset.category, emoji: preset.emoji, location: null, schedule: null } : { name: "", category: "school", emoji: "📚", location: null, schedule: null });
        setEditIdx(null); setShowForm(true);
    };
    const openEdit = (idx) => {
        const baseSchedule = list[idx].schedule || null;
        setForm({
            ...list[idx],
            schedule: baseSchedule
                ? { ...baseSchedule, repeatWeeks: Math.max(1, Number(baseSchedule.repeatWeeks || 4)) }
                : null
        });
        setEditIdx(idx);
        setShowForm(true);
    };
    const saveForm = () => {
        if (!form.name.trim()) return;
        const cat = CATEGORIES.find(c => c.id === form.category);
        const item = { ...form, color: cat.color, bg: cat.bg };
        if (editIdx !== null) { const nl = [...list]; nl[editIdx] = item; setList(nl); }
        else setList(p => [...p, item]);
        setShowForm(false);
    };
    const removeItem = (idx) => setList(p => p.filter((_, i) => i !== idx));
    const canEditSavedPlaces = () => {
        if (!savedPlacesLocked) return true;
        if (typeof onSavedPlacesLocked === "function") onSavedPlacesLocked();
        return false;
    };
    const openNewSavedPlace = () => {
        if (!canEditSavedPlaces()) return;
        setSavedForm({ name: "", location: null, is_playdate_safe: false, public_place_id: null });
        setSavedEditIdx(null);
        setShowSavedForm(true);
        setShowForm(false);
    };
    const openNewSafePlace = () => {
        if (!canEditSavedPlaces()) return;
        setSavedForm({ name: "", location: null, is_playdate_safe: true, public_place_id: null });
        setSavedEditIdx(null);
        setShowSavedForm(true);
        setShowForm(false);
    };
    const openSavedPlaceEdit = (idx) => {
        if (!canEditSavedPlaces()) return;
        const place = savedList[idx] || {};
        setSavedForm({
            ...place,
            is_playdate_safe: !!place.is_playdate_safe,
            public_place_id: place.public_place_id || null,
        });
        setSavedEditIdx(idx);
        setShowSavedForm(true);
        setShowForm(false);
    };
    const saveSavedPlaceForm = () => {
        if (!savedForm.name.trim() || !savedForm.location?.address) return;
        const item = { ...savedForm, id: savedForm.id || generateUUID(), name: savedForm.name.trim() };
        if (savedEditIdx !== null) {
            const nextList = [...savedList];
            nextList[savedEditIdx] = item;
            setSavedList(nextList);
        } else {
            setSavedList(prev => [...prev, item]);
        }
        setShowSavedForm(false);
    };
    const removeSavedPlace = (idx) => {
        if (!canEditSavedPlaces()) return;
        setSavedList(prev => prev.filter((_, index) => index !== idx));
    };
    const canEditDangerZones = () => {
        if (!dangerZonesLocked) return true;
        if (typeof onDangerZonesLocked === "function") onDangerZonesLocked();
        return false;
    };
    const openNewDangerPlace = () => {
        if (!canEditDangerZones()) return;
        setDangerForm({ name: "", location: null, radius_m: 200, zone_type: "custom" });
        setShowDangerForm(true);
        setShowForm(false);
        setShowSavedForm(false);
    };
    const saveDangerPlaceForm = async () => {
        const lat = Number(dangerForm.location?.lat);
        const lng = Number(dangerForm.location?.lng);
        if (!dangerForm.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || dangerSaving) return;
        setDangerSaving(true);
        try {
            const saved = await onDangerZoneAdd?.({
                name: dangerForm.name.trim(),
                lat,
                lng,
                radius_m: Math.max(50, Number(dangerForm.radius_m || 200)),
                zone_type: dangerForm.zone_type || "custom",
            });
            setDangerList(prev => [...prev, saved || {
                id: generateUUID(),
                name: dangerForm.name.trim(),
                lat,
                lng,
                radius_m: Math.max(50, Number(dangerForm.radius_m || 200)),
                zone_type: dangerForm.zone_type || "custom",
            }]);
            setShowDangerForm(false);
            setDangerForm({ name: "", location: null, radius_m: 200, zone_type: "custom" });
        } catch (error) {
            console.error("[AcademyManager] danger zone save failed:", error);
        } finally {
            setDangerSaving(false);
        }
    };
    const removeDangerPlace = async (zone) => {
        if (!canEditDangerZones() || !zone?.id) return;
        if (typeof window !== "undefined" && window.confirm && !window.confirm(`"${zone.name}" 조심할 곳을 삭제할까요?`)) return;
        try {
            await onDangerZoneDelete?.(zone.id);
            setDangerList(prev => prev.filter(item => item.id !== zone.id));
        } catch (error) {
            console.error("[AcademyManager] danger zone delete failed:", error);
        }
    };
    const handleSaveAndClose = async () => {
        if (managerSaving) return;
        setManagerSaving(true);
        try {
            if (academyListChanged) {
                const saved = await onSave(list);
                if (saved === false) return;
            }
            if (savedPlacesChanged && typeof onSavedPlacesSave === "function") {
                const savedPlacesResult = await onSavedPlacesSave(savedList);
                if (savedPlacesResult === false) return;
            }
            onClose();
        } catch (error) {
            console.error("[AcademyManager] save failed:", error);
        } finally {
            setManagerSaving(false);
        }
    };

    if (showMap) return (
        <MapPicker initial={form.location} currentPos={currentPos} title="📍 학원 위치 설정"
            onClose={() => setShowMap(false)}
            onConfirm={loc => { setForm(p => ({ ...p, location: loc })); setShowMap(false); }} />
    );

    if (showSavedMap) return (
        <MapPicker
            initial={savedForm.location}
            currentPos={currentPos}
            title={savedForm.is_playdate_safe ? "🛡️ 안전장소 설정" : "📍 자주 가는 장소 설정"}
            onClose={() => setShowSavedMap(false)}
            onConfirm={loc => {
                setSavedForm(prev => ({
                    ...prev,
                    location: loc,
                    name: prev.name.trim() ? prev.name : (prev.is_playdate_safe ? "안전장소" : (loc.address || "").split(" ").slice(-1)[0] || "자주 가는 장소"),
                    public_place_id: loc.kakao_place_id && loc.kakao_place_id === prev.location?.kakao_place_id ? prev.public_place_id || null : null,
                }));
                setShowSavedMap(false);
            }}
        />
    );

    if (showDangerMap) return (
        <MapPicker
            initial={dangerForm.location}
            currentPos={currentPos}
            title="⚠️ 조심할 곳 설정"
            onClose={() => setShowDangerMap(false)}
            onConfirm={loc => {
                setDangerForm(prev => ({
                    ...prev,
                    location: loc,
                    name: prev.name.trim() ? prev.name : (loc.address || "").split(" ").slice(-1)[0] || "조심할 곳",
                }));
                setShowDangerMap(false);
            }}
        />
    );

    const safePlacesCount = savedList.filter(p => p.is_playdate_safe).length;
    const frequentPlacesCount = savedList.filter(p => !p.is_playdate_safe).length;
    const academyCount = list.length;
    const dangerCount = dangerList.length;

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (...fields) => {
        if (!trimmedQuery) return true;
        return fields.some(field => String(field || "").toLowerCase().includes(trimmedQuery));
    };
    const filteredAcademyList = trimmedQuery
        ? list.filter(item => matchesQuery(item.name, item.location?.address, item.category))
        : list;
    const filteredDangerList = trimmedQuery
        ? dangerList.filter(item => matchesQuery(item.name, item.zone_type))
        : dangerList;
    const toggleSearch = () => {
        setShowSearch(prev => {
            const next = !prev;
            if (!next) setSearchQuery("");
            return next;
        });
    };

    const FILTER_TABS = [
        { id: "academy", label: "학원", icon: "calendar-check", color: "var(--brand-mint, #31C48D)", bg: "var(--brand-mint-soft, #DDF7EA)", text: "var(--brand-mint-text, #087653)" },
        { id: "danger", label: "위험장소", icon: "shield", color: "var(--brand-rose, #F779A8)", bg: "var(--brand-rose-soft, #FFE2EC)", text: "var(--brand-rose-text, #B83262)" },
        { id: "safe", label: "안전장소", icon: "shield-heart", color: "var(--brand-mint, #31C48D)", bg: "var(--brand-mint-soft, #DDF7EA)", text: "var(--brand-mint-text, #087653)" },
        { id: "frequent", label: "자주가는장소", icon: "pin-lavender", color: "var(--brand-lavender, #A78BFA)", bg: "var(--brand-lavender-soft, #EFE8FF)", text: "var(--brand-lavender-text, #5F43B2)" },
    ];

    const handleFilterCta = () => {
        if (activeFilter === "academy") openNew();
        else if (activeFilter === "danger") openNewDangerPlace();
        else if (activeFilter === "safe") openNewSafePlace();
        else if (activeFilter === "frequent") openNewSavedPlace();
    };

    const ctaLabel = activeFilter === "academy" ? "새 학원 추가하기"
        : activeFilter === "danger" ? "새 위험장소 추가하기"
        : activeFilter === "safe" ? "새 안전장소 추가하기"
        : "새 자주가는장소 추가하기";

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "var(--bg-page-mint, #F1FBF6)", display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Hero header — bunny + title + actions */}
            <section
                aria-label="장소관리 헤더"
                style={{
                    margin: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 0",
                    padding: "16px 18px 18px",
                    background: "linear-gradient(135deg, #FFFFFF 0%, var(--brand-mint-soft, #DDF7EA) 100%)",
                    borderRadius: 28,
                    border: "1px solid var(--brand-mint-line, #BCEBD8)",
                    boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31,24,28,0.06))",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <button
                    type="button"
                    aria-label="장소관리 닫기"
                    onClick={onClose}
                    style={{
                        flexShrink: 0,
                        width: 60,
                        height: 60,
                        background: "var(--brand-mint-soft, #DDF7EA)",
                        border: "1px solid var(--brand-mint-line, #BCEBD8)",
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                    }}
                >
                    <AnimalIcon name="rabbit" size={48} aria-label="" />
                </button>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#202024", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        학원·장소 관리
                    </h1>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#5F6368", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        아이 일정과 안전 장소를 정리해요
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                        type="button"
                        aria-label={showSearch ? "검색 닫기" : "검색"}
                        aria-pressed={showSearch}
                        onClick={toggleSearch}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: showSearch ? "var(--brand-mint, #31C48D)" : "#FFFFFF",
                            border: "1px solid var(--brand-mint-line, #BCEBD8)",
                            color: showSearch ? "#FFFFFF" : "var(--brand-mint-text, #087653)",
                            fontSize: 16,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: FF,
                        }}
                    >
                        {showSearch ? "✕" : "🔍"}
                    </button>
                    <button
                        type="button"
                        aria-label="새 장소 추가"
                        onClick={handleFilterCta}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "var(--brand-mint-soft, #DDF7EA)",
                            border: "1px solid var(--brand-mint, #31C48D)",
                            color: "var(--brand-mint-deep, #15936B)",
                            fontSize: 22,
                            fontWeight: 900,
                            cursor: "pointer",
                            fontFamily: FF,
                            lineHeight: 1,
                        }}
                    >
                        +
                    </button>
                </div>
            </section>

            {showSearch && (
                <div style={{ padding: "12px 16px 0", display: "flex", gap: 8, alignItems: "center" }}>
                    <div
                        style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 14px",
                            background: "#FFFFFF",
                            border: "1px solid var(--brand-mint-line, #BCEBD8)",
                            borderRadius: 16,
                            boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31,24,28,0.06))",
                        }}
                    >
                        <span aria-hidden="true" style={{ fontSize: 14 }}>🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={
                                activeFilter === "academy" ? "학원 이름·주소·카테고리"
                                : activeFilter === "danger" ? "위험장소 이름·종류"
                                : activeFilter === "safe" ? "안전장소 이름"
                                : "자주가는장소 이름"
                            }
                            autoFocus
                            aria-label="장소 검색"
                            style={{
                                flex: 1,
                                border: "none",
                                outline: "none",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--fg-primary)",
                                fontFamily: FF,
                                background: "transparent",
                                minWidth: 0,
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="검색어 지우기"
                                onClick={() => setSearchQuery("")}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--fg-tertiary)",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    padding: 0,
                                    lineHeight: 1,
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div
                role="tablist"
                aria-label="장소 필터"
                style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    padding: "12px 16px 4px",
                    scrollbarWidth: "none",
                }}
            >
                {FILTER_TABS.map(tab => {
                    const active = activeFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setActiveFilter(tab.id)}
                            style={{
                                flexShrink: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 16px 10px 10px",
                                borderRadius: 999,
                                border: active ? `2px solid ${tab.color}` : "1px solid var(--line-soft, #F1ECEE)",
                                background: active ? tab.bg : "#FFFFFF",
                                color: active ? tab.text : "#5F6368",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: FF,
                                boxShadow: active ? "0 6px 14px rgba(31,24,28,0.08)" : "none",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <ThreeDIcon name={tab.icon} size={22} aria-label="" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Stats — 3 tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, padding: "12px 16px 4px" }}>
                <StatTile
                    icon={<ThreeDIcon name="calendar-check" size={36} aria-label="" />}
                    label="등록 학원"
                    count={academyCount}
                    accent="var(--brand-mint-text, #087653)"
                />
                <StatTile
                    icon={<ThreeDIcon name="shield-heart" size={36} aria-label="" />}
                    label="안전장소"
                    count={safePlacesCount}
                    accent="var(--brand-mint-text, #087653)"
                />
                <StatTile
                    icon={<ThreeDIcon name="shield" size={36} aria-label="" />}
                    label="위험장소"
                    count={dangerCount}
                    accent="var(--brand-rose-text, #B83262)"
                />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", paddingBottom: hasBottomNavigation ? 16 : "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>

                {/* Form */}
                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: "18px", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 14 }}>{editIdx !== null ? "✏️ 학원 수정" : "➕ 학원 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>학원 이름</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예) 영어학원, 수학왕..."
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid var(--bg-muted)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>카테고리</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {CATEGORIES.map(cat => {
                                    const active = form.category === cat.id;
                                    return (
                                        <button key={cat.id} onClick={() => setForm(p => ({ ...p, category: cat.id, emoji: cat.emoji }))}
                                            style={{ padding: "7px 12px", borderRadius: 14, border: active ? "2px solid var(--theme-accent)" : "2px solid var(--theme-accent-line)", background: active ? "var(--theme-accent-soft)" : "white", color: active ? "var(--theme-accent-text)" : "var(--fg-secondary)", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}>
                                            {cat.emoji} {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📍 위치 (GPS)</label>
                            {form.location ? (
                                <div style={{ background: "var(--theme-accent-soft)", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--theme-accent)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed var(--theme-accent-line)", borderRadius: 14, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 위치 선택
                                </button>
                            )}
                        </div>
                        {/* Schedule (days + time) */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📅 요일 & 시간</label>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {DAYS_LABEL.map((d, i) => {
                                    const active = form.schedule?.days?.includes(i);
                                    return (
                                        <button key={i} onClick={() => {
                                            const days = form.schedule?.days || [];
                                            const newDays = active ? days.filter(x => x !== i) : [...days, i].sort();
                                            setForm(p => ({ ...p, schedule: { ...(p.schedule || { startTime: "15:00", endTime: "16:00", repeatWeeks: 4 }), days: newDays } }));
                                        }}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FF, border: active ? "2px solid var(--theme-accent)" : "2px solid var(--bg-muted)", background: active ? "var(--theme-accent-soft)" : "#FAFAFA", color: active ? "var(--theme-accent-text)" : "var(--fg-secondary)", transition: "all 0.15s" }}>
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.schedule?.days?.length > 0 && (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="time" className="hyeni-time-input" value={form.schedule?.startTime || "15:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, startTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid var(--bg-muted)", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none", accentColor: "var(--theme-accent)", colorScheme: "light" }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-tertiary)" }}>~</span>
                                    <input type="time" className="hyeni-time-input" value={form.schedule?.endTime || "16:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, endTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid var(--bg-muted)", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none", accentColor: "var(--theme-accent)", colorScheme: "light" }} />
                                </div>
                            )}
                            {form.schedule?.days?.length > 0 && (
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)" }}>반복 기간</span>
                                    <select
                                        value={Math.max(1, Number(form.schedule?.repeatWeeks || 4))}
                                        onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, repeatWeeks: Number(e.target.value) } }))}
                                        style={{ padding: "8px 10px", borderRadius: 10, border: "2px solid var(--bg-muted)", fontSize: 13, fontWeight: 700, color: "var(--fg-primary)", fontFamily: FF, background: "white" }}
                                    >
                                        <option value={2}>2주</option>
                                        <option value={4}>4주</option>
                                        <option value={8}>8주</option>
                                        <option value={12}>12주</option>
                                    </select>
                                    <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>저장 즉시 캘린더 반영</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: "13px", background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "13px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {showSavedForm && (
                    <div style={{ background: "var(--hyeni-surface-warm)", borderRadius: 20, padding: "18px", marginBottom: 16, border: "1px solid var(--theme-accent-line)" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 14 }}>{savedEditIdx !== null ? "✏️ 장소 수정" : savedForm.is_playdate_safe ? "➕ 안전장소 추가" : "➕ 자주 가는 장소 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>장소 이름</label>
                            <input
                                value={savedForm.name}
                                onChange={e => setSavedForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={savedForm.is_playdate_safe ? "예) 학교 정문, 태권도장, 놀이터" : "예) 집, 할머니 집, 도서관"}
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid var(--bg-muted)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📍 위치</label>
                            {savedForm.location ? (
                                <div style={{ background: "white", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {savedForm.location.address}</div>
                                    <button onClick={() => setShowSavedMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--theme-accent)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowSavedMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed var(--theme-accent-line)", borderRadius: 14, background: "white", color: "var(--theme-accent-text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 장소 선택
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveSavedPlaceForm} style={{ flex: 1, padding: "13px", background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowSavedForm(false)} style={{ flex: 1, padding: "13px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {showDangerForm && (
                    <div style={{ background: "var(--status-negative-subtle)", borderRadius: 20, padding: "18px", marginBottom: 16, border: "1px solid rgba(220,38,38,0.22)" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--status-negative-strong)", marginBottom: 14 }}>➕ 조심할 곳 추가</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>장소 이름</label>
                            <input
                                value={dangerForm.name}
                                onChange={e => setDangerForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="예) 공사장 앞, 큰길 건널목"
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid rgba(220,38,38,0.22)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>종류</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {DANGER_TYPES.map(type => {
                                    const active = dangerForm.zone_type === type.id;
                                    return (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setDangerForm(prev => ({ ...prev, zone_type: type.id }))}
                                            style={{ padding: "7px 12px", borderRadius: 14, border: active ? `2px solid ${type.color}` : "2px solid rgba(220,38,38,0.16)", background: active ? "white" : "rgba(255,255,255,0.72)", color: active ? type.color : "var(--fg-secondary)", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}
                                        >
                                            {type.emoji} {type.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>반경: {dangerForm.radius_m}m</label>
                            <input
                                type="range"
                                min={50}
                                max={500}
                                step={50}
                                value={dangerForm.radius_m}
                                onChange={e => setDangerForm(prev => ({ ...prev, radius_m: Number(e.target.value) }))}
                                style={{ width: "100%", accentColor: "var(--status-negative)" }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📍 위치</label>
                            {dangerForm.location ? (
                                <div style={{ background: "white", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⚠️ {dangerForm.location.address || `${Number(dangerForm.location.lat).toFixed(5)}, ${Number(dangerForm.location.lng).toFixed(5)}`}</div>
                                    <button onClick={() => setShowDangerMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--status-negative)", color: "var(--status-negative-strong)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowDangerMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed rgba(220,38,38,0.32)", borderRadius: 14, background: "white", color: "var(--status-negative-strong)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 조심할 곳 선택
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveDangerPlaceForm} disabled={dangerSaving || !dangerForm.name.trim() || !dangerForm.location}
                                style={{ flex: 1, padding: "13px", background: dangerSaving || !dangerForm.name.trim() || !dangerForm.location ? "#D1D5DB" : "var(--status-negative)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: dangerSaving || !dangerForm.name.trim() || !dangerForm.location ? "default" : "pointer", fontFamily: FF }}>
                                {dangerSaving ? "저장 중..." : "조심할 곳 저장"}
                            </button>
                            <button onClick={() => setShowDangerForm(false)} style={{ flex: 1, padding: "13px", background: "white", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {!showForm && !showSavedForm && !showDangerForm && (
                    <>
                        <button
                            type="button"
                            onClick={handleFilterCta}
                            style={{
                                width: "100%",
                                marginBottom: 14,
                                padding: "16px 18px",
                                background: "linear-gradient(135deg, var(--brand-mint-soft, #DDF7EA) 0%, #FFFDF8 100%)",
                                border: "2px solid var(--brand-mint, #31C48D)",
                                borderRadius: 22,
                                color: "var(--brand-mint-text, #087653)",
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: FF,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 10,
                                boxShadow: "0 8px 20px rgba(49,196,141,0.18)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: "var(--brand-mint, #31C48D)",
                                    color: "#FFFFFF",
                                    fontSize: 18,
                                    fontWeight: 900,
                                    lineHeight: 1,
                                }}
                            >
                                +
                            </span>
                            {ctaLabel}
                        </button>

                        {activeFilter === "academy" && (
                            <AcademyCard
                                list={filteredAcademyList}
                                presets={ACADEMY_PRESETS}
                                categories={CATEGORIES}
                                daysLabel={DAYS_LABEL}
                                onAddNew={() => openNew()}
                                onAddPreset={(preset) => openNew(preset)}
                                onEdit={openEdit}
                                onRemove={removeItem}
                            />
                        )}
                        {activeFilter === "danger" && (
                            <DangerCard
                                list={filteredDangerList}
                                locked={dangerZonesLocked}
                                dangerTypes={DANGER_TYPES}
                                onAddNew={openNewDangerPlace}
                                onRemove={removeDangerPlace}
                            />
                        )}
                        {activeFilter === "safe" && (() => {
                            const filtered = savedList
                                .map((place, originalIdx) => ({ place, originalIdx }))
                                .filter(({ place }) => place.is_playdate_safe && matchesQuery(place.name, place.location?.address));
                            const filteredList = filtered.map(({ place }) => place);
                            const mapIdx = (i) => filtered[i]?.originalIdx ?? i;
                            return (
                                <SavedPlacesSection
                                    list={filteredList}
                                    locked={savedPlacesLocked}
                                    onAddNew={openNewSafePlace}
                                    onAddSafe={openNewSafePlace}
                                    onEdit={(i) => openSavedPlaceEdit(mapIdx(i))}
                                    onRemove={(i) => removeSavedPlace(mapIdx(i))}
                                />
                            );
                        })()}
                        {activeFilter === "frequent" && (() => {
                            const filtered = savedList
                                .map((place, originalIdx) => ({ place, originalIdx }))
                                .filter(({ place }) => !place.is_playdate_safe && matchesQuery(place.name, place.location?.address));
                            const filteredList = filtered.map(({ place }) => place);
                            const mapIdx = (i) => filtered[i]?.originalIdx ?? i;
                            return (
                                <SavedPlacesSection
                                    list={filteredList}
                                    locked={savedPlacesLocked}
                                    onAddNew={openNewSavedPlace}
                                    onAddSafe={openNewSavedPlace}
                                    onEdit={(i) => openSavedPlaceEdit(mapIdx(i))}
                                    onRemove={(i) => removeSavedPlace(mapIdx(i))}
                                />
                            );
                        })()}
                    </>
                )}
            </div>
            <div style={{ padding: "12px 16px", paddingBottom: hasBottomNavigation ? 10 : "calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid var(--bg-muted)", background: "rgba(255,255,255,0.96)", boxShadow: "0 -10px 24px rgba(31,26,34,0.06)" }}>
                <button
                    type="button"
                    aria-label="장소관리 저장"
                    onClick={handleSaveAndClose}
                    disabled={managerSaving}
                    style={{ width: "100%", padding: "14px", border: "none", borderRadius: 16, background: managerSaving ? "#D1D5DB" : "var(--hyeni-theme-gradient)", color: "white", fontSize: 15, fontWeight: 900, cursor: managerSaving ? "default" : "pointer", fontFamily: FF, boxShadow: managerSaving ? "none" : "var(--hyeni-theme-shadow-soft)" }}
                >
                    {managerSaving ? "저장 중..." : "저장하고 닫기"}
                </button>
            </div>
            {bottomNavigation && (
                <div className="hyeni-manager-bottom-nav" aria-label="장소관리 하단 바로가기">
                    {bottomNavigation}
                </div>
            )}
        </div>
    );
}
