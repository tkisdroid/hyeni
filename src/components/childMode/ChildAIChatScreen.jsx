// src/components/childMode/ChildAIChatScreen.jsx
// 아이모드 — AI 동물 캐릭터 채팅 화면.
// - 헤더: 뒤로 / 캐릭터 아이콘 + 이름 / 오늘 남은 횟수
// - 본문: 말풍선(memo-bubble 클래스 재사용). user='child' 우측, assistant='parent' 좌측.
// - 입력바: textarea + 전송 버튼. 전송 중 로딩, 한도/비활성/실패시 친근 안내.
// 디자인은 token-only(CLAUDE.md), 반말 카피(자녀 화면).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBackHandler } from "../../lib/backHandler.js";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";
import { getPersona } from "../../lib/aiChatPersonas.js";
import {
    loadChatSettings,
    loadRecentMessages,
    loadTodayUsage,
    sendChildChat,
} from "../../lib/aiChat.js";

const MAX_INPUT_LEN = 300;

function StatusPill({ kind = "info", children }) {
    const bg = kind === "warning" ? "var(--status-cautionary-subtle, #FFF7ED)" : "var(--theme-accent-soft, var(--bg-muted))";
    const fg = kind === "warning" ? "var(--status-cautionary-strong, #B45309)" : "var(--theme-accent-text, var(--fg-secondary))";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                background: bg,
                color: fg,
                fontSize: 11,
                fontWeight: "var(--weight-bold)",
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </span>
    );
}

function ChatBubble({ role, children }) {
    const from = role === "user" ? "child" : "parent";
    return (
        <div className="memo-bubble-row" data-from={from}>
            <div className="memo-bubble-stack">
                <span className="memo-bubble" data-from={from} style={{ whiteSpace: "pre-wrap" }}>
                    {children}
                </span>
            </div>
        </div>
    );
}

function TypingBubble() {
    return (
        <div className="memo-bubble-row" data-from="parent">
            <div className="memo-bubble-stack">
                <span
                    className="memo-bubble"
                    data-from="parent"
                    aria-live="polite"
                    aria-label="캐릭터가 답을 쓰는 중"
                    style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                >
                    <span style={{ opacity: 0.55 }}>· · ·</span>
                </span>
            </div>
        </div>
    );
}

