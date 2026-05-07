// 카툰 SVG 일러스트 컴포넌트 세트.
//
// reference (screenshots/design1) 의 분홍 후드 여자아이 + 학부모 듀오를
// 영감으로, 외부 raster asset 없이 inline SVG 로 구현한다. 모든 색상은
// 토큰 또는 CSS 변수를 사용해 다크/라이트 모드 또는 테마 변경 시에도 일관된
// 룩을 유지한다 (현재는 라이트 cartoon 만 의도, 토큰만 정의되어 있음).
//
// viewBox = 100x100 정사각형, viewBox 내부 좌표만 사용해 size prop 으로 어떤
// 사이즈로든 픽셀 손상 없이 렌더링.

import "./cartoonIllustrations.css";

// ────────────────────────────────────────────────────────────
// HyeniGirl — 분홍 후드 + 갈색 단발 + 분홍 볼터치 + 작은 미소
// ────────────────────────────────────────────────────────────
export function HyeniGirl({ size = 64, ariaLabel = "혜니" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--hyeni"
        >
            {/* Hood/jacket back layer (rose) */}
            <path
                d="M 18 60 Q 18 38 50 38 Q 82 38 82 60 L 82 92 Q 82 96 78 96 L 22 96 Q 18 96 18 92 Z"
                className="ci-fill-rose-soft"
            />
            {/* Hood ear-tips (cute bear ears) */}
            <ellipse cx="28" cy="36" rx="7" ry="8" className="ci-fill-rose-soft" />
            <ellipse cx="72" cy="36" rx="7" ry="8" className="ci-fill-rose-soft" />
            <ellipse cx="28" cy="37" rx="3" ry="3.6" className="ci-fill-rose" />
            <ellipse cx="72" cy="37" rx="3" ry="3.6" className="ci-fill-rose" />

            {/* Face (skin) */}
            <ellipse cx="50" cy="55" rx="22" ry="23" className="ci-fill-skin" />

            {/* Hair fringe — brown bob */}
            <path
                d="M 30 47 Q 33 35 50 32 Q 67 35 70 47 Q 64 41 56 43 Q 50 39 44 43 Q 36 41 30 47 Z"
                className="ci-fill-hair"
            />
            {/* Side hair tufts */}
            <path d="M 28 50 Q 26 60 30 66 L 33 60 Q 32 53 32 50 Z" className="ci-fill-hair" />
            <path d="M 72 50 Q 74 60 70 66 L 67 60 Q 68 53 68 50 Z" className="ci-fill-hair" />

            {/* Cheeks (blush) */}
            <ellipse cx="38" cy="60" rx="3.4" ry="2.2" className="ci-fill-blush" />
            <ellipse cx="62" cy="60" rx="3.4" ry="2.2" className="ci-fill-blush" />

            {/* Eyes — simple closed-eye smile dots */}
            <circle cx="42" cy="55" r="1.8" className="ci-fill-ink" />
            <circle cx="58" cy="55" r="1.8" className="ci-fill-ink" />

            {/* Mouth — small smile */}
            <path
                d="M 47 65 Q 50 68 53 65"
                className="ci-stroke-ink"
                fill="none"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// ParentMomDuo — 엄마 + 아이가 어깨동무한 듀오 (학부모 카드/상단용)
// ────────────────────────────────────────────────────────────
export function ParentMomDuo({ size = 80, ariaLabel = "엄마와 아이" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size * (96 / 120)}
            viewBox="0 0 120 96"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--mom-duo"
        >
            {/* Mom body (beige cardigan) */}
            <path
                d="M 14 50 Q 14 38 38 38 Q 62 38 62 50 L 62 92 Q 62 96 58 96 L 18 96 Q 14 96 14 92 Z"
                className="ci-fill-beige"
            />
            {/* Mom face */}
            <ellipse cx="38" cy="32" rx="16" ry="17" className="ci-fill-skin" />
            {/* Mom hair — long brown bob */}
            <path
                d="M 22 30 Q 22 14 38 12 Q 54 14 54 30 Q 54 38 56 50 L 50 50 Q 50 38 50 30 Q 48 22 38 22 Q 28 22 26 30 Q 26 38 26 50 L 20 50 Q 22 38 22 30 Z"
                className="ci-fill-hair"
            />
            {/* Mom cheeks */}
            <ellipse cx="29" cy="36" rx="2.2" ry="1.6" className="ci-fill-blush" />
            <ellipse cx="47" cy="36" rx="2.2" ry="1.6" className="ci-fill-blush" />
            {/* Mom eyes */}
            <circle cx="32" cy="32" r="1.4" className="ci-fill-ink" />
            <circle cx="44" cy="32" r="1.4" className="ci-fill-ink" />
            {/* Mom mouth */}
            <path d="M 35 40 Q 38 42 41 40" className="ci-stroke-ink" fill="none" strokeWidth="1.4" strokeLinecap="round" />

            {/* Child rose hood + body (overlapping mom on right) */}
            <path
                d="M 60 56 Q 60 42 80 42 Q 100 42 100 56 L 100 92 Q 100 96 96 96 L 64 96 Q 60 96 60 92 Z"
                className="ci-fill-rose-soft"
            />
            <ellipse cx="71" cy="42" rx="5" ry="5.5" className="ci-fill-rose-soft" />
            <ellipse cx="89" cy="42" rx="5" ry="5.5" className="ci-fill-rose-soft" />
            {/* Child face */}
            <ellipse cx="80" cy="52" rx="14" ry="15" className="ci-fill-skin" />
            {/* Child hair fringe */}
            <path
                d="M 67 47 Q 70 38 80 36 Q 90 38 93 47 Q 88 42 84 44 Q 80 41 76 44 Q 72 42 67 47 Z"
                className="ci-fill-hair"
            />
            {/* Child cheeks */}
            <ellipse cx="71" cy="56" rx="2.2" ry="1.5" className="ci-fill-blush" />
            <ellipse cx="89" cy="56" rx="2.2" ry="1.5" className="ci-fill-blush" />
            {/* Child eyes */}
            <circle cx="74" cy="52" r="1.3" className="ci-fill-ink" />
            <circle cx="86" cy="52" r="1.3" className="ci-fill-ink" />
            {/* Child mouth */}
            <path d="M 77 60 Q 80 62 83 60" className="ci-stroke-ink" fill="none" strokeWidth="1.3" strokeLinecap="round" />

            {/* Mom arm reaching child (subtle gesture) */}
            <path
                d="M 56 60 Q 64 56 70 58"
                className="ci-stroke-beige-strong"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
            />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// ParentMom — 엄마 단독 (역할 chip 용)
// ────────────────────────────────────────────────────────────
export function ParentMom({ size = 36, ariaLabel = "엄마" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--mom"
        >
            <path
                d="M 22 60 Q 22 44 50 44 Q 78 44 78 60 L 78 92 Q 78 96 74 96 L 26 96 Q 22 96 22 92 Z"
                className="ci-fill-beige"
            />
            <ellipse cx="50" cy="38" rx="20" ry="22" className="ci-fill-skin" />
            {/* Long hair frame */}
            <path
                d="M 28 38 Q 28 16 50 14 Q 72 16 72 38 Q 72 52 74 60 L 66 60 Q 66 50 66 38 Q 64 26 50 26 Q 36 26 34 38 Q 34 50 34 60 L 26 60 Q 28 52 28 38 Z"
                className="ci-fill-hair"
            />
            <ellipse cx="40" cy="44" rx="2.5" ry="1.8" className="ci-fill-blush" />
            <ellipse cx="60" cy="44" rx="2.5" ry="1.8" className="ci-fill-blush" />
            <circle cx="44" cy="40" r="1.6" className="ci-fill-ink" />
            <circle cx="56" cy="40" r="1.6" className="ci-fill-ink" />
            <path d="M 47 49 Q 50 51 53 49" className="ci-stroke-ink" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// ParentDad — 아빠 단독 (역할 chip 용) — 짧은 머리 + 살짝 진한 윤곽
// ────────────────────────────────────────────────────────────
export function ParentDad({ size = 36, ariaLabel = "아빠" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--dad"
        >
            <path
                d="M 22 60 Q 22 44 50 44 Q 78 44 78 60 L 78 92 Q 78 96 74 96 L 26 96 Q 22 96 22 92 Z"
                className="ci-fill-navy"
            />
            <ellipse cx="50" cy="40" rx="20" ry="20" className="ci-fill-skin" />
            {/* Short hair top */}
            <path
                d="M 32 30 Q 36 18 50 16 Q 64 18 68 30 Q 68 36 64 38 Q 60 32 50 32 Q 40 32 36 38 Q 32 36 32 30 Z"
                className="ci-fill-hair-dark"
            />
            <ellipse cx="40" cy="46" rx="2.4" ry="1.6" className="ci-fill-blush" />
            <ellipse cx="60" cy="46" rx="2.4" ry="1.6" className="ci-fill-blush" />
            <circle cx="44" cy="42" r="1.6" className="ci-fill-ink" />
            <circle cx="56" cy="42" r="1.6" className="ci-fill-ink" />
            <path d="M 47 51 Q 50 53 53 51" className="ci-stroke-ink" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// ParentGuardian — 보호자 (안경 캐릭터)
// ────────────────────────────────────────────────────────────
export function ParentGuardian({ size = 36, ariaLabel = "보호자" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--guardian"
        >
            <path
                d="M 22 60 Q 22 44 50 44 Q 78 44 78 60 L 78 92 Q 78 96 74 96 L 26 96 Q 22 96 22 92 Z"
                className="ci-fill-mint"
            />
            <ellipse cx="50" cy="40" rx="20" ry="20" className="ci-fill-skin" />
            {/* Short greying hair */}
            <path
                d="M 32 28 Q 36 16 50 14 Q 64 16 68 28 Q 68 34 64 36 Q 60 30 50 30 Q 40 30 36 36 Q 32 34 32 28 Z"
                className="ci-fill-hair-grey"
            />
            {/* Glasses */}
            <circle cx="42" cy="42" r="5" className="ci-stroke-ink" fill="none" strokeWidth="1.8" />
            <circle cx="58" cy="42" r="5" className="ci-stroke-ink" fill="none" strokeWidth="1.8" />
            <line x1="47" y1="42" x2="53" y2="42" className="ci-stroke-ink" strokeWidth="1.8" />
            <ellipse cx="36" cy="48" rx="1.8" ry="1.2" className="ci-fill-blush" />
            <ellipse cx="64" cy="48" rx="1.8" ry="1.2" className="ci-fill-blush" />
            <path d="M 47 53 Q 50 55 53 53" className="ci-stroke-ink" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// FamilyHome — 집 + 가족 + 잔디 (ChildPairInput 하단 안내)
// ────────────────────────────────────────────────────────────
export function FamilyHome({ width = 220, ariaLabel = "가족과 함께하는 집" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={width}
            height={width * (80 / 220)}
            viewBox="0 0 220 80"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--family-home"
        >
            {/* Grass band */}
            <ellipse cx="110" cy="76" rx="120" ry="6" className="ci-fill-mint-soft" />
            {/* House body */}
            <rect x="22" y="38" width="58" height="32" rx="3" className="ci-fill-rose-soft" />
            {/* Roof */}
            <path d="M 16 40 L 51 18 L 86 40 Z" className="ci-fill-rose" />
            {/* Door */}
            <rect x="44" y="50" width="14" height="20" rx="2" className="ci-fill-beige" />
            <circle cx="55" cy="60" r="0.9" className="ci-fill-ink" />
            {/* Window */}
            <rect x="28" y="44" width="10" height="10" rx="1.5" className="ci-fill-cream" />
            <rect x="62" y="44" width="10" height="10" rx="1.5" className="ci-fill-cream" />
            <line x1="33" y1="44" x2="33" y2="54" className="ci-stroke-rose" strokeWidth="0.8" />
            <line x1="28" y1="49" x2="38" y2="49" className="ci-stroke-rose" strokeWidth="0.8" />
            <line x1="67" y1="44" x2="67" y2="54" className="ci-stroke-rose" strokeWidth="0.8" />
            <line x1="62" y1="49" x2="72" y2="49" className="ci-stroke-rose" strokeWidth="0.8" />

            {/* Tree */}
            <ellipse cx="100" cy="58" rx="10" ry="12" className="ci-fill-mint" />
            <rect x="98.5" y="64" width="3" height="10" className="ci-fill-hair" />

            {/* Family — small mom + child (overlap house right side) */}
            <g transform="translate(118, 36) scale(0.42)">
                {/* mom */}
                <path d="M 22 60 Q 22 44 50 44 Q 78 44 78 60 L 78 92 Q 78 96 74 96 L 26 96 Q 22 96 22 92 Z" className="ci-fill-beige" />
                <ellipse cx="50" cy="38" rx="20" ry="22" className="ci-fill-skin" />
                <path d="M 28 38 Q 28 16 50 14 Q 72 16 72 38 L 66 60 Q 66 38 50 26 Q 34 38 34 60 Z" className="ci-fill-hair" />
                <circle cx="44" cy="40" r="2" className="ci-fill-ink" />
                <circle cx="56" cy="40" r="2" className="ci-fill-ink" />
                <path d="M 47 49 Q 50 51 53 49" className="ci-stroke-ink" fill="none" strokeWidth="2" strokeLinecap="round" />
            </g>
            <g transform="translate(160, 44) scale(0.36)">
                {/* child */}
                <path d="M 18 60 Q 18 38 50 38 Q 82 38 82 60 L 82 92 Q 82 96 78 96 L 22 96 Q 18 96 18 92 Z" className="ci-fill-rose-soft" />
                <ellipse cx="28" cy="36" rx="7" ry="8" className="ci-fill-rose-soft" />
                <ellipse cx="72" cy="36" rx="7" ry="8" className="ci-fill-rose-soft" />
                <ellipse cx="50" cy="55" rx="22" ry="23" className="ci-fill-skin" />
                <path d="M 30 47 Q 33 35 50 32 Q 67 35 70 47 Q 64 41 56 43 Q 50 39 44 43 Q 36 41 30 47 Z" className="ci-fill-hair" />
                <circle cx="42" cy="55" r="2" className="ci-fill-ink" />
                <circle cx="58" cy="55" r="2" className="ci-fill-ink" />
                <path d="M 47 65 Q 50 68 53 65" className="ci-stroke-ink" fill="none" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Floating hearts */}
            <path d="M 92 14 c -1 -1.6 -3.4 -1.4 -3.4 0.7 c 0 1.6 2 2.8 3.4 4 c 1.4 -1.2 3.4 -2.4 3.4 -4 c 0 -2.1 -2.4 -2.3 -3.4 -0.7 z" className="ci-fill-rose" />
            <path d="M 196 22 c -0.7 -1 -2.2 -0.9 -2.2 0.5 c 0 1 1.3 1.8 2.2 2.6 c 0.9 -0.8 2.2 -1.6 2.2 -2.6 c 0 -1.4 -1.5 -1.5 -2.2 -0.5 z" className="ci-fill-rose-soft" />
        </svg>
    );
}

// ────────────────────────────────────────────────────────────
// PinBubbleGirl — 작은 여자아이 + 말풍선 (지도 옆 location callout)
// ────────────────────────────────────────────────────────────
export function PinBubbleGirl({ size = 64, ariaLabel = "여기가요" }) {
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="cartoon-illust cartoon-illust--pin-bubble"
        >
            {/* Speech bubble */}
            <rect x="6" y="8" width="60" height="22" rx="11" className="ci-fill-rose" />
            <path d="M 26 30 L 30 36 L 36 30 Z" className="ci-fill-rose" />
            <text
                x="36"
                y="24"
                textAnchor="middle"
                className="ci-text-on-rose"
                fontSize="10"
                fontWeight="800"
                fontFamily="var(--font-sans)"
            >
                여기가요
            </text>

            {/* Girl below bubble — compact version */}
            <g transform="translate(40, 36)">
                <path d="M 0 30 Q 0 14 25 14 Q 50 14 50 30 L 50 60 Q 50 64 46 64 L 4 64 Q 0 64 0 60 Z" className="ci-fill-rose-soft" />
                <ellipse cx="9" cy="16" rx="5" ry="6" className="ci-fill-rose-soft" />
                <ellipse cx="41" cy="16" rx="5" ry="6" className="ci-fill-rose-soft" />
                <ellipse cx="25" cy="28" rx="15" ry="16" className="ci-fill-skin" />
                <path d="M 11 22 Q 14 12 25 10 Q 36 12 39 22 Q 33 17 28 19 Q 25 16 22 19 Q 17 17 11 22 Z" className="ci-fill-hair" />
                <circle cx="19" cy="28" r="1.5" className="ci-fill-ink" />
                <circle cx="31" cy="28" r="1.5" className="ci-fill-ink" />
                <path d="M 22 36 Q 25 38 28 36" className="ci-stroke-ink" fill="none" strokeWidth="1.4" strokeLinecap="round" />
            </g>
        </svg>
    );
}
