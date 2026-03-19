import { useState } from "react";
import { FF } from "../../lib/utils.js";
import { getCategories, saveCustomCategories, getCustomCategories, ACADEMY_PRESETS } from "../../lib/categories.js";
import CategoryAddForm from "./CategoryAddForm.jsx";
import MapPicker from "../location/MapPicker.jsx";

export default function AcademyManager({ academies, onSave, onClose, currentPos }) {
    const [list, setList] = useState(academies);
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", category: "school", emoji: "📚", location: null, schedule: null });
    const [showAcademyCatAdd, setShowAcademyCatAdd] = useState(false);
    const DAYS_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

    const openNew = (preset = null) => {
        setForm(preset ? { name: preset.label, category: preset.category, emoji: preset.emoji, location: null, schedule: null } : { name: "", category: "school", emoji: "📚", location: null, schedule: null });
        setEditIdx(null); setShowForm(true);
    };
    const openEdit = (idx) => { setForm({ ...list[idx], schedule: list[idx].schedule || null }); setEditIdx(idx); setShowForm(true); };
    const saveForm = () => {
        if (!form.name.trim()) return;
        const cat = getCategories().find(c => c.id === form.category);
        const item = { ...form, color: cat.color, bg: cat.bg };
        if (editIdx !== null) { const nl = [...list]; nl[editIdx] = item; setList(nl); }
        else setList(p => [...p, item]);
        setShowForm(false);
    };
    const removeItem = (idx) => setList(p => p.filter((_, i) => i !== idx));

    if (showMap) return (
        <MapPicker initial={form.location} currentPos={currentPos} title="📍 학원 위치 설정"
            onClose={() => setShowMap(false)}
            onConfirm={loc => { setForm(p => ({ ...p, location: loc })); setShowMap(false); }} />
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "white", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#374151" }}>🏫 학원 목록 관리</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

                {/* Quick presets */}
                {!showForm && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>빠른 추가</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                            {ACADEMY_PRESETS.filter(p => !list.some(a => a.name === p.label)).map(p => (
                                <button key={p.label} onClick={() => openNew(p)}
                                    style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #E5E7EB", background: "#FAFAFA", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>
                                    {p.emoji} {p.label}
                                </button>
                            ))}
                            <button onClick={() => openNew()}
                                style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #F9A8D4", background: "#FFF0F7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#E879A0" }}>
                                + 직접 입력
                            </button>
                        </div>
                    </>
                )}

                {/* Form */}
                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: "18px", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 14 }}>{editIdx !== null ? "✏️ 학원 수정" : "➕ 학원 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>학원 이름</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예) 영어학원, 수학왕..."
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>카테고리</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {getCategories().map(cat => (
                                    <button key={cat.id} onClick={() => setForm(p => ({ ...p, category: cat.id, emoji: cat.emoji }))}
                                        style={{ padding: "7px 12px", borderRadius: 14, border: `2px solid ${form.category === cat.id ? cat.color : "#E5E7EB"}`, background: form.category === cat.id ? cat.color : "white", color: form.category === cat.id ? "white" : cat.color, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}>
                                        {cat.emoji} {cat.label}
                                    </button>
                                ))}
                                <button onClick={() => setShowAcademyCatAdd(prev => !prev)} style={{ padding: "7px 12px", borderRadius: 14, border: "2px dashed #D1D5DB", background: "#F9FAFB", color: "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}>+ 추가</button>
                            </div>
                            {showAcademyCatAdd && <CategoryAddForm onAdd={(cat) => { saveCustomCategories([...getCustomCategories(), cat]); setForm(p => ({ ...p, category: cat.id, emoji: cat.emoji })); setShowAcademyCatAdd(false); }} onClose={() => setShowAcademyCatAdd(false)} />}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📍 위치 (GPS)</label>
                            {form.location ? (
                                <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 위치 선택
                                </button>
                            )}
                        </div>
                        {/* Schedule (days + time) */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📅 요일 & 시간</label>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {DAYS_LABEL.map((d, i) => {
                                    const active = form.schedule?.days?.includes(i);
                                    return (
                                        <button key={i} onClick={() => {
                                            const days = form.schedule?.days || [];
                                            const newDays = active ? days.filter(x => x !== i) : [...days, i].sort();
                                            setForm(p => ({ ...p, schedule: { ...(p.schedule || { startTime: "15:00", endTime: "16:00" }), days: newDays } }));
                                        }}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FF, border: active ? "2px solid #E879A0" : "2px solid #F3F4F6", background: active ? "#FFF0F7" : "#FAFAFA", color: active ? "#E879A0" : i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : "#6B7280", transition: "all 0.15s" }}>
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.schedule?.days?.length > 0 && (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="time" value={form.schedule?.startTime || "15:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, startTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF" }}>~</span>
                                    <input type="time" value={form.schedule?.endTime || "16:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, endTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "13px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {/* Registered academies list */}
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>등록된 학원 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🏫</div>
                        <div style={{ fontSize: 14 }}>등록된 학원이 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>위에서 추가해 보세요!</div>
                    </div>
                )}
                {list.map((a, i) => (
                    <div key={i} style={{ background: a.bg || "#F9FAFB", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${a.color || "#E5E7EB"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 26 }}>{a.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{getCategories().find(c => c.id === a.category)?.label}</div>
                                {a.location && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {a.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                {!a.location && <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>📍 위치 미등록</div>}
                                {a.schedule?.days?.length > 0 && <div style={{ fontSize: 11, color: "#E879A0", fontWeight: 700, marginTop: 3 }}>📅 {a.schedule.days.map(d => DAYS_LABEL[d]).join(", ")} {a.schedule.startTime}~{a.schedule.endTime}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#EF4444", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
