// src/components/multichild/PairingWizard/ColorPicker.jsx
import { CHILD_PALETTE } from "../ChildPalette.js";
import { applyThemeColor } from "../../../lib/theme.js";

const COLOR_NAMES = {
  "#F779A8": "핑크",
  "#3B82F6": "파랑",
  "#10B981": "초록",
  "#F59E0B": "노랑",
  "#A78BFA": "보라",
  "#EF4444": "빨강",
};

export function ColorPicker({ selected, usedColors = [], onChange }) {
  const handleSelect = (color) => {
    onChange(color);
    // Live preview — applying the theme on selection lets the user see the
    // chosen color reflected in the surrounding wizard chrome before commit.
    applyThemeColor(color);
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {CHILD_PALETTE.map((color) => {
        const isUsed = usedColors.includes(color) && color !== selected;
        const isSelected = color === selected;
        return (
          <button
            key={color}
            type="button"
            aria-label={COLOR_NAMES[color] || "색상"}
            aria-pressed={isSelected}
            aria-disabled={isUsed}
            disabled={isUsed}
            onClick={() => !isUsed && handleSelect(color)}
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-full)",
              background: color,
              border: isSelected
                ? "3px solid var(--fg-primary)"
                : "2px solid var(--line-soft)",
              opacity: isUsed ? 0.3 : 1,
              cursor: isUsed ? "not-allowed" : "pointer",
              boxShadow: isSelected ? `0 0 0 4px ${color}33` : "none",
              transition: "box-shadow 160ms var(--easing-standard, ease-out), border-color 160ms",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation",
            }}
          />
        );
      })}
    </div>
  );
}
