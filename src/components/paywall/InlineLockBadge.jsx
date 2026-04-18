export function InlineLockBadge({
  locked,
  label = "프리미엄",
  children,
  blur = true,
  minHeight = 0,
}) {
  if (!locked) return children;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        minHeight,
      }}
    >
      <div style={{ filter: blur ? "blur(3px)" : "none", pointerEvents: "none", opacity: 0.55 }}>
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.78))",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: "#111827",
            color: "white",
            fontSize: 12,
            fontWeight: 800,
            boxShadow: "0 8px 20px rgba(17,24,39,0.24)",
          }}
        >
          <span>🔒</span>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
