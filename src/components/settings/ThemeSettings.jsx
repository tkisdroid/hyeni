// Theme preference picker. Bottom-sheet modal with 3 options:
// system (follow OS), light, dark. Uses useTheme from src/lib/theme.js
// for state + localStorage persistence + <html data-theme> apply.

import { useTheme } from "../../lib/theme.js";

const OPTIONS = [
  { value: "system", icon: "🖥️", label: "시스템 설정 따르기", desc: "기기 설정에 맞춰 자동 전환" },
  { value: "light",  icon: "☀️", label: "라이트",            desc: "밝은 배경" },
  { value: "dark",   icon: "🌙", label: "다크",              desc: "어두운 배경 · 야간 권장" },
];

export function ThemeSettings({ open, onClose }) {
  const { pref, setPref } = useTheme();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="테마 설정"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(15, 15, 18, 0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        className="card-elevated"
        style={{
          width: "100%", maxWidth: 460,
          borderRadius: "16px 16px 0 0",
          padding: "16px 18px calc(env(safe-area-inset-bottom, 0px) + 22px)",
          background: "var(--bg-base)",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg-primary)" }}>
            테마
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {OPTIONS.map((opt) => {
            const active = pref === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPref(opt.value); }}
                aria-pressed={active}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 14px",
                  borderRadius: "var(--radius-card)",
                  border: active
                    ? "1.5px solid var(--hyeni-pink)"
                    : "1px solid var(--line-soft)",
                  background: active ? "var(--hyeni-pink-soft)" : "var(--bg-base)",
                  color: "var(--fg-primary)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color var(--duration-fast) var(--easing-standard), background-color var(--duration-fast) var(--easing-standard)",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--fg-primary)" }}>
                    {opt.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--fg-secondary)", marginTop: 2 }}>
                    {opt.desc}
                  </span>
                </span>
                {active && (
                  <span aria-hidden="true" style={{
                    width: 22, height: 22, borderRadius: "var(--radius-full)",
                    background: "var(--hyeni-pink)",
                    color: "var(--fg-on-primary)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