export function ChildAIChatScreen({
    onBack,
    familyId,
    childUserId,
    childName = "",
    characterEmoji = "🐰",
}) {
    useBackHandler(() => {
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });

    const persona = useMemo(() => getPersona(characterEmoji), [characterEmoji]);

    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(true);
    const [settings, setSettings] = useState(null);
    const [todayCount, setTodayCount] = useState(0);
    const [remaining, setRemaining] = useState(null);
    const [creditBalance, setCreditBalance] = useState(0);
    const [banner, setBanner] = useState(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        async function bootstrap() {
            setBootstrapping(true);
            const [s, u, msgs] = await Promise.all([
                loadChatSettings(familyId),
                loadTodayUsage({ familyId, childUserId }),
                loadRecentMessages({ familyId, childUserId, limit: 20 }),
            ]);
            if (cancelled) return;
            setSettings(s);
            setTodayCount(u?.count || 0);
            setCreditBalance(s?.credit_balance || 0);
            const limit = s?.daily_limit ?? 0;
            const rem = Math.max(0, limit - (u?.count || 0));
            setRemaining(rem);
            setMessages(
                (msgs || []).map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                }))
            );
            setBootstrapping(false);
        }
        if (familyId && childUserId) bootstrap();
        return () => { cancelled = true; };
    }, [familyId, childUserId]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const t = window.setTimeout(() => {
            el.scrollTop = el.scrollHeight;
        }, 20);
        return () => window.clearTimeout(t);
    }, [messages, sending]);

    const enabled = !!settings?.enabled;
    const dailyLimit = settings?.daily_limit ?? 0;
    const canSend = enabled && !sending && (remaining === null || remaining > 0 || creditBalance > 0);

    const handleSend = useCallback(async () => {
        const text = draft.trim();
        if (!text || sending) return;
        if (!enabled) {
            setBanner({ kind: "warning", text: "AI 친구는 잠깐 쉬는 중이야. 부모님께 켜달라고 부탁해줘." });
            return;
        }
        if ((remaining ?? 0) <= 0 && creditBalance <= 0) {
            setBanner({ kind: "warning", text: "오늘 이야기는 다 했어! 내일 또 만나자." });
            return;
        }
        const tempId = `tmp-${Date.now()}`;
        setMessages((prev) => [...prev, { id: tempId, role: "user", content: text }]);
        setDraft("");
        setSending(true);
        setBanner(null);
        try {
            const res = await sendChildChat(text);
            if (!res.ok) {
                if (res.error === "daily_limit_reached") {
                    setRemaining(0);
                    if (typeof res.creditBalance === "number") setCreditBalance(res.creditBalance);
                    setBanner({
                        kind: "warning",
                        text: "오늘 이야기는 다 했어! 내일 또 만나자.",
                    });
                } else if (res.error === "feature_disabled") {
                    setBanner({ kind: "warning", text: "AI 친구는 잠깐 쉬는 중이야. 부모님께 켜달라고 부탁해줘." });
                } else if (res.error === "not_child" || res.error === "no_family") {
                    setBanner({ kind: "warning", text: "지금은 이야기할 수 없어. 부모님께 알려줘." });
                } else if (res.error === "message_too_long") {
                    setBanner({ kind: "warning", text: "조금만 짧게 다시 말해줄래?" });
                } else {
                    setBanner({ kind: "error", text: "잠깐 연결이 안 됐어. 다시 시도해줘." });
                }
            } else {
                setMessages((prev) => [
                    ...prev,
                    { id: `srv-${Date.now()}-a`, role: "assistant", content: res.reply },
                ]);
                if (typeof res.remaining === "number") setRemaining(res.remaining);
                if (typeof res.creditBalance === "number") setCreditBalance(res.creditBalance);
                if (typeof res.dailyLimit === "number") setSettings((prev) => prev ? { ...prev, daily_limit: res.dailyLimit } : prev);
                setTodayCount((c) => (res.usedCredit ? c : c + 1));
            }
        } catch (err) {
            console.error("[ChildAIChatScreen] send failed", err);
            setBanner({ kind: "error", text: "잠깐 연결이 안 됐어. 다시 시도해줘." });
        } finally {
            setSending(false);
            window.setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [draft, sending, enabled, remaining, creditBalance]);

    const remainingLabel = (() => {
        if (!enabled) return "쉬는 중";
        if (remaining == null) return "…";
        if (remaining > 0) return `오늘 ${remaining}번 더`;
        if (creditBalance > 0) return `크레딧 ${creditBalance}개`;
        return "오늘 끝!";
    })();

    return (
        <div
            className="hyeni-child-ai-chat"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 420,
                background: "var(--cartoon-bg-cream, var(--bg-base))",
                display: "flex",
                flexDirection: "column",
                fontFamily: "var(--font-sans)",
            }}
        >
            <header
                style={{
                    background: "var(--cartoon-bg-card, var(--bg-base))",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4) var(--space-3)",
                    borderBottom: "1px solid var(--cartoon-line, var(--line-soft))",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexShrink: 0,
                }}
            >
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로"
                    className="btn-icon-circle"
                >
                    ←
                </button>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0, flex: 1 }}>
                    <AnimalIcon emoji={characterEmoji} size={32} aria-label={`${persona.species} 캐릭터`} />
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{
                            fontSize: 15,
                            fontWeight: "var(--weight-bold)",
                            color: "var(--fg-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}>{persona.name}</span>
                        <span style={{
                            fontSize: 11,
                            color: "var(--fg-tertiary)",
                            fontWeight: "var(--weight-medium)",
                        }}>{persona.species} 친구</span>
                    </div>
                </div>
                <StatusPill kind={enabled && (remaining ?? 1) > 0 ? "info" : "warning"}>
                    {remainingLabel}
                </StatusPill>
            </header>

            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "var(--space-4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                }}
            >
                {bootstrapping ? (
                    <div style={{ margin: "auto", color: "var(--fg-tertiary)", fontSize: 13 }}>잠깐, 친구 깨우는 중…</div>
                ) : (
                    <>
                        {messages.length === 0 && (
                            <div
                                style={{
                                    margin: "var(--space-4) auto",
                                    maxWidth: 320,
                                    textAlign: "center",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "var(--space-3)",
                                }}
                            >
                                <AnimalIcon emoji={characterEmoji} size={96} aria-label={`${persona.species} 캐릭터`} />
                                <p style={{
                                    margin: 0,
                                    fontSize: 15,
                                    fontWeight: "var(--weight-bold)",
                                    color: "var(--fg-primary)",
                                    lineHeight: 1.5,
                                }}>
                                    {persona.greeting}
                                </p>
                                <p style={{
                                    margin: 0,
                                    fontSize: 12,
                                    color: "var(--fg-tertiary)",
                                    fontWeight: "var(--weight-medium)",
                                }}>
                                    {childName ? `${childName}, 궁금한 거 물어봐도 돼!` : "궁금한 거 물어봐도 돼!"}
                                </p>
                            </div>
                        )}
                        {messages.map((m) => (
                            <ChatBubble key={m.id} role={m.role}>{m.content}</ChatBubble>
                        ))}
                        {sending && <TypingBubble />}
                    </>
                )}
            </div>

            {banner && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        margin: "0 var(--space-4) var(--space-2)",
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--radius-lg)",
                        background: banner.kind === "error"
                            ? "var(--status-negative-subtle, #FEF2F2)"
                            : "var(--status-cautionary-subtle, #FFF7ED)",
                        color: banner.kind === "error"
                            ? "var(--status-negative-strong, #B91C1C)"
                            : "var(--status-cautionary-strong, #B45309)",
                        fontSize: 13,
                        fontWeight: "var(--weight-bold)",
                        lineHeight: 1.5,
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                    }}
                >
                    <ThreeDIcon name="bell" size={18} aria-label="" />
                    <span style={{ flex: 1, minWidth: 0 }}>{banner.text}</span>
                </div>
            )}

            <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                style={{
                    padding: "var(--space-3) var(--space-4) calc(env(safe-area-inset-bottom, 0px) + var(--space-3))",
                    background: "var(--cartoon-bg-card, var(--bg-base))",
                    borderTop: "1px solid var(--cartoon-line, var(--line-soft))",
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "flex-end",
                    flexShrink: 0,
                }}
            >
                <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT_LEN))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    rows={1}
                    placeholder={
                        !enabled ? "AI 친구가 쉬는 중이야"
                            : (remaining ?? 1) <= 0 && creditBalance <= 0 ? "내일 또 만나자!"
                                : `${persona.name}에게 말해봐…`
                    }
                    disabled={!enabled || sending || ((remaining ?? 1) <= 0 && creditBalance <= 0)}
                    aria-label="메시지 입력"
                    style={{
                        flex: 1,
                        minHeight: 44,
                        maxHeight: 120,
                        resize: "none",
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--line-soft)",
                        background: "var(--bg-muted, var(--cartoon-bg-cream))",
                        color: "var(--fg-primary)",
                        fontFamily: "var(--font-sans)",
                        fontSize: 14,
                        fontWeight: "var(--weight-medium)",
                        lineHeight: 1.5,
                        outline: "none",
                    }}
                />
                <button
                    type="submit"
                    disabled={!canSend || !draft.trim()}
                    aria-label="보내기"
                    className="btn btn-primary"
                    style={{
                        minWidth: 56,
                        height: 44,
                        padding: "0 var(--space-3)",
                        fontWeight: "var(--weight-bold)",
                        fontSize: 14,
                        opacity: !canSend || !draft.trim() ? 0.5 : 1,
                        cursor: !canSend || !draft.trim() ? "not-allowed" : "pointer",
                    }}
                >
                    {sending ? "…" : "보내기"}
                </button>
            </form>
            {dailyLimit > 0 && enabled && (
                <div style={{
                    padding: "0 var(--space-4) calc(env(safe-area-inset-bottom, 0px) + var(--space-2))",
                    fontSize: 11,
                    color: "var(--fg-tertiary)",
                    textAlign: "center",
                    fontWeight: "var(--weight-medium)",
                }}>
                    오늘 {Math.min(todayCount, dailyLimit)}/{dailyLimit}회 사용
                    {creditBalance > 0 ? ` · 크레딧 ${creditBalance}개` : ""}
                </div>
            )}
        </div>
    );
}
