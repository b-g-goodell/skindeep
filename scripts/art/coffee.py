#!/usr/bin/env python3
# Draw the coffee skin's own images, a bohemian basement cafe: chalk
# doodles, string lights, a corkboard of handbills, a lava lamp, a
# turntable and its record and tonearm, a tube amp with its VU meter and
# knob, a cubby of LPs, a French press, a mason jar, a potted pothos, a
# typewriter and a plank of mismatched mugs.
# Needs python3 with numpy and Pillow, DejaVu Sans Bold (found by
# fc-match), and the skin's own fonts. Wood grain comes from images/counter.jpg (ambientCG Wood049,
# CC0). Run from the repository root: python3 scripts/art/coffee.py
#
# Every image but the slate is saved at twice its size in CSS pixels.
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = 'skins/coffee/images/'
FONTS = 'skins/coffee/fonts/'
DEJAVU = subprocess.run(['fc-match', '-f', '%{file}', 'DejaVu Sans:bold'],
                        capture_output=True, text=True, check=True).stdout
if os.path.basename(DEJAVU) != 'DejaVuSans-Bold.ttf':
    sys.exit(f'coffee.py: DejaVu Sans Bold is not installed (fc-match gave {DEJAVU})')
AMATIC = FONTS + 'AmaticSC/AmaticSC-Bold.ttf'
SHRIKHAND = FONTS + 'Shrikhand/Shrikhand-Regular.ttf'
CUTIVE = FONTS + 'CutiveMono/CutiveMono-Regular.ttf'
Z = 4  # drawing pixels per CSS pixel


def lerp(a, b, t):
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def new(w, h, fill=(0, 0, 0, 0)):
    return Image.new('RGBA', (w * Z, h * Z), fill)


def save(img, name, w, h):
    img.resize((w * 2, h * 2), Image.LANCZOS).save(OUT + name, optimize=True)


def sc(pts):
    return [(x * Z, y * Z) for x, y in pts]


def box(x0, y0, x1, y1):
    return [x0 * Z, y0 * Z, x1 * Z, y1 * Z]


def font(path, px):
    return ImageFont.truetype(path, int(px * Z))


def grad(w, h, stops, vertical=False):
    # An RGBA gradient image w x h (drawing pixels), stops [(t, rgb), ...].
    n = h if vertical else w
    t = np.linspace(0, 1, max(n, 2))
    cols = np.stack([np.interp(t, [p for p, _ in stops], [c[k] for _, c in stops]) for k in range(3)], -1)
    a = np.repeat(cols[:, None, :], w, 1) if vertical else np.repeat(cols[None, :, :], h, 0)
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def shape(img, pts, fill):
    # Paint a polygon (CSS pixel points) with a solid colour or a gradient
    # maker fill(w, h) sized to its bounding box.
    p = sc(pts)
    x0, y0 = int(min(x for x, _ in p)), int(min(y for _, y in p))
    x1, y1 = int(math.ceil(max(x for x, _ in p))) + 1, int(math.ceil(max(y for _, y in p))) + 1
    m = Image.new('L', (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in p], fill=255)
    g = fill(x1 - x0, y1 - y0) if callable(fill) else Image.new('RGBA', (x1 - x0, y1 - y0), fill)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    layer.paste(g, (x0, y0), m)
    img.alpha_composite(layer)


def ellipse_pts(cx, cy, rx, ry, a0=0, a1=360, n=72):
    return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a)))
            for a in np.linspace(a0, a1, n)]


def metal(c0, c1, c2):
    # A cylinder's sheen across its width: dark edge, highlight, dark edge.
    return lambda w, h: grad(w, h, [(0, c0), (0.3, c2), (0.45, c1), (1, c0)])


def wood(w, h, tint, gain=1.0, off=0, scale=300):
    # Grain from counter.jpg, tinted, w x h CSS pixels.
    src = Image.open(OUT + 'counter.jpg').convert('L')
    n = scale * Z
    a = np.array(src.resize((n, n), Image.BICUBIC), dtype=np.float32)
    W, H = w * Z, h * Z
    big = np.tile(a, (H // n + 2, W // n + 2))
    oy, ox = (off * 137) % n, (off * 291) % n
    g = big[oy:oy + H, ox:ox + W]
    g = 1 + (g / g.mean() - 1) * 1.3
    rgb = np.clip(np.array(tint, np.float32) * g[..., None] * gain, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, 'RGB').convert('RGBA')


def shadow(img, pts, off=(2, 3), blur=3, alpha=110):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).polygon(sc([(x + off[0], y + off[1]) for x, y in pts]), fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(blur * Z))
    layer = Image.new('RGBA', img.size, (0, 0, 0, 255))
    layer.putalpha(m)
    img.alpha_composite(layer)


def glow(img, cx, cy, r, color, alpha):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(r * Z / 2))
    layer = Image.new('RGBA', img.size, color + (255,))
    layer.putalpha(m)
    img.alpha_composite(layer)


def chalk(mask, seed, color=(242, 238, 228), alpha=0.92):
    # Strokes drawn on an L mask become grainy chalk.
    rng = np.random.default_rng(seed)
    m = np.array(mask.filter(ImageFilter.GaussianBlur(0.6 * Z)), np.float32) / 255
    grain = (rng.random(m.shape) > 0.3) * 0.75 + 0.25 * rng.random(m.shape)
    img = Image.new('RGBA', mask.size, color + (0,))
    img.putalpha(Image.fromarray(np.clip(m * grain * alpha * 255, 0, 255).astype(np.uint8)))
    return img


# The menu board.

