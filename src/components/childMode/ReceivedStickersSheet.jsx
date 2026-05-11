// src/components/childMode/ReceivedStickersSheet.jsx
// 자녀 모드 — 부모가 보낸 칭찬 스티커 수신 내역 시트.
// "스티커보내기" 버튼을 대체하는 받은 스티커 히스토리 뷰.

import { useEffect, useState } from "react";
import { EventSheet } from "../multichild/EventModal/EventSheet.jsx";
import { StickerIcon } from "../../lib/stickerIcons.jsx";
import { fetchReceivedPraiseStickers } from "../../lib/sync.js";
import { FF } from "../../lib/styleHelpers.js";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { deferEffectStateUpdate } from "../../lib/deferEffectStateUpdate.js";

function formatDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours < 12 ? "오전" : "오후";
    const h = hours % 12 || 12;
    return `${month}월 ${day}일 ${ampm} ${h}:${minutes}`;
}

export function ReceivedStickersSheet({ open, onClose, familyId, userId, parentName }) {
    const [stickers, setStickers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !familyId || !userId) return;
        return deferEffectStateUpdate(() => {
            setLoading(true);
            fetchReceivedPraiseStickers(familyId, userId)
                .then((data) => setStickers(data))
                .finally(() => setLoading(false));
        });
    }, [open, familyId, userId]);

    const senderLabel = parentName ? `${parentName}이(가)` : "부모님이";

    return (
        <EventSheet
            open={open}
            quick={false}
            title="받은 스티커"
            canSave={false}
            onClose={onClose}
        >
            {loading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--fg-tertiary)", fontFamily: FF }}>
                    불러오는 중…
                </div>
            ) : stickers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", fontFamily: FF }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                        <HyeniMascot variant="sad" size={64} aria-label="" />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 4 }}>
                        아직 받은 스티커가 없어
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)" }}>
                        {senderLabel} 보낸 칭찬 스티커가 여기 표시돼!
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <div style={{
                        fontSize: 12,
                        color: "var(--fg-tertiary)",
                        fontWeight: "var(--weight-medium)",
                        fontFamily: FF,
                        marginBottom: "var(--space-1)",
                    }}>
                        총 {stickers.length}개 받았어 🎉
                    </div>
                    {stickers.map((s, i) => (
                        <div
                            key={s.id || i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-3)",
                                background: "var(--theme-accent-soft)",
                                borderRadius: "var(--radius-card)",
                                padding: "var(--space-3) var(--space-4)",
                                border: "1.5px solid var(--theme-accent-line)",
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--radius-md)",
                                background: "var(--bg-base)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                border: "1.5px solid var(--theme-accent-line)",
                            }}>
                                <StickerIcon emoji={s.emoji} size={24} color="var(--theme-accent-text)" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, fontFamily: FF }}>
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "var(--fg-primary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {s.title || s.emoji}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: "var(--weight-medium)", marginTop: 2 }}>
                                    {senderLabel} 보낸 칭찬 · {formatDate(s.created_at)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </EventSheet>
    );
}
