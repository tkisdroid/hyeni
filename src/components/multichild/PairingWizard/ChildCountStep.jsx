// src/components/multichild/PairingWizard/ChildCountStep.jsx
// 헤더(h2/p)는 PairingWizard의 WizardMascotIntro가 담당.
export function ChildCountStep({ value, onChange, onNext }) {
  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-7)" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`cartoon-pill ${value === n ? "cartoon-pill--rose" : "cartoon-pill--white"}`}
            style={{ flex: 1, height: 56, fontSize: 16 }}
          >
            {n}명
          </button>
        ))}
      </div>
      <button
        type="button" onClick={onNext} disabled={value == null}
        className="cartoon-pill cartoon-pill--rose"
        style={{ width: "100%", height: 52, fontSize: 16 }}
      >다음</button>
    </div>
  );
}
