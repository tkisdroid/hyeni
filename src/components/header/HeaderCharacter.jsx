// src/components/header/HeaderCharacter.jsx
// 최상단 헤더 전용 "혜니" 캐릭터.
// 헤더 상태(mood)에 따라 3D 이미지를 전환한다. 헤더에서만 사용하며
// HyeniMascot / AppBrandLogo 및 그 사용처에는 영향을 주지 않는다.
//
// 에셋: src/assets/3d/header/*.webp — 원본 PNG의 투명 여백을 트림한
// 이미지. 정사각 슬롯 안에서 object-fit: contain 으로 캐릭터를 중앙 정렬한다.
//
// Props:
//   mood: "static" | "diary" | "sad" (default "static") — 알 수 없는 값은 static 폴백
//   size: number (px, default 36) — 정사각 슬롯 한 변
//   aria-label: string

import headerStatic from "../../assets/3d/header/static.webp";
import headerDiary from "../../assets/3d/header/diary.webp";
import headerSad from "../../assets/3d/header/sad.webp";

const SOURCES = {
    static: headerStatic,
    diary: headerDiary,
    sad: headerSad,
};

export function HeaderCharacter({
    mood = "static",
    size = 36,
    "aria-label": ariaLabel = "혜니",
}) {
    const src = SOURCES[mood] ?? SOURCES.static;

    return (
        <span
            style={{
                width: size,
                height: size,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                lineHeight: 0,
            }}
        >
            <img
                src={src}
                width={size}
                height={size}
                alt={ariaLabel}
                draggable={false}
                style={{
                    width: size,
                    height: size,
                    objectFit: "contain",
                    objectPosition: "center",
                    userSelect: "none",
                    pointerEvents: "none",
                }}
            />
        </span>
    );
}
