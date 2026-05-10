// src/components/place-management/SavedPlaceManager.jsx
// 자주 가는 장소 관리 — 이름 + 지도 위치 선택, 추가/수정/삭제.
// Extracted from App.jsx (Phase 5 #4 / B17).

import { useState } from "react";
import { generateUUID } from "../../lib/auth.js";
import { FF } from "../../lib/styleHelpers.js";
import { MapPicker } from "../map/MapPicker.jsx";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

export function SavedPlaceManager({
    places,
    onSave,
    onClose,
    currentPos,
    isPremium = false,
    freeSafePlaceLimit = 1,
    onRequestUpgrade,
}) {
    const [list, setList] = useState(places);
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", location: null, is_playdate_safe: !isPremium });

    // 무료 티어: 모든 장소가 자동으로 안전장소(is_playdate_safe=true) 처리되며 한도 1개.
    const safeCount = list.filter((p) => p.is_playdate_safe).length;
    const freeQuotaReached = !isPremium && safeCount >= freeSafePlaceLimit && editIdx === null;

    const openNew = () => {
        if (freeQuotaReached) {
            if (typeof onRequestUpgrade === "function") onRequestUpgrade();
            return;
        }
        setForm({ name: "", location: null, is_playdate_safe: !isPremium });
        setEditIdx(null);
        setShowForm(true);
    };
    const openEdit = (idx) => {
        setForm({ ...list[idx] });
        setEditIdx(idx);
        setShowForm(true);
    };
    const saveForm = () => {
        if (!form.name.trim() || !form.location?.address) return;
        const item = {
            ...form,
            id: form.id || generateUUID(),
            name: form.name.trim(),
            is_playdate_safe: isPremium ? !!form.is_playdate_safe : true,
        };
        if (editIdx !== null) {
            const nextList = [...list];
            nextList[editIdx] = item;
            setList(nextList);
        } else {
            setList((prev) => [...prev, item]);
        }
        setShowForm(false);
    };
    const removeItem = (idx) => setList((prev) => prev.filter((_, index) => index !== idx));

    if (showMap) return (
        <MapPicker
            initial={form.location}
            currentPos={currentPos}
            title="📍 자주 가는 장소 설정"
            onClose={() => setShowMap(false)}
            onConfirm={(loc) => {
                setForm((prev) => ({
                    ...prev,
                    location: loc,
                    name: prev.name.trim() ? prev.name : (loc.address || "").split(" ").slice(-1)[0] || "자주 가는 장소",
                }));
                setShowMap(false);
            }}
        />
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "white", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid var(--bg-muted)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "var(--fg-primary)" }}>📍 자주 가는 장소</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>
                {!isPremium && (
                    <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "var(--theme-accent-soft)", border: "1px solid var(--theme-accent-line)", fontSize: 12, lineHeight: 1.55, color: "var(--theme-accent-text)" }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>💡 무료 안내</div>
                        무료 사용자는 안전장소 <strong>{freeSafePlaceLimit}개</strong>까지 저장할 수 있어요 ({safeCount}/{freeSafePlaceLimit}). 더 많이 등록하고 싶으면 프리미엄으로 업그레이드해 봐요!
                    </div>
                )}
                {!showForm && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 10 }}>빠른 추가</div>
                        <button
                            onClick={openNew}
                            style={{
                                padding: "10px 14px",
                                borderRadius: 16,
                                border: freeQuotaReached
                                    ? "2px dashed var(--status-cautionary-line, #FCD34D)"
                                    : "2px dashed var(--theme-accent-line)",
                                background: freeQuotaReached
                                    ? "var(--status-cautionary-subtle, #FEF3C7)"
                                    : "var(--theme-accent-soft)",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: FF,
                                color: freeQuotaReached
                                    ? "var(--status-cautionary-strong, #92400E)"
                                    : "var(--theme-accent-text)",
                            }}
                        >
                            {freeQuotaReached ? "✨ 프리미엄으로 더 추가하기" : "+ 장소 직접 추가"}
                        </button>
                    </div>
                )}

                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: 18, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 14 }}>{editIdx !== null ? "✏️ 장소 수정" : "➕ 장소 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>장소 이름</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="예) 할머니 집, 피아노 학원, 도서관"
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid var(--bg-muted)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📍 위치</label>
                            {form.location ? (
                                <div style={{ background: "var(--theme-accent-soft)", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--theme-accent)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)} style={{ width: "100%", padding: 12, border: "2px dashed var(--theme-accent-line)", borderRadius: 14, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 장소 선택
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: 13, background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 13, background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 10 }}>등록된 장소 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--fg-tertiary)" }}>
                        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
                            <HyeniMascot variant="thinking" size={72} aria-label="" />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>등록된 장소가 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>자주 가는 장소를 저장해 두면 일정 입력이 빨라져요</div>
                    </div>
                )}
                {list.map((place, index) => (
                    <div key={place.id || index} style={{ background: "var(--hyeni-surface-warm)", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: "4px solid var(--theme-accent)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 24 }}>📍</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg-primary)" }}>{place.name}</div>
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.location?.address || "위치 미등록"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--status-negative)", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
