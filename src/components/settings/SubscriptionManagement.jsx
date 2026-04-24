import { CHILD_DEVICE_NOTE, PRICING } from "../../lib/paywallCopy.js";
import { manageSubscriptionLink } from "../../lib/qonversion.js";

export function SubscriptionManagement({ entitlement, role, onRefresh, onStartTrial }) {
  if (role === "child") {
    return (
      <section
        style={{
        background: "#FFF9FC",
        borderRadius: 18,
        padding: "18px 16px",
        border: "1.5px solid #FFE4EF",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>구독 상태</div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{CHILD_DEVICE_NOTE}</div>
      </section>
    );
  }

  const isPremium = entitlement?.tier === "premium";
  const statusCopy = entitlement?.isTrial && entitlement.trialDaysLeft != null
    ? `무료 체험 ${entitlement.trialDaysLeft}일 남음`
    : isPremium && entitlement?.currentPeriodEnd
      ? `다음 갱신일 ${entitlement.currentPeriodEnd.toLocaleDateString("ko-KR")}`
      : isPremium
        ? "프리미엄 기능이 현재 활성화되어 있어요"
        : "7일 무료 체험 후 계속 이용 여부를 결정할 수 있어요";

  return (
    <section
      style={{
        background: "white",
        borderRadius: 22,
        padding: "20px 18px",
        boxShadow: "0 14px 34px rgba(180,120,150,0.12)",
        border: "1.5px solid #FFE4EF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937" }}>혜니 프리미엄</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            {isPremium ? "실시간 위치 · 주변 소리 듣기 · AI 분석 활성화" : "프리미엄을 시작하면 잠긴 기능이 모두 열려요"}
          </div>
        </div>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            background: isPremium ? "#DCFCE7" : "#FEF3C7",
            color: isPremium ? "#166534" : "#92400E",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {isPremium ? (entitlement.isTrial ? "무료 체험 중" : "프리미엄 이용 중") : "무료 플랜"}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          borderRadius: 18,
          background: "linear-gradient(135deg,#FFF0F7,#F8FAFC)",
          border: "1px solid #FBCFE8",
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: "#BE185D" }}>
          {PRICING.monthlyLabel} · {PRICING.yearlyLabel}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>{statusCopy}</div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {!isPremium && (
          <button
            type="button"
            onClick={() => onStartTrial(PRICING.monthlyProductId)}
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: "none",
              background: "linear-gradient(135deg,#E879A0,#BE185D)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            7일 무료 체험 시작
          </button>
        )}
        <a
          href={manageSubscriptionLink(entitlement?.productId || PRICING.monthlyProductId)}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            padding: "13px 16px",
            borderRadius: 18,
            background: "#F8FAFC",
            color: "#334155",
            border: "1px solid #E2E8F0",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Google Play 구독 관리 열기
        </a>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            padding: "12px 16px",
            borderRadius: 18,
            border: "1px solid #E5E7EB",
            background: "white",
            color: "#6B7280",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          구독 상태 새로고침
        </button>
      </div>
    </section>
  );
}
