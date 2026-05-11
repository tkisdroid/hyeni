import { AUTO_RENEWAL_DISCLOSURE } from "../../lib/paywallCopy.js";

export function AutoRenewalDisclosure({ open, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="cartoon-modal-backdrop cartoon-modal-backdrop--bottom"
      style={{ zIndex: 710 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="cartoon-modal-card cartoon-modal-card--bottom"
        style={{
          background: "linear-gradient(180deg, var(--bg-card), color-mix(in srgb, var(--fg-primary) 2%, var(--theme-accent-soft)))",
          border: "1px solid var(--theme-accent-line)",
          boxShadow: "var(--hyeni-theme-shadow)",
        }}
      >
        <h2 className="cartoon-title" style={{ fontSize: 20, color: "var(--fg-primary)", textAlign: "left" }}>
          {AUTO_RENEWAL_DISCLOSURE.title}
        </h2>
        <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)" }}>
          {AUTO_RENEWAL_DISCLOSURE.items.map((item) => (
            <div
              key={item}
              className="cartoon-modal-meta"
              style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", marginTop: 0, fontWeight: 600, lineHeight: 1.6 }}
            >
              <span aria-hidden="true">•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-primary"
            style={{ flex: 1, background: "var(--hyeni-theme-gradient)" }}
          >
            {AUTO_RENEWAL_DISCLOSURE.confirm}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flexShrink: 0, padding: "0 var(--space-5)" }}
          >
            {AUTO_RENEWAL_DISCLOSURE.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
