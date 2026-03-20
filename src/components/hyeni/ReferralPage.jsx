import { useState, useEffect } from "react";
import { FF } from "../../lib/utils.js";
import { getMyReferralCode, getMyReferralStats, shareReferralLink, applyReferralCode } from "../../services/referralService.js";

const MILESTONES = [
  { count: 5, bonus: 100 },
  { count: 10, bonus: 200 },
  { count: 20, bonus: 500 },
];

export default function ReferralPage({ familyId, onClose }) {
  const [code, setCode] = useState("");
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [applyResult, setApplyResult] = useState(null);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      try {
        const [c, s] = await Promise.all([
          getMyReferralCode(familyId),
          getMyReferralStats(familyId),
        ]);
        if (c) setCode(c);
        if (s) setStats(s);
      } catch (e) {
        console.warn("[ReferralPage]", e);
      }
    })();
  }, [familyId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async () => {
    if (!inputCode.trim()) return;
    const result = await applyReferralCode(familyId, inputCode.trim());
    if (result?.success) {
      setApplyResult("success");
      setShowInput(false);
    } else {
      const errMsg = result?.error === "invalid_code" ? "유효하지 않은 코드예요"
        : result?.error === "self_referral" ? "자신의 코드는 사용할 수 없어요"
        : result?.error === "already_referred" ? "이미 추천코드를 사용했어요"
        : "오류가 발생했어요";
      setApplyResult(errMsg);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#FFF0F7", zIndex: 200, fontFamily: FF, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0" }}>친구 추천</div>
        <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 12, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>닫기</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
        {/* 상단 안내 */}
        <div style={{ textAlign: "center", marginBottom: 20, padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
          <div style={{ fontSize: 15, color: "#374151", fontWeight: 600, marginBottom: 4 }}>친구에게 혜니캘린더를 추천하면</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#E879A0" }}>서로 50혜니!</div>
        </div>

        {/* 추천코드 박스 */}
        <div style={{ background: "white", borderRadius: 20, padding: "20px", marginBottom: 16, border: "1px solid #F3E8EF", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>내 추천코드</div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 900, color: "#374151", letterSpacing: 2, marginBottom: 16 }}>
            {code || "로딩 중..."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCopy} style={{ flex: 1, padding: "12px", background: "#E879A0", color: "white", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
              {copied ? "복사됨!" : "코드 복사"}
            </button>
            <button onClick={() => shareReferralLink(code)} style={{ flex: 1, padding: "12px", background: "#F59E0B", color: "white", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
              공유하기
            </button>
          </div>
        </div>

        {/* 추천 현황 */}
        {stats && (
          <div style={{ background: "white", borderRadius: 20, padding: "16px", marginBottom: 16, border: "1px solid #F3E8EF" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 12 }}>추천 현황</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[
                { label: "완료", value: stats.rewardedCount, color: "#10B981" },
                { label: "대기", value: stats.pendingCount, color: "#F59E0B" },
                { label: "전체", value: stats.totalReferrals, color: "#E879A0" },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, background: "#F9FAFB", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* 마일스톤 */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {MILESTONES.map((ms, i) => {
                const reached = stats.totalReferrals >= ms.count;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: reached ? "#E879A0" : "#E5E7EB",
                      color: reached ? "white" : "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 900, marginBottom: 4,
                    }}>{reached ? "✓" : ms.count}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: reached ? "#E879A0" : "#9CA3AF" }}>+{ms.bonus}혜니</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 추천코드 입력 */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px", marginBottom: 16, border: "1px solid #F3E8EF" }}>
          {!showInput ? (
            <button onClick={() => setShowInput(true)} style={{ width: "100%", padding: "12px", background: "#F9FAFB", border: "1px dashed #D1D5DB", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer", fontFamily: FF }}>
              추천코드가 있나요?
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>추천코드 입력</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  placeholder="HYENI-XXXX-XXXX"
                  style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 14, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}
                />
                <button onClick={handleApply} style={{ padding: "10px 16px", background: "#E879A0", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>적용</button>
              </div>
              {applyResult && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: applyResult === "success" ? "#10B981" : "#EF4444" }}>
                  {applyResult === "success" ? "추천코드 등록 완료! 3일 뒤 50혜니가 와요 🎁" : applyResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px", border: "1px solid #F3E8EF" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>안내</div>
          {[
            "추천받은 친구가 3일간 앱을 사용하면 양쪽 50혜니!",
            "5명 추천 +100혜니 / 10명 +200혜니 / 20명 +500혜니",
            "추천 보상은 횟수 제한 없이 계속 받을 수 있어요!",
          ].map((text, i) => (
            <div key={i} style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, padding: "4px 0", display: "flex", gap: 6 }}>
              <span>•</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
