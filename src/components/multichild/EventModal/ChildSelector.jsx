// src/components/multichild/EventModal/ChildSelector.jsx
export function ChildSelector({ children, value, onChange }) {
  if (!children || children.length < 2) return null;

  const { childIds = [], familyAll = false } = value || {};

  function toggleChild(id) {
    const next = childIds.includes(id) ? childIds.filter((x) => x !== id) : [...childIds, id];
    onChange({ childIds: next, familyAll: false });
  }

  function pickFamily() {
    onChange({ childIds: [], familyAll: true });
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--fg-primary)" }}>대상</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children.map((c) => {
          // Use family_members.id (matches events_children.child_id FK target).
          // When familyAll is on, mark every checkbox as checked for visual parity
          // — the underlying flag still drives the save path (is_family_event=true).
          const checked = familyAll || childIds.includes(c.id);
          return (
            <label
              key={c.id}
              className="card card-interactive"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px",
                border: checked ? `2px solid ${c.color_hex}` : undefined,
                background: checked ? `${c.color_hex}15` : undefined,
              }}
            >
              <input
                type="checkbox" checked={checked}
                onChange={() => toggleChild(c.id)}
                aria-label={c.name}
                data-child-id={c.id}
                style={{ width: 20, height: 20, accentColor: c.color_hex }}
              />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color_hex }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-primary)" }}>{c.name}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button" onClick={pickFamily}
        className={`btn ${familyAll ? "btn-primary" : "btn-secondary"}`}
        style={{
          marginTop: "var(--space-3)",
          width: "100%",
          height: 44,
          fontSize: 14,
          border: `2px dashed ${familyAll ? "var(--theme-accent)" : "var(--theme-accent-line)"}`,
          userSelect: "none",
        }}
      >가족 전체</button>
    </div>
  );
}
