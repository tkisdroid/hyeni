// src/components/friendPlaydate/CreatePlaydateSheet.jsx
// Phase 4 spec section 4.3 — 친구놀이 약속 만들기 3 step.
// EventSheet 재사용 (80vh) + wizard-dots progress.
// 기존 friendPlaydate 핸들러 보존 — 본 컴포넌트는 시각/순서만 정비.

import { useEffect, useState } from "react";
import { EventSheet } from "../multichild/EventModal/EventSheet.jsx";

const STEPS = [
    { id: "who",   label: "누구랑 만나?" },
    { id: "when",  label: "언제·어디서?" },
    { id: "safe",  label: "안전 옵션" },
];

function ProgressDots({ currentIndex, total }) {
    return (
        <div className="wizard-dots" aria-label={`${currentIndex + 1} / ${total} 단계`}>
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className="wizard-dot"
                    data-active={i === currentIndex ? "true" : undefined}
                    data-done={i < currentIndex ? "true" : undefined}
                />
            ))}
        </div>
    );
}

function StepWho({ candidates = [], selected, onSelect, onAddByContact, onAddByKakao }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>
                만날 친구 가족을 골라줘
            </p>
            {candidates.length === 0 && (
                <div style={{ padding: "var(--space-4)", background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-card)", textAlign: "center", fontSize: 13, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}>
                    아직 연결된 친구 가족이 없어요
                </div>
            )}
            {candidates.map((c) => {
                const active = selected?.id === c.id;
                return (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelect?.(c)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            padding: "var(--space-3) var(--space-4)",
                            background: active ? "var(--theme-accent-soft)" : "var(--bg-base)",
                            border: active ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                            borderRadius: "var(--radius-card)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                            width: "100%",
                        }}
                    >
                        <span style={{ width: 36, height: 36, borderRadius: "var(--radius-full)", background: c.color || "var(--theme-accent)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "var(--weight-bold)", fontSize: 14, flexShrink: 0 }}>
                            {(c.name || "?").slice(0, 1)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 14, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{c.name || "친구"}</span>
                            {c.subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--fg-secondary)", marginTop: 2, fontWeight: "var(--weight-medium)" }}>{c.subtitle}</span>}
                        </span>
                    </button>
                );
            })}
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                {typeof onAddByContact === "function" && (
                    <button type="button" className="wizard-secondary" onClick={onAddByContact} style={{ flex: 1, padding: "var(--space-3)", border: "1px dashed var(--line-default)", borderRadius: "var(--radius-md)", textDecoration: "none" }}>
                        📇 연락처에서 초대
                    </button>
                )}
                {typeof onAddByKakao === "function" && (
                    <button type="button" className="wizard-secondary" onClick={onAddByKakao} style={{ flex: 1, padding: "var(--space-3)", border: "1px dashed var(--line-default)", borderRadius: "var(--radius-md)", textDecoration: "none" }}>
                        💛 카카오 공유
                    </button>
                )}
            </div>
        </div>
    );
}

function StepWhen({ places = [], selectedPlace, onSelectPlace, date, onChangeDate, startTime, endTime, onChangeStart, onChangeEnd }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
                <p style={{ margin: "0 0 var(--space-2)", fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>📍 어디서 만나?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {places.length === 0 && (
                        <div style={{ padding: "var(--space-3)", background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-card)", fontSize: 13, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)", textAlign: "center" }}>
                            등록된 안전 장소가 없어요
                        </div>
                    )}
                    {places.map((p) => {
                        const active = selectedPlace?.id === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectPlace?.(p)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                                    padding: "var(--space-3) var(--space-4)",
                                    background: active ? "var(--theme-accent-soft)" : "var(--bg-base)",
                                    border: active ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                                    borderRadius: "var(--radius-card)",
                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                                }}
                            >
                                <span aria-hidden="true" style={{ fontSize: 18 }}>{p.emoji || "📍"}</span>
                                <span style={{ flex: 1, fontSize: 14, fontWeight: "var(--weight-medium)", color: "var(--fg-primary)" }}>{p.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div>
                <p style={{ margin: "0 0 var(--space-2)", fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>⏰ 언제?</p>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <input type="date" value={date || ""} onChange={(e) => onChangeDate?.(e.target.value)} style={{ flex: 1, padding: "var(--space-3)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", fontFamily: "inherit", fontSize: 14, background: "var(--bg-base)", color: "var(--fg-primary)" }} />
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <input type="time" value={startTime || ""} onChange={(e) => onChangeStart?.(e.target.value)} style={{ flex: 1, padding: "var(--space-3)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", fontFamily: "inherit", fontSize: 14, background: "var(--bg-base)", color: "var(--fg-primary)" }} />
                    <span style={{ alignSelf: "center", color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}>~</span>
                    <input type="time" value={endTime || ""} onChange={(e) => onChangeEnd?.(e.target.value)} style={{ flex: 1, padding: "var(--space-3)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", fontFamily: "inherit", fontSize: 14, background: "var(--bg-base)", color: "var(--fg-primary)" }} />
                </div>
            </div>
        </div>
    );
}

function StepSafe({ notifyArrival, onChangeNotifyArrival, notifyDeparture, onChangeNotifyDeparture, autoEndAfterHours, onChangeAutoEnd }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)" }}>안전 알림 설정</p>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-card)", cursor: "pointer" }}>
                <input type="checkbox" checked={notifyArrival} onChange={(e) => onChangeNotifyArrival?.(e.target.checked)} style={{ accentColor: "var(--theme-accent)" }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: "var(--weight-medium)", color: "var(--fg-primary)" }}>도착 시 알림</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-card)", cursor: "pointer" }}>
                <input type="checkbox" checked={notifyDeparture} onChange={(e) => onChangeNotifyDeparture?.(e.target.checked)} style={{ accentColor: "var(--theme-accent)" }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: "var(--weight-medium)", color: "var(--fg-primary)" }}>출발 시 알림</span>
            </label>
            <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-card)" }}>
                <span style={{ display: "block", fontSize: 13, color: "var(--fg-secondary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-2)" }}>자동 종료 시간 (시간)</span>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    {[1, 2, 3, 4].map((h) => (
                        <button
                            key={h}
                            type="button"
                            onClick={() => onChangeAutoEnd?.(h)}
                            style={{
                                flex: 1,
                                padding: "var(--space-2)",
                                borderRadius: "var(--radius-md)",
                                border: autoEndAfterHours === h ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                                background: autoEndAfterHours === h ? "var(--theme-accent-soft)" : "var(--bg-base)",
                                color: autoEndAfterHours === h ? "var(--theme-accent-text)" : "var(--fg-primary)",
                                fontFamily: "inherit",
                                fontSize: 13,
                                fontWeight: "var(--weight-bold)",
                                cursor: "pointer",
                            }}
                        >
                            {h}h
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function CreatePlaydateSheet({
    open,
    onClose,
    onCreate,
    candidates = [],
    safePlaces = [],
    onAddByContact,
    onAddByKakao,
    isSubmitting = false,
}) {
    const [stepIndex, setStepIndex] = useState(0);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("14:00");
    const [endTime, setEndTime] = useState("16:00");
    const [notifyArrival, setNotifyArrival] = useState(true);
    const [notifyDeparture, setNotifyDeparture] = useState(true);
    const [autoEndAfterHours, setAutoEndAfterHours] = useState(2);

    useEffect(() => {
        if (!open) {
            setStepIndex(0);
            setSelectedFriend(null);
            setSelectedPlace(null);
        }
    }, [open]);

    const total = STEPS.length;
    const isLast = stepIndex === total - 1;
    const canProceed =
        stepIndex === 0 ? !!selectedFriend :
        stepIndex === 1 ? !!selectedPlace && !!date && !!startTime :
        true;

    const handleSave = () => {
        if (!isLast) {
            if (canProceed) setStepIndex((i) => Math.min(total - 1, i + 1));
            return;
        }
        onCreate?.({
            friend: selectedFriend,
            place: selectedPlace,
            date, startTime, endTime,
            notifyArrival, notifyDeparture, autoEndAfterHours,
        });
    };

    const renderStep = () => {
        if (stepIndex === 0) return <StepWho candidates={candidates} selected={selectedFriend} onSelect={setSelectedFriend} onAddByContact={onAddByContact} onAddByKakao={onAddByKakao} />;
        if (stepIndex === 1) return <StepWhen places={safePlaces} selectedPlace={selectedPlace} onSelectPlace={setSelectedPlace} date={date} onChangeDate={setDate} startTime={startTime} endTime={endTime} onChangeStart={setStartTime} onChangeEnd={setEndTime} />;
        return <StepSafe notifyArrival={notifyArrival} onChangeNotifyArrival={setNotifyArrival} notifyDeparture={notifyDeparture} onChangeNotifyDeparture={setNotifyDeparture} autoEndAfterHours={autoEndAfterHours} onChangeAutoEnd={setAutoEndAfterHours} />;
    };

    return (
        <EventSheet
            open={open}
            title={STEPS[stepIndex].label}
            saveLabel={isLast ? (isSubmitting ? "보내는 중…" : "보내기") : "다음"}
            canSave={canProceed && !isSubmitting}
            onClose={onClose}
            onSave={handleSave}
        >
            <div style={{ marginBottom: "var(--space-4)" }}>
                <ProgressDots currentIndex={stepIndex} total={total} />
            </div>
            {stepIndex > 0 && (
                <button
                    type="button"
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    style={{
                        background: "transparent", border: "none",
                        color: "var(--fg-secondary)",
                        fontFamily: "inherit", fontSize: 13,
                        fontWeight: "var(--weight-medium)",
                        cursor: "pointer",
                        padding: 0, marginBottom: "var(--space-3)",
                    }}
                >
                    ← 이전 단계
                </button>
            )}
            {renderStep()}
        </EventSheet>
    );
}
