// src/components/onboarding/ChildPermissionWizard.jsx
// Fullscreen wizard shown to a child user the first time they reach the
// home screen with native setup incomplete. Lists every required permission
// and exposes a deep-link button per item; the rest of the app keeps polling
// native readiness, so once the user finishes a step the wizard reflects the
// new state and (when everything is ready) collapses automatically.
//
// Mounted from src/App.jsx (isNativeApp && !isParent && !allReady && !dismissed).
// Steps come from CHILD_SAFETY_SETUP_STEPS via getChildSafetySetupSteps; this
// component only renders. The deep-link plumbing (battery / fullScreen / DND /
// location / channel) lives in src/App.jsx → openChildSetupAction.

const FF = '"BMHANNAPro", "Pretendard", system-ui, -apple-system, sans-serif';

export function ChildPermissionWizard({ steps = [], onAction, onDismiss }) {
  const totalCount = steps.length;
  const readyCount = steps.filter((s) => s.ready).length;
  const allReady = totalCount > 0 && readyCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-permission-wizard-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "linear-gradient(180deg,#FFF1F7 0%,#FFFBFE 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: FF,
        overflowY: "auto",
      }}
    >
      <header style={{ padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 12px" }}>
        <div style={{ fontSize: 12, color: "#BE185D", fontWeight: 800, letterSpacing: 1 }}>처음 사용 안내</div>
        <h2
          id="child-permission-wizard-title"
          style={{ margin: "6px 0 8px", fontSize: 22, fontWeight: 900, color: "#1F2937", whiteSpace: "pre-line" }}
        >
          {allReady ? "준비가 모두 끝났어요!" : "안전 사용을 위해\n권한을 모두 허용해주세요"}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>
          {allReady
            ? "이제 부모님이 안전 상태를 정확히 받아볼 수 있어요."
            : "각 항목에서 \"허용하기\"를 눌러 설정 화면으로 이동해 주세요. 돌아오면 자동으로 다음 단계가 안내돼요."}
        </p>

        <div
          aria-label={`설정 진행률 ${readyCount} / ${totalCount}`}
          style={{
            marginTop: 16,
            background: "#FCE7F3",
            borderRadius: 999,
            height: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: allReady ? "#10B981" : "#F779A8",
              transition: "width 240ms ease-out, background 240ms ease-out",
            }}
          />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>
          {readyCount} / {totalCount} 완료
        </div>
      </header>

      <ul
        style={{
          listStyle: "none",
          padding: "12px 16px 24px",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {steps.map((step) => {
          const ready = !!step.ready;
          return (
            <li
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px",
                background: ready ? "#ECFDF5" : "white",
                border: ready ? "1.5px solid #A7F3D0" : "1.5px solid #FBCFE8",
                borderRadius: 16,
                boxShadow: ready ? "none" : "0 6px 16px rgba(232,121,160,0.08)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: ready ? "#10B981" : "#F779A8",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {ready ? "✓" : "!"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ready ? "#065F46" : "#1F2937" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 1.45 }}>
                  {step.description}
                </div>
              </div>
              {!ready && (
                <button
                  type="button"
                  onClick={() => onAction?.(step)}
                  aria-label={`${step.title} ${step.actionLabel || "허용하기"}`}
                  style={{
                    flexShrink: 0,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "#F779A8",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    fontFamily: FF,
                    boxShadow: "0 6px 12px rgba(232,121,160,0.25)",
                  }}
                >
                  {step.actionLabel || "허용하기"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <footer
        style={{
          marginTop: "auto",
          padding: "12px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          background: "rgba(255,255,255,0.85)",
          borderTop: "1px solid #FCE7F3",
        }}
      >
        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            background: allReady ? "#10B981" : "white",
            color: allReady ? "white" : "#6B7280",
            border: allReady ? "none" : "1.5px solid #E5E7EB",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: FF,
            boxShadow: allReady ? "0 8px 18px rgba(16,185,129,0.25)" : "none",
          }}
        >
          {allReady ? "시작하기" : "나중에 설정하기"}
        </button>
        {!allReady && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
            나중에 설정해도 홈 상단에서 다시 안내해드려요
          </div>
        )}
      </footer>
    </div>
  );
}
