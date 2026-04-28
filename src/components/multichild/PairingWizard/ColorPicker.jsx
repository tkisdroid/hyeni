// src/components/multichild/PairingWizard/ColorPicker.jsx
import { CHILD_PALETTE } from "../ChildPalette.js";

const COLOR_NAMES = {
  "#F779A8": "핑크", "#3B82F6": "파랑", "#10B981": "초록",
  "#F59E0B": "노랑", "#A78BFA": "보라", "#EF4444": "빨강",
};

export function ColorPicker({ selected, usedColors = [], onChange }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {CHILD_PALETTE.map((color) => {
        const isUsed = usedColors.includes(color) && color !== selected;
        const isSelected = color === selected;
        return (
          <button
            key={color} type="button"
            aria-label={COLOR_NAMES[color]}
            aria-disabled={isUsed}
            disabled={isUsed}
            onClick={() => !isUsed && onChange(color)}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: color,
              border: isSelected ? "3px solid #1F2937" : "2px solid #E5E7EB",
              opacity: isUsed ? 0.3 : 1,
              cursor: isUsed ? "not-allowed" : "pointer",
            }}
          />
        );
      })}
    </div>
  );
}
