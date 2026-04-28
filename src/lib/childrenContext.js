import { useMemo } from "react";
import { autoAssignColor } from "../components/multichild/ChildPalette.js";

export function deriveChildren(familyInfo) {
  if (!familyInfo || !Array.isArray(familyInfo.members)) {
    return { count: 0, isMultiChild: false, list: [] };
  }

  const children = familyInfo.members
    .filter((m) => m.role === "child")
    .sort((a, b) => (a.child_order ?? 99) - (b.child_order ?? 99));

  const usedColors = [];
  const list = children.map((c) => {
    let color = c.color_hex;
    if (!color) color = autoAssignColor(usedColors);
    usedColors.push(color);
    return { ...c, color_hex: color };
  });

  return { count: list.length, isMultiChild: list.length >= 2, list };
}

export function useChildren(familyInfo) {
  return useMemo(() => deriveChildren(familyInfo), [familyInfo]);
}
