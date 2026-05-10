// src/components/memo/ParentMemoPage.jsx
// 부모/자녀 모드 공유 메모 페이지 — Premium Kawaii redesign (mockup #13).
// 기능 보존: replies, onReplySubmit, onReplyRef, mode 분기(parent/child).

import { useEffect, useRef, useState } from "react";
import { buildMessageItems, getMemoTime } from "../../lib/memoTime.js";
import { getParentMemoQuickReplies } from "../../lib/memoDisplay.js";
import { withParticle } from "../../lib/koreanParticle.js";
import { MemoBubble } from "../childMode/MemoBubble.jsx";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

const FF = "var(--font-sans)";

function DateDivider({ label }) {
    return (
        <div role="separator" aria-label={label} style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px" }}>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: "var(--brand-mint-line, #BCEBD8)", opacity: 0.6 }} />
            <strong style={{ padding: "5px 14px", borderRadius: 999, background: "var(--brand-mint-soft, #DDF7EA)", color: "var(--brand-mint-text, #087653)", fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em" }}>{label}</strong>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: "var(--brand-mint-line, #BCEBD8)", opacity: 0.6 }} />
        </div>
    );
}

function MineBubble({ text, time, sender = "나" }) {
    return (
        <article style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5F6368", fontSize: 11, fontWeight: 600 }}>
                <strong style={{ color: "#202024", fontSize: 13, fontWeight: 800 }}>{sender}</strong>
                <span>{time}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div
                    style={{
                        maxWidth: 240,
                        padding: "12px 18px",
                        background: "linear-gradient(135deg, var(--brand-mint, #31C48D) 0%, var(--brand-mint-deep, #15936B) 100%)",
                        color: "#FFFFFF",
                        fontSize: 15,
                        fontWeight: 800,
                        borderRadius: "22px 22px 6px 22px",
                        boxShadow: "0 8px 18px rgba(49, 196, 141, 0.28)",
                        letterSpacing: "-0.01em",
                        wordBreak: "break-word",
                    }}
                >
                    {text}
                </div>
                <span
                    aria-hidden="true"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--brand-mint-soft, #DDF7EA)",
                        border: "2px solid #FFFFFF",
                        boxShadow: "0 2px 6px rgba(31,24,28,0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                    }}
                >
                    <HyeniMascot variant="static" size={32} aria-label="" />
                </span>
            </div>
            <div style={{ marginRight: 44, fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary, #9A9AA0)" }}>
                읽음 <span aria-hidden="true" style={{ color: "var(--brand-rose, #F779A8)" }}>✓✓</span>
            </div>
        </article>
    );
}

function TheirBubble({ text, time, sender }) {
    return (
        <article style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16 }}>
            <span
                aria-hidden="true"
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--brand-rose-soft, #FFE2EC)",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 2px 6px rgba(31,24,28,0.08)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 22,
                }}
            >
                👧
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5F6368", fontSize: 11, fontWeight: 600 }}>
                    <strong style={{ color: "#202024", fontSize: 13, fontWeight: 800 }}>{sender}</strong>
                    <span>{time}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                        style={{
                            maxWidth: 240,
                            padding: "12px 18px",
                            background: "#FFFFFF",
                            color: "#202024",
                            fontSize: 15,
                            fontWeight: 700,
                            borderRadius: "22px 22px 22px 6px",
                            boxShadow: "0 6px 16px rgba(31,24,28,0.06)",
                            border: "1px solid var(--line-soft, #F1ECEE)",
                            letterSpacing: "-0.01em",
                            wordBreak: "break-word",
                        }}
                    >
                        {text}
                    </div>
                    <span aria-hidden="true" style={{ width: 24, height: 24, display: "inline-flex" }}>
                        <ThreeDIcon name="heart" size={20} aria-label="" />
                    </span>
                </div>
            </div>
        </article>
    );
}

export function ParentMemoPage({ replies, onReplySubmit, myUserId, onClose, partnerName, onReplyRef, mode = "parent", quickReplies, emptyCopy, stickerCopy, bottomNavigation = null }) {
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const [lastFailedText, setLastFailedText] = useState("");
    const threadRef = useRef(null);
    const today = new Date();
    const dateLabel = `오늘 · ${DAYS_KO[today.getDay()]}요일`;
    const title = "오늘의 메모";
    const subtitle = mode === "child"
        ? "부모님과 도란도란 이야기중"
        : (partnerName ? `${withParticle(partnerName, "과", "와")} 실시간 공유중` : "가족 연동 후 공유돼요");
    const messages = Array.isArray(replies) ? replies : [];
    const quickItems = Array.isArray(quickReplies) && quickReplies.length > 0
        ? quickReplies
        : getParentMemoQuickReplies();
    const emptyTitle = emptyCopy?.title || "아이에게 첫 메시지를 남겨보세요";
    const emptyDescription = emptyCopy?.description || "아이와 공유할 준비물, 칭찬, 확인할 일을 남겨보세요.";
    const stickerTitle = stickerCopy?.title || "스티커 칭찬을 남겨보세요!";
    const stickerDescription = stickerCopy?.description || "짧은 응원도 아이에게 바로 보여요.";
    const messageItems = buildMessageItems(messages);
    const isLinked = !!partnerName;

    const handleSend = (textOverride) => {
        const text = typeof textOverride === "string" ? textOverride.trim() : inputText.trim();
        if (!text || isSending) return;
        setIsSending(true);
        setSendError("");
        const result = onReplySubmit ? onReplySubmit(text) : null;
        Promise.resolve(result)
            .then(() => {
                setInputText("");
                setLastFailedText("");
            })
            .catch(err => {
                console.error("[ParentMemoPage] send failed", err);
                setLastFailedText(text);
                setSendError("메시지 전송에 실패했어요. 다시 시도해 주세요.");
            })
            .finally(() => setIsSending(false));
    };

    const handleRetry = () => {
        if (!lastFailedText) return;
        handleSend(lastFailedText);
    };

    const setPreset = (text) => {
        setInputText(text);
        setSendError("");
    };

    useEffect(() => {
        const el = threadRef.current;
        if (!el) return;
        const id = window.requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        return () => window.cancelAnimationFrame(id);
    }, [messages.length]);

    return (
        <main
            aria-label="오늘의 메모 페이지"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 600,
                background: "linear-gradient(180deg, var(--bg-page-mint, #F1FBF6) 0%, #FFFDF8 100%)",
                fontFamily: FF,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Hero header card */}
            <header
                style={{
                    margin: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 0",
                    padding: "16px 18px 18px",
                    background: "#FFFFFF",
                    border: "1px solid var(--brand-mint-line, #BCEBD8)",
                    borderRadius: 28,
                    boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31,24,28,0.06))",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 92,
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="메모 닫기"
                    style={{
                        flexShrink: 0,
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        border: "1px solid var(--brand-mint-line, #BCEBD8)",
                        background: "#FFFFFF",
                        color: "var(--brand-mint-text, #087653)",
                        fontSize: 22,
                        fontWeight: 900,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(31,24,28,0.06)",
                        fontFamily: FF,
                    }}
                >
                    ✕
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#202024", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: isLinked ? "var(--brand-mint-text, #087653)" : "#9A9AA0", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: isLinked ? "var(--brand-mint, #31C48D)" : "#C7C7CC", flexShrink: 0 }} />
                        {subtitle}
                    </p>
                </div>
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        right: -8,
                        top: -8,
                        width: 96,
                        height: 96,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <HyeniMascot variant="diary" size={92} aria-label="" />
                    <span style={{ position: "absolute", left: -10, top: 28, fontSize: 16, opacity: 0.85 }}>💗</span>
                    <span style={{ position: "absolute", left: -2, top: 56, fontSize: 12, opacity: 0.75 }}>💗</span>
                </div>
            </header>

            {/* Thread */}
            <section
                ref={threadRef}
                aria-label="오늘의 메모 대화"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "16px 16px 8px",
                }}
            >
                {messages.length === 0 ? (
                    <>
                        <DateDivider label={dateLabel} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 16px 28px" }}>
                            <div aria-hidden="true" style={{ marginBottom: 8 }}>
                                <ThreeDIcon name="heart" size={56} aria-label="" />
                            </div>
                            <strong style={{ fontSize: 15, fontWeight: 800, color: "#202024" }}>{emptyTitle}</strong>
                            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "#5F6368", lineHeight: 1.5, maxWidth: 280 }}>{emptyDescription}</p>
                        </div>
                    </>
                ) : (
                    messageItems.map((item) => {
                        if (item.type === "separator") {
                            return <DateDivider key={item.key} label={item.label} />;
                        }
                        const message = item.r;
                        const isMine = message.user_id === myUserId;
                        const sender = message.user_role === "parent"
                            ? (mode === "child" ? (partnerName || "부모님") : "엄마")
                            : (mode === "child" ? "아이" : (partnerName || "아이"));
                        const time = getMemoTime(message.created_at);
                        const replyRefAttach = el => { if (el && onReplyRef && message.id && !String(message.id).startsWith("temp-")) onReplyRef(el, message.id); };

                        if (mode === "child") {
                            const from = message.user_role === "parent" ? "parent" : "child";
                            const stamp = isMine ? `${time} · 읽음 ✓` : `${sender} · ${time}`;
                            return (
                                <div key={message.id} ref={replyRefAttach} aria-label={`${sender} ${time} 메모: ${message.content}`}>
                                    <MemoBubble from={from} stamp={stamp}>{message.content}</MemoBubble>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={message.id}
                                ref={replyRefAttach}
                                aria-label={`${sender} ${time} 메모: ${message.content}`}
                            >
                                {isMine
                                    ? <MineBubble text={message.content} time={time} sender="나" />
                                    : <TheirBubble text={message.content} time={time} sender={sender} />
                                }
                            </div>
                        );
                    })
                )}

                {/* Sticker hint card */}
                <div
                    style={{
                        margin: "12px 0 14px",
                        padding: "16px 18px",
                        background: "linear-gradient(135deg, var(--brand-rose-soft, #FFE2EC) 0%, #FFFDF8 100%)",
                        border: "1px solid var(--brand-rose-line, #FFD0DD)",
                        borderRadius: 22,
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <span aria-hidden="true" style={{ flexShrink: 0, filter: "drop-shadow(0 4px 8px rgba(255,200,80,0.32))" }}>
                        <ThreeDIcon name="star-face" size={56} aria-label="" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>{stickerTitle}</strong>
                        <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: "#5F6368" }}>{stickerDescription}</p>
                    </div>
                    <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 16, fontSize: 14 }}>💗</span>
                    <span aria-hidden="true" style={{ position: "absolute", bottom: 12, right: 12, fontSize: 12, opacity: 0.85 }}>✨</span>
                </div>

                {/* Quick reply chips */}
                <div aria-label="빠른 메모" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    {quickItems.map(item => (
                        <button
                            key={item.text}
                            type="button"
                            onClick={() => setPreset(item.text)}
                            className="chip"
                            style={{
                                flex: "1 1 auto",
                                minWidth: 0,
                                justifyContent: "center",
                                minHeight: 36,
                            }}
                        >
                            <span aria-hidden="true" style={{ fontSize: 16 }}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Composer */}
            <footer
                style={{
                    padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
                    background: "transparent",
                }}
            >
                {sendError && (
                    <div role="alert" style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 14, background: "#FFF3C7", color: "#9A6500", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {sendError}
                        <button
                            type="button"
                            onClick={handleRetry}
                            disabled={isSending}
                            className="btn btn-sm btn-secondary"
                        >
                            다시 시도
                        </button>
                    </div>
                )}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: 6,
                        background: "#FFFFFF",
                        border: "1px solid var(--line-soft, #F1ECEE)",
                        borderRadius: 999,
                        boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31,24,28,0.06))",
                    }}
                >
                    <input
                        type="text"
                        aria-label="메모 입력"
                        placeholder="메시지를 입력하세요..."
                        value={inputText}
                        onChange={event => {
                            setInputText(event.target.value);
                            if (sendError) setSendError("");
                        }}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                handleSend();
                            }
                        }}
                        style={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            padding: "12px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: FF,
                            color: "#202024",
                            minWidth: 0,
                        }}
                    />
                    <button
                        type="button"
                        aria-label="메시지 보내기"
                        onClick={() => handleSend()}
                        disabled={!inputText.trim() || isSending}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "none",
                            background: !inputText.trim() || isSending
                                ? "var(--brand-mint-soft, #DDF7EA)"
                                : "linear-gradient(135deg, var(--brand-mint, #31C48D) 0%, var(--brand-mint-deep, #15936B) 100%)",
                            cursor: !inputText.trim() || isSending ? "default" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: !inputText.trim() || isSending ? "none" : "0 6px 14px rgba(49,196,141,0.28)",
                            fontFamily: FF,
                            opacity: !inputText.trim() || isSending ? 0.5 : 1,
                            padding: 0,
                        }}
                    >
                        <ThreeDIcon name="send" size={26} aria-label="" />
                    </button>
                </div>
            </footer>
            {bottomNavigation}
        </main>
    );
}
