// "혜니캘린더" wordmark — reference (screenshots/design1) 처럼 글자별
// 미세한 회전/크기 변화로 카툰 무드를 살린다. 토큰 컬러만 사용.
//
// size: "lg" (entry 화면) | "md" | "sm". font-family 는 cartoon-font-display
// 가 우선이며 Cafe24 Ssurround 가 없으면 Pretendard 굵은 weight 로 fallback.
const CHARS = ["혜", "니", "캘", "린", "더"];
const TILTS = [-4, 3, -2, 4, -3]; // deg
const SCALES = [1.0, 1.04, 0.96, 1.02, 1.0];

const SIZE_TABLE = {
  lg: { fontSize: 36, gap: 2, weight: 800 },
  md: { fontSize: 26, gap: 2, weight: 800 },
  sm: { fontSize: 18, gap: 1, weight: 700 },
};

export function HyeniWordmark({
  size = "lg",
  color = "var(--cartoon-rose-text)",
  ariaLabel = "혜니캘린더",
  style,
}) {
  const dims = SIZE_TABLE[size] || SIZE_TABLE.lg;
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: dims.gap,
        fontFamily: "var(--cartoon-font-display)",
        fontWeight: dims.weight,
        fontSize: dims.fontSize,
        lineHeight: 1.1,
        color,
        letterSpacing: 0,
        ...style,
      }}
    >
      {CHARS.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: "inline-block",
            transform: `rotate(${TILTS[i]}deg) scale(${SCALES[i]})`,
            transformOrigin: "center bottom",
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
