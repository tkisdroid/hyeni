// src/components/multichild/PairingWizard/ChildCountStep.jsx
// 헤더(h2/p)는 PairingWizard의 WizardMascotIntro가 담당.
export function ChildCountStep({ value, onChange, onNext }) {
  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-7)" }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n} type="button"
              aria-pressed={active}
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                height: 56,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "inherit",
                borderRadius: "var(--radius-control)",
                background: active ? "var(--theme-accent-soft)" : "var(--bg-card)",
                border: active
                  ? "2px solid var(--theme-accent)"
                  : "1px solid var(--line-soft)",
                color: active ? "var(--theme-accent-text)" : "var(--fg-primary)",
                cursor: "pointer",
                transition:
                  "background var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard), color var(--duration-fast) var(--easing-standard)",
              }}
            >
              {n}명
            </button>
          );
        })}
      </div>
      <button
        type="button" onClick={onNext} disabled={value == null}
        className="btn btn-primary"
        style={{ width: "100%" }}
      >다음</button>
    </div>
  );
}
