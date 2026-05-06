// src/components/multichild/PairingWizard/PairingWizard.jsx
// Phase 4 spec section 4.1 — 5 → 6 step (디바이스 종류 picker 신규 추가).
// wizard-dots progress + 1-thing/1-page principle (한 화면 1 결정).
// 보존: setupFamily, set_family_member_photo_url_by_id RPC, useBackHandler.

import { useState } from "react";
import { setupFamily } from "../../../lib/auth.js";
import { supabase } from "../../../lib/supabase.js";
import { useBackHandler } from "../../../lib/backHandler.js";
import { autoAssignColor } from "../ChildPalette.js";
import { ChildCountStep } from "./ChildCountStep.jsx";
import { ChildDetailsStep } from "./ChildDetailsStep.jsx";

const TOTAL_STEPS = 6; // 0:family, 1:device, 2:childCount, 3:childDetails, 4:pairCode, 5:complete

const DEVICE_OPTIONS = [
    { id: "own_phone",   icon: "📱", label: "자기 폰",       desc: "자녀가 본인 휴대폰을 가지고 있어요" },
    { id: "shared_phone", icon: "📞", label: "부모 공기계",   desc: "예전에 쓰던 부모님 폰을 자녀에게 넘겨줘요" },
    { id: "kids_phone",  icon: "🎈", label: "키즈폰",         desc: "어린이용 키즈폰이나 워치를 사용해요" },
];

async function uploadPendingPhotos(familyId, children) {
    if (!familyId) return;
    const pending = children
        .map((c, i) => ({ child: c, order: i + 1 }))
        .filter(({ child }) => typeof child.photo_url === "string" && child.photo_url.startsWith("data:"));
    if (pending.length === 0) return;

    const { data: members } = await supabase
        .from("family_members")
        .select("id, child_order")
        .eq("family_id", familyId)
        .eq("role", "child");
    const memberByOrder = new Map((members || []).map((m) => [m.child_order, m]));

    for (const { child, order } of pending) {
        try {
            const member = memberByOrder.get(order);
            if (!member) continue;
            const blob = await (await fetch(child.photo_url)).blob();
            const ext = (blob.type.split("/")[1] || "jpg").split(";")[0] || "jpg";
            const path = `${familyId}/child-${order}-${Date.now()}.${ext}`;
            const bucket = supabase.storage.from("child-photos");
            const { error: upErr } = await bucket.upload(path, blob, {
                upsert: true,
                contentType: blob.type || "image/jpeg",
            });
            if (upErr) {
                console.error("[PairingWizard] photo upload failed:", upErr);
                continue;
            }
            const { error: updErr } = await supabase.rpc("set_family_member_photo_url_by_id", {
                p_family_id: familyId,
                p_member_id: member.id,
                p_url: path,
            });
            if (updErr) console.error("[PairingWizard] photo url persist failed:", updErr);
        } catch (e) {
            console.error("[PairingWizard] photo persist error:", e);
        }
    }
}

function WizardDots({ current, total }) {
    return (
        <div className="wizard-dots" style={{ marginBottom: "var(--space-6)" }} aria-label={`${current + 1} / ${total} 단계`}>
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className="wizard-dot"
                    data-active={i === current ? "true" : undefined}
                    data-done={i < current ? "true" : undefined}
                />
            ))}
        </div>
    );
}

