// src/components/childMode/SendStickerSheet.jsx
// Phase 3 spec section 4.4 — 자녀가 부모에게 스티커 보내기.
// EventSheet 재사용 (quick=true, 32vh) + 4×4 emoji grid.

import { useState } from "react";
import { EventSheet } from "../multichild/EventModal/EventSheet.jsx";

const DEFAULT_STICKERS = [
    "❤️", "🐰", "🎉", "👍",
    "💪", "⭐", "🌟", "🎁",
    "🍎", "🍪", "🌈", "🦄",
    "🌸", "🐱", "🐶", "🎈",
];

export function SendStickerSheet({ open, onClose, onSend, stickers = DEFAULT_STICKERS, isSending = false }) {
    const [selected, setSelected] = useState(null);

    const reset = () => setSelected(null);

    const handleClose = () => {
        reset();
        if (typeof onClose === "function") onClose();
    };

    const handleSave = () => {
        if (!selected || isSending) return;
        const result = onSend?.(selected);
        if (result && typeof result.then === "function") {
            result.then(() => reset()).catch(() => {});
        } else {
            reset();
        }
    };

    return (
        <EventSheet
            open={open}
            quick
            title="스티커 보내기"
            saveLabel={isSending ? "보내는 중…" : "보내기"}
            canSave={Boolean(selected) && !isSending}
            onClose={handleClose}
            onSave={handleSave}
        >
            <p style={{ fontSize: 13, color: "var(--fg-secondary)", textAlign: "center", marginTop: 0, marginBottom: "var(--space-4)", fontWeight: "var(--weight-medium)" }}>
                보낼 스티커를 골라줘
            </p>
            <div className="sticker-grid">
                {stickers.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="sticker-cell"
                        data-selected={selected === emoji ? "true" : "false"}
                        onClick={() => setSelected(emoji)}
                        aria-label={`${emoji} 스티커 선택`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </EventSheet>
    );
}
