// src/components/pairing/PairingModal.jsx
// 부모/자녀 페어링 + 자녀 프로필 편집 모달.
// PairCodeSection (QR + 코드 + TTL) + ChildRemoteListenReadiness (원격청취 준비) + PairingModal.
// Extracted from App.jsx (Phase 5 #4 / B9).

import { useState } from "react";
import { ColorPicker } from "../multichild/PairingWizard/ColorPicker.jsx";
import { applyThemeColor } from "../../lib/theme.js";
import { formatDeviceDuration } from "../../lib/deviceFormat.js";
import { getDeviceLabelFromUA } from "../../lib/deviceInfo.js";
import { FF, modalBackdropStyle, makeSheetStyle } from "../../lib/styleHelpers.js";
import { summarizeRemoteListenHealth, resolveChildRemoteListenHealth } from "../../lib/remoteListenHealth.js";

export function PairCodeSection({ pairCode, childrenCount, maxChildren, lockedMessage = "", pairCodeExpiresAt = null, onRegenerate = null, onConfirm = null }) {
    const [showCode, setShowCode] = useState(childrenCount === 0);
    const canAddMore = childrenCount < maxChildren;
    // Phase 2 PAIR-01 UI: Korean-locale pair_code TTL formatter (inline, no external helper — monolith policy).
    // Returns {text, expired} when expiresAt is a Date/string; null when grandfathered (pairCodeExpiresAt === null).
    const ttlLabel = (() => {
        if (!pairCodeExpiresAt) return null;
        const d = pairCodeExpiresAt instanceof Date ? pairCodeExpiresAt : new Date(pairCodeExpiresAt);
        const ms = d.getTime() - Date.now();
        if (ms <= 0) return { text: "만료됨 — 새로고침이 필요해요", expired: true };
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { text: hours >= 1 ? `만료까지 ${hours}시간 ${minutes}분` : `만료까지 ${Math.max(minutes, 1)}분`, expired: false };
    })();
    const handleRegenerate = async () => {
        if (!onRegenerate) return;
        const run = async () => {
            try { await onRegenerate(); } catch (err) { console.error("[regenerate]", err); }
        };
        if (onConfirm) {
            onConfirm({
                title: "연동 코드 새로 만들기",
                message: "연동 코드를 새로 만들면 기존 코드는 바로 무효가 돼요. 계속할까요?",
                confirmLabel: "새로 만들기",
                tone: "danger",
                onConfirm: run,
            });
            return;
        }
        await run();
    };
    const ttlLine = ttlLabel ? (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 10, color: ttlLabel.expired ? "var(--status-cautionary-strong)" : "var(--status-positive-strong)" }}>
            ⏱️ {ttlLabel.text}
        </div>
    ) : null;
    const regenerateBtn = onRegenerate ? (
        <button type="button" onClick={handleRegenerate}
            style={{ marginTop: 10, width: "100%", padding: "10px", background: "white", color: "#059669", border: "1.5px solid #86EFAC", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
            🔄 새로고침 (새 연동 코드)
        </button>
    ) : null;

    if (childrenCount === 0) {
        return (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>📋 아이에게 공유할 연동 코드</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                    <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                        style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                </div>
                <div style={{ marginTop: 14, borderRadius: 18, background: "white", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairCode)}`}
                        alt="연동 QR 코드"
                        width="160"
                        height="160"
                        style={{ width: 160, height: 160, borderRadius: 16, background: "white", padding: 8 }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--status-positive-strong)", textAlign: "center", lineHeight: 1.6 }}>
                        아이 기기에서 QR을 스캔하면<br />즉시 연동돼요
                    </div>
                </div>
                {ttlLine}
                {regenerateBtn}
                <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 8 }}>아이 기기에서 이 코드를 입력하면 자동 연결돼요</div>
            </div>
        );
    }

    return (
        <div style={{ background: showCode ? "#F0FDF4" : "var(--bg-subtle)", border: showCode ? "1.5px solid #86EFAC" : "1.5px solid #E5E7EB", borderRadius: 16, padding: "12px 16px", marginBottom: 20 }}>
            <button onClick={() => setShowCode(v => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, fontFamily: FF }}>
                <span style={{ fontSize: 14 }}>{showCode ? "🔓" : "🔑"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-primary)", flex: 1, textAlign: "left" }}>연동 코드 확인</span>
                <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{showCode ? "접기" : "펼치기"}</span>
            </button>
            {showCode && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                        <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                            style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                    </div>
                    <div style={{ marginTop: 14, borderRadius: 18, background: "white", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairCode)}`}
                            alt="연동 QR 코드"
                            width="160"
                            height="160"
                            style={{ width: 160, height: 160, borderRadius: 16, background: "white", padding: 8 }}
                        />
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--status-positive-strong)", textAlign: "center", lineHeight: 1.6 }}>
                            아이 기기에서 QR을 스캔하면<br />즉시 연동돼요
                        </div>
                    </div>
                    {ttlLine}
                    {regenerateBtn}
                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 8 }}>
                        {canAddMore
                            ? "추가 아이 기기에서 이 코드를 입력하면 연결돼요"
                            : (lockedMessage || "최대 연동 수에 도달했어요. 기존 연동을 해제하면 새로 추가할 수 있어요")}
                    </div>
                </div>
            )}
        </div>
    );
}

