import { useEffect, useState } from "react";
import {
  HYENI_DEFAULT_CHILD_IMAGE_CROP,
  HYENI_DEFAULT_CHILD_IMAGE_STYLE,
  HYENI_DEFAULT_CHILD_IMAGE_URL,
} from "../../../lib/childDefaultImage.js";
import { deferEffectStateUpdate } from "../../../lib/deferEffectStateUpdate.js";

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
  const accent = color || child?.color_hex || "var(--cartoon-rose)";
  const name = child?.name || "자녀";
  const [imageState, setImageState] = useState(photoUrl ? "loading" : "fallback");
  const [defaultImageFailed, setDefaultImageFailed] = useState(false);
  const [photoErrored, setPhotoErrored] = useState(false);

  useEffect(() => {
    return deferEffectStateUpdate(() => {
      setImageState(photoUrl ? "loading" : "fallback");
      setDefaultImageFailed(false);
      setPhotoErrored(false);
    });
  }, [photoUrl]);

  // 상태 분기:
  //   no-photo (initial fallback)  : 기본 Hyeni 이미지 (defaultImageFailed→glyph)
  //   loading (photo 로딩중)        : photo img(투명) + 기본 Hyeni 백그라운드
  //   loaded                        : photo img 만 노출
  //   fallback after photoError     : 색상 glyph 만 (img 요소 제거)
  const showPhotoImg = Boolean(photoUrl) && !photoErrored;
  const showDefaultBackground =
    !photoErrored && !defaultImageFailed && imageState !== "loaded";
  const showGlyph =
    (imageState === "fallback" && photoErrored) ||
    (imageState !== "loaded" && defaultImageFailed);

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
      {/* photo img — DOM 우선순위 첫 번째 (테스트는 querySelector("img") 로 본다). */}
      {showPhotoImg && (
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
          onLoad={() => setImageState("loaded")}
          onError={() => { setPhotoErrored(true); setImageState("fallback"); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: imageState === "loaded" ? 1 : 0,
            transition: "opacity 120ms ease",
            zIndex: 2,
          }}
        />
      )}
      {/* default background — photo 로딩 중에만 노출 (fallback 상태에서는 제거) */}
      {showDefaultBackground && (
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
            zIndex: 1,
          }}
        />
      )}
      {/* 색상 기반 glyph — fallback 또는 photoUrl 없음 */}
      {showGlyph && (
        <span
          aria-hidden="true"
          style={{
            opacity: 1,
            transition: "opacity 120ms ease",
            fontSize: child?.emoji ? Math.round(size * 0.86) : fontSize,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {getFallbackGlyph(child)}
        </span>
      )}
    </span>
  );
}
