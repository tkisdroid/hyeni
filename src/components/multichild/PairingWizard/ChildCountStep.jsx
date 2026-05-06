// src/components/multichild/PairingWizard/ChildCountStep.jsx
export function ChildCountStep({ value, onChange, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--fg-primary)", marginBottom: 8 }}>
        자녀가 몇 명인가요?
      </h2>
      <p style={{ fontSize: 14, color: "var(--fg-secondary)", marginBottom: 24 }}>
        나중에 추가/삭제할 수 있어요.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            style={{
              flex: 1, padding: "16px 0", borderRadius: 14,
              border: value === n ? "2px solid var(--theme-accent)" : "1.5px solid var(--line-soft)",
              background: value === n ? "var(--theme-accent-soft)" : "white",
              fontSize: 16, fontWeight: 800,
              color: value === n ? "var(--theme-accent-text)" : "var(--fg-primary)",
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
            }}
          >
            {n}명
          </button>
        ))}
      </div>
      <button
        type="button" onClick={onNext} disabled={value == null}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 14,
          background: value == null ? "var(--bg-muted)" : "var(--theme-accent)",
          color: value == null ? "var(--fg-disabled)" : "white",
          fontSize: 16, fontWeight: 800,
          cursor: value == null ? "not-allowed" : "pointer",
          border: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "manipulation",
        }}
      >다음</button>
    </div>
  );
}