export function PairingWizard({ userId, parentName, parentPhone = "", parentGender = "", onComplete, onCancel }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [familyName, setFamilyName] = useState("");
    const [deviceType, setDeviceType] = useState(null);
    const [childCount, setChildCount] = useState(null);
    const [children, setChildren] = useState([]);
    const [family, setFamily] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // After family is created (stepIndex >= 4), back finalises via onComplete.
    useBackHandler(() => {
        if (busy) return true;
        if (stepIndex >= 4) {
            onComplete?.(family);
            return true;
        }
        if (stepIndex > 0) {
            setStepIndex(stepIndex - 1);
            return true;
        }
        if (onCancel) {
            onCancel();
            return true;
        }
        return false;
    });

    function startChildren() {
        if (children.length === 0) {
            const final = [];
            for (let i = 0; i < childCount; i++) {
                const used = final.map((c) => c.color_hex);
                final.push({ name: "", birthdate: "", color_hex: autoAssignColor(used), photo_url: null });
            }
            setChildren(final);
        }
    }

    async function submitChildren() {
        setBusy(true);
        setError(null);
        try {
            const childrenForInsert = children.map((c) => ({
                ...c,
                photo_url: typeof c.photo_url === "string" && c.photo_url.startsWith("data:")
                    ? null
                    : (c.photo_url || null),
            }));
            const created = await setupFamily(userId, parentName, {
                familyName, plannedChildCount: childCount, children: childrenForInsert, parentPhone, parentGender,
            });
            await uploadPendingPhotos(created.id, children);
            setFamily(created);
            setStepIndex(4); // pair code step
        } catch (err) {
            setError(err.message || "가족 생성 실패");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ padding: "var(--space-screen-pad)", maxWidth: 480, margin: "0 auto" }}>
            <WizardDots current={stepIndex} total={TOTAL_STEPS} />

            {stepIndex === 0 && (
                <Step1FamilyName value={familyName} onChange={setFamilyName} onNext={() => setStepIndex(1)} />
            )}
            {stepIndex === 1 && (
                <Step2DevicePicker value={deviceType} onChange={setDeviceType} onNext={() => setStepIndex(2)} />
            )}
            {stepIndex === 2 && (
                <ChildCountStep
                    value={childCount} onChange={setChildCount}
                    onNext={() => { startChildren(); setStepIndex(3); }}
                />
            )}
            {stepIndex === 3 && (
                <Step4Children
                    children={children} onChange={setChildren}
                    familyId={family?.id || "pending"}
                    busy={busy} error={error}
                    onSubmit={submitChildren}
                />
            )}
            {stepIndex === 4 && family && (
                <Step5PairCode family={family} deviceType={deviceType} onNext={() => setStepIndex(5)} />
            )}
            {stepIndex === 5 && (
                <Step6Complete onComplete={() => onComplete?.(family)} />
            )}
        </div>
    );
}

function Step1FamilyName({ value, onChange, onNext }) {
    return (
        <div>
            <h2 className="t-screen-title" style={{ marginBottom: "var(--space-5)" }}>
                가족 이름을 알려주세요
            </h2>
            <p className="t-screen-subtitle" style={{ marginBottom: "var(--space-3)" }}>
                홈 화면 인사말에 쓰여요
            </p>
            <input
                type="text" value={value} onChange={(e) => onChange(e.target.value)}
                placeholder="예) 혜니네" maxLength={20}
                className="input"
                aria-label="가족 이름"
            />
            <button
                type="button" onClick={onNext} disabled={!value.trim()}
                className="wizard-primary"
                style={{ marginTop: "var(--space-6)" }}
            >다음</button>
        </div>
    );
}

