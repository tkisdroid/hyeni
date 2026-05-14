// src/components/childMode/MemoBubble.jsx
// Phase 3 spec section 4.4 — iMessage 풍 메모 bubble.
// 부모가 보낸 메모(좌측 회색) / 자녀가 보낸 답장(우측 핑크).

export function MemoBubble({ from, children, stamp }) {
    return (
        <div className="memo-bubble-row" data-from={from === "child" ? "child" : "parent"}>
            <div className="memo-bubble-stack">
                <span
                    className="memo-bubble"
                    data-from={from === "child" ? "child" : "parent"}
                    style={{ wordBreak: "keep-all", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
                >
                    {children}
                </span>
                {stamp && <span className="memo-bubble-stamp">{stamp}</span>}
            </div>
        </div>
    );
}
