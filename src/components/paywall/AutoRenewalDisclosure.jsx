import { AUTO_RENEWAL_DISCLOSURE } from "../../lib/paywallCopy.js";

export function AutoRenewalDisclosure({ open, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 710,
        background: "color-mix(in srgb, var(--fg-primary) 38%, transparent)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="card-elevated"
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: "16px 16px 0 0",
          padding: "24px 20px 32px",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)" }}>{AUTO_RENEWAL_DISCLOSURE.title}</div>
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {AUTO_RENEWAL_DISCLOSURE.items.map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 16,
                background: "var(--theme-accent-soft)",
                border: "1px solid var(--theme-accent-line)",
                color: "var(--fg-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <span>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 18,
              border: "none",
              background: "var(--hyeni-theme-gradient)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
            }}
          >
            {AUTO_RENEWAL_DISCLOSURE.confirm}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: "1px solid var(--line-soft)",
              background: "var(--bg-subtle)",
              color: "var(--fg-secondary)",
              fontWeight: 700,
              cursor: "pointer",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
            }}
          >
            {AUTO_RENEWAL_DISCLOSURE.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
