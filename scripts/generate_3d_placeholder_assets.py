"""
신규 3D 자산 placeholder 생성기 v2 (기존 heart.webp 스타일 모방).

기존 자산은 outline 없이 부드러운 그라데이션 + 위쪽 highlight blob +
작은 sparkle + soft outer shadow 의 진짜 3D 렌더링 스타일이다.
PIL 만으로 시도하는 흉내:

  - 베이스 도형 (둥근 형태) → vertical gradient fill (위 light, 아래 deep)
  - 위쪽 1~2 개 large highlight ellipse (white, gaussian blur ~30)
  - 위쪽 small sparkle dot (white, gaussian blur ~6)
  - outline 제거 (또는 매우 얇은 darker color)
  - soft outer drop shadow (color-tinted, gaussian blur ~24)

해상도 512×512.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path("src/assets/3d/ui")
SIZE = 512
PAD = 56

# Premium Kawaii palette (saturated 약간 강화)
ROSE = (247, 121, 168, 255)
ROSE_DEEP = (224, 80, 130, 255)
ROSE_DARK = (188, 52, 100, 255)
ROSE_LIGHT = (255, 198, 218, 255)
ROSE_SOFT = (255, 226, 236, 255)
MINT = (49, 196, 141, 255)
MINT_DEEP = (21, 147, 107, 255)
MINT_LIGHT = (130, 230, 184, 255)
MINT_SOFT = (221, 247, 234, 255)
LAVENDER = (183, 168, 255, 255)
LAVENDER_DEEP = (140, 122, 230, 255)
LAVENDER_LIGHT = (220, 210, 255, 255)
LAVENDER_SOFT = (236, 230, 255, 255)
CREAM = (255, 232, 130, 255)         # 약간 saturated
CREAM_DEEP = (235, 188, 60, 255)
CREAM_DARK = (190, 140, 30, 255)
CREAM_LIGHT = (255, 246, 200, 255)
AMBER = (255, 165, 50, 255)
AMBER_DEEP = (210, 120, 20, 255)
RED = (224, 60, 60, 255)
RED_DEEP = (180, 40, 50, 255)
WHITE = (255, 255, 255, 255)
WHITE_TR = (255, 255, 255, 200)
WHITE_HL = (255, 255, 255, 255)
GRAY_LIGHT = (235, 230, 232, 255)
SHADOW = (180, 100, 130, 80)


def new_canvas():
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def vertical_gradient_image(w, h, top, bottom):
    """w×h 사각형에 위→아래 vertical gradient (top→bottom)."""
    img = Image.new("RGBA", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        col = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        for x in range(w):
            px[x, y] = col
    return img


def fill_shape_with_gradient(canvas, mask_img, top, bottom):
    """mask_img(L mode) 의 shape 를 vertical gradient 로 채워 canvas 에 합성."""
    bbox = mask_img.getbbox() or (0, 0, *mask_img.size)
    x0, y0, x1, y1 = bbox
    grad = vertical_gradient_image(x1 - x0, y1 - y0, top, bottom)
    full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    full.paste(grad, (x0, y0))
    # alpha = mask_img → 이용해 shape 모양으로 잘라낸다
    full.putalpha(mask_img)
    return Image.alpha_composite(canvas, full)


def add_top_highlight(canvas, cx, cy, rx, ry, alpha=180, blur=30):
    """위쪽에 부드러운 흰색 highlight blob 1 개 추가."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry),
              fill=(255, 255, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=blur))
    return Image.alpha_composite(canvas, layer)