export function ChildRemoteListenReadiness({ health }) {
    const summary = summarizeRemoteListenHealth(health);
    if (!summary.hasReport) {
        return (
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--fg-tertiary)", fontFamily: FF }}>
                🎤 원격 청취 준비 — 자녀 앱에서 보고 대기 중
            </div>
        );
    }
    if (summary.ready && summary.advisory.length === 0) {
        return (
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--status-positive-strong)", fontWeight: 700, fontFamily: FF }}>
                ✅ 원격 청취 연결 가능
            </div>
        );
    }
    if (summary.ready) {
        const advisoryLabels = summary.advisory.slice(0, 3).map((s) => s.label).join(" · ");
        return (
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--status-cautionary-strong)", fontWeight: 700, fontFamily: FF }}>
                ℹ️ 원격 청취 연결 가능 — 확인: {advisoryLabels}
            </div>
        );
    }
    const missingLabels = summary.blockers.map((s) => s.label).join(" · ");
    return (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--status-cautionary-strong)", fontWeight: 700, fontFamily: FF }}>
            ⚠️ 원격 청취 설정 필요 — {missingLabels}
        </div>
    );
}

export function PairingModal({ myRole, pairCode, pairedMembers, familyId: _familyId, onUnpair, onRename, onPhotoChange, onProfileChange, activeThemeColor = null, onClose, maxChildren = 2, lockedMessage = "", pairCodeExpiresAt = null, onRegenerate = null, canManageFamily = true, onConfirm = null, childDeviceStatusMap = {} }) {
    const isParent = myRole === "parent";
    const children = pairedMembers?.filter(m => m.role === "child") || [];
    const parent = pairedMembers?.find(m => m.role === "parent") || null;
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [photoUploadingId, setPhotoUploadingId] = useState(null);
    const [profileSavingId, setProfileSavingId] = useState(null);
    const [profileSaveError, setProfileSaveError] = useState("");
    const usedChildColors = children.map((child) => child.color_hex).filter(Boolean);

    const stopProfileEditing = () => {
        setEditingId(null);
        setEditName("");
        setEditColor("");
        setProfileSaveError("");
        applyThemeColor(activeThemeColor || null);
    };

    const handleClose = () => {
        if (editingId) {
            applyThemeColor(activeThemeColor || null);
        }
        onClose?.();
    };

    const startProfileEditing = (child) => {
        setEditingId(child.id);
        setEditName(child.name || "");
        setEditColor(child.color_hex || "#F779A8");
        setProfileSaveError("");
    };

    const saveProfileEditing = async (child) => {
        if (!canManageFamily || !child?.id || profileSavingId) return;
        const nextName = editName.trim();
        const nextColor = editColor || child.color_hex || "#F779A8";
        if (!nextName) return;

        setProfileSavingId(child.id);
        setProfileSaveError("");
        try {
            const saved = onProfileChange
                ? await onProfileChange(child.id, { name: nextName, colorHex: nextColor })
                : await onRename?.(child.id, nextName);
            if (saved !== false) {
                setEditingId(null);
                setEditName("");
                setEditColor("");
                return;
            }
            setProfileSaveError("프로필 저장에 실패했어요. 변경 내용을 확인하고 다시 시도해 주세요.");
        } catch (err) {
            console.error("[PairingModal profile save]", err);
            setProfileSaveError("프로필 저장에 실패했어요. 네트워크 연결 후 다시 시도해 주세요.");
        } finally {
            setProfileSavingId(null);
        }
    };

    async function handlePhotoSelected(child, file) {
        if (!file || !_familyId || !child?.id) return;
        setPhotoUploadingId(child.id);
        try {
            const dotIdx = file.name.lastIndexOf(".");
            const ext = dotIdx > 0 && dotIdx < file.name.length - 1
                ? file.name.slice(dotIdx + 1).toLowerCase()
                : "jpg";
            const orderKey = child.child_order || child.id;
            const path = `${_familyId}/child-${orderKey}-${Date.now()}.${ext}`;
            const bucket = supabase.storage.from("child-photos");
            const { error: upErr } = await bucket.upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            await onPhotoChange?.(child.id, path);
        } catch (err) {
            console.error("[PairingModal photo upload]", err);
            if (typeof window !== "undefined") {
                window.alert("사진 업로드 실패: " + (err?.message || err));
            }
        } finally {
            setPhotoUploadingId(null);
        }
    }

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
            <div style={makeSheetStyle({ padding: "28px 24px 40px", width: "100%", maxWidth: 460, maxHeight: "80vh", overflowY: "auto" })}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--fg-primary)" }}>🔗 {isParent ? "아이 연동 관리" : "부모님 연동"}</div>
                    <button onClick={handleClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* Pair code display (parent) */}
                {isParent && (
                    pairCode ? (
                        <PairCodeSection
                            pairCode={pairCode}
                            childrenCount={children.length}
                            maxChildren={maxChildren}
                            lockedMessage={lockedMessage}
                            pairCodeExpiresAt={pairCodeExpiresAt}
                            onRegenerate={isParent && canManageFamily ? onRegenerate : null}
                            onConfirm={onConfirm}
                        />
                    ) : children.length === 0 ? (
                        <div style={{ background: "var(--status-cautionary-subtle)", border: "1.5px solid #FCD34D", borderRadius: 16, padding: "16px", marginBottom: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--status-cautionary-strong)", marginBottom: 4 }}>카카오 로그인이 필요해요</div>
                            <div style={{ fontSize: 12, color: "#A16207", lineHeight: 1.6 }}>로그인하면 연동 코드가 생성되고<br/>아이 기기와 연결할 수 있어요</div>
                        </div>
                    ) : null
                )}

                {/* Connected children (parent view) */}
                {isParent && children.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 10 }}>연동된 아이 ({children.length}/{maxChildren})</div>
                        {children.map((child, i) => {
                            const childTone = editingId === child.id
                                ? (editColor || child.color_hex || "#F779A8")
                                : (child.color_hex || "#F779A8");
                            const isSavingProfile = profileSavingId === child.id;
                            const childProfileError = editingId === child.id ? profileSaveError : "";
                            return (
                            <div key={child.id || child.user_id || i} style={{ background: "color-mix(in srgb, var(--theme-accent-soft) 64%, white)", borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: "1.5px solid var(--theme-accent-line)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <ChildAvatar child={child} size={44} color={childTone} radius="50%" fontSize={child.emoji ? 24 : 18} />
                                    <div style={{ flex: 1 }}>
                                        {/* Track editing by family_member.id (always present) — using user_id
                                            previously caused unpaired placeholders (user_id=null) to match a
                                            null editingId and auto-render the input + keyboard with empty value. */}
                                        {editingId && editingId === child.id ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, flexWrap: "wrap" }}>
                                                    <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                                                        style={{ width: 110, minWidth: 0, padding: "6px 8px", border: "2px solid var(--theme-accent)", borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                                                        maxLength={10} />
                                                    <button
                                                        type="button"
                                                        onClick={() => saveProfileEditing(child)}
                                                        disabled={isSavingProfile || !editName.trim()}
                                                        style={{ padding: "6px 10px", borderRadius: 10, background: "var(--hyeni-theme-gradient)", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: isSavingProfile ? "wait" : "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0, opacity: isSavingProfile || !editName.trim() ? 0.62 : 1 }}
                                                    >
                                                        {isSavingProfile ? "저장 중" : "저장"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={stopProfileEditing}
                                                        disabled={isSavingProfile}
                                                        style={{ padding: "6px 8px", borderRadius: 10, background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", fontSize: 12, fontWeight: 800, cursor: isSavingProfile ? "wait" : "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0, opacity: isSavingProfile ? 0.62 : 1 }}
                                                    >
                                                        취소
                                                    </button>
                                                    <label
                                                        htmlFor={`pmodal-photo-${child.id}`}
                                                        style={{ padding: "6px 10px", borderRadius: 10, background: photoUploadingId === child.id ? "var(--status-cautionary-subtle)" : "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", border: "1px solid #FED7AA", fontSize: 12, fontWeight: 800, cursor: photoUploadingId === child.id ? "wait" : "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}
                                                    >
                                                        {photoUploadingId === child.id ? "⏳ 업로드 중" : "📷 사진 변경"}
                                                    </label>
                                                    <input
                                                        id={`pmodal-photo-${child.id}`}
                                                        type="file"
                                                        accept="image/*"
                                                        disabled={photoUploadingId === child.id}
                                                        style={{ display: "none" }}
                                                        onChange={e => {
                                                            const f = e.target.files?.[0];
                                                            e.target.value = "";
                                                            handlePhotoSelected(child, f);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--fg-secondary)", marginBottom: 7 }}>테마 색상</div>
                                                    <ColorPicker
                                                        selected={editColor}
                                                        usedColors={usedChildColors.filter((color) => color !== child.color_hex)}
                                                        onChange={setEditColor}
                                                    />
                                                    <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 6, fontWeight: 700 }}>
                                                        저장하면 앱 전체 테마에 반영돼요
                                                    </div>
                                                    {isSavingProfile && (
                                                        <div role="status" aria-live="polite" style={{ fontSize: 11, color: "var(--theme-accent-text)", marginTop: 6, fontWeight: 800 }}>
                                                            저장 중이에요. 잠시만 기다려 주세요.
                                                        </div>
                                                    )}
                                                    {childProfileError && (
                                                        <div role="alert" style={{ fontSize: 11, color: "var(--status-cautionary-strong)", marginTop: 6, fontWeight: 800, lineHeight: 1.45 }}>
                                                            {childProfileError}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.name}</div>
                                                {canManageFamily && child.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => startProfileEditing(child)}
                                                        style={{ padding: "4px 10px", borderRadius: 10, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", border: "1px solid var(--theme-accent-line)", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}
                                                    >
                                                        ✏️ 프로필 수정
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>📱 {childDeviceStatusMap?.[child.user_id]?.deviceLabel || child.device_label || `기기 ${i + 1}`}</div>
                                        <ChildRemoteListenReadiness health={resolveChildRemoteListenHealth(child, childDeviceStatusMap)} />
                                    </div>
                                    {canManageFamily && (
                                        <button onClick={() => {
                                            const run = () => onUnpair(child.user_id);
                                            if (onConfirm) {
                                                onConfirm({
                                                    title: "아이 연동 해제",
                                                    message: `${child.name} 연동을 해제할까요?`,
                                                    confirmLabel: "해제",
                                                    tone: "danger",
                                                    onConfirm: run,
                                                });
                                                return;
                                            }
                                            run();
                                        }}
                                            style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                            해제
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}

                {/* Child view: show parent */}
                {!isParent && parent && (
                    <div style={{ background: "var(--status-positive-subtle)", border: "2px solid #6EE7B7", borderRadius: 20, padding: "20px", marginBottom: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#065F46" }}>연동 완료</div>
                        <div style={{ fontSize: 14, color: "var(--status-positive-strong)", marginTop: 4 }}>{parent.name} (부모님)</div>
                    </div>
                )}

                {/* Empty state */}
                {isParent && children.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fg-tertiary)", fontSize: 14 }}>
                        아직 연결된 아이가 없어요
                    </div>
                )}
                {!isParent && !parent && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fg-tertiary)", fontSize: 14 }}>
                        부모님과 아직 연동되지 않았어요
                    </div>
                )}
            </div>
        </div>
    );
}
