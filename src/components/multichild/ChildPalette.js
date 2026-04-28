export const CHILD_PALETTE = [
  "#F779A8", // 핑크
  "#3B82F6", // 파랑
  "#10B981", // 초록
  "#F59E0B", // 노랑
  "#A78BFA", // 보라
  "#EF4444", // 빨강
];

export function autoAssignColor(usedColors) {
  if (!Array.isArray(usedColors) || usedColors.length === 0) {
    return CHILD_PALETTE[0];
  }
  for (const color of CHILD_PALETTE) {
    if (!usedColors.includes(color)) return color;
  }
  return CHILD_PALETTE[0];
}
