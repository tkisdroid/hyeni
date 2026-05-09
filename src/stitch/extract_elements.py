"""
Extract individual elements from ChatGPT-generated sticker sheets.

Strategy:
  1. Open each PNG as RGBA.
  2. Build a foreground mask:
     - If image has meaningful alpha (transparent bg), use alpha > THRESH.
     - Else fall back to "not near-white" mask.
  3. Dilate slightly so disconnected sub-parts of one element merge.
  4. scipy.ndimage.label -> connected components.
  5. Filter out tiny noise + edge artifacts.
  6. For each kept component, crop original RGBA by bbox (with small pad)
     and write to extracted/{sheet_stem}/element-NN.png.
  7. Print a per-sheet count summary.

Output: src/stitch/extracted/{sheet_basename_no_ext}/element-{idx:02d}.png
        + src/stitch/extracted/_INDEX.md  (sheet -> count mapping)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

STITCH_DIR = Path(__file__).resolve().parent
OUT_DIR = STITCH_DIR / "extracted"

ALPHA_THRESH = 16
WHITE_DIST_THRESH = 24
EDGE_TOUCH_FRAC = 0.85
PAD_PX = 12


def sheet_profile(stem: str):
    """Return (mode, dilate_iter, min_area_px) for a given sheet stem.
    mode is one of: 'single', 'grid', 'skip'."""
    if "07_30_50" in stem or "07_31_06" in stem:
        return ("skip", 0, 0)
    if "12_59_52" in stem:
        return ("single", 24, 1500)
    if "01_54_" in stem:
        return ("grid", 3, 1800)
    return ("grid", 4, 4000)


def build_foreground_mask(rgba: np.ndarray) -> np.ndarray:
    a = rgba[..., 3]
    if a.min() < 250:
        return a > ALPHA_THRESH
    rgb = rgba[..., :3].astype(np.int16)
    dist_from_white = np.abs(rgb - 255).max(axis=-1)
    return dist_from_white > WHITE_DIST_THRESH


def filter_components(labels: np.ndarray, n: int, h: int, w: int, min_area_px: int):
    keep = []
    for idx in range(1, n + 1):
        ys, xs = np.where(labels == idx)
        if ys.size < min_area_px:
            continue
        y0, y1 = ys.min(), ys.max()
        x0, x1 = xs.min(), xs.max()
        bw = x1 - x0 + 1
        bh = y1 - y0 + 1
        if bw > w * EDGE_TOUCH_FRAC and bh > h * EDGE_TOUCH_FRAC:
            continue
        keep.append((idx, y0, y1, x0, x1))
    keep.sort(key=lambda t: (round(t[1] / 20), t[3]))
    return keep


def extract_sheet(png_path: Path) -> tuple[str, int]:
    mode, dilate_iter, min_area_px = sheet_profile(png_path.stem)
    if mode == "skip":
        return ("skip", 0)
    img = Image.open(png_path).convert("RGBA")
    rgba = np.array(img)
    h, w = rgba.shape[:2]

    fg = build_foreground_mask(rgba)
    fg_dil = ndimage.binary_dilation(fg, iterations=dilate_iter) if dilate_iter else fg
    labels, n = ndimage.label(fg_dil)
    kept = filter_components(labels, n, h, w, min_area_px)

    out_dir = OUT_DIR / png_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    for existing in out_dir.glob("element-*.png"):
        existing.unlink()

    saved = 0
    for i, (lbl, y0, y1, x0, x1) in enumerate(kept, start=1):
        py0 = max(0, y0 - PAD_PX)
        py1 = min(h, y1 + 1 + PAD_PX)
        px0 = max(0, x0 - PAD_PX)
        px1 = min(w, x1 + 1 + PAD_PX)

        crop = rgba[py0:py1, px0:px1].copy()
        comp_mask = (labels[py0:py1, px0:px1] == lbl)
        if crop[..., 3].max() == 0:
            crop[..., 3] = np.where(comp_mask, 255, 0).astype(np.uint8)
        else:
            crop[..., 3] = np.where(comp_mask, crop[..., 3], 0).astype(np.uint8)

        crop_img = Image.fromarray(crop, mode="RGBA")
        out_path = out_dir / f"element-{i:02d}.png"
        crop_img.save(out_path, optimize=True)
        saved += 1
    return (mode, saved)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    sheets = sorted(p for p in STITCH_DIR.glob("*.png") if p.is_file())
    if not sheets:
        print("no sheets found")
        return

    summary = []
    for sheet in sheets:
        mode, count = extract_sheet(sheet)
        summary.append((sheet.name, mode, count))
        print(f"[{mode:>6}] {count:>3}  {sheet.name}")

    index_md = OUT_DIR / "_INDEX.md"
    lines = [
        "# Extracted elements per sheet",
        "",
        "Mode legend:",
        "- `single` = 12_59_52 batch (one element per sheet, dilated heavily so sub-parts merge)",
        "- `grid` = 01_54_* batch (sticker grids; light dilation)",
        "- `skip` = 07_30_50 / 07_31_06 batch (full mockups; use the original sheet as reference)",
        "",
    ]
    for name, mode, count in summary:
        stem = Path(name).stem
        if mode == "skip":
            lines.append(f"- **skip** — `{name}` (use whole sheet as mockup reference)")
        else:
            lines.append(f"- **{count}** ({mode}) — `extracted/{stem}/` <- `{name}`")
    index_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwrote {index_md}")


if __name__ == "__main__":
    main()
