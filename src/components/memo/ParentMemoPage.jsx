// src/components/memo/ParentMemoPage.jsx
// 부모/자녀 모드 공유 메모 페이지 — Phase 3에서 자녀용 chat bubble 모드 추가됨.
// Extracted from App.jsx (Phase 5 #4 / B19).

import { useEffect, useRef, useState } from "react";
import { buildMessageItems, getMemoTime } from "../../lib/memoTime.js";
import { getParentMemoQuickReplies } from "../../lib/memoDisplay.js";
import { MemoBubble } from "../childMode/MemoBubble.jsx";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function ParentMemoPage({ replies, onReplySubmit, myUserId, onClose, partnerName, onReplyRef, mode = "parent", quickReplies, emptyCopy, stickerCopy }) {
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const [lastFailedText, setLastFailedText] = useState("");
    const [showOnboardingToast, setShowOnboardingToast] = useState(false);
    const threadRef = useRef(null);
    const onboardingTimerRef = useRef(null);
    const today = new Date();
    const dateLabel = `오늘 · ${DAYS_KO[today.getDay()]}요일`;
    const title = "오늘의 메모";
    const subtitle = mode === "child"
        ? "부모님과 도란도란 이야기중"
        : (partnerName ? `${partnerName}와 실시간 공유중` : "가족 연동 후 공유돼요");
    const messages = Array.isArray(replies) ? replies : [];
    const quickItems = Array.isArray(quickReplies) && quickReplies.length > 0
        ? quickReplies
        : getParentMemoQuickReplies();
    const emptyTitle = emptyCopy?.title || "아이에게 첫 메시지를 남겨보세요";
    const emptyDescription = emptyCopy?.description || "아이와 공유할 준비물, 칭찬, 확인할 일을 남겨보세요.";
    const stickerTitle = stickerCopy?.title || "스티커 칭찬을 남겨보세요!";
    const stickerDescription = stickerCopy?.description || "짧은 응원도 아이에게 바로 보여요.";
    const messageItems = buildMessageItems(messages);

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

    // Keep newest message in view when the thread becomes scrollable
    useEffect(() => {
        const el = threadRef.current;
        if (!el) return;
        // Defer one frame so the just-rendered bubble is laid out first
        const id = window.requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        return () => window.cancelAnimationFrame(id);
    }, [messages.length]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        if (!window.localStorage.getItem("memoOnboardingV2Seen")) {
            setShowOnboardingToast(true);
            window.localStorage.setItem("memoOnboardingV2Seen", "1");
            onboardingTimerRef.current = window.setTimeout(() => setShowOnboardingToast(false), 6000);
        }
        return () => {
            if (onboardingTimerRef.current) window.clearTimeout(onboardingTimerRef.current);
        };
    }, []);

    return (
        <main className="hyeni-memo-page" aria-label="오늘의 메모 페이지">
            <div className="hyeni-memo-phone">
                <header className="hyeni-memo-header">
                    <button type="button" className="hyeni-memo-back" onClick={onClose} aria-label="메모 닫기">×</button>
                    <div className="hyeni-memo-title-block">
                        <h1>{title}</h1>
                        <p><span aria-hidden="true" />{subtitle}</p>
                    </div>
                </header>

                <section className="hyeni-memo-thread" aria-label="오늘의 메모 대화" ref={threadRef}>
                    {messages.length === 0 && <div className="hyeni-memo-date-row" role="separator" aria-label={dateLabel}>
                        <span />
                        <strong>{dateLabel}</strong>
                        <span />
                    </div>}

                    {messages.length === 0 ? (
                        <div className="hyeni-memo-empty">
                            <div>💗</div>
                            <strong>{emptyTitle}</strong>
                            <p>{emptyDescription}</p>
                        </div>
                    ) : (
                        messageItems.map((item) => {
                            if (item.type === "separator") {
                                return (
                                    <div className="hyeni-memo-date-row" role="separator" aria-label={item.label} key={item.key}>
                                        <span />
                                        <strong>{item.label}</strong>
                                        <span />
                                    </div>
                                );
                            }
                            const message = item.r;
                            const isMine = message.user_id === myUserId;
                            const sender = message.user_role === "parent"
                                ? (mode === "child" ? (partnerName || "부모님") : "엄마")
                                : (mode === "child" ? "아이" : (partnerName || "아이"));
                            const theirAvatar = mode === "child" && message.user_role === "parent" ? "💗" : "👧";
                            const myAvatar = mode === "child" ? "🌈" : "🐰";
                            const time = getMemoTime(message.created_at);
                            const replyRefAttach = el => { if (el && onReplyRef && message.id && !String(message.id).startsWith("temp-")) onReplyRef(el, message.id); };

                            // Phase 3 §4.4 — 자녀 메모 페이지는 iMessage 풍 좌/우 bubble 사용.
                            if (mode === "child") {
                                const from = message.user_role === "parent" ? "parent" : "child";
                                const stamp = isMine ? `${time} · 읽음 ✓` : `${sender} · ${time}`;
                                return (
                                    <div
                                        key={message.id}
                                        ref={replyRefAttach}
                                        aria-label={`${sender} ${time} 메모: ${message.content}`}
                                    >
                                        <MemoBubble from={from} stamp={stamp}>{message.content}</MemoBubble>
                                    </div>
                                );
                            }

                            return (
                                <article
                                    key={message.id}
                                    className={`hyeni-memo-message ${isMine ? "mine" : "theirs"}`}
                                    ref={replyRefAttach}
                                    aria-label={`${sender} ${time} 메모: ${message.content}`}
                                >
                                    {!isMine && <div className="hyeni-memo-avatar" aria-hidden="true">{theirAvatar}</div>}
                                    <div className="hyeni-memo-message-body">
                                        <div className="hyeni-memo-sender">
                                            <strong>{isMine ? "나" : sender}</strong>
                                            <span>{time}</span>
                                        </div>
                                        <div className="hyeni-memo-bubble">{message.content}</div>
                                        {isMine && <div className="hyeni-memo-read">읽음 ✓</div>}
                                    </div>
                                    {isMine && <div className="hyeni-memo-avatar small" aria-hidden="true">{myAvatar}</div>}
                                </article>
                            );
                        })
                    )}

                    <div className="hyeni-memo-sticker-card">
                        <span aria-hidden="true">⭐</span>
                        <div>
                            <strong>{stickerTitle}</strong>
                            <p>{stickerDescription}</p>
                        </div>
                    </div>

                    <div className="hyeni-memo-quick-row" aria-label="빠른 메모">
                        {quickItems.map(item => (
                            <button key={item.text} type="button" onClick={() => setPreset(item.text)}>
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>
                </section>

                <footer className="hyeni-memo-composer">
                    {sendError && (
                        <div className="hyeni-memo-error" role="alert">
                            {sendError}
                            <button type="button" onClick={handleRetry} disabled={isSending}>
                                다시 시도
                            </button>
                        </div>
                    )}
                    <div className="hyeni-memo-input-shell">
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
                        />
                        <button
                            type="button"
                            aria-label="메시지 보내기"
                            onClick={handleSend}
                            disabled={!inputText.trim() || isSending}
                        >
                            ↑
                        </button>
                    </div>
                </footer>
            </div>
            {showOnboardingToast && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-label="메모 화면이 새로워졌어요"
                    className="hyeni-memo-onboarding-toast"
                >
                    메모 화면이 새로워졌어요 ✨
                    <button
                        type="button"
                        aria-label="메모 안내 숨김"
                        onClick={() => {
                            setShowOnboardingToast(false);
                            if (onboardingTimerRef.current) window.clearTimeout(onboardingTimerRef.current);
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </main>
    );
}
