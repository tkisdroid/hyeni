// src/lib/styleHelpers.js
// Inline-style 토큰 + style factory. Extracted from App.jsx (Phase 5 #4 / A5).
//
// 책임:
//   - DESIGN — 테마 색/그라디언트/radius/shadow 상수 묶음 (Object.freeze)
//   - FF     — Pretendard 우선 font-family stack
//   - modalBackdropStyle — 모달 backdrop 공통 스타일
//   - make*Style       — 카드/시트/입력/버튼 base style factory (overrides 머지)
//
// CLAUDE.md token-only 룰: 가능한 곳은 var(--*) token, 일부 legacy hex 는
// DESIGN.colors 안의 historical brand 색 (예: #F3E9EC line) 으로 보존.

export const FF = "'Pretendard Variable','Pretendard',system-ui,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif";

export const DESIGN = Object.freeze({
    colors: {
        brand: "#E65C92",
        brandDark: "#C4447A",
        pink: "#F779A8",
        pinkDeep: "#E65C92",
        pinkText: "#B0477A",
        pinkSoft: "#FFF5FA",
        pinkLine: "#FFE4EF",
        pinkLineStrong: "#FFD4E7",
        pale: "#FFFAF5",
        cream: "#FCF1EB",
        parent: "#3B82F6",
        parentDeep: "#2563EB",
        parentPale: "var(--bg-subtle)",
        ink: "var(--fg-primary)",
        inkSoft: "var(--fg-secondary)",
        muted: "var(--fg-tertiary)",
        line: "#F3E9EC",
        lineStrong: "#EFE9F1",
        success: "var(--status-positive)",
        successPale: "var(--status-positive-subtle)",
        warning: "var(--status-cautionary)",
        warningPale: "var(--status-cautionary-subtle)",
        danger: "var(--status-negative)",
        dangerPale: "var(--status-negative-subtle)",
        surface: "var(--bg-base)",
    },
    gradients: {
        shell: "var(--hyeni-product-canvas)",
        page: "var(--hyeni-product-canvas)",
        primary: "linear-gradient(135deg,var(--theme-accent) 0%,var(--theme-accent-deep) 100%)",
        hero: "linear-gradient(135deg,color-mix(in srgb, var(--theme-accent) 28%, #FFFFFF) 0%,var(--theme-accent) 100%)",
        parent: "linear-gradient(135deg,#60A5FA 0%,#3B82F6 100%)",
        child: "linear-gradient(135deg,var(--theme-accent) 0%,var(--theme-accent-deep) 100%)",
        warm: "linear-gradient(135deg,#FFFFFF 0%,var(--theme-accent-soft) 100%)",
        onboard: "var(--hyeni-product-canvas)",
        map: "linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 48%, #fff 52%) 0%, #fffaf6 100%)",
        // Non-emergency destructive/warn confirmation gradient (amber tones).
        // Saturated red reserved for SOS, 긴급, 하트 visuals only.
        danger: "linear-gradient(135deg,var(--status-cautionary),var(--status-cautionary-strong))",
    },
    radius: {
        sm: 12,
        md: 16,
        lg: 20,
        xl: 16,
        hero: 32,
        sheet: "16px 16px 0 0",
    },
    shadow: {
        soft: "none",
        card: "none",
        elevated: "var(--hyeni-theme-shadow)",
        sheet: "var(--hyeni-theme-shadow)",
        focus: "0 0 0 4px var(--theme-accent-soft)",
    },
});

export const modalBackdropStyle = {
    background: "rgba(31,41,55,0.38)",
    backdropFilter: "blur(12px)",
};

export const makeCardStyle = (overrides = {}) => ({
    background: DESIGN.colors.surface,
    borderRadius: DESIGN.radius.xl,
    border: "2px solid var(--theme-accent-line)",
    boxShadow: DESIGN.shadow.card,
    ...overrides,
});

export const makeSheetStyle = (overrides = {}) => ({
    background: DESIGN.colors.surface,
    borderRadius: DESIGN.radius.sheet,
    border: "1px solid var(--theme-accent-line)",
    boxShadow: DESIGN.shadow.sheet,
    ...overrides,
});

export const makeInputStyle = (overrides = {}) => ({
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${DESIGN.colors.line}`,
    borderRadius: DESIGN.radius.md,
    fontSize: 15,
    fontWeight: "var(--weight-medium)",
    color: "var(--fg-primary)",
    background: DESIGN.colors.surface,
    fontFamily: FF,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.16s ease, box-shadow 0.16s ease",
    ...overrides,
});

export const makePrimaryButtonStyle = (overrides = {}) => ({
    width: "100%",
    minHeight: 48,
    padding: "14px 16px",
    background: DESIGN.gradients.primary,
    color: "var(--fg-on-primary)",
    border: "none",
    borderRadius: DESIGN.radius.lg,
    fontSize: 15,
    fontWeight: "var(--weight-bold)",
    cursor: "pointer",
    fontFamily: FF,
    boxShadow: "var(--hyeni-theme-shadow-soft)",
    transition: "transform 0.12s ease, box-shadow 0.16s ease",
    ...overrides,
});

export const makeSecondaryButtonStyle = (overrides = {}) => ({
    width: "100%",
    minHeight: 44,
    padding: "12px 14px",
    background: DESIGN.colors.surface,
    color: "var(--fg-secondary)",
    border: `1.5px solid ${DESIGN.colors.line}`,
    borderRadius: DESIGN.radius.lg,
    fontSize: 14,
    fontWeight: "var(--weight-bold)",
    cursor: "pointer",
    fontFamily: FF,
    transition: "background 0.16s ease, border-color 0.16s ease",
    ...overrides,
});
