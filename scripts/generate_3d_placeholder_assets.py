"""
신규 3D 자산 placeholder 생성기 (Premium Kawaii pastel 톤).

진짜 3D 렌더링은 외부 AI 도구가 필요하지만,
이 스크립트는 PIL 만으로 다음 효과를 시도한다:
  - 큰 둥근 형태 (kawaii feel)
  - radial gradient 로 약한 3D shading
  - drop shadow
  - 파스텔 색조

해상도 512×512 (기존 자산 670×795 와 비슷한 영역, 256+ 권장).
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path("src/assets/3d/ui")
SIZE = 512
PAD = 48  # 외곽 padding (drop shadow 여유)

# Premium Kawaii palette
ROSE = (247, 121, 168, 255)         # brand-rose
ROSE_DEEP = (224, 80, 130, 255)
ROSE_SOFT = (255, 226, 236, 255)
ROSE_TEXT = (184, 50, 98, 255)
MINT = (49, 196, 141, 255)
MINT_DEEP = (21, 147, 107, 255)
MINT_SOFT = (221, 247, 234, 255)
LAVENDER = (183, 168, 255, 255)
LAVENDER_DEEP = (140, 122, 230, 255)
LAVENDER_SOFT = (236, 230, 255, 255)
CREAM = (255, 241, 168, 255)
AMBER = (255, 165, 50, 255)
AMBER_DEEP = (210, 120, 20, 255)
RED = (224, 60, 60, 255)              # SOS only — bell-off strike 용
WHITE = (255, 255, 255, 255)
LINE = (220, 215, 220, 255)
SHADOW = (180, 100, 130, 64)          # rose-tint shadow


def new_canvas():
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def radial_fill(draw_img: Image.Image, bbox, base, light):
    """bbox 안에 radial gradient (가운데 light → 외곽 base) 효과를 합성한다."""
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    cx, cy = w / 2, h / 2
    rmax = max(w, h) / 2
    for r in range(int(rmax), 0, -1):
        t = r / rmax  # 1 (외곽) → 0 (중심)
        col = tuple(
            int(base[i] * t + light[i] * (1 - t))
            for i in range(4)
        )
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    draw_img.paste(grad, (x0, y0), grad)


def add_shadow(canvas: Image.Image) -> Image.Image:
    """canvas 의 alpha 를 기반으로 부드러운 drop shadow 를 합성."""
    alpha = canvas.split()[3]
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", canvas.size, SHADOW)
    shadow.paste(shadow_layer, (0, 12), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=10))
    out = Image.alpha_composite(shadow, canvas)
    return out


def draw_battery():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    # 외곽 — 둥근 사각형
    body = (PAD + 60, PAD + 130, SIZE - PAD - 30, SIZE - PAD - 130)
    d.rounded_rectangle(body, radius=64, fill=WHITE, outline=LINE, width=8)
    # 노치 (오른쪽 양극)
    notch = (SIZE - PAD - 30, PAD + 200, SIZE - PAD + 8, SIZE - PAD - 200)
    d.rounded_rectangle(notch, radius=12, fill=LINE)
    # 채움 (mint, 약 80%) + radial gradient
    fill = (PAD + 84, PAD + 154, SIZE - PAD - 90, SIZE - PAD - 154)
    radial_fill(img, fill, MINT, MINT_SOFT)
    return add_shadow(img)


def draw_warning():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2 + 20
    h = 380
    pts = [
        (cx, cy - h / 2),
        (cx - h * 0.866 / 2, cy + h / 2),
        (cx + h * 0.866 / 2, cy + h / 2),
    ]
    d.polygon(pts, fill=CREAM, outline=AMBER_DEEP, width=10)
    radial_fill(img, (int(cx - h / 4), int(cy - h / 6), int(cx + h / 4), int(cy + h / 6)),
                CREAM, WHITE)
    bar_w, bar_h = 28, 110
    d.rounded_rectangle(
        (cx - bar_w / 2, cy - 80, cx + bar_w / 2, cy - 80 + bar_h),
        radius=14, fill=AMBER_DEEP,
    )
    d.ellipse((cx - 22, cy + 60, cx + 22, cy + 104), fill=AMBER_DEEP)
    return add_shadow(img)


def draw_sparkle():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2
    big = 200
    small = 70
    pts_big = [
        (cx, cy - big),
        (cx + small, cy),
        (cx, cy + big),
        (cx - small, cy),
    ]
    pts_big2 = [
        (cx - big, cy),
        (cx, cy - small),
        (cx + big, cy),
        (cx, cy + small),
    ]
    d.polygon(pts_big, fill=CREAM, outline=AMBER_DEEP, width=6)
    d.polygon(pts_big2, fill=CREAM, outline=AMBER_DEEP, width=6)
    d.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=WHITE, outline=AMBER_DEEP, width=4)
    for ox, oy, sc in [(-180, -120, 40), (160, 140, 32)]:
        sx, sy = cx + ox, cy + oy
        d.polygon([(sx, sy - sc), (sx + sc / 3, sy), (sx, sy + sc), (sx - sc / 3, sy)],
                  fill=CREAM, outline=AMBER_DEEP, width=3)
        d.polygon([(sx - sc, sy), (sx, sy - sc / 3), (sx + sc, sy), (sx, sy + sc / 3)],
                  fill=CREAM, outline=AMBER_DEEP, width=3)
    return add_shadow(img)


def draw_school():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    body = (PAD + 40, PAD + 160, SIZE - PAD - 40, SIZE - PAD - 30)
    d.rounded_rectangle(body, radius=32, fill=WHITE, outline=LINE, width=8)
    radial_fill(img, (PAD + 56, PAD + 176, SIZE - PAD - 56, SIZE - PAD - 46),
                ROSE_SOFT, WHITE)
    roof = [
        (PAD + 20, PAD + 160),
        (PAD + 100, PAD + 60),
        (SIZE - PAD - 100, PAD + 60),
        (SIZE - PAD - 20, PAD + 160),
    ]
    d.polygon(roof, fill=ROSE, outline=ROSE_DEEP, width=8)
    flag_x = SIZE / 2
    d.line([(flag_x, PAD + 60), (flag_x, PAD + 4)], fill=LAVENDER_DEEP, width=6)
    d.polygon([(flag_x, PAD + 8), (flag_x + 60, PAD + 24), (flag_x, PAD + 40)],
              fill=ROSE, outline=ROSE_DEEP, width=4)
    door = (SIZE / 2 - 40, SIZE - PAD - 130, SIZE / 2 + 40, SIZE - PAD - 30)
    d.rounded_rectangle(door, radius=16, fill=ROSE, outline=ROSE_DEEP, width=4)
    for wx in [PAD + 80, SIZE - PAD - 140]:
        d.rounded_rectangle((wx, PAD + 200, wx + 60, PAD + 270),
                            radius=8, fill=CREAM, outline=AMBER_DEEP, width=4)
    return add_shadow(img)


def draw_lightning():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2
    pts = [
        (cx + 20, cy - 200),
        (cx - 80, cy - 30),
        (cx - 10, cy - 30),
        (cx - 60, cy + 200),
        (cx + 90, cy - 10),
        (cx + 20, cy - 10),
    ]
    d.polygon(pts, fill=CREAM, outline=AMBER_DEEP, width=10)
    radial_fill(img, (int(cx - 80), int(cy - 100), int(cx + 80), int(cy + 100)),
                CREAM, WHITE)
    return add_shadow(img)


def draw_clock():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2
    r = 200
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE, outline=ROSE_DEEP, width=10)
    radial_fill(img, (int(cx - r + 8), int(cy - r + 8), int(cx + r - 8), int(cy + r - 8)),
                ROSE_SOFT, WHITE)
    for ang_deg in [0, 90, 180, 270]:
        ang = math.radians(ang_deg - 90)
        ix = cx + math.cos(ang) * (r - 30)
        iy = cy + math.sin(ang) * (r - 30)
        ox = cx + math.cos(ang) * (r - 8)
        oy = cy + math.sin(ang) * (r - 8)
        d.line([(ix, iy), (ox, oy)], fill=ROSE_DEEP, width=8)
    a1 = math.radians(-60)
    d.line([(cx, cy), (cx + math.cos(a1) * 90, cy + math.sin(a1) * 90)],
           fill=ROSE_TEXT, width=10)
    a2 = math.radians(-30 + 90)
    d.line([(cx, cy), (cx + math.cos(a2) * 130, cy + math.sin(a2) * 130)],
           fill=ROSE_TEXT, width=8)
    d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=ROSE_DEEP)
    return add_shadow(img)


def draw_camera():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    body = (PAD + 30, PAD + 140, SIZE - PAD - 30, SIZE - PAD - 80)
    d.rounded_rectangle(body, radius=40, fill=WHITE, outline=LINE, width=8)
    radial_fill(img, (PAD + 46, PAD + 156, SIZE - PAD - 46, SIZE - PAD - 96),
                LAVENDER_SOFT, WHITE)
    hump = [
        (PAD + 130, PAD + 140),
        (PAD + 160, PAD + 80),
        (SIZE - PAD - 160, PAD + 80),
        (SIZE - PAD - 130, PAD + 140),
    ]
    d.polygon(hump, fill=LAVENDER, outline=LAVENDER_DEEP, width=6)
    cx, cy = SIZE / 2, SIZE / 2 + 40
    d.ellipse((cx - 110, cy - 110, cx + 110, cy + 110),
              fill=LAVENDER_DEEP, outline=LAVENDER_DEEP, width=2)
    d.ellipse((cx - 90, cy - 90, cx + 90, cy + 90),
              fill=LAVENDER, outline=LAVENDER_DEEP, width=4)
    radial_fill(img, (int(cx - 60), int(cy - 60), int(cx + 60), int(cy + 60)),
                LAVENDER_SOFT, WHITE)
    d.ellipse((SIZE - PAD - 80, PAD + 96, SIZE - PAD - 56, PAD + 120),
              fill=ROSE)
    return add_shadow(img)


def draw_broadcast():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    cx, cy = SIZE / 2, SIZE / 2 + 40
    d.rounded_rectangle((cx - 14, cy - 70, cx + 14, cy + 160),
                        radius=8, fill=ROSE_DEEP)
    pts = [
        (cx - 70, cy + 200),
        (cx - 30, cy + 160),
        (cx + 30, cy + 160),
        (cx + 70, cy + 200),
    ]
    d.polygon(pts, fill=ROSE, outline=ROSE_DEEP, width=6)
    for r in [70, 130, 190]:
        bbox = (cx - r, cy - 70 - r, cx + r, cy - 70 + r)
        d.arc(bbox, start=200, end=340, fill=ROSE, width=12)
    d.ellipse((cx - 22, cy - 90, cx + 22, cy - 50), fill=CREAM, outline=AMBER_DEEP, width=4)
    return add_shadow(img)


def draw_bell_off():
    """기존 bell.webp 위에 빨간 사선을 합성."""
    bell_path = OUT / "bell.webp"
    if bell_path.exists():
        img = Image.open(bell_path).convert("RGBA")
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
    else:
        img = new_canvas()
        d = ImageDraw.Draw(img)
        cx, cy = SIZE / 2, SIZE / 2
        d.pieslice((cx - 160, cy - 200, cx + 160, cy + 100),
                   start=180, end=360, fill=CREAM, outline=AMBER_DEEP, width=8)
        d.rectangle((cx - 160, cy - 50, cx + 160, cy + 60),
                    fill=CREAM, outline=AMBER_DEEP, width=8)
        d.rounded_rectangle((cx - 180, cy + 50, cx + 180, cy + 100),
                            radius=20, fill=AMBER, outline=AMBER_DEEP, width=8)
        d.ellipse((cx - 22, cy + 100, cx + 22, cy + 160),
                  fill=AMBER_DEEP)
    d = ImageDraw.Draw(img)
    pad = 80
    d.line([(pad, pad), (SIZE - pad, SIZE - pad)],
           fill=(255, 255, 255, 255), width=42)
    d.line([(pad, pad), (SIZE - pad, SIZE - pad)],
           fill=RED, width=24)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    targets = {
        "battery": draw_battery,
        "warning": draw_warning,
        "sparkle": draw_sparkle,
        "school": draw_school,
        "lightning": draw_lightning,
        "clock": draw_clock,
        "camera": draw_camera,
        "broadcast": draw_broadcast,
        "bell-off": draw_bell_off,
    }
    for name, fn in targets.items():
        out_path = OUT / f"{name}.webp"
        img = fn()
        img.save(out_path, "WEBP", quality=92, method=6)
        print(f"  [ok] {out_path}  ({img.size})")


if __name__ == "__main__":
    main()
