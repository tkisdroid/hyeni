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
        background: "rgba(31,41,55,0.38)",
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
        style={{
          width: "100%",
          maxWidth: 460,
          background: "white",
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px 32px",
          boxShadow: "0 -18px 48px rgba(31,41,55,0.16)",
          border: "1px solid #FFE4EF",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937" }}>{AUTO_RENEWAL_DISCLOSURE.title}</div>
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
                background: "#F8FAFC",
                color: "#475569",
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
              background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
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
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#6B7280",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {AUTO_RENEWAL_DISCLOSURE.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
