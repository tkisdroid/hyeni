// src/components/auth/HyeniMascot.jsx
// Inline SVG mascot for child-mode placements (Phase 1 spec section 3.5).
// Two variants: static (decorative, role card) + wave (animated, child entry transition).
// Uses theme tokens so 6 테마 픽커 변경 시 자동 반영.

export function HyeniMascot({ size = 56, variant = "static", className = "", "aria-label": ariaLabel = "혜니 마스코트" }) {
    const isWave = variant === "wave";
    const viewBox = isWave ? "0 0 96 96" : "0 0 88 88";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            width={size}
            height={size}
            role="img"
            aria-label={ariaLabel}
            className={className}
            style={{
                "--mascot-pink": "var(--theme-accent)",
                "--mascot-pink-soft": "var(--theme-accent-soft)",
                "--mascot-pink-line": "var(--theme-accent-line)",
                "--mascot-cream": "var(--bg-base)",
                "--mascot-ink": "var(--fg-primary)",
            }}
        >
            {isWave ? (
                <>
                    {/* Face */}
                    <circle cx="48" cy="38" r="22" fill="var(--mascot-pink-soft)" stroke="var(--mascot-pink)" strokeWidth="1.6"/>
                    {/* Smiling eyes (‿‿) */}
                    <path d="M 38 35 Q 40 38 42 35" stroke="var(--mascot-ink)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    <path d="M 54 35 Q 56 38 58 35" stroke="var(--mascot-ink)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    {/* Smile */}
                    <path d="M 38 45 Q 48 51 58 45" stroke="var(--mascot-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                    {/* Cheeks */}
                    <circle cx="34" cy="40" r="3.5" fill="var(--mascot-pink)" opacity="0.5"/>
                    <circle cx="62" cy="40" r="3.5" fill="var(--mascot-pink)" opacity="0.5"/>
                    {/* Cone */}
                    <path d="M 32 65 L 64 65 L 48 92 Z" fill="var(--mascot-pink-soft)" stroke="var(--mascot-pink)" strokeWidth="1.6"/>
                    <ellipse cx="48" cy="65" rx="18" ry="8" fill="var(--mascot-cream)" stroke="var(--mascot-pink)" strokeWidth="1.6"/>
                    {/* Sprinkles */}
                    <circle cx="40" cy="63" r="2" fill="var(--mascot-pink)" opacity="0.5"/>
                    <circle cx="48" cy="60" r="2" fill="var(--mascot-pink)" opacity="0.5"/>
                    <circle cx="56" cy="64" r="2" fill="var(--mascot-pink)" opacity="0.5"/>
                    {/* Wave hand — animated via CSS class */}
                    <g className="hyeni-mascot-wave-arm">
                        <circle cx="74" cy="32" r="6" fill="var(--mascot-pink-soft)" stroke="var(--mascot-pink)" strokeWidth="1.5"/>
                    </g>
                </>
            ) : (
                <>
                    {/* Face */}
                    <circle cx="44" cy="36" r="20" fill="var(--mascot-pink-soft)" stroke="var(--mascot-pink)" strokeWidth="1.5"/>
                    {/* Eyes */}
                    <circle cx="37" cy="33" r="2.4" fill="var(--mascot-ink)"/>
                    <circle cx="51" cy="33" r="2.4" fill="var(--mascot-ink)"/>
                    {/* Smile */}
                    <path d="M 36 42 Q 44 47 52 42" stroke="var(--mascot-ink)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    {/* Cheeks */}
                    <circle cx="32" cy="38" r="3" fill="var(--mascot-pink)" opacity="0.5"/>
                    <circle cx="56" cy="38" r="3" fill="var(--mascot-pink)" opacity="0.5"/>
                    {/* Cone */}
                    <path d="M 30 60 L 58 60 L 44 84 Z" fill="var(--mascot-pink-soft)" stroke="var(--mascot-pink)" strokeWidth="1.5"/>
                    <ellipse cx="44" cy="60" rx="16" ry="7" fill="var(--mascot-cream)" stroke="var(--mascot-pink)" strokeWidth="1.5"/>
                    {/* Sprinkles */}
                    <circle cx="38" cy="58" r="2" fill="var(--mascot-pink)" opacity="0.4"/>
                    <circle cx="46" cy="55" r="2" fill="var(--mascot-pink)" opacity="0.4"/>
                    <circle cx="50" cy="59" r="2" fill="var(--mascot-pink)" opacity="0.4"/>
                </>
            )}
        </svg>
    );
}
