// src/components/icons/CategoryIcon.jsx
// 3D category icon. Looks up iconKey on CATEGORIES; falls back to the emoji
// glyph when no asset is curated yet (e.g. friend).
// Phase 07 Step 3 — 3D asset migration.

import { CATEGORIES } from "../../lib/scheduleCategories";

import schoolIcon from "../../assets/3d/category/school.webp";
import sportsIcon from "../../assets/3d/category/sports.webp";
import hobbyIcon from "../../assets/3d/category/hobby.webp";
import familyIcon from "../../assets/3d/category/family.webp";
import otherIcon from "../../assets/3d/category/other.webp";

const SOURCES = {
    school: schoolIcon,
    sports: sportsIcon,
    hobby: hobbyIcon,
    family: familyIcon,
    other: otherIcon,
};

export function CategoryIcon({
    categoryId,
    size = 24,
    className = "",
    "aria-label": ariaLabel,
}) {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return null;
    const src = cat.iconKey ? SOURCES[cat.iconKey] : null;
    const label = ariaLabel ?? cat.label;

    if (!src) {
        return (
            <span
                role="img"
                aria-label={label}
                className={className}
                style={{
                    fontSize: size,
                    lineHeight: 1,
                    display: "inline-block",
                    width: size,
                    height: size,
                    textAlign: "center",
                }}
            >
                {cat.emoji}
            </span>
        );
    }

    return (
        <img
            src={src}
            width={size}
            height={size}
            alt={label}
            className={className}
            draggable={false}
            style={{
                width: size,
                height: size,
                objectFit: "contain",
                userSelect: "none",
            }}
        />
    );
}
