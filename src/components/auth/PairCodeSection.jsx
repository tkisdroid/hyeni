import { useState } from "react";
import { FF } from "../../lib/utils.js";

function PairCodeSection({ pairCode, childrenCount, maxChildren }) {
    const [showCode, setShowCode] = useState(childrenCount === 0);
    const canAddMore = childrenCount < maxChildren;

    if (childrenCount === 0) {
        return (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>📋 아이에게 공유할 연동 코드</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                    <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                        style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>아이 기기에서 이 코드를 입력하면 자동 연결돼요</div>
            </div>
        );
    }

    return (
        <div style={{ background: showCode ? "#F0FDF4" : "#F9FAFB", border: showCode ? "1.5px solid #86EFAC" : "1.5px solid #E5E7EB", borderRadius: 16, padding: "12px 16px", marginBottom: 20 }}>
            <button onClick={() => setShowCode(v => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, fontFamily: FF }}>
                <span style={{ fontSize: 14 }}>{showCode ? "🔓" : "🔑"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", flex: 1, textAlign: "left" }}>연동 코드 확인</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{showCode ? "접기" : "펼치기"}</span>
            </button>
            {showCode && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                        <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                            style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                        {canAddMore ? "추가 아이 기기에서 이 코드를 입력하면 연결돼요" : "최대 연동 수에 도달했어요. 기존 연동을 해제하면 새로 추가할 수 있어요"}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PairCodeSection;
