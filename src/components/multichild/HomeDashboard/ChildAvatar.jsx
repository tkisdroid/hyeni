import { useEffect, useState } from "react";
import {
  HYENI_DEFAULT_CHILD_IMAGE_CROP,
  HYENI_DEFAULT_CHILD_IMAGE_STYLE,
  HYENI_DEFAULT_CHILD_IMAGE_URL,
} from "../../../lib/childDefaultImage.js";

function getFallbackGlyph(child) {
  if (child?.emoji) return child.emoji;
  const firstChar = child?.name?.trim?.()[0];
  return firstChar || "아이";
}

export function ChildAvatar({
  child,
  size = 52,
  color,
  radius = "var(--radius-full)",
  fontSize = 17,
  className,
  style,
  loading = "eager",
  decorative = false,
}) {
  const photoUrl = typeof child?.photo_url === "string" && child.photo_url.trim() ? child.photo_url : null;
  const accent = color || child?.color_hex || "var(--theme-accent)";
  const name = child?.name || "자녀";
  const [imageState, setImageState] = useState(photoUrl ? "loading" : "fallback");
  const [defaultImageFailed, setDefaultImageFailed] = useState(false);

  useEffect(() => {
    setImageState(photoUrl ? "loading" : "fallback");
    setDefaultImageFailed(false);
  }, [photoUrl]);

  const showImage = Boolean(photoUrl) && imageState !== "fallback";
  const fallbackVisible = imageState !== "loaded";

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${name} 프로필`}
      aria-hidden={decorative ? "true" : undefined}
      data-child-avatar
      data-avatar-state={imageState}
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: radius,
        background: accent,
        border: `2px solid ${accent}`,
        flexShrink: 0,
        overflow: "hidden",
        color: "white",
        fontWeight: "var(--weight-bold)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        lineHeight: 1,
        userSelect: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
    >
      {fallbackVisible && (
        defaultImageFailed ? (
          <span
            aria-hidden="true"
            style={{
              opacity: 1,
              transition: "opacity 120ms ease",
            }}
          >
            {getFallbackGlyph(child)}
          </span>
        ) : (
          <img
            src={HYENI_DEFAULT_CHILD_IMAGE_URL}
            alt=""
            aria-hidden="true"
            data-hyeni-default-child-image
            data-hyeni-default-child-image-crop={HYENI_DEFAULT_CHILD_IMAGE_CROP}
            loading={loading}
            decoding="async"
            onError={() => setDefaultImageFailed(true)}
            style={{
              ...HYENI_DEFAULT_CHILD_IMAGE_STYLE,
              opacity: 1,
              transition: "opacity 120ms ease",
            }}
          />
        )
      )}
      {showImage && (
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
          onLoad={() => setImageState("loaded")}
          onError={() => setImageState("fallback")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: imageState === "loaded" ? 1 : 0,
            transition: "opacity 120ms ease",
          }}
        />
      )}
    </span>
  );
}