def add_sparkle_dot(canvas, x, y, r=14, alpha=255):
    """작은 흰 sparkle dot."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=4))
    return Image.alpha_composite(canvas, layer)


def add_soft_shadow(canvas, offset_y=14, blur=22, alpha=80):
    """canvas alpha 기반 부드러운 외부 그림자."""
    a = canvas.split()[3]
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer = Image.new("RGBA", canvas.size, (180, 100, 130, alpha))
    shadow.paste(layer, (0, offset_y), a)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))
    return Image.alpha_composite(shadow, canvas)


def make_rounded_rect_mask(w, h, bbox, radius):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle(bbox, radius=radius, fill=255)
    return mask


def make_polygon_mask(w, h, pts):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.polygon(pts, fill=255)
    return mask


def make_ellipse_mask(w, h, bbox):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse(bbox, fill=255)
    return mask


# ─── Asset draw functions ────────────────────────────────────────────


def draw_battery():
    img = new_canvas()
    body_bbox = (PAD + 30, PAD + 130, SIZE - PAD - 60, SIZE - PAD - 130)
    notch_bbox = (SIZE - PAD - 60, SIZE / 2 - 50, SIZE - PAD - 12, SIZE / 2 + 50)

    # outline (옅은 darker shadow 로 입체감)
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.rounded_rectangle(body_bbox, radius=70, fill=(190, 180, 195, 255))
    od.rounded_rectangle(notch_bbox, radius=14, fill=(190, 180, 195, 255))
    img = Image.alpha_composite(img, outline)

    # body — vertical gradient (white-light → soft gray)
    bx0, by0, bx1, by1 = body_bbox
    inner_body_bbox = (bx0 + 8, by0 + 8, bx1 - 8, by1 - 8)
    body_mask = make_rounded_rect_mask(SIZE, SIZE, inner_body_bbox, 62)
    img = fill_shape_with_gradient(img, body_mask, WHITE, GRAY_LIGHT)

    # notch
    notch_mask = make_rounded_rect_mask(SIZE, SIZE,
                                        (notch_bbox[0] + 4, notch_bbox[1] + 4,
                                         notch_bbox[2] - 4, notch_bbox[3] - 4),
                                        10)
    img = fill_shape_with_gradient(img, notch_mask, GRAY_LIGHT, (200, 195, 200, 255))

    # 충전 영역 — vertical gradient (mint top → mint-deep bottom)
    fill_bbox = (bx0 + 32, by0 + 32, bx1 - 36, by1 - 32)
    fill_mask = make_rounded_rect_mask(SIZE, SIZE, fill_bbox, 44)
    img = fill_shape_with_gradient(img, fill_mask, MINT_LIGHT, MINT_DEEP)

    # 충전 영역 안 위쪽 highlight stripe (mint 광택)
    img = add_top_highlight(img, SIZE / 2, by0 + 70, 130, 24, alpha=200, blur=10)

    # 본체 위쪽 큰 highlight blob
    img = add_top_highlight(img, SIZE / 2 - 50, by0 + 30, 180, 50, alpha=220, blur=30)
    # sparkle dot
    img = add_sparkle_dot(img, bx0 + 80, by0 + 40, r=18, alpha=240)

    return add_soft_shadow(img)


def draw_warning():
    img = new_canvas()
    cx, cy = SIZE / 2, SIZE / 2 + 24
    h = 380
    pts_outline = [
        (cx, cy - h / 2 - 10),
        (cx - h * 0.866 / 2 - 6, cy + h / 2 + 6),
        (cx + h * 0.866 / 2 + 6, cy + h / 2 + 6),
    ]
    # outline (얇은 darker)
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.polygon(pts_outline, fill=CREAM_DARK)
    img = Image.alpha_composite(img, outline)

    pts = [
        (cx, cy - h / 2),
        (cx - h * 0.866 / 2, cy + h / 2),
        (cx + h * 0.866 / 2, cy + h / 2),
    ]
    body_mask = make_polygon_mask(SIZE, SIZE, pts)
    img = fill_shape_with_gradient(img, body_mask, CREAM_LIGHT, CREAM_DEEP)

    # 느낌표 (둥근 모서리)
    bar_w, bar_h = 36, 130
    bar_bbox = (cx - bar_w / 2, cy - 90, cx + bar_w / 2, cy - 90 + bar_h)
    bar_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(bar_outline).rounded_rectangle(
        (bar_bbox[0] - 3, bar_bbox[1] - 3, bar_bbox[2] + 3, bar_bbox[3] + 3),
        radius=20, fill=ROSE_DARK)
    img = Image.alpha_composite(img, bar_outline)
    bar_mask = make_rounded_rect_mask(SIZE, SIZE, bar_bbox, 18)
    img = fill_shape_with_gradient(img, bar_mask, ROSE_LIGHT, ROSE_DEEP)

    # 점 (둥근)
    dot_bbox = (cx - 26, cy + 70, cx + 26, cy + 122)
    dot_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(dot_outline).ellipse(
        (dot_bbox[0] - 3, dot_bbox[1] - 3, dot_bbox[2] + 3, dot_bbox[3] + 3),
        fill=ROSE_DARK)
    img = Image.alpha_composite(img, dot_outline)
    dot_mask = make_ellipse_mask(SIZE, SIZE, dot_bbox)
    img = fill_shape_with_gradient(img, dot_mask, ROSE_LIGHT, ROSE_DEEP)

    # 위쪽 highlight (큰)
    img = add_top_highlight(img, cx - 30, cy - 80, 120, 32, alpha=180, blur=24)
    img = add_sparkle_dot(img, cx - 110, cy - 30, r=14, alpha=220)

    return add_soft_shadow(img)


def draw_sparkle():
    img = new_canvas()
    cx, cy = SIZE / 2, SIZE / 2

    # 큰 별 (8-point starburst — 두 개의 4-point 별 회전 배치)
    big = 200
    small = 56
    pts1 = [(cx, cy - big), (cx + small, cy - small),
            (cx + big, cy), (cx + small, cy + small),
            (cx, cy + big), (cx - small, cy + small),
            (cx - big, cy), (cx - small, cy - small)]
    # outline
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    out_pts = []
    for px, py in pts1:
        dx, dy = px - cx, py - cy
        d = math.hypot(dx, dy)
        if d > 0:
            out_pts.append((cx + dx * (d + 8) / d, cy + dy * (d + 8) / d))
        else:
            out_pts.append((px, py))
    od.polygon(out_pts, fill=CREAM_DARK)
    img = Image.alpha_composite(img, outline)

    star_mask = make_polygon_mask(SIZE, SIZE, pts1)
    img = fill_shape_with_gradient(img, star_mask, CREAM_LIGHT, CREAM_DEEP)

    # 작은 sparkle 2 개
    for ox, oy, sc in [(-180, -130, 50), (170, 150, 42)]:
        sx, sy = cx + ox, cy + oy
        small_pts = [
            (sx, sy - sc), (sx + sc / 3, sy - sc / 3),
            (sx + sc, sy), (sx + sc / 3, sy + sc / 3),
            (sx, sy + sc), (sx - sc / 3, sy + sc / 3),
            (sx - sc, sy), (sx - sc / 3, sy - sc / 3),
        ]
        sm_mask = make_polygon_mask(SIZE, SIZE, small_pts)
        img = fill_shape_with_gradient(img, sm_mask, CREAM_LIGHT, CREAM_DEEP)

    # 위쪽 highlight + sparkle
    img = add_top_highlight(img, cx - 30, cy - 70, 110, 30, alpha=200, blur=22)
    img = add_sparkle_dot(img, cx - 60, cy - 100, r=16, alpha=230)

    return add_soft_shadow(img)


def draw_school():
    img = new_canvas()

    # 본관 — 큰 둥근 사각형
    body_bbox = (PAD + 30, PAD + 170, SIZE - PAD - 30, SIZE - PAD - 30)
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.rounded_rectangle(
        (body_bbox[0] - 6, body_bbox[1] - 6, body_bbox[2] + 6, body_bbox[3] + 6),
        radius=40, fill=(190, 180, 195, 255))
    img = Image.alpha_composite(img, outline)

    body_mask = make_rounded_rect_mask(SIZE, SIZE, body_bbox, 36)
    img = fill_shape_with_gradient(img, body_mask, WHITE, ROSE_SOFT)

    # 지붕 — 사다리꼴 (분홍 vertical gradient)
    roof = [
        (PAD + 10, PAD + 170),
        (PAD + 110, PAD + 50),
        (SIZE - PAD - 110, PAD + 50),
        (SIZE - PAD - 10, PAD + 170),
    ]
    roof_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(roof_outline).polygon(
        [(roof[0][0] - 6, roof[0][1] + 6), (roof[1][0] - 4, roof[1][1] - 6),
         (roof[2][0] + 4, roof[2][1] - 6), (roof[3][0] + 6, roof[3][1] + 6)],
        fill=ROSE_DARK)
    img = Image.alpha_composite(img, roof_outline)

    roof_mask = make_polygon_mask(SIZE, SIZE, roof)
    img = fill_shape_with_gradient(img, roof_mask, ROSE_LIGHT, ROSE_DEEP)

    # 깃대 + 깃발
    flag_x = SIZE / 2
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((flag_x - 4, PAD + 0, flag_x + 4, PAD + 60),
                        radius=2, fill=LAVENDER_DEEP)
    flag_pts = [(flag_x, PAD + 4), (flag_x + 64, PAD + 22), (flag_x, PAD + 40)]
    flag_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(flag_outline).polygon(
        [(flag_pts[0][0] - 3, flag_pts[0][1] - 3),
         (flag_pts[1][0] + 4, flag_pts[1][1]),
         (flag_pts[2][0] - 3, flag_pts[2][1] + 3)],
        fill=ROSE_DARK)
    img = Image.alpha_composite(img, flag_outline)
    flag_mask = make_polygon_mask(SIZE, SIZE, flag_pts)
    img = fill_shape_with_gradient(img, flag_mask, ROSE_LIGHT, ROSE_DEEP)

    # 입구 — 큰 문 (pill 모양 위)
    door_bbox = (SIZE / 2 - 46, SIZE - PAD - 130, SIZE / 2 + 46, SIZE - PAD - 30)
    door_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(door_outline).rounded_rectangle(
        (door_bbox[0] - 4, door_bbox[1] - 4, door_bbox[2] + 4, door_bbox[3]),
        radius=42, fill=ROSE_DARK)
    img = Image.alpha_composite(img, door_outline)
    door_mask = Image.new("L", (SIZE, SIZE), 0)
    dm = ImageDraw.Draw(door_mask)
    # 위쪽 둥근 + 아래 직선 (문틀)
    dm.rounded_rectangle(door_bbox, radius=38, fill=255)
    dm.rectangle((door_bbox[0], door_bbox[3] - 30, door_bbox[2], door_bbox[3]), fill=255)
    img = fill_shape_with_gradient(img, door_mask, ROSE_LIGHT, ROSE_DEEP)

    # 창문 2 개 — cream gradient
    for wx in [PAD + 80, SIZE - PAD - 140]:
        win_bbox = (wx, PAD + 220, wx + 60, PAD + 290)
        win_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(win_outline).rounded_rectangle(
            (win_bbox[0] - 3, win_bbox[1] - 3, win_bbox[2] + 3, win_bbox[3] + 3),
            radius=12, fill=CREAM_DARK)
        img = Image.alpha_composite(img, win_outline)
        win_mask = make_rounded_rect_mask(SIZE, SIZE, win_bbox, 10)
        img = fill_shape_with_gradient(img, win_mask, CREAM_LIGHT, CREAM_DEEP)

    # 지붕 위쪽 큰 highlight
    img = add_top_highlight(img, SIZE / 2 - 60, PAD + 80, 160, 28, alpha=180, blur=18)
    img = add_sparkle_dot(img, PAD + 100, PAD + 100, r=12, alpha=220)
    return add_soft_shadow(img)


def draw_lightning():
    img = new_canvas()
    cx, cy = SIZE / 2, SIZE / 2
    pts = [
        (cx + 30, cy - 220),
        (cx - 90, cy - 30),
        (cx - 10, cy - 30),
        (cx - 70, cy + 220),
        (cx + 100, cy - 10),
        (cx + 20, cy - 10),
    ]
    # outline
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out_pts = []
    for px, py in pts:
        dx, dy = px - cx, py - cy
        d = math.hypot(dx, dy)
        if d > 0:
            out_pts.append((cx + dx * (d + 12) / d, cy + dy * (d + 12) / d))
        else:
            out_pts.append((px, py))
    ImageDraw.Draw(outline).polygon(out_pts, fill=CREAM_DARK)
    img = Image.alpha_composite(img, outline)

    bolt_mask = make_polygon_mask(SIZE, SIZE, pts)
    img = fill_shape_with_gradient(img, bolt_mask, CREAM_LIGHT, CREAM_DEEP)
    img = add_top_highlight(img, cx - 30, cy - 100, 80, 60, alpha=200, blur=18)
    img = add_sparkle_dot(img, cx + 10, cy - 180, r=14, alpha=230)
    return add_soft_shadow(img)


def draw_clock():
    img = new_canvas()
    cx, cy = SIZE / 2, SIZE / 2
    r = 200

    # outline
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(outline).ellipse((cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8),
                                    fill=ROSE_DARK)
    img = Image.alpha_composite(img, outline)

    # 다이얼 — vertical gradient white→rose-soft
    face_mask = make_ellipse_mask(SIZE, SIZE, (cx - r, cy - r, cx + r, cy + r))
    img = fill_shape_with_gradient(img, face_mask, WHITE, ROSE_SOFT)

    # 12·3·6·9 마크
    d = ImageDraw.Draw(img)
    for ang_deg in [0, 90, 180, 270]:
        ang = math.radians(ang_deg - 90)
        ix = cx + math.cos(ang) * (r - 36)
        iy = cy + math.sin(ang) * (r - 36)
        ox = cx + math.cos(ang) * (r - 14)
        oy = cy + math.sin(ang) * (r - 14)
        d.line([(ix, iy), (ox, oy)], fill=ROSE_DEEP, width=14)

    # 시침 (10시 방향)
    a1 = math.radians(-60)
    d.line([(cx, cy), (cx + math.cos(a1) * 88, cy + math.sin(a1) * 88)],
           fill=ROSE_DARK, width=14)
    # 분침 (2시 방향)
    a2 = math.radians(60)
    d.line([(cx, cy), (cx + math.cos(a2) * 130, cy + math.sin(a2) * 130)],
           fill=ROSE_DARK, width=10)
    # 중심점
    d.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=ROSE_DARK)

    img = add_top_highlight(img, cx - 50, cy - 80, 120, 30, alpha=180, blur=22)
    img = add_sparkle_dot(img, cx - 120, cy - 50, r=14, alpha=220)
    return add_soft_shadow(img)


def draw_camera():
    img = new_canvas()

    # 본체 — 큰 둥근 사각형
    body_bbox = (PAD + 30, PAD + 150, SIZE - PAD - 30, SIZE - PAD - 80)
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(outline).rounded_rectangle(
        (body_bbox[0] - 6, body_bbox[1] - 6, body_bbox[2] + 6, body_bbox[3] + 6),
        radius=46, fill=LAVENDER_DEEP)
    img = Image.alpha_composite(img, outline)
    body_mask = make_rounded_rect_mask(SIZE, SIZE, body_bbox, 40)
    img = fill_shape_with_gradient(img, body_mask, LAVENDER_LIGHT, LAVENDER)

    # 뷰파인더 돌기 — 사다리꼴 (lavender deep gradient)
    hump = [
        (PAD + 130, PAD + 150),
        (PAD + 170, PAD + 80),
        (SIZE - PAD - 170, PAD + 80),
        (SIZE - PAD - 130, PAD + 150),
    ]
    hump_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(hump_outline).polygon(
        [(hump[0][0] - 4, hump[0][1] + 4), (hump[1][0] - 4, hump[1][1] - 6),
         (hump[2][0] + 4, hump[2][1] - 6), (hump[3][0] + 4, hump[3][1] + 4)],
        fill=LAVENDER_DEEP)
    img = Image.alpha_composite(img, hump_outline)
    hump_mask = make_polygon_mask(SIZE, SIZE, hump)
    img = fill_shape_with_gradient(img, hump_mask, LAVENDER_LIGHT, LAVENDER)

    # 렌즈 — 큰 외 + 가운데 deep
    cx, cy = SIZE / 2, SIZE / 2 + 40
    # outer ring
    ring_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring_outline).ellipse((cx - 116, cy - 116, cx + 116, cy + 116),
                                         fill=LAVENDER_DEEP)
    img = Image.alpha_composite(img, ring_outline)
    outer_lens_mask = make_ellipse_mask(SIZE, SIZE, (cx - 110, cy - 110, cx + 110, cy + 110))
    img = fill_shape_with_gradient(img, outer_lens_mask, LAVENDER, LAVENDER_DEEP)
    # inner deep
    d = ImageDraw.Draw(img)
    d.ellipse((cx - 78, cy - 78, cx + 78, cy + 78), fill=LAVENDER_DEEP)
    inner_mask = make_ellipse_mask(SIZE, SIZE, (cx - 66, cy - 66, cx + 66, cy + 66))
    img = fill_shape_with_gradient(img, inner_mask, LAVENDER_LIGHT, LAVENDER)
    # iris highlight
    d2 = ImageDraw.Draw(img)
    d2.ellipse((cx - 28, cy - 40, cx + 12, cy - 4), fill=(255, 255, 255, 220))

    # 셔터 표시 dot
    d2.ellipse((SIZE - PAD - 96, PAD + 96, SIZE - PAD - 56, PAD + 132),
               fill=ROSE_DEEP)

    img = add_top_highlight(img, SIZE / 2 - 80, PAD + 130, 160, 30, alpha=190, blur=22)
    img = add_sparkle_dot(img, PAD + 100, PAD + 200, r=12, alpha=220)
    return add_soft_shadow(img)


def draw_broadcast():
    img = new_canvas()
    cx, cy = SIZE / 2, SIZE / 2 + 20
    # 안테나 (수직 막대)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((cx - 18, cy - 90, cx + 18, cy + 180),
                        radius=10, fill=ROSE_DARK)
    bar_mask = make_rounded_rect_mask(SIZE, SIZE, (cx - 14, cy - 90, cx + 14, cy + 180), 7)
    img = fill_shape_with_gradient(img, bar_mask, ROSE_LIGHT, ROSE_DEEP)

    # 베이스 (사다리꼴)
    base = [(cx - 90, cy + 220), (cx - 40, cy + 170),
            (cx + 40, cy + 170), (cx + 90, cy + 220)]
    base_outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(base_outline).polygon(
        [(base[0][0] - 6, base[0][1] + 4), (base[1][0] - 4, base[1][1] - 6),
         (base[2][0] + 4, base[2][1] - 6), (base[3][0] + 6, base[3][1] + 4)],
        fill=ROSE_DARK)
    img = Image.alpha_composite(img, base_outline)
    base_mask = make_polygon_mask(SIZE, SIZE, base)
    img = fill_shape_with_gradient(img, base_mask, ROSE_LIGHT, ROSE_DEEP)

    # 신호 호 — 좌우 3 겹 (그라데이션 색감)
    for r, alpha in [(80, 180), (140, 140), (200, 100)]:
        arc_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ad = ImageDraw.Draw(arc_layer)
        ad.arc((cx - r, cy - 90 - r, cx + r, cy - 90 + r),
               start=200, end=340, fill=(247, 121, 168, alpha), width=14)
        img = Image.alpha_composite(img, arc_layer)

    # origin dot (cream)
    d2 = ImageDraw.Draw(img)
    dot_outline_bbox = (cx - 30, cy - 110, cx + 30, cy - 50)
    d2.ellipse(dot_outline_bbox, fill=CREAM_DARK)
    dot_mask = make_ellipse_mask(SIZE, SIZE, (cx - 26, cy - 106, cx + 26, cy - 54))
    img = fill_shape_with_gradient(img, dot_mask, CREAM_LIGHT, CREAM_DEEP)

    img = add_top_highlight(img, cx - 30, cy + 60, 80, 40, alpha=180, blur=22)
    return add_soft_shadow(img)


def draw_bell_off():
    """기존 bell.webp 위에 stylized 빨간 strike."""
    bell_path = OUT / "bell.webp"
    if bell_path.exists():
        img = Image.open(bell_path).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    else:
        img = new_canvas()
    # strike 띠 — 흰색 외곽 + 빨강 안 + 둥근 cap
    pad = 90
    p1 = (pad, pad)
    p2 = (SIZE - pad, SIZE - pad)
    # cap 효과 위해 흰 테두리 두꺼움 후 빨강 가운데
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.line([p1, p2], fill=(255, 255, 255, 255), width=48)
    ld.ellipse((p1[0] - 24, p1[1] - 24, p1[0] + 24, p1[1] + 24), fill=(255, 255, 255, 255))
    ld.ellipse((p2[0] - 24, p2[1] - 24, p2[0] + 24, p2[1] + 24), fill=(255, 255, 255, 255))
    layer2 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    l2d = ImageDraw.Draw(layer2)
    l2d.line([p1, p2], fill=RED, width=28)
    l2d.ellipse((p1[0] - 14, p1[1] - 14, p1[0] + 14, p1[1] + 14), fill=RED)
    l2d.ellipse((p2[0] - 14, p2[1] - 14, p2[0] + 14, p2[1] + 14), fill=RED)
    img = Image.alpha_composite(img, layer)
    img = Image.alpha_composite(img, layer2)
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
