// src/components/multichild/PairingWizard/PairingWizard.jsx
// Phase 4 spec section 4.1 — 5 → 6 step (디바이스 종류 picker 신규 추가).
// wizard-dots progress + 1-thing/1-page principle (한 화면 1 결정).
// 보존: setupFamily, set_family_member_photo_url_by_id RPC, useBackHandler.

import { useState } from "react";
import { setupFamily } from "../../../lib/auth.js";
import { supabase } from "../../../lib/supabase.js";
import { useBackHandler } from "../../../lib/backHandler.js";
import { autoAssignColor } from "../ChildPalette.js";
import { HyeniMascot } from "../../auth/HyeniMascot.jsx";
import { ChildCountStep } from "./ChildCountStep.jsx";
import { ChildDetailsStep } from "./ChildDetailsStep.jsx";

const ORDINAL_KO = ["첫째", "둘째", "셋째", "넷째", "다섯째"];

const TOTAL_STEPS = 6; // 0:family, 1:device, 2:childCount, 3:childDetails, 4:pairCode, 5:complete

const DEVICE_OPTIONS = [
    { id: "own_phone",   icon: "📱", label: "자기 폰",       desc: "자녀가 본인 휴대폰을 가지고 있어요" },
    { id: "shared_phone", icon: "📞", label: "부모 공기계",   desc: "예전에 쓰던 부모님 폰을 자녀에게 넘겨줘요" },
    { id: "kids_phone",  icon: "🎈", label: "키즈폰",         desc: "어린이용 키즈폰이나 워치를 사용해요" },
];

// 함수 본문 가독성·길이 제어를 위해 스타일 객체를 module-level로 lift.
const STYLE_INTRO_WRAP = {
    display: "flex",
    gap: "var(--space-3)",
    alignItems: "flex-start",
    marginBottom: "var(--space-5)",
};
const STYLE_INTRO_AVATAR = {
    width: 56,
    height: 56,
    background: "var(--theme-accent-soft)",
    border: "1px solid var(--theme-accent-line)",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
};
const STYLE_INTRO_BUBBLE = {
    flex: 1,
    minWidth: 0,
    position: "relative",
    background: "var(--theme-accent-soft)",
    border: "1px solid var(--theme-accent-line)",
    borderTop: "3px solid var(--theme-accent-deep)",
    borderRadius: "var(--cartoon-radius-card)",
    padding: "var(--space-3) var(--space-4)",
    boxShadow: "0 4px 12px color-mix(in srgb, var(--theme-accent) 10%, transparent)",
};
const STYLE_INTRO_BUBBLE_TAIL = {
    position: "absolute",
    left: -6,
    top: 18,
    width: 11,
    height: 11,
    background: "var(--theme-accent-soft)",
    borderLeft: "1px solid var(--theme-accent-line)",
    borderBottom: "1px solid var(--theme-accent-line)",
    transform: "rotate(45deg)",
};
const STYLE_INTRO_TITLE = {
    margin: 0,
    fontSize: 16,
    fontWeight: "var(--weight-bold)",
    color: "var(--theme-accent-text)",
    lineHeight: "var(--leading-tight)",
    letterSpacing: 0,
};
const STYLE_INTRO_SUBTITLE = {
    margin: "var(--space-1) 0 0",
    fontSize: 12,
    color: "var(--fg-secondary)",
    lineHeight: "var(--leading-normal)",
    fontWeight: "var(--weight-medium)",
};

const STYLE_COMPLETE_WRAP = { textAlign: "center", paddingTop: "var(--space-8)" };
const STYLE_COMPLETE_CHEER = {
    width: 96,
    height: 96,
    margin: "0 auto var(--space-4)",
    background: "var(--theme-accent-soft)",
    border: "1px solid var(--theme-accent-line)",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
};
const STYLE_COMPLETE_HEADLINE = {
    margin: 0,
    fontSize: 22,
    fontWeight: "var(--weight-bold)",
    color: "var(--theme-accent-text)",
    lineHeight: "var(--leading-tight)",
    letterSpacing: 0,
};
const STYLE_COMPLETE_SUBTEXT = {
    margin: "var(--space-2) 0 var(--space-6)",
    fontSize: 13,
    color: "var(--fg-secondary)",
    fontWeight: "var(--weight-medium)",
    lineHeight: "var(--leading-normal)",
};
const STYLE_COMPLETE_LINEUP = {
    display: "flex",
    gap: "var(--space-3)",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: "var(--space-7)",
};

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

// 모바일 기준: 마스코트 56px + 말풍선 가변 폭. 좌우 stack으로 narrow viewport에서도 안정.
function WizardMascotIntro({ title, subtitle, variant = "static", cheer = false }) {
    return (
        <div role="presentation" style={STYLE_INTRO_WRAP}>
            <div className={cheer ? "hyeni-mascot-cheer" : ""} style={STYLE_INTRO_AVATAR}>
                <HyeniMascot size={48} variant={variant} aria-label="혜니" />
            </div>
            <div style={STYLE_INTRO_BUBBLE}>
                <span aria-hidden="true" style={STYLE_INTRO_BUBBLE_TAIL} />
                <h2 style={STYLE_INTRO_TITLE}>{title}</h2>
                {subtitle && <p style={STYLE_INTRO_SUBTITLE}>{subtitle}</p>}
            </div>
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
                <>
                    <WizardMascotIntro
                        title="자녀가 몇 명이세요?"
                        subtitle="한 명씩 차근차근 등록할게요"
                    />
                    <ChildCountStep
                        value={childCount} onChange={setChildCount}
                        onNext={() => { startChildren(); setStepIndex(3); }}
                    />
                </>
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
                <Step6Complete
                    familyName={familyName}
                    childrenList={children}
                    onComplete={() => onComplete?.(family)}
                />
            )}
        </div>
    );
}

