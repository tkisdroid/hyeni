// src/components/multichild/SubscriptionScreen/PriceSummary.jsx
function formatKrw(n) {
  return "₩" + n.toLocaleString("ko-KR") + "/월";
}

export function PriceSummary({ totalKrw, subscribedCount }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "var(--space-4)", borderRadius: "var(--cartoon-radius-card)",
      background: "linear-gradient(135deg, var(--cartoon-rose-soft), var(--cartoon-bg-cream))",
      border: "1.5px solid var(--cartoon-rose)",
    }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--fg-secondary)", fontWeight: 700 }}>합계</div>
        {subscribedCount > 0 ? (
          <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 4 }}>자녀 {subscribedCount}명 구독 중</div>
        ) : null}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--cartoon-rose-text)" }}>
        {totalKrw === 0 ? "구독 없음" : formatKrw(totalKrw)}
      </div>
    </div>
  );
}
