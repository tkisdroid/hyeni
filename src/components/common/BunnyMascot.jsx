const BunnyMascot = ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <ellipse cx="33" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="67" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="33" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="67" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="50" cy="65" rx="26" ry="22" fill="#FFF0F7" />
        <circle cx="50" cy="48" r="24" fill="#FFF0F7" />
        <path d="M38 44 Q40 41 42 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M58 44 Q60 41 62 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="51" rx="3" ry="2" fill="#FFB3D1" />
        <path d="M45 54 Q50 58 55 54" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="37" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <circle cx="63" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <ellipse cx="28" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(-20 28 68)" />
        <ellipse cx="72" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(20 72 68)" />
    </svg>
);

export default BunnyMascot;
