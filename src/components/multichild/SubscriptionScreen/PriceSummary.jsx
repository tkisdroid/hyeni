// src/components/multichild/SubscriptionScreen/PriceSummary.jsx
function formatKrw(n) {
  return "₩" + n.toLocaleString("ko-KR") + "/월";
}

export function PriceSummary({ totalKrw, subscribedCount }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: 18, borderRadius: 14,
      background: "linear-gradient(135deg, #FFF1F7, #F8FAFC)",
      border: "1.5px solid #FBCFE8",
    }}>
      <div>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>합계</div>
        {subscribedCount > 0 ? (
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>자녀 {subscribedCount}명 구독 중</div>
        ) : null}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#BE185D" }}>
        {totalKrw === 0 ? "구독 없음" : formatKrw(totalKrw)}
      </div>
    </div>
  );
}
