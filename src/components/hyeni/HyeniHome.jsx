import { useState, useEffect, useCallback } from "react";
import { FF } from "../../lib/utils.js";
import { getWallet, getTransactions, getTodayStats } from "../../services/hyeniService.js";
import { getMyReferralCode, getMyReferralStats, shareReferralLink } from "../../services/referralService.js";
import { CATEGORY_LABELS } from "../common/HyeniToast.jsx";

const DAILY_LIMITS = {
  attendance: 1, arrival: 5, arrival_early: 5,
  event_create: 3, gguk: 5, memo: 3, academy_register: 1,
};

const STAT_CHIPS = [
  { key: "attendance", emoji: "✅", label: "출석", limit: 1 },
  { key: "arrival", emoji: "📍", label: "도착", limit: 5, mergeWith: "arrival_early" },
  { key: "gguk", emoji: "💕", label: "꾹", limit: 5 },
  { key: "memo", emoji: "✏️", label: "메모", limit: 3 },
  { key: "event_create", emoji: "📅", label: "일정", limit: 3 },
  { key: "academy_register", emoji: "🏫", label: "학원", limit: 1 },
];

export default function HyeniHome({ familyId, onClose, onReferralPage }) {
  const [wallet, setWallet] = useState({ balance: 0, total_earned: 0, streak_days: 0 });
  const [todayStats, setTodayStats] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txOffset, setTxOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      const [w, stats, txs, code, rStats] = await Promise.all([
        getWallet(familyId),
        getTodayStats(familyId),
        getTransactions(familyId, 20, 0),
        getMyReferralCode(familyId),
        getMyReferralStats(familyId),
      ]);
      setWallet(w);
      setTodayStats(stats);
      setTransactions(txs);
      setTxOffset(20);
      setHasMore(txs.length >= 20);
      if (code) setReferralCode(code);
      if (rStats) setReferralStats(rStats);
    } catch (e) {
      console.warn("[HyeniHome] load failed:", e);
    }
    setLoading(false);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    const txs = await getTransactions(familyId, 20, txOffset);
    setTransactions(prev => [...prev, ...txs]);
    setTxOffset(prev => prev + 20);
    setHasMore(txs.length >= 20);
  };

  const todayTotal = Object.values(todayStats).reduce((sum, s) => {
    if (["referral_invite", "referral_welcome", "referral_milestone"].includes(s.category)) return sum;
    return sum + (s.total || 0);
  }, 0);

  const getChipCount = (chip) => {
    const s = todayStats[chip.key] || { count: 0 };
    if (chip.mergeWith) {
      const s2 = todayStats[chip.mergeWith] || { count: 0 };
      return s.count + s2.count;
    }
    return s.count;
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#FFF0F7", zIndex: 200, fontFamily: FF, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0" }}>내 혜니</div>
        <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 12, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>닫기</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {/* 1. 잔액 카드 */}
        <div style={{ background: "linear-gradient(135deg, #E879A0, #F4A7C1)", borderRadius: 24, padding: "24px 20px", color: "white", marginBottom: 16, position: "relative" }}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>내 혜니</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 900 }}>{wallet.balance.toLocaleString()}</span>
            <span style={{ fontSize: 14, opacity: 0.8 }}>혜니</span>
          </div>
          {wallet.streak_days > 0 && (
            <div style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.25)", borderRadius: 12, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
              🔥 연속 도착 {wallet.streak_days}일째
            </div>
          )}
        </div>

        {/* 2. 오늘의 적립 현황 */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px", marginBottom: 16, border: "1px solid #F3E8EF" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>오늘의 적립</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {STAT_CHIPS.map(chip => {
              const count = getChipCount(chip);
              const full = count >= chip.limit;
              return (
                <div key={chip.key} style={{
                  flexShrink: 0, background: full ? "#F3F4F6" : "#FFF0F7",
                  borderRadius: 12, padding: "6px 10px", textAlign: "center",
                  border: `1px solid ${full ? "#E5E7EB" : "#FBCFE8"}`,
                  opacity: full ? 0.6 : 1,
                }}>
                  <div style={{ fontSize: 14 }}>{chip.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: full ? "#9CA3AF" : "#E879A0" }}>
                    {count}/{chip.limit}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 전체 진행바 */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>
              <span>오늘 {todayTotal}/50혜니</span>
              <span>{Math.min(100, Math.round(todayTotal / 50 * 100))}%</span>
            </div>
            <div style={{ background: "#F3F4F6", borderRadius: 6, height: 6, overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(90deg, #E879A0, #F4A7C1)", height: "100%", width: `${Math.min(100, todayTotal / 50 * 100)}%`, borderRadius: 6, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>

        {/* 3. 추천 현황 카드 */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px", marginBottom: 16, border: "1px solid #F3E8EF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>🎁 친구 추천하고 50혜니!</div>
            {onReferralPage && (
              <button onClick={onReferralPage} style={{ background: "#FFF0F7", border: "1px solid #FBCFE8", borderRadius: 10, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#E879A0", cursor: "pointer", fontFamily: FF }}>자세히</button>
            )}
          </div>
          {referralCode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, background: "#F9FAFB", borderRadius: 10, padding: "8px 12px", fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: "#374151", letterSpacing: 1 }}>{referralCode}</div>
              <button onClick={() => { navigator.clipboard.writeText(referralCode); }} style={{ background: "#E879A0", color: "white", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>복사</button>
              <button onClick={() => shareReferralLink(referralCode)} style={{ background: "#F59E0B", color: "white", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>공유</button>
            </div>
          )}
          {referralStats && (
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
              {referralStats.totalReferrals}명 완료 {referralStats.nextMilestone > 0 && `· 다음 보너스(${referralStats.nextMilestone}명)까지 ${referralStats.remainingToNext}명`}
            </div>
          )}
        </div>

        {/* 4. 최근 내역 */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px", border: "1px solid #F3E8EF" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 12 }}>최근 내역</div>
          {transactions.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#D1D5DB", fontSize: 13 }}>아직 내역이 없어요</div>
          )}
          {transactions.map((tx, i) => {
            const info = CATEGORY_LABELS[tx.category] || { emoji: "💰", label: tx.category };
            return (
              <div key={tx.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < transactions.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <span style={{ fontSize: 20 }}>{info.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{tx.description || info.label}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{fmtTime(tx.created_at)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: tx.type === "earn" ? "#10B981" : "#EF4444" }}>
                  {tx.type === "earn" ? "+" : "-"}{tx.amount}혜니
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button onClick={loadMore} style={{ width: "100%", padding: "10px", marginTop: 8, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, fontSize: 12, fontWeight: 700, color: "#6B7280", cursor: "pointer", fontFamily: FF }}>더 보기</button>
          )}
        </div>
      </div>
    </div>
  );
}