function Step2DevicePicker({ value, onChange, onNext }) {
    return (
        <div>
            <h2 className="t-screen-title" style={{ marginBottom: "var(--space-2)" }}>
                자녀 디바이스가 어떤 종류인가요?
            </h2>
            <p className="t-screen-subtitle" style={{ marginBottom: "var(--space-5)" }}>
                연동 방식이 디바이스에 따라 달라요
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {DEVICE_OPTIONS.map((opt) => {
                    const active = value === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChange(opt.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-3)",
                                padding: "var(--space-4)",
                                borderRadius: "var(--radius-card)",
                                background: active ? "var(--theme-accent-soft)" : "var(--bg-base)",
                                border: active ? "2px solid var(--theme-accent)" : "1px solid var(--line-soft)",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                width: "100%",
                            }}
                            aria-pressed={active}
                        >
                            <span aria-hidden="true" style={{ fontSize: 28, width: 40, textAlign: "center" }}>{opt.icon}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 15, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{opt.label}</span>
                                <span style={{ display: "block", fontSize: 12, color: "var(--fg-secondary)", marginTop: 2, fontWeight: "var(--weight-medium)" }}>{opt.desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <button
                type="button" onClick={onNext} disabled={!value}
                className="wizard-primary"
                style={{ marginTop: "var(--space-6)" }}
            >다음</button>
        </div>
    );
}

function Step4Children({ children, onChange, familyId, busy, error, onSubmit }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const usedColors = children.map((c) => c.color_hex).filter(Boolean);
    const allValid = children.every((c) => c.name.trim() && c.birthdate);

    return (
        <div>
            <ChildDetailsStep
                child={children[activeIndex]}
                index={activeIndex}
                onChange={(updated) => {
                    const next = [...children];
                    next[activeIndex] = updated;
                    onChange(next);
                }}
                usedColors={usedColors}
                familyId={familyId}
            />

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
                {activeIndex > 0 && (
                    <button type="button" onClick={() => setActiveIndex(activeIndex - 1)}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}>
                        이전 자녀
                    </button>
                )}
                {activeIndex < children.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => setActiveIndex(activeIndex + 1)}
                        disabled={!children[activeIndex].name.trim() || !children[activeIndex].birthdate}
                        className="wizard-primary"
                        style={{ flex: 1 }}
                    >다음 자녀</button>
                ) : (
                    <button
                        type="button" onClick={onSubmit} disabled={!allValid || busy}
                        className="wizard-primary"
                        style={{ flex: 1 }}
                    >{busy ? "저장 중..." : "다음"}</button>
                )}
            </div>
            {error && <div style={{ color: "var(--status-negative-strong)", marginTop: "var(--space-3)", fontSize: 14, fontWeight: "var(--weight-medium)" }}>{error}</div>}
        </div>
    );
}

function Step5PairCode({ family, deviceType, onNext }) {
    const deviceLabel = DEVICE_OPTIONS.find((d) => d.id === deviceType)?.label || "자녀 디바이스";
    return (
        <div>
            <h2 className="t-screen-title" style={{ marginBottom: "var(--space-2)" }}>
                페어링 코드
            </h2>
            <p className="t-screen-subtitle" style={{ marginBottom: "var(--space-5)" }}>
                {deviceLabel}에서 이 코드를 입력하면 연결돼요
            </p>
            <div style={{
                background: "var(--theme-accent-soft)",
                border: "2px solid var(--theme-accent-deep)",
                borderRadius: "var(--radius-card)",
                padding: "var(--space-6)",
                textAlign: "center",
                fontSize: 28,
                fontWeight: "var(--weight-bold)",
                letterSpacing: 4,
                color: "var(--theme-accent-text)",
                fontVariantNumeric: "tabular-nums",
            }}>
                {family.pair_code}
            </div>
            <p style={{ marginTop: "var(--space-3)", fontSize: 12, color: "var(--fg-tertiary)", textAlign: "center", fontWeight: "var(--weight-medium)" }}>
                코드는 24시간 후 자동 만료돼요
            </p>
            <button
                type="button" onClick={onNext}
                className="wizard-primary"
                style={{ marginTop: "var(--space-6)" }}
            >모든 자녀 페어링 완료</button>
        </div>
    );
}

function Step6Complete({ onComplete }) {
    return (
        <div style={{ textAlign: "center", paddingTop: "var(--space-12)" }}>
            <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }} aria-hidden="true">🎉</div>
            <h2 className="t-screen-title" style={{ marginBottom: "var(--space-3)" }}>설정 완료!</h2>
            <p className="t-screen-subtitle" style={{ marginBottom: "var(--space-6)" }}>
                이제 가족 일정을 함께 관리해보세요
            </p>
            <button
                type="button" onClick={onComplete}
                className="wizard-primary"
            >시작하기</button>
        </div>
    );
}
