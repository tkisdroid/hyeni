import { useId } from "react";

// 카툰 디자인 reference(screenshots/design1) 의 핵심 분위기 — 부드러운 크림
// 핑크 그라데이션 + 흩뿌려진 하트 파티클 — 을 wrapper 형태로 적용한다.
//
// children 은 BG 위에 그대로 렌더링되며, height/width 는 wrapper 사이즈를
// 따라간다. position 은 기본적으로 relative (children 의 absolute 좌표가
// 기준이 됨). 토큰만 사용해 색상 일관성 유지.
//
// CSS-only 라 reduced-motion 이슈 없음. SVG pattern 은 한번만 정의되고 fill
// 의 url(#) reference 는 useId 로 안전하게 격리된다 (한 화면에 두 개 mount
// 시 충돌 방지).
export function HeartsBackground({
  children,
  density = "soft", // "soft" | "dense"
  className,
  style,
}) {
  const patternId = useId();
  const tile = density === "dense" ? 64 : 96;
  const heartScale = density === "dense" ? 0.85 : 1;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100%",
        background: "var(--cartoon-bg-gradient)",
        overflow: "hidden",
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <defs>
          <pattern
            id={patternId}
            width={tile}
            height={tile}
            patternUnits="userSpaceOnUse"
          >
            <g transform={`scale(${heartScale})`}>
              <path
                d="M 12 7 c -2.2 -3.4 -7.2 -3.0 -7.2 1.4 c 0 3.4 4.2 6.0 7.2 8.6 c 3.0 -2.6 7.2 -5.2 7.2 -8.6 c 0 -4.4 -5.0 -4.8 -7.2 -1.4 z"
                fill="var(--cartoon-heart-fill)"
                transform="translate(8 12)"
              />
              <path
                d="M 12 7 c -2.2 -3.4 -7.2 -3.0 -7.2 1.4 c 0 3.4 4.2 6.0 7.2 8.6 c 3.0 -2.6 7.2 -5.2 7.2 -8.6 c 0 -4.4 -5.0 -4.8 -7.2 -1.4 z"
                fill="var(--cartoon-heart-fill-strong)"
                transform="translate(54 46) scale(0.7)"
              />
              <circle cx="76" cy="20" r="2" fill="var(--cartoon-heart-fill-strong)" />
              <circle cx="22" cy="68" r="1.6" fill="var(--cartoon-heart-fill)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div style={{ position: "relative", zIndex: 1, width: "100%", minHeight: "100%" }}>
        {children}
      </div>
    </div>
  );
}
