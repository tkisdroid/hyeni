"""
Convert curated 3D elements from src/stitch/extracted/ to WebP at
src/assets/3d/ with semantic naming.

Mapping is hand-curated via visual spot-check of element-NN files.
Re-run this script after editing ASSETS to regenerate. Idempotent.

Output structure:
  src/assets/3d/
    mascot/{static,wave,phone}.webp
    ui/{bell,heart,pin,shield,calendar-heart,calendar-check}.webp
    category/{school,sports,hobby,family,friend,other}.webp
    animal/{rabbit,cat,fox,dog,chick,bear,panda,tiger}.webp
"""

from pathlib import Path
from PIL import Image

STITCH_DIR = Path(__file__).resolve().parent
EXTRACTED_DIR = STITCH_DIR / "extracted"
ASSETS_DIR = STITCH_DIR.parent / "assets" / "3d"

WEBP_QUALITY = 85
WEBP_METHOD = 6

SHEET_STEMS = {
    "12_59_52_1": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (1)",
    "12_59_52_2": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (2)",
    "12_59_52_3": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (3)",
    "12_59_52_4": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (4)",
    "12_59_52_6": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (6)",
    "12_59_52_7": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (7)",
    "12_59_52_8": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (8)",
    "12_59_52_9": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (9)",
    "12_59_52_10": "ChatGPT Image 2026년 5월 9일 오전 12_59_52 (10)",
    "01_54_51_5": "ChatGPT Image 2026년 5월 9일 오전 01_54_51 (5)",
    "01_54_53_10": "ChatGPT Image 2026년 5월 9일 오전 01_54_53 (10)",
    "01_54_50_1": "ChatGPT Image 2026년 5월 9일 오전 01_54_50 (1)",
}

ASSETS = [
    ("mascot/static.webp", "12_59_52_1", 1),
    ("mascot/wave.webp", "12_59_52_10", 1),
    ("mascot/phone.webp", "12_59_52_9", 1),

    ("ui/bell.webp", "12_59_52_8", 1),
    ("ui/heart.webp", "12_59_52_6", 1),
    ("ui/pin.webp", "12_59_52_4", 1),
    ("ui/shield.webp", "12_59_52_7", 1),
    ("ui/calendar-heart.webp", "12_59_52_3", 1),
    ("ui/calendar-check.webp", "12_59_52_2", 1),

    ("category/school.webp", "01_54_51_5", 5),
    ("category/sports.webp", "01_54_51_5", 3),
    ("category/hobby.webp", "01_54_51_5", 4),
    ("category/family.webp", "01_54_51_5", 2),
    ("category/friend.webp", "01_54_50_1", 7),
    ("category/other.webp", "01_54_53_10", 9),

    ("animal/rabbit.webp", "01_54_53_10", 1),
    ("animal/cat.webp", "01_54_53_10", 2),
    ("animal/fox.webp", "01_54_53_10", 3),
    ("animal/dog.webp", "01_54_53_10", 4),
    ("animal/chick.webp", "01_54_53_10", 5),
    ("animal/bear.webp", "01_54_53_10", 6),
    ("animal/panda.webp", "01_54_53_10", 7),
    ("animal/tiger.webp", "01_54_53_10", 8),
]


def main():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    total_bytes = 0
    for target_rel, sheet_key, element_n in ASSETS:
        sheet_stem = SHEET_STEMS[sheet_key]
        src = EXTRACTED_DIR / sheet_stem / f"element-{element_n:02d}.png"
        if not src.exists():
            print(f"  MISSING source: {src}")
            continue
        dst = ASSETS_DIR / target_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        img = Image.open(src)
        img.save(dst, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD, lossless=False)
        size_b = dst.stat().st_size
        total_bytes += size_b
        print(f"  {target_rel}  ({size_b/1024:.1f} KB)")
        written += 1
    print(f"\n{written} assets written, total {total_bytes/1024:.1f} KB ({total_bytes/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