function Step1FamilyName({ value, onChange, onNext }) {
    return (
        <div>
            <WizardMascotIntro
                variant="wave"
                title="안녕하세요! 가족 이름을 알려주세요"
                subtitle="홈 화면 인사말에 쓰여요"
            />
            <input
                type="text" value={value} onChange={(e) => onChange(e.target.value)}
                placeholder="예) 혜니네" maxLength={20}
                className="input"
                aria-label="가족 이름"
            />
            <button
                type="button" onClick={onNext} disabled={!value.trim()}
                className="btn btn-primary"
                style={{ marginTop: "var(--space-6)", width: "100%" }}
            >다음</button>
        </div>
    );
}

function Step2DevicePicker({ value, onChange, onNext }) {
    return (
        <div>
            <WizardMascotIntro
                title="자녀는 어떤 폰을 쓰세요?"
                subtitle="디바이스에 따라 연결 방식이 달라요"
            />
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
                                borderRadius: "var(--cartoon-radius-card)",
                                background: active ? "var(--cartoon-rose-soft)" : "var(--cartoon-bg-card)",
                                border: active ? "2px solid var(--cartoon-rose)" : "1px solid var(--cartoon-line)",
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
                className="btn btn-primary"
                style={{ marginTop: "var(--space-6)", width: "100%" }}
            >다음</button>
        </div>
    );
}

function Step4Children({ children, onChange, familyId, busy, error, onSubmit }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const usedColors = children.map((c) => c.color_hex).filter(Boolean);
    const allValid = children.every((c) => c.name.trim() && c.birthdate);
    const ordinal = ORDINAL_KO[activeIndex] || `${activeIndex + 1}번째 자녀`;

    return (
        <div>
            <WizardMascotIntro
                title={`${ordinal} 자녀 차례예요`}
                subtitle="이름·생일·색깔·사진을 채워주세요"
            />
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
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                    >다음 자녀</button>
                ) : (
                    <button
                        type="button" onClick={onSubmit} disabled={!allValid || busy}
                        className="btn btn-primary"
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
            <WizardMascotIntro
                variant="wave"
                title="이 코드를 자녀에게 보여주세요"
                subtitle={`${deviceLabel}에서 입력하면 연결돼요`}
            />
            <div style={{
                background: "var(--cartoon-rose-soft)",
                border: "2px solid var(--cartoon-rose)",
                borderRadius: "var(--cartoon-radius-card)",
                padding: "var(--space-6)",
                textAlign: "center",
                fontSize: 28,
                fontWeight: "var(--weight-bold)",
                letterSpacing: 4,
                color: "var(--cartoon-rose-text)",
                fontVariantNumeric: "tabular-nums",
            }}>
                {family.pair_code}
            </div>
            <p style={{ marginTop: "var(--space-3)", fontSize: 12, color: "var(--fg-tertiary)", textAlign: "center", fontWeight: "var(--weight-medium)" }}>
                코드는 24시간 후 자동 만료돼요
            </p>
            <button
                type="button" onClick={onNext}
                className="btn btn-primary"
                style={{ marginTop: "var(--space-6)", width: "100%" }}
            >모든 자녀 페어링 완료</button>
        </div>
    );
}

function Step6Complete({ familyName, childrenList = [], onComplete }) {
    const list = Array.isArray(childrenList) ? childrenList : [];
    const headline = familyName ? `${familyName} 가족이 시작됐어요!` : "가족이 시작됐어요!";

    return (
        <div style={STYLE_COMPLETE_WRAP}>
            <div className="hyeni-mascot-cheer" style={STYLE_COMPLETE_CHEER}>
                <HyeniMascot size={84} variant="wave" aria-label="혜니" />
            </div>
            <h2 style={STYLE_COMPLETE_HEADLINE}>{headline}</h2>
            <p style={STYLE_COMPLETE_SUBTEXT}>이제 가족 일정을 함께 관리해보세요</p>
            {list.length > 0 && (
                <div aria-label="가족 멤버" style={STYLE_COMPLETE_LINEUP}>
                    {list.map((child, i) => (
                        <ChildAvatarChip
                            key={i}
                            name={child.name?.trim() || `${ORDINAL_KO[i] || `${i + 1}번째`}`}
                            colorHex={child.color_hex}
                            photoUrl={child.photo_url}
                        />
                    ))}
                </div>
            )}
            <button type="button" onClick={onComplete} className="btn btn-primary" style={{ width: "100%" }}>시작하기</button>
        </div>
    );
}

function ChildAvatarChip({ name, colorHex, photoUrl }) {
    // 사진이 data URL인 경우 우선 사용. 없으면 색상 chip만.
    const hasPhoto = typeof photoUrl === "string" && photoUrl.startsWith("data:");
    return (
        <div style={{ width: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: hasPhoto ? `center/cover no-repeat url(${photoUrl})` : (colorHex || "var(--cartoon-bg-chip)"),
                    border: "2px solid var(--cartoon-line)",
                    boxSizing: "border-box",
                }}
                aria-hidden="true"
            />
            <span
                style={{
                    fontSize: 11,
                    fontWeight: "var(--weight-medium)",
                    color: "var(--fg-secondary)",
                    maxWidth: 56,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {name}
            </span>
        </div>
    );
}