def slate():
    # A black menu board, 900 x 400, with old chalk smudges.
    W, H = 900, 400
    rng = np.random.default_rng(5)
    img = np.ones((H, W, 3), dtype=np.float32) * np.array([30, 29, 27], dtype=np.float32)
    low = Image.fromarray((rng.random((8, 18)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    img += (np.array(low, dtype=np.float32)[..., None] / 255 - 0.5) * 12
    sm = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(sm)
    for _ in range(12):
        cx, cy = rng.integers(0, W), rng.integers(0, H)
        rx, ry = rng.integers(60, 220), rng.integers(10, 30)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=int(rng.integers(8, 22)))
    sm = sm.filter(ImageFilter.GaussianBlur(16))
    img += np.array(sm, dtype=np.float32)[..., None]
    img += rng.normal(0, 3, (H, W, 1))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT + 'slate.jpg', quality=82)


def doodles():
    # Chalk doodles: a strip beside the board's title, 300 x 28, and a mug
    # with "pay what you can" for the board's right end, 92 x 116.
    W, H = 300, 28
    m = Image.new('L', (W * Z, H * Z), 0)
    d = ImageDraw.Draw(m)
    w = int(1.6 * Z)

    def star(cx, cy, r):
        pts = [(cx + (r if k % 2 == 0 else r * 0.42) * math.sin(math.pi * k / 5),
                cy - (r if k % 2 == 0 else r * 0.42) * math.cos(math.pi * k / 5)) for k in range(11)]
        d.line(sc(pts), fill=255, width=w, joint='curve')

    star(12, 15, 10)
    sp = [(44 + 0.9 * t * math.cos(t), 14 + 0.9 * t * math.sin(t)) for t in np.linspace(0.5, 12, 80)]
    d.line(sc(sp), fill=255, width=w, joint='curve')
    for k in range(8):
        a = math.radians(45 * k)
        d.ellipse(box(78 + 6 * math.cos(a) - 3, 14 + 6 * math.sin(a) - 3, 78 + 6 * math.cos(a) + 3, 14 + 6 * math.sin(a) + 3),
                  outline=255, width=w)
    d.ellipse(box(75, 11, 81, 17), fill=255)
    for x, y in ((106, 21), (122, 19)):
        d.ellipse(box(x - 3.5, y - 2.5, x + 3.5, y + 2.5), fill=255)
        d.line(sc([(x + 3, y), (x + 3, y - 15)]), fill=255, width=w)
    d.line(sc([(109, 6), (125, 4)]), fill=255, width=int(2.4 * Z))
    d.line(sc([(109, 10), (125, 8)]), fill=255, width=int(2.0 * Z))
    moon = ellipse_pts(160, 14, 10, 10, 60, 300, 40) + ellipse_pts(166, 14, 8, 9, 240, 120, 40)
    d.line(sc(moon), fill=255, width=w, joint='curve')
    for x, y, r in ((186, 8, 4), (200, 19, 3), (214, 9, 5), (176, 22, 2.5)):
        d.line(sc([(x - r, y), (x + r, y)]), fill=255, width=w)
        d.line(sc([(x, y - r), (x, y + r)]), fill=255, width=w)
    d.line(sc([(230 + t, 14 + 5 * math.sin(t / 4)) for t in np.linspace(0, 64, 60)]), fill=255, width=w, joint='curve')
    save(chalk(m, 11), 'doodles.png', W, H)

    W, H = 92, 116
    m = Image.new('L', (W * Z, H * Z), 0)
    d = ImageDraw.Draw(m)
    for k, x in enumerate((34, 46, 58)):
        pts = [(x + 4 * math.sin(t / 5 + k), 34 - t) for t in np.linspace(0, 26, 30)]
        d.line(sc(pts), fill=255, width=w, joint='curve')
    d.line(sc([(24, 40), (26, 74), (28, 78), (62, 78), (64, 74), (66, 40)]), fill=255, width=w, joint='curve')
    d.line(sc(ellipse_pts(45, 40, 21, 3)), fill=255, width=w)
    d.line(sc(ellipse_pts(66, 56, 8, 9, -80, 80, 30)), fill=255, width=w)
    d.line(sc(ellipse_pts(45, 80, 32, 4, 0, 180, 40)), fill=255, width=w)
    heart = [(45 + 6 * math.sin(t) ** 3, 58 - (5 * math.cos(t) - 2 * math.cos(2 * t) - math.cos(3 * t))) for t in np.linspace(0, 2 * math.pi, 50)]
    d.polygon(sc(heart), fill=255)
    f = font(AMATIC, 19)
    d.text((46 * Z, 94 * Z), 'pay what', font=f, fill=255, anchor='mm')
    d.text((46 * Z, 107 * Z), 'you can', font=f, fill=255, anchor='mm')
    save(chalk(m, 12), 'doodle.png', W, H)


def lights():
    # A strand of string lights, a 240 x 30 tile that repeats across the
    # wall: bulbs softly lit (lights-off) and flaring (lights-on).
    W, H = 240, 30
    cols = [(255, 176, 64), (236, 72, 56), (96, 200, 112), (84, 150, 240), (250, 120, 190)]
    xs = [22, 70, 120, 170, 218]
    wire = lambda x: 3 + 9 * (1 - ((x - 120) / 120) ** 2)
    for name, on in (('lights-off.png', False), ('lights-on.png', True)):
        img = new(W, H)
        d = ImageDraw.Draw(img)
        d.line(sc([(x, wire(x)) for x in np.linspace(0, W, 120)]), fill=(26, 22, 18, 255), width=int(1.3 * Z), joint='curve')
        for x, c in zip(xs, cols):
            y = wire(x)
            if on:
                glow(img, x, y + 12, 10, c, 230)
            else:
                glow(img, x, y + 12, 7, c, 70)
            d = ImageDraw.Draw(img)
            d.rectangle(box(x - 2, y, x + 2, y + 5), fill=(34, 52, 30, 255))
            body = ellipse_pts(x, y + 11.5, 3.8, 5.8)
            core = lerp(c, (255, 250, 236), 0.6) if on else lerp(c, (40, 30, 24), 0.35)
            shape(img, body, core)
            d.ellipse(box(x - 1.6, y + 8, x + 0.2, y + 11), fill=(255, 255, 255, 200 if on else 90))
        save(img, name, W, H)


def cork():
    # The corkboard, 228 x 140: a pine frame, cork, and three handbills.
    # The open mic flyer leaves its lower half blank for the "open for"
    # readout, which the stylesheet turns by the flyer's 3 degrees.
    W, H = 228, 140
    img = wood(W, H, (206, 164, 112), off=3)
    rng = np.random.default_rng(8)
    cw, ch = (W - 16) * Z, (H - 16) * Z
    base = np.ones((ch, cw, 3), np.float32) * np.array([184, 136, 88], np.float32)
    lowf = np.array(Image.fromarray((rng.random((6, 10)) * 255).astype(np.uint8)).resize((cw, ch), Image.BICUBIC), np.float32)
    base += (lowf[..., None] / 255 - 0.5) * 24
    gran = np.array(Image.fromarray((rng.random((ch // 3, cw // 3)) * 255).astype(np.uint8)).resize((cw, ch), Image.NEAREST), np.float32)
    base += (gran[..., None] / 255 - 0.5) * 46
    dark = rng.random((ch, cw)) > 0.985
    base[dark] *= 0.55
    img.paste(Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB').filter(ImageFilter.GaussianBlur(0.5 * Z)), (8 * Z, 8 * Z))
    d = ImageDraw.Draw(img)
    d.rectangle(box(8, 8, W - 8, H - 8), outline=(90, 60, 30, 255), width=int(1 * Z))

    def paper(w, h, color, draw, angle, at, pin):
        p = new(w, h, color + (255,))
        tex = np.random.default_rng(int(w * h)).normal(0, 4, (h * Z, w * Z, 1))
        a = np.array(p, np.float32)
        a[..., :3] += tex
        p = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        draw(ImageDraw.Draw(p))
        r = p.rotate(angle, resample=Image.BICUBIC, expand=True)
        sh = Image.new('RGBA', r.size, (0, 0, 0, 255))
        sh.putalpha(r.getchannel('A').point(lambda v: v * 0.45).filter(ImageFilter.GaussianBlur(2 * Z)))
        x, y = int(at[0] * Z - (r.width - w * Z) / 2), int(at[1] * Z - (r.height - h * Z) / 2)
        img.alpha_composite(sh, (x + 2 * Z, y + 3 * Z))
        img.alpha_composite(r, (x, y))
        px, py = at[0] + w / 2, at[1] + 4
        glow(img, px + 1.5, py + 2, 3, (0, 0, 0), 120)
        d2 = ImageDraw.Draw(img)
        d2.ellipse(box(px - 3.2, py - 3.2, px + 3.2, py + 3.2), fill=pin + (255,))
        d2.ellipse(box(px - 1.8, py - 2.2, px - 0.2, py - 0.6), fill=(255, 255, 255, 170))

    def flyer(d):
        d.text((52 * Z, 22 * Z), 'OPEN', font=font(SHRIKHAND, 25), fill=(196, 62, 38), anchor='mm')
        d.text((52 * Z, 46 * Z), 'MIC', font=font(SHRIKHAND, 25), fill=(196, 62, 38), anchor='mm')
        d.text((52 * Z, 64 * Z), 'poems . folk . jazz', font=font(CUTIVE, 8.5), fill=(50, 40, 36), anchor='mm')
        d.line(box(14, 72, 90, 72), fill=(120, 96, 80), width=int(0.6 * Z))

    def card(d):
        d.line(box(0, 11, 88, 11), fill=(206, 70, 70), width=int(0.6 * Z))
        for y in range(21, 58, 9):
            d.line(box(0, y, 88, y), fill=(120, 160, 210), width=int(0.4 * Z))
        f = font(CUTIVE, 9.5)
        for k, t in enumerate(('POETRY', 'sun 8 pm', 'bring your', 'own words')):
            d.text((8 * Z, (19 + 9 * k) * Z), t, font=f, fill=(44, 40, 70), anchor='ls')

    def chess(d):
        d.text((40 * Z, 18 * Z), 'chess', font=font(SHRIKHAND, 14), fill=(70, 40, 20), anchor='mm')
        d.text((40 * Z, 34 * Z), 'thursdays', font=font(CUTIVE, 9.5), fill=(60, 40, 24), anchor='mm')
        for i in range(6):
            for j in range(2):
                if (i + j) % 2 == 0:
                    d.rectangle(box(22 + 6 * i, 41 + 5 * j, 28 + 6 * i, 46 + 5 * j), fill=(70, 40, 20))

    paper(104, 120, (241, 232, 208), flyer, 3, (12, 9), (206, 48, 40))
    paper(88, 58, (216, 230, 238), card, -4, (126, 12), (236, 200, 60))
    paper(80, 54, (228, 182, 74), chess, 2, (136, 76), (70, 150, 80))
    save(img, 'cork.png', W, H)


def lava():
    # The lava lamp's glass, cap and base, 68 x 150, laid over the liquid
    # the stylesheet draws: the glass runs from y 30 to 104, x 14 to 54.
    W, H = 68, 150
    img = new(W, H)
    gold = metal((120, 76, 30), (255, 226, 150), (214, 160, 72))
    shadow(img, [(6, 146), (62, 146), (62, 150), (6, 150)], off=(0, 0), blur=2, alpha=150)
    shape(img, [(27, 8), (41, 8), (47, 30), (21, 30)], gold)
    shape(img, ellipse_pts(34, 8, 7, 1.6), (250, 216, 140, 255))
    shape(img, [(17, 104), (51, 104), (62, 144), (6, 144)], gold)
    shape(img, [(17, 104), (51, 104), (52, 108), (16, 108)], metal((150, 100, 40), (255, 240, 190), (230, 190, 110)))
    shape(img, [(5, 143), (63, 143), (63, 148), (5, 148)], metal((90, 56, 22), (220, 180, 110), (170, 120, 54)))
    glass = [(21, 30), (47, 30), (54, 80), (51, 104), (17, 104), (14, 80)]
    d = ImageDraw.Draw(img)
    d.line(sc(glass + glass[:1]), fill=(40, 24, 20, 150), width=int(0.9 * Z), joint='curve')
    hl = Image.new('L', img.size, 0)
    ImageDraw.Draw(hl).polygon(sc([(23, 34), (26, 34), (20, 80), (21, 98), (19, 98), (17.5, 80)]), fill=120)
    hl = hl.filter(ImageFilter.GaussianBlur(1 * Z))
    layer = Image.new('RGBA', img.size, (255, 255, 255, 255))
    layer.putalpha(hl)
    img.alpha_composite(layer)
    sh = Image.new('L', img.size, 0)
    ImageDraw.Draw(sh).polygon(sc([(44, 32), (47, 30), (54, 80), (51, 104), (47, 104), (50, 80)]), fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(1.5 * Z))
    layer = Image.new('RGBA', img.size, (0, 0, 0, 255))
    layer.putalpha(sh)
    img.alpha_composite(layer)
    save(img, 'lava.png', W, H)


# The turntable.

def deck():
    # The turntable's plinth, 284 x 200: walnut, a brushed top plate, the
    # platter's mat and strobe rim around (98, 100), the tonearm's base.
    W, H = 284, 200
    img = new(W, H)
    pl = wood(W, H, (118, 70, 40), off=5)
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box(0, 0, W, H), radius=6 * Z, fill=255)
    img.paste(pl, (0, 0), m)
    rng = np.random.default_rng(3)
    pw, ph = (W - 16) * Z, (H - 16) * Z
    br = 186 + rng.normal(0, 1, (ph, 1)) * 6 + rng.normal(0, 1, (ph, pw)) * 5
    c = np.cumsum(np.pad(br, ((0, 0), (40, 40)), mode='edge'), axis=1)
    br = (c[:, 80:] - c[:, :-80]) / 80
    br = br[:, :pw]
    plate = np.stack([br, br + 2, br + 5], -1)
    plate *= np.linspace(1.08, 0.86, ph)[:, None, None]
    img.paste(Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8), 'RGB'), (8 * Z, 8 * Z))
    d = ImageDraw.Draw(img)
    d.rectangle(box(8, 8, W - 8, H - 8), outline=(70, 60, 52, 255), width=int(1 * Z))
    glow(img, 101, 104, 88, (0, 0, 0), 160)
    d = ImageDraw.Draw(img)
    cx, cy = 98, 100
    d.ellipse(box(cx - 88, cy - 88, cx + 88, cy + 88), fill=(150, 152, 156, 255))
    d.ellipse(box(cx - 87, cy - 87, cx + 87, cy + 87), fill=(206, 208, 212, 255))
    for k in range(90):
        a = math.radians(4 * k)
        x, y = cx + 85 * math.sin(a), cy - 85 * math.cos(a)
        d.ellipse(box(x - 0.9, y - 0.9, x + 0.9, y + 0.9), fill=(70, 72, 76, 255))
    d.ellipse(box(cx - 83, cy - 83, cx + 83, cy + 83), fill=(30, 30, 32, 255))
    for r in range(80, 70, -3):
        d.ellipse(box(cx - r, cy - r, cx + r, cy + r), outline=(40, 40, 43, 255), width=int(0.7 * Z))
    # Tonearm base and rest.
    d.ellipse(box(224, 30, 252, 58), fill=(46, 46, 50, 255))
    d.ellipse(box(227, 33, 249, 55), fill=(170, 172, 176, 255))
    d.ellipse(box(231, 37, 245, 51), fill=(60, 60, 64, 255))
    d.rectangle(box(258, 104, 266, 120), fill=(60, 60, 64, 255))
    d.rectangle(box(255, 100, 269, 104), fill=(150, 152, 156, 255))
    # Speed buttons and the start button.
    f = font(DEJAVU, 6)
    for x, t in ((198, '33'), (226, '45')):
        d.rounded_rectangle(box(x, 172, x + 24, 184), radius=2 * Z, fill=(52, 52, 56, 255))
        d.text(((x + 12) * Z, 178 * Z), t, font=f, fill=(220, 220, 220), anchor='mm')
    d.ellipse(box(256, 170, 272, 186), fill=(52, 52, 56, 255))
    d.ellipse(box(260, 174, 268, 182), fill=(200, 70, 50, 255))
    d.rectangle(box(196, 152, 276, 166), fill=(64, 60, 56, 255))
    d.rectangle(box(197, 153, 275, 165), outline=(150, 150, 150, 255), width=int(0.5 * Z))
    save(img, 'deck.png', W, H)


def record():
    # The record, 140 x 140: grooves, a sheen, and an orange label whose
    # print turns with it. The value the gauge prints sits on the label.
    N = 140 * Z
    c = (N - 1) / 2
    y, x = np.mgrid[0:N, 0:N]
    r = np.hypot(x - c, y - c) / Z
    th = np.arctan2(y - c, x - c)
    v = np.full((N, N), 20.0)
    gro = (r > 26) & (r < 68.5)
    v += gro * (6 * np.sin(r * 9.0) ** 2)
    for band in (40.5, 51.5, 60.5):
        v -= 4 * (np.abs(r - band) < 0.8)
    v += gro * 46 * np.abs(np.cos(th - 0.6)) ** 24
    rgb = np.stack([v, v, v + 2], -1)
    alpha = np.clip((70 - r) * Z, 0, 1) * 255
    img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(img)
    C = 70
    d.ellipse(box(C - 24, C - 24, C + 24, C + 24), fill=(214, 100, 42, 255))
    d.ellipse(box(C - 24, C - 24, C + 24, C + 24), outline=(160, 66, 26, 255), width=int(0.6 * Z))
    band = Image.new('L', img.size, 0)
    bd = ImageDraw.Draw(band)
    bd.pieslice(box(C - 22, C - 22, C + 22, C + 22), 200, 340, fill=255)
    bd.ellipse(box(C - 15, C - 15, C + 15, C + 15), fill=0)
    layer = Image.new('RGBA', img.size, (244, 228, 190, 255))
    layer.putalpha(band)
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    for k, (r0, a0, a1) in enumerate(((19.5, 220, 320), (17, 235, 305))):
        d.arc(box(C - r0, C - r0, C + r0, C + r0), a0, a1, fill=(90, 50, 30, 255), width=int(1.1 * Z))
    for a0 in range(30, 150, 22):
        d.arc(box(C - 20, C - 20, C + 20, C + 20), a0, a0 + 14, fill=(250, 230, 200, 255), width=int(1 * Z))
    d.ellipse(box(C + 15 - 3, C - 3, C + 15 + 3, C + 3), outline=(250, 230, 200, 255), width=int(0.8 * Z))
    d.ellipse(box(C - 1.8, C - 1.8, C + 1.8, C + 1.8), fill=(200, 202, 206, 255))
    save(img, 'record.png', 140, 140)


def tonearm():
    # The tonearm over the record, 284 x 200 like the plinth: pivot at
    # (238, 44), the headshell on the lead-in at (150, 133).
    W, H = 284, 200
    img = new(W, H)
    P, E, Hd = (238, 44), (163, 120), (150, 133)
    ux, uy = (P[0] - E[0]), (P[1] - E[1])
    L = math.hypot(ux, uy)
    ux, uy = ux / L, uy / L
    nx, ny = -uy, ux
    cw = [(P[0] + ux * 10 + nx * 6, P[1] + uy * 10 + ny * 6), (P[0] + ux * 26 + nx * 6, P[1] + uy * 26 + ny * 6),
          (P[0] + ux * 26 - nx * 6, P[1] + uy * 26 - ny * 6), (P[0] + ux * 10 - nx * 6, P[1] + uy * 10 - ny * 6)]
    tube = [(P[0] + nx * 2, P[1] + ny * 2), (E[0] + nx * 2, E[1] + ny * 2), (E[0] - nx * 2, E[1] - ny * 2), (P[0] - nx * 2, P[1] - ny * 2)]
    hx, hy = (Hd[0] - E[0]), (Hd[1] - E[1])
    hl = math.hypot(hx, hy)
    hx, hy = hx / hl, hy / hl
    hn = (-hy, hx)
    head = [(E[0] + hn[0] * 4, E[1] + hn[1] * 4), (Hd[0] + hx * 4 + hn[0] * 5, Hd[1] + hy * 4 + hn[1] * 5),
            (Hd[0] + hx * 4 - hn[0] * 5, Hd[1] + hy * 4 - hn[1] * 5), (E[0] - hn[0] * 4, E[1] - hn[1] * 4)]
    for pts in (cw, tube, head):
        shadow(img, pts, off=(4, 6), blur=2.5, alpha=120)
    shape(img, cw, (40, 40, 44, 255))
    d = ImageDraw.Draw(img)
    for k in range(12, 26, 3):
        a, b = (P[0] + ux * k + nx * 6, P[1] + uy * k + ny * 6), (P[0] + ux * k - nx * 6, P[1] + uy * k - ny * 6)
        d.line(sc([a, b]), fill=(90, 90, 96, 255), width=int(0.6 * Z))
    shape(img, tube, (196, 198, 204, 255))
    d = ImageDraw.Draw(img)
    d.line(sc([(P[0] + nx * 0.8, P[1] + ny * 0.8), (E[0] + nx * 0.8, E[1] + ny * 0.8)]), fill=(250, 250, 252, 255), width=int(0.8 * Z))
    shape(img, head, (54, 54, 58, 255))
    d = ImageDraw.Draw(img)
    d.line(sc([(Hd[0] - hn[0] * 5, Hd[1] - hn[1] * 5), (Hd[0] - hn[0] * 11 - hx * 2, Hd[1] - hn[1] * 11 - hy * 2)]), fill=(170, 170, 176, 255), width=int(1.2 * Z))
    d.ellipse(box(P[0] - 7, P[1] - 7, P[0] + 7, P[1] + 7), fill=(80, 80, 86, 255))
    d.ellipse(box(P[0] - 4, P[1] - 4, P[0] + 4, P[1] + 4), fill=(200, 202, 206, 255))
    save(img, 'tonearm.png', W, H)


# The amp.

def amp():
    # The tube amp's face, 284 x 168: a walnut case, a brushed face, the
    # VU window at (16, 12)-(176, 132), the knob's scale around (234, 52).
    W, H = 284, 168
    img = new(W, H)
    case = wood(W, H, (112, 64, 36), off=9)
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box(0, 0, W, H), radius=5 * Z, fill=255)
    img.paste(case, (0, 0), m)
    rng = np.random.default_rng(4)
    pw, ph = (W - 16) * Z, (H - 16) * Z
    br = 176 + rng.normal(0, 1, (ph, 1)) * 5 + rng.normal(0, 1, (ph, pw)) * 5
    c = np.cumsum(np.pad(br, ((0, 0), (40, 40)), mode='edge'), axis=1)
    br = ((c[:, 80:] - c[:, :-80]) / 80)[:, :pw]
    face = np.stack([br + 4, br + 2, br - 2], -1) * np.linspace(1.08, 0.88, ph)[:, None, None]
    img.paste(Image.fromarray(np.clip(face, 0, 255).astype(np.uint8), 'RGB'), (8 * Z, 8 * Z))
    d = ImageDraw.Draw(img)
    d.rectangle(box(8, 8, W - 8, H - 8), outline=(60, 50, 40, 255), width=int(1 * Z))
    d.rounded_rectangle(box(12, 8.5, 180, 135.5), radius=5 * Z, fill=(26, 22, 20, 255))
    d.rounded_rectangle(box(15, 11, 177, 133), radius=3 * Z, fill=(60, 40, 20, 255))
    cx, cy = 234, 52
    for k in range(11):
        a = math.radians(-135 + 27 * k)
        r0, r1 = 41, 45 if k % 5 == 0 else 43.5
        d.line(sc([(cx + r0 * math.sin(a), cy - r0 * math.cos(a)), (cx + r1 * math.sin(a), cy - r1 * math.cos(a))]), fill=(40, 34, 30, 255), width=int(0.9 * Z))
    f = font(DEJAVU, 5.5)
    d.text(((cx - 34) * Z, (cy + 40) * Z), '0', font=f, fill=(40, 34, 30), anchor='mm')
    d.text(((cx + 34) * Z, (cy + 40) * Z), '100', font=f, fill=(40, 34, 30), anchor='mm')
    # The jewel lamp and the input switches along the bottom.
    glow(img, 24, 148, 6, (255, 170, 60), 200)
    d = ImageDraw.Draw(img)
    d.ellipse(box(20, 144, 28, 152), fill=(255, 190, 90, 255))
    d.ellipse(box(21.5, 145, 24.5, 148), fill=(255, 245, 220, 255))
    f = font(DEJAVU, 5)
    for k, t in enumerate(('PHONO', 'TAPE', 'AUX')):
        x = 52 + 40 * k
        d.text((x * Z, 141 * Z), t, font=f, fill=(46, 40, 34), anchor='mm')
        d.rounded_rectangle(box(x - 3, 146, x + 3, 156), radius=1.5 * Z, fill=(60, 56, 52, 255))
        d.ellipse(box(x - 2, 146 if k == 0 else 151, x + 2, 150 if k == 0 else 155), fill=(220, 220, 220, 255))
    d.ellipse(box(258, 143, 268, 153), fill=(40, 36, 32, 255))
    d.ellipse(box(261, 146, 265, 150), fill=(10, 10, 10, 255))
    save(img, 'amp.png', W, H)


def vu():
    # The VU meter's face, 240 x 180: the needle widget's 100 x 75 box,
    # pivot at (50, 70), sweep -60 to 60 degrees, 0 to 150 tokens/s.
    W, H = 240, 180
    S = Z
    img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    y, x = np.mgrid[0:H * S, 0:W * S] / S
    t = np.clip(np.hypot((x - 120) / 150, (y - 120) / 120), 0, 1)
    back = np.stack([255 - 50 * t, 222 - 80 * t, 150 - 90 * t, np.full_like(t, 255)], -1)
    img = Image.fromarray(np.clip(back, 0, 255).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(img)
    cx, cy, R = 120, 168, 126

    def at(r, deg):
        a = math.radians(deg)
        return (cx + r * math.sin(a)) * S, (cy - r * math.cos(a)) * S

    d.arc([(cx - R + 2) * S, (cy - R + 2) * S, (cx + R - 2) * S, (cy + R - 2) * S], -150, -30, fill=(30, 22, 16), width=int(1.4 * S))
    for k in range(60):
        deg = 36 + 24 * k / 59
        d.line([at(R - 4, deg), at(R - 14, deg)], fill=(190, 40, 30), width=int(3 * S))
    for k in range(31):
        deg = -60 + 120 * k / 30
        major = k % 6 == 0
        d.line([at(R - 2, deg), at(R - (20 if major else 11), deg)], fill=(30, 22, 16), width=int((2.6 if major else 1.2) * S))
    f = font(DEJAVU, 13)
    for k, n in enumerate(range(0, 151, 30)):
        d.text(at(R - 34, -60 + 24 * k), str(n), font=f, fill=(30, 22, 16), anchor='mm')
    d.text((cx * S, (cy - 70) * S), 'TOKENS / S', font=font(DEJAVU, 10), fill=(120, 54, 28), anchor='mm')
    img = img.resize((W * 2, H * 2), Image.LANCZOS)
    img.save(OUT + 'vu.png', optimize=True)


def knob():
    # A bakelite knob, 96 x 96, knurled skirt, brass cap, pointer at 12.
    N = 96
    img = new(N, N)
    d = ImageDraw.Draw(img)
    c = N / 2
    for i in range(48):
        a0 = 360 * i / 48
        d.pieslice(box(c - 45, c - 45, c + 45, c + 45), a0, a0 + 7.5, fill=(52, 38, 30, 255) if i % 2 else (28, 20, 16, 255))
    for k in range(60):
        t = k / 60
        rr = 36 * (1 - t)
        off = 4 * t
        d.ellipse(box(c - rr - off, c - rr - off, c + rr - off, c + rr - off), fill=lerp((30, 22, 18), (92, 70, 56), t ** 1.4) + (255,))
    d.ellipse(box(c - 9, c - 9, c + 9, c + 9), fill=(150, 112, 50, 255))
    d.ellipse(box(c - 7, c - 7, c + 5, c + 5), fill=(220, 180, 100, 255))
    d.rounded_rectangle(box(c - 2.2, 8, c + 2.2, c - 14), radius=1.5 * Z, fill=(244, 232, 210, 255))
    save(img, 'knob.png', N, N)


def lps():
    # A cubby of LPs, 284 x 210, standing on its floor. The stylesheet
    # pins the picture to the cubby's bottom.
    W, H = 284, 210
    img = new(W, H)
    img.alpha_composite(grad(W * Z, H * Z, [(0, (14, 9, 6)), (0.5, (30, 20, 14)), (1, (40, 27, 18))], vertical=True).convert('RGBA'))
    rng = np.random.default_rng(21)
    pal = [(196, 92, 40), (222, 170, 60), (110, 120, 50), (40, 90, 100), (150, 50, 50), (232, 222, 196), (30, 30, 30),
           (180, 120, 70), (90, 60, 110), (60, 120, 80), (210, 130, 90), (120, 80, 50)]
    d = ImageDraw.Draw(img)
    x = 6.0
    while x < 214:
        w = float(rng.uniform(2.5, 6.5))
        h = float(rng.uniform(182, 198))
        col = pal[rng.integers(len(pal))]
        col = lerp(col, (20, 14, 10), float(rng.uniform(0.15, 0.45)))
        d.rectangle(box(x, 204 - h, x + w - 0.4, 204), fill=col + (255,))
        d.line(sc([(x + w - 0.6, 204 - h), (x + w - 0.6, 204)]), fill=(10, 8, 6, 255), width=int(0.5 * Z))
        if rng.random() < 0.5:
            for k in range(int(rng.integers(2, 5))):
                yy = 204 - h + 14 + k * 9 + float(rng.uniform(0, 3))
                d.line(sc([(x + w / 2, yy), (x + w / 2, yy + float(rng.uniform(3, 6)))]), fill=lerp(col, (250, 240, 220), 0.6) + (255,), width=int(0.7 * Z))
        x += w
    # Two sleeves leaning at the end, their fronts half turned to us.
    shape(img, [(222, 20), (262, 16), (282, 204), (240, 204)], (230, 160, 50, 255))
    d = ImageDraw.Draw(img)
    for k in range(5):
        d.line(sc([(226 + 4 * k, 120 - 6 * k), (262 - 2 * k, 116 - 6 * k)]), fill=(180, 70, 40, 255), width=int(2 * Z))
    shape(img, ellipse_pts(250, 70, 13, 14), (196, 60, 40, 255))
    shape(img, [(212, 30), (226, 22), (250, 204), (232, 204)], (40, 70, 90, 255))
    d = ImageDraw.Draw(img)
    d.line(sc([(216 + 2 * math.sin(t / 6), 40 + t) for t in np.linspace(0, 150, 40)]), fill=(230, 220, 180, 255), width=int(1.2 * Z))
    img.paste(wood(W, H - 204, (120, 74, 42), off=2), (0, 204 * Z))
    save(img, 'lps.png', W, H)


# The table.

def press():
    # A French press, 70 x 118, laid over the coffee the stylesheet draws
    # in its glass, x 12 to 52, y 28 to 102.
    W, H = 70, 118
    img = new(W, H)
    chrome = metal((96, 100, 106), (250, 252, 255), (200, 204, 210))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box(53, 34, 68, 96), radius=7 * Z, outline=(26, 24, 24, 255), width=int(4.5 * Z))
    shape(img, [(33.5, 8), (36.5, 8), (36.5, 20), (33.5, 20)], chrome)
    shape(img, ellipse_pts(35, 6, 6, 5.5), lambda w, h: grad(w, h, [(0, (70, 66, 64)), (0.35, (20, 18, 18)), (1, (6, 6, 6))]))
    shape(img, ellipse_pts(35, 21, 23, 6, 180, 360), chrome)
    shape(img, [(11, 21), (59, 21), (59, 28), (11, 28)], chrome)
    shape(img, [(11, 100), (59, 100), (60, 110), (10, 110)], chrome)
    for x0 in (12, 50):
        shape(img, [(x0, 110), (x0 + 8, 110), (x0 + 7, 114), (x0 + 1, 114)], (60, 62, 66, 255))
    d = ImageDraw.Draw(img)
    d.line(sc([(12, 28), (12, 100)]), fill=(220, 226, 232, 150), width=int(0.8 * Z))
    d.line(sc([(58, 28), (58, 100)]), fill=(80, 70, 60, 150), width=int(0.8 * Z))
    d.rectangle(box(13, 29, 57, 32), fill=(130, 132, 136, 220))
    d.line(sc([(35, 28), (35, 29)]), fill=(200, 200, 200, 255), width=int(1.4 * Z))
    hl = Image.new('L', img.size, 0)
    ImageDraw.Draw(hl).rectangle(box(16, 33, 19, 97), fill=110)
    hl = hl.filter(ImageFilter.GaussianBlur(1 * Z))
    layer = Image.new('RGBA', img.size, (255, 255, 255, 255))
    layer.putalpha(hl)
    img.alpha_composite(layer)
    save(img, 'press.png', W, H)


def jar():
    # A mason jar, 56 x 100, laid over the cold brew the stylesheet draws
    # inside it, x 8 to 48, y 22 to 94.
    W, H = 56, 100
    img = new(W, H)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box(4, 14, 52, 98), radius=11 * Z, outline=(236, 240, 236, 150), width=int(1.6 * Z))
    shape(img, [(7, 3), (49, 3), (50, 16), (6, 16)], metal((110, 96, 60), (240, 226, 170), (200, 180, 120)))
    d = ImageDraw.Draw(img)
    for y in (6, 9, 12):
        d.line(sc([(6.5, y), (49.5, y)]), fill=(120, 100, 60, 200), width=int(0.6 * Z))
    hl = Image.new('L', img.size, 0)
    ImageDraw.Draw(hl).rounded_rectangle(box(9, 24, 13, 88), radius=2 * Z, fill=120)
    ImageDraw.Draw(hl).rounded_rectangle(box(40, 30, 42, 60), radius=1 * Z, fill=60)
    hl = hl.filter(ImageFilter.GaussianBlur(1 * Z))
    layer = Image.new('RGBA', img.size, (255, 255, 255, 255))
    layer.putalpha(hl)
    img.alpha_composite(layer)
    save(img, 'jar.png', W, H)


def plant():
    # A pothos in a terracotta pot, 86 x 120, vines over the rim.
    W, H = 86, 120
    img = new(W, H)
    terra = lambda w, h: grad(w, h, [(0, (120, 54, 30)), (0.35, (206, 110, 66)), (1, (110, 50, 28))])
    shape(img, [(26, 80), (60, 80), (57, 118), (29, 118)], terra)
    shape(img, [(22, 72), (64, 72), (64, 82), (22, 82)], terra)
    shape(img, ellipse_pts(43, 73, 20, 3), (50, 32, 20, 255))
    rng = np.random.default_rng(31)

    def leaf(x, y, s, ang, col):
        pts = [(math.sin(t) ** 3 * 1.0, -(0.8 * math.cos(t) - 0.3 * math.cos(2 * t) - 0.15 * math.cos(3 * t))) for t in np.linspace(0, 2 * math.pi, 40)]
        ca, sa = math.cos(ang), math.sin(ang)
        p = [(x + s * (px * ca - py * sa), y + s * (px * sa + py * ca)) for px, py in pts]
        shape(img, p, col + (255,))
        ImageDraw.Draw(img).line(sc([(x, y), (x + s * 0.7 * sa * -1, y + s * 0.7 * ca)]), fill=lerp(col, (220, 230, 150), 0.4) + (255,), width=int(0.5 * Z))

    vines = [
        [(40, 72), (30, 60), (20, 54), (10, 62), (6, 80), (8, 100)],
        [(46, 72), (58, 58), (70, 56), (78, 68), (80, 88), (78, 108)],
        [(43, 72), (40, 52), (36, 34), (40, 18), (48, 10)],
        [(44, 72), (52, 50), (62, 36), (70, 26)],
        [(42, 72), (26, 76), (16, 86), (14, 104)],
        [(45, 73), (64, 80), (70, 96), (68, 114)],
    ]
    d = ImageDraw.Draw(img)
    for v in vines:
        d.line(sc(v), fill=(70, 100, 40, 255), width=int(0.9 * Z), joint='curve')
    greens = [(56, 120, 50), (80, 146, 60), (46, 100, 44), (100, 160, 70), (70, 130, 56)]
    for v in vines:
        for i in range(1, len(v)):
            x, y = v[i]
            px, py = v[i - 1]
            ang = math.atan2(y - py, x - px) + float(rng.uniform(-0.9, 0.9))
            leaf(x + float(rng.uniform(-2, 2)), y, float(rng.uniform(6.5, 9)), ang - math.pi / 2, greens[rng.integers(len(greens))])
    save(img, 'plant.png', W, H)


def typewriter():
    # A manual typewriter, 168 x 96, a sheet in its platen.
    W, H = 168, 96
    img = new(W, H)
    shape(img, [(60, 0), (110, 0), (110, 30), (60, 30)], (246, 240, 226, 255))
    d = ImageDraw.Draw(img)
    for k, ln in enumerate((38, 30, 41, 22, 35)):
        d.line(sc([(66, 6 + 4.2 * k), (66 + ln, 6 + 4.2 * k)]), fill=(80, 76, 80, 255), width=int(1.1 * Z))
    shadow(img, [(8, 36), (160, 36), (166, 92), (2, 92)], off=(2, 4), blur=3, alpha=140)
    body = lambda w, h: grad(w, h, [(0, (36, 58, 46)), (0.5, (66, 96, 76)), (1, (30, 50, 40))], vertical=True)
    shape(img, [(14, 34), (154, 34), (164, 86), (4, 86)], body)
    shape(img, [(4, 86), (164, 86), (162, 92), (6, 92)], (22, 34, 28, 255))
    shape(img, [(22, 24), (146, 24), (146, 36), (22, 36)], lambda w, h: grad(w, h, [(0, (10, 10, 10)), (0.3, (70, 70, 72)), (1, (6, 6, 6))], vertical=True))
    for x0 in (12, 146):
        shape(img, ellipse_pts(x0 + 5, 30, 5, 5), (30, 30, 32, 255))
    d = ImageDraw.Draw(img)
    d.line(sc([(22, 26), (6, 14), (2, 16)]), fill=(210, 212, 216, 255), width=int(1.6 * Z), joint='curve')
    for row, (y, n, x0, step) in enumerate(((50, 10, 30, 12), (61, 10, 34, 11.6), (72, 9, 40, 11.4))):
        for k in range(n):
            x = x0 + step * k
            d.ellipse(box(x - 4, y - 4, x + 4, y + 4), fill=(16, 16, 16, 255))
            d.ellipse(box(x - 3, y - 3, x + 3, y + 3), fill=(232, 224, 204, 255))
            d.ellipse(box(x - 1.8, y - 2.4, x, y - 1), fill=(255, 255, 250, 255))
    d.rounded_rectangle(box(52, 79, 116, 83), radius=2 * Z, fill=(200, 202, 206, 255))
    save(img, 'typewriter.png', W, H)


def mug(img, x, base, kind):
    # One mug, its foot centred at (x, base), about 30 x 32.
    d = ImageDraw.Draw(img)
    if kind == 0:  # speckled oatmeal stoneware
        col, rim = (222, 206, 176), (180, 150, 110)
        d.rounded_rectangle(box(x + 9, base - 26, x + 21, base - 9), radius=6 * Z, outline=col + (255,), width=int(3.2 * Z))
        shape(img, [(x - 13, base - 30), (x + 13, base - 30), (x + 12, base - 2), (x + 10, base), (x - 10, base), (x - 12, base - 2)],
              lambda w, h: grad(w, h, [(0, (170, 150, 120)), (0.35, col), (1, (150, 130, 100))]))
        rng = np.random.default_rng(x)
        d = ImageDraw.Draw(img)
        for _ in range(40):
            px, py = x + float(rng.uniform(-11, 11)), base - float(rng.uniform(2, 28))
            d.ellipse(box(px - 0.4, py - 0.4, px + 0.4, py + 0.4), fill=(90, 70, 50, 255))
        d.rectangle(box(x - 13, base - 30, x + 13, base - 28), fill=rim + (255,))
    elif kind == 1:  # mustard with a brown drip glaze
        d.rounded_rectangle(box(x + 8, base - 24, x + 20, base - 8), radius=6 * Z, outline=(214, 160, 40, 255), width=int(3 * Z))
        shape(img, [(x - 12, base - 28), (x + 12, base - 28), (x + 13, base - 3), (x + 11, base), (x - 11, base), (x - 13, base - 3)],
              lambda w, h: grad(w, h, [(0, (170, 120, 20)), (0.35, (232, 180, 52)), (1, (160, 110, 20))]))
        drip = [(x - 12, base - 28), (x + 12, base - 28), (x + 12.2, base - 22)]
        for k in range(8, -9, -2):
            drip.append((x + k * 1.45, base - 22 + (4 if k % 4 == 0 else 1)))
        drip.append((x - 12.2, base - 21))
        shape(img, drip, (110, 60, 26, 255))
    elif kind == 2:  # white enamel camp mug, blue rim
        d.arc(box(x + 7, base - 25, x + 21, base - 9), -90, 90, fill=(240, 240, 236, 255), width=int(2.6 * Z))
        shape(img, [(x - 12, base - 26), (x + 12, base - 26), (x + 11, base), (x - 11, base)],
              lambda w, h: grad(w, h, [(0, (190, 194, 196)), (0.35, (250, 250, 248)), (1, (180, 184, 188))]))
        d = ImageDraw.Draw(img)
        d.rectangle(box(x - 12.4, base - 27, x + 12.4, base - 24.5), fill=(40, 70, 150, 255))
        d.rectangle(box(x - 11.2, base - 1.4, x + 11.2, base), fill=(40, 70, 150, 255))
        d.ellipse(box(x - 4, base - 16, x - 1, base - 14), fill=(60, 60, 60, 255))
    else:  # teal hand-thrown, round belly
        d.arc(box(x + 7, base - 24, x + 20, base - 8), -90, 90, fill=(40, 120, 120, 255), width=int(3.2 * Z))
        body = [(x - 10, base - 30), (x + 10, base - 30), (x + 13, base - 18), (x + 12, base - 6), (x + 8, base), (x - 8, base), (x - 12, base - 6), (x - 13, base - 18)]
        shape(img, body, lambda w, h: grad(w, h, [(0, (20, 80, 80)), (0.35, (70, 160, 156)), (1, (18, 70, 70))]))
        d = ImageDraw.Draw(img)
        d.line(sc([(x - 12.5, base - 14), (x + 12.5, base - 14)]), fill=(200, 190, 160, 255), width=int(0.9 * Z))
        d.polygon(sc([(x + 5, base - 30), (x + 9, base - 30), (x + 7, base - 27)]), fill=(200, 180, 150, 255))
    d = ImageDraw.Draw(img)
    d.ellipse(box(x - 11, base - 31, x + 11, base - 27), fill=(60, 34, 18, 255))


def mugs():
    # Mismatched mugs on a plank for the subagents: frames of 186 x 84 for
    # none to four mugs, in a row.
    W, H = 186, 84
    frames = []
    for n in range(5):
        img = new(W, H)
        shadow(img, [(4, 66), (182, 66), (182, 80), (4, 80)], off=(0, 3), blur=2, alpha=150)
        plank = wood(W, 16, (150, 98, 58), off=7)
        img.paste(plank.crop((0, 0, 178 * Z, 10 * Z)), (4 * Z, 64 * Z))
        img.paste(Image.new('RGBA', (178 * Z, 6 * Z), (84, 52, 28, 255)), (4 * Z, 74 * Z))
        for i, x in enumerate((34, 74, 114, 154)[:n]):
            mug(img, x, 65, i)
        frames.append(img.resize((W * 2, H * 2), Image.LANCZOS))
    sheet = Image.new('RGBA', (W * 2 * 5, H * 2), (0, 0, 0, 0))
    for n, f in enumerate(frames):
        sheet.paste(f, (W * 2 * n, 0))
    sheet.save(OUT + 'mugs.png', optimize=True)


if __name__ == '__main__':
    slate()
    doodles()
    lights()
    cork()
    lava()
    deck()
    record()
    tonearm()
    amp()
    vu()
    knob()
    lps()
    press()
    jar()
    plant()
    typewriter()
    mugs()
