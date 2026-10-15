#!/usr/bin/env python3
# Draw the library skin's own images: the shelf of books, the chalkboard,
# the reading lamp sprite and the brass knob. Needs python3 with numpy
# and Pillow. Run from the repository root: python3 scripts/art/library.py
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'skins/library/images/'


def lerp(a, b, t):
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def books():
    # A shelf of book spines, 640 x 128, seamless left to right.
    W, H, SHELF = 640, 128, 16
    rnd = random.Random(7)
    img = Image.new('RGB', (W, H), (20, 13, 9))
    px = np.array(img, dtype=np.float32)
    # The back of the case, darker towards the top.
    for y in range(H):
        px[y, :, :] *= 0.55 + 0.45 * y / H
    img = Image.fromarray(px.astype(np.uint8))
    d = ImageDraw.Draw(img)
    palette = [(112, 30, 28), (34, 48, 86), (30, 70, 44), (150, 106, 42), (92, 58, 34),
               (70, 72, 78), (128, 52, 40), (46, 38, 70), (166, 140, 96), (60, 30, 24)]
    widths = []
    x = 0
    while W - x > 0:
        rest = W - x
        w = rnd.randint(13, 30)
        if rest - w < 13:
            w = rest
        widths.append(w)
        x += w
    x = 0
    floor = H - SHELF
    for i, w in enumerate(widths):
        if rnd.random() < 0.06 and i not in (0, len(widths) - 1):
            x += w
            continue
        h = rnd.randint(70, 104)
        base = palette[rnd.randrange(len(palette))]
        k = 0.8 + 0.35 * rnd.random()
        col = tuple(min(255, int(c * k)) for c in base)
        top = floor - h
        for u in range(w - 1):
            s = 0.55 + 0.45 * math.sin(math.pi * (u + 0.5) / (w - 1))
            d.line([(x + u, top), (x + u, floor - 1)], fill=tuple(int(c * s) for c in col))
        band = lerp(col, (214, 178, 92), 0.75) if rnd.random() < 0.6 else lerp(col, (10, 8, 6), 0.6)
        for by in (top + 7, top + 12, floor - 12):
            d.line([(x + 1, by), (x + w - 3, by)], fill=band, width=2)
        if rnd.random() < 0.45:
            ly = top + 20 + rnd.randint(0, 14)
            d.rectangle([x + 3, ly, x + w - 5, ly + rnd.randint(10, 22)], fill=lerp(col, (236, 222, 190), 0.55))
        d.line([(x + w - 1, top), (x + w - 1, floor - 1)], fill=(12, 8, 6))
        x += w
    # The shelf board, lit along its front edge.
    for y in range(floor, H):
        t = (y - floor) / SHELF
        d.line([(0, y), (W, y)], fill=lerp((132, 88, 52), (58, 36, 20), t))
    d.line([(0, floor), (W, floor)], fill=(176, 124, 76))
    # The shelf above casts a shadow on the tops.
    for y in range(10):
        d.line([(0, y), (W, y)], fill=lerp((10, 6, 4), (20, 13, 9), y / 10))
    noise = np.random.default_rng(3).normal(0, 4, (H, W, 1))
    a = np.clip(np.array(img, dtype=np.float32) + noise, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(OUT + 'books.png', optimize=True)


def chalkboard():
    # A worn chalkboard, 900 x 640: smudges, eraser swipes and grain.
    W, H = 900, 640
    rng = np.random.default_rng(11)
    base = np.array([34, 46, 39], dtype=np.float32)
    img = np.ones((H, W, 3), dtype=np.float32) * base
    low = Image.fromarray((rng.random((10, 14)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    img += (np.array(low, dtype=np.float32)[..., None] / 255 - 0.5) * 14
    swipes = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(swipes)
    for _ in range(14):
        cx, cy = rng.integers(0, W), rng.integers(0, H)
        rx, ry = rng.integers(80, 260), rng.integers(14, 40)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=int(rng.integers(10, 26)))
    swipes = swipes.filter(ImageFilter.GaussianBlur(18))
    img += np.array(swipes, dtype=np.float32)[..., None] * np.array([0.8, 0.9, 0.85])
    img += rng.normal(0, 3.5, (H, W, 1))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT + 'chalkboard.jpg', quality=82)


def lamp_frame(on):
    # A banker's lamp, 140 x 120: brass base and stem, green glass shade.
    W, H = 140, 120
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if on:
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        g = ImageDraw.Draw(glow)
        g.polygon([(30, 60), (110, 60), (134, 118), (6, 118)], fill=(255, 214, 120, 120))
        g.ellipse([20, 92, 120, 120], fill=(255, 220, 140, 140))
        glow = glow.filter(ImageFilter.GaussianBlur(9))
        img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)
    brass_hi, brass, brass_lo = (246, 214, 128), (190, 146, 58), (104, 72, 24)
    # Base.
    d.ellipse([34, 100, 106, 116], fill=brass_lo)
    d.ellipse([34, 97, 106, 112], fill=brass)
    d.ellipse([46, 99, 92, 106], fill=brass_hi)
    # Stem.
    for xx, c in ((66, brass_lo), (67, brass), (68, brass_hi), (69, brass), (70, brass), (71, brass_lo)):
        d.line([(xx, 62), (xx, 100)], fill=c)
    # Pull chain.
    d.line([(92, 62), (92, 84)], fill=brass, width=1)
    d.ellipse([89, 83, 95, 89], fill=brass_hi)
    # Shade: a half cylinder seen from the front, lit from inside when on.
    top, bot = 30, 62
    for y in range(top, bot + 1):
        t = (y - top) / (bot - top)
        half = 30 + 22 * math.sqrt(t)
        for xx in range(int(70 - half), int(70 + half) + 1):
            u = (xx - (70 - half)) / (2 * half)
            s = 0.45 + 0.55 * math.sin(math.pi * u)
            if on:
                c = lerp((14, 70, 40), (90, 200, 120), s * (0.55 + 0.45 * t))
            else:
                c = lerp((6, 34, 20), (46, 120, 76), s * (0.6 + 0.4 * (1 - t)))
            d.point((xx, y), fill=c + (255,))
    d.line([(18, bot), (122, bot)], fill=brass_hi, width=2)
    d.line([(18, bot + 2), (122, bot + 2)], fill=brass_lo, width=1)
    d.arc([40, top - 4, 100, top + 6], 180, 360, fill=brass, width=2)
    # Highlight on the glass.
    hl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(hl).line([(52, top + 6), (44, bot - 6)], fill=(220, 255, 230, 110 if on else 70), width=4)
    return Image.alpha_composite(img, hl.filter(ImageFilter.GaussianBlur(1.2)))


def lamp():
    sheet = Image.new('RGBA', (280, 120), (0, 0, 0, 0))
    sheet.paste(lamp_frame(False), (0, 0))
    sheet.paste(lamp_frame(True), (140, 0))
    sheet.save(OUT + 'lamp.png', optimize=True)


def knob():
    # A knurled brass knob, 96 x 96, pointer at 12 o'clock.
    S = 4
    N = 96 * S
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = N / 2
    r = N / 2 - 2 * S
    for i in range(120):
        a0 = 360 * i / 120
        d.pieslice([c - r, c - r, c + r, c + r], a0, a0 + 3, fill=(120, 84, 30) if i % 2 else (214, 176, 92))
    for k in range(60):
        t = k / 60
        rr = (r - 6 * S) * (1 - t)
        col = lerp((150, 108, 40), (250, 222, 150), t ** 0.7)
        off = 6 * S * t
        d.ellipse([c - rr - off, c - rr - off, c + rr - off, c + rr - off], fill=col)
    d.line([(c, c - 8 * S), (c, 14 * S)], fill=(60, 36, 10), width=4 * S)
    img.resize((96, 96), Image.LANCZOS).save(OUT + 'knob.png', optimize=True)


if __name__ == '__main__':
    books()
    chalkboard()
    lamp()
    knob()
