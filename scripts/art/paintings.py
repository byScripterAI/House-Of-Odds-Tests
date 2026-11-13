"""
CUADROS del casino: seis obras art déco pintadas por código (vectores + pincelada + lienzo envejecido).
    /tmp/bpyenv/bin/python scripts/art/paintings.py assets/art
Cada una con su tema (no seis paisajes iguales): metrópolis con reflectores, pavo real, transatlántico,
cartel de Montecarlo, fuente congelada y marina a la luz de la luna. Salen en WebP 1024×1360.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'art'))
FONT = os.path.join(os.path.dirname(__file__), '..', 'models', 'fonts', 'cinzel-latin-700-normal.ttf')
W, H = 1024, 1360
GOLD = (212, 175, 55)
GOLD_HI = (246, 220, 140)
BLACK = (12, 10, 10)


def grad(top, bottom, w=W, h=H, curve=1.0):
    t = np.linspace(0, 1, h)[:, None] ** curve
    a = np.array(top, float)[None, None, :]
    b = np.array(bottom, float)[None, None, :]
    img = a + (b - a) * t[..., None]
    return Image.fromarray(np.repeat(img, w, axis=1).astype(np.uint8), 'RGB')


def radial(img, cx, cy, r, color, alpha=1.0):
    y, x = np.mgrid[0:img.height, 0:img.width]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    k = np.clip(1 - d, 0, 1) ** 2 * alpha
    base = np.asarray(img, float)
    out = base + (np.array(color, float)[None, None, :] - base) * k[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def over(img, layer_fn, alpha=255):
    """Dibuja con transparencia: layer_fn(draw) en una capa RGBA que se compone encima."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    layer_fn(ImageDraw.Draw(layer))
    return Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')


def finish(img, seed, warm=0.08):
    """Pincelada, trama del lienzo, barniz envejecido y viñeta: que parezca un óleo, no un vector."""
    rnd = np.random.default_rng(seed)
    a = np.asarray(img, float)
    # pincelada: desenfoque direccional suave mezclado con la imagen y ruido de color de baja frecuencia
    soft = np.asarray(img.filter(ImageFilter.GaussianBlur(2.2)), float)
    noise = rnd.normal(0, 1, (H // 8, W // 8))
    noise = np.asarray(Image.fromarray(((noise * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), float) / 255 - 0.5
    a = a * 0.75 + soft * 0.25
    a *= 1 + noise[..., None] * 0.12
    # trama del lienzo (sarga fina)
    y, x = np.mgrid[0:H, 0:W]
    weave = (np.sin(x * 1.9) * np.sin(y * 1.9) * 0.5 + np.sin((x + y) * 0.9) * 0.25)
    a *= 1 + weave[..., None] * 0.035
    # grano
    a += rnd.normal(0, 4.5, (H, W, 1))
    # barniz: tono ámbar y viñeta
    tint = np.array([1.0 + warm, 1.0 + warm * 0.45, 1.0 - warm * 0.6])
    a *= tint[None, None, :]
    d = np.sqrt(((x - W / 2) / (W * 0.62)) ** 2 + ((y - H / 2) / (H * 0.62)) ** 2)
    a *= (1 - np.clip(d - 0.55, 0, 1) * 0.55)[..., None]
    # craquelado muy leve (celdas de Voronoi aproximadas por ruido)
    crack = rnd.random((H // 24, W // 24))
    crack = np.asarray(Image.fromarray((crack * 255).astype(np.uint8)).resize((W, H), Image.NEAREST).filter(ImageFilter.FIND_EDGES), float) / 255
    a *= (1 - crack * 0.05)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')


def deco_border(img, color=GOLD, inset=26, width=4):
    def f(d):
        d.rectangle((inset, inset, W - inset, H - inset), outline=color + (255,), width=width)
        d.rectangle((inset + 14, inset + 14, W - inset - 14, H - inset - 14), outline=color + (150,), width=2)
        for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
            d.polygon([(cx, cy - 16), (cx + 16, cy), (cx, cy + 16), (cx - 16, cy)], fill=color + (255,))
    return over(img, f)


# ------------------------------------------------------------------ 1. Metrópolis con reflectores
def metropolis():
    img = grad((8, 14, 34), (64, 42, 52), curve=1.3)
    img = radial(img, W * 0.5, H * 0.72, 700, (150, 90, 60), 0.6)
    rnd = random.Random(11)

    def beams(d):
        for k, a in enumerate([-38, -20, -6, 9, 24, 40]):
            r = math.radians(a)
            x0 = W * (0.18 + k * 0.13)
            L = H * 1.1
            spread = math.radians(3.2)
            pts = [(x0, H * 0.78), (x0 + math.sin(r - spread) * L, H * 0.78 - math.cos(r - spread) * L), (x0 + math.sin(r + spread) * L, H * 0.78 - math.cos(r + spread) * L)]
            d.polygon(pts, fill=(255, 236, 180, 34))
    img = over(img, beams)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    # luna con halo
    img = radial(img, W * 0.72, H * 0.17, 230, (250, 236, 200), 0.55)

    def moon(d):
        d.ellipse((W * 0.72 - 62, H * 0.17 - 62, W * 0.72 + 62, H * 0.17 + 62), fill=(246, 236, 210, 255))
    img = over(img, moon)

    def towers(d):
        base = H * 0.86
        specs = [(0.05, 0.16, 0.42), (0.17, 0.13, 0.55), (0.28, 0.16, 0.36), (0.40, 0.2, 0.62), (0.58, 0.14, 0.5), (0.7, 0.16, 0.44), (0.83, 0.14, 0.58)]
        for (x, w, h) in specs:
            x0, x1 = x * W, (x + w) * W
            top = base - h * H
            cx = (x0 + x1) / 2
            # escalonamientos art déco
            levels = 4
            for l in range(levels):
                inset = l * (x1 - x0) * 0.11
                y = top + l * (h * H) * 0.07
                d.rectangle((x0 + inset, top + (h * H) * 0.07 * (levels - l - 1), x1 - inset, base), fill=(14, 12, 18, 255))
            spire = top - (h * H) * 0.05 * (levels)
            d.polygon([(cx - 8, top - (h * H) * 0.0), (cx, spire - 70), (cx + 8, top)], fill=(14, 12, 18, 255))
            # aristas doradas
            d.line([(x0, base), (x0, top + (h * H) * 0.21)], fill=GOLD + (140,), width=2)
            # ventanas
            for wy in np.arange(top + 40, base - 10, 22):
                for wx in np.arange(x0 + 12, x1 - 10, 16):
                    if rnd.random() < 0.32:
                        d.rectangle((wx, wy, wx + 5, wy + 8), fill=(255, 210, 120, 200 if rnd.random() < 0.7 else 120))
        d.rectangle((0, base, W, H), fill=(10, 8, 12, 255))
        # reflejo en el agua del río
        for k in range(60):
            y = base + 8 + k * 7
            x = rnd.random() * W
            d.line([(x, y), (x + rnd.random() * 90 + 20, y)], fill=(255, 200, 120, int(60 * (1 - k / 60))), width=2)
    img = over(img, towers)
    img = deco_border(img)
    return finish(img, 1)


# ------------------------------------------------------------------ 2. Pavo real (abanico art déco)
def peacock():
    img = grad((10, 26, 28), (4, 10, 12), curve=0.8)
    img = radial(img, W / 2, H * 0.55, 650, (20, 70, 64), 0.55)
    cx, cy = W / 2, H * 0.86

    def fan(d):
        for ring_i, (R, n) in enumerate([(820, 21), (640, 17), (470, 13)]):
            for k in range(n):
                a = math.radians(-82 + k * 164 / (n - 1))
                ex, ey = cx + math.sin(a) * R, cy - math.cos(a) * R
                # pluma: tallo y ojo
                d.line([(cx, cy), (ex, ey)], fill=(180, 150, 70, 150), width=3)
                for s, col in ((44, (20, 90, 80, 255)), (32, (30, 140, 120, 255)), (22, (212, 175, 55, 255)), (13, (20, 40, 110, 255)), (6, (5, 10, 25, 255))):
                    sc = s * (1 - ring_i * 0.18)
                    d.ellipse((ex - sc, ey - sc * 1.25, ex + sc, ey + sc * 1.25), fill=col)
        # cuerpo estilizado
        d.ellipse((cx - 60, cy - 330, cx + 60, cy - 60), fill=(20, 60, 120, 255))
        d.ellipse((cx - 38, cy - 400, cx + 38, cy - 300), fill=(24, 80, 150, 255))
        d.polygon([(cx + 30, cy - 360), (cx + 70, cy - 350), (cx + 32, cy - 342)], fill=GOLD + (255,))
        for k in range(5):
            a = math.radians(-20 + k * 10)
            d.line([(cx, cy - 395), (cx + math.sin(a) * 70, cy - 395 - math.cos(a) * 70)], fill=GOLD + (255,), width=3)
            d.ellipse((cx + math.sin(a) * 70 - 6, cy - 395 - math.cos(a) * 70 - 6, cx + math.sin(a) * 70 + 6, cy - 395 - math.cos(a) * 70 + 6), fill=GOLD + (255,))
        d.rectangle((0, cy, W, H), fill=(8, 8, 8, 255))
        d.line([(0, cy), (W, cy)], fill=GOLD + (255,), width=4)
    img = over(img, fan)
    img = deco_border(img)
    return finish(img, 2, warm=0.05)


# ------------------------------------------------------------------ 3. Transatlántico (cartel de travesía)
def liner():
    img = grad((210, 196, 168), (150, 132, 108), curve=1.0)
    img = radial(img, W * 0.5, H * 0.28, 600, (240, 226, 196), 0.6)

    def ship(d):
        hor = H * 0.7
        # mar
        d.rectangle((0, hor, W, H), fill=(22, 40, 70, 255))
        for k in range(26):
            y = hor + 10 + k * 18
            d.line([(0, y), (W, y)], fill=(60, 90, 130, 120), width=3)
        # proa monumental vista desde abajo
        cx = W * 0.5
        d.polygon([(cx - 330, hor + 40), (cx, H * 0.08), (cx + 330, hor + 40)], fill=(14, 12, 14, 255))
        d.polygon([(cx - 330, hor + 40), (cx, H * 0.08), (cx - 18, hor + 40)], fill=(32, 28, 30, 255))
        d.polygon([(cx - 340, hor + 40), (cx + 340, hor + 40), (cx + 300, hor + 110), (cx - 300, hor + 110)], fill=(150, 22, 30, 255))
        d.line([(cx - 330, hor + 40), (cx + 330, hor + 40)], fill=(240, 236, 220, 255), width=10)
        # franja de ojos de buey y cadena del ancla (nada de «cara»)
        for k in range(-5, 6):
            yy = hor - 40 - abs(k) * 2
            xx = cx + k * 46
            if abs(xx - cx) < 300 - (hor - yy) * 0.5:
                d.ellipse((xx - 7, yy - 7, xx + 7, yy + 7), fill=(240, 220, 160, 255))
        d.line([(cx + 60, H * 0.42), (cx + 150, hor - 10)], fill=GOLD + (255,), width=6)
        d.line([(cx - 4, H * 0.08), (cx - 4, hor + 40)], fill=(70, 62, 60, 255), width=3)
        # gaviotas
        for (x, y) in ((0.18, 0.2), (0.26, 0.16), (0.78, 0.26)):
            d.arc((W * x - 22, H * y - 10, W * x, H * y + 10), 200, 340, fill=(30, 30, 30, 255), width=4)
            d.arc((W * x, H * y - 10, W * x + 22, H * y + 10), 200, 340, fill=(30, 30, 30, 255), width=4)
    img = over(img, ship)
    font = ImageFont.truetype(FONT, 64)

    def title(d):
        t = 'TRANSATLANTIQUE'
        w = d.textlength(t, font=font)
        d.text(((W - w) / 2, H * 0.9), t, font=font, fill=(240, 232, 214, 255))
    img = over(img, title)
    img = deco_border(img, color=(30, 26, 22))
    return finish(img, 3, warm=0.1)


# ------------------------------------------------------------------ 4. Cartel de Montecarlo (as de picas)
def montecarlo():
    img = grad((120, 16, 30), (40, 6, 12), curve=1.1)

    def rays(d):
        cx, cy = W / 2, H * 0.46
        for k in range(36):
            a = k * math.tau / 36
            if k % 2:
                continue
            p = [(cx, cy), (cx + math.cos(a) * 1600, cy + math.sin(a) * 1600), (cx + math.cos(a + math.tau / 36) * 1600, cy + math.sin(a + math.tau / 36) * 1600)]
            d.polygon(p, fill=(212, 175, 55, 46))
    img = over(img, rays)
    img = radial(img, W / 2, H * 0.46, 520, (255, 220, 150), 0.35)

    def spade(d):
        cx, cy, s = W / 2, H * 0.46, 260
        pts = []
        for i in range(181):
            t = math.radians(i * 2)
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((cx + x * s / 16, cy + y * s / 16 - s * 0.15))
        for width, col in ((18, GOLD + (255,)), (0, (10, 8, 8, 255))):
            if width:
                d.polygon(pts, fill=col)
            else:
                inner = [(cx + (x - cx) * 0.93, cy - s * 0.15 + (y - (cy - s * 0.15)) * 0.93) for (x, y) in pts]
                d.polygon(inner, fill=col)
        d.polygon([(cx - 26, cy + s * 0.5), (cx - 90, cy + s * 1.05), (cx + 90, cy + s * 1.05), (cx + 26, cy + s * 0.5)], fill=GOLD + (255,))
        d.polygon([(cx - 18, cy + s * 0.55), (cx - 74, cy + s * 0.99), (cx + 74, cy + s * 0.99), (cx + 18, cy + s * 0.55)], fill=(10, 8, 8, 255))
    img = over(img, spade)
    f1 = ImageFont.truetype(FONT, 92)
    f2 = ImageFont.truetype(FONT, 40)

    def text(d):
        for (t, f, y, col) in (('MONTE CARLO', f1, H * 0.08, GOLD_HI + (255,)), ('· 1926 ·', f2, H * 0.83, GOLD + (255,)), ('GRAND CASINO', f2, H * 0.88, (240, 226, 200, 255))):
            w = d.textlength(t, font=f)
            d.text(((W - w) / 2, y), t, font=f, fill=col)
    img = over(img, text)
    img = deco_border(img)
    return finish(img, 4, warm=0.06)


# ------------------------------------------------------------------ 5. Fuente congelada (motivo déco)
def fountain():
    img = grad((14, 40, 34), (6, 16, 14), curve=0.9)
    cx = W / 2
    base = H * 0.78

    def f(d):
        # chorros: arcos concéntricos plateados
        for k in range(9):
            R = 120 + k * 52
            col = (200, 225, 220, 210 - k * 14)
            d.arc((cx - R, base - R * 1.9, cx + R, base + R * 0.1), 200, 340, fill=col, width=6)
        for k in range(7):
            x = cx + (k - 3) * 46
            d.line([(x, base), (x + (k - 3) * 30, base - 420 - abs(k - 3) * -30)], fill=(220, 240, 236, 200), width=5)
            d.ellipse((x + (k - 3) * 30 - 10, base - 430 + abs(k - 3) * 30 - 10, x + (k - 3) * 30 + 10, base - 430 + abs(k - 3) * 30 + 10), fill=(240, 250, 248, 230))
        # pilón escalonado
        for i, (w, h) in enumerate(((560, 40), (470, 40), (380, 40))):
            y = base + i * 40
            d.rectangle((cx - w / 2 - i * 40, y, cx + w / 2 + i * 40, y + h), fill=(30, 26, 22, 255), outline=GOLD + (255,), width=3)
        d.rectangle((0, base + 120, W, H), fill=(10, 12, 12, 255))
        # estrellas
        rnd = random.Random(5)
        for _ in range(70):
            x, y = rnd.random() * W, rnd.random() * H * 0.45
            r = rnd.random() * 2 + 1
            d.ellipse((x - r, y - r, x + r, y + r), fill=(240, 236, 210, 200))
    img = over(img, f)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img = deco_border(img, color=(190, 200, 190))
    return finish(img, 5, warm=0.05)


# ------------------------------------------------------------------ 6. Marina a la luz de la luna (óleo)
def seascape():
    img = grad((12, 18, 38), (60, 70, 96), curve=1.2)
    img = radial(img, W * 0.62, H * 0.24, 420, (200, 205, 220), 0.55)
    rnd = random.Random(7)

    def sea(d):
        hor = H * 0.56
        d.ellipse((W * 0.62 - 58, H * 0.24 - 58, W * 0.62 + 58, H * 0.24 + 58), fill=(236, 236, 226, 255))
        d.rectangle((0, hor, W, H), fill=(14, 22, 40, 255))
        for k in range(160):
            y = hor + (k / 160) ** 1.6 * (H - hor)
            x = W * 0.62 + rnd.gauss(0, 60 + k * 2.2)
            L = 20 + rnd.random() * (40 + k)
            a = int(200 * (1 - k / 170))
            d.line([(x - L / 2, y), (x + L / 2, y)], fill=(230, 230, 210, a), width=2 + k // 40)
        # promontorio y faro
        d.polygon([(0, hor + 10), (0, hor - 140), (120, hor - 120), (260, hor - 60), (380, hor + 10)], fill=(8, 10, 16, 255))
        d.rectangle((160, hor - 230, 186, hor - 110), fill=(20, 22, 30, 255))
        d.polygon([(150, hor - 230), (196, hor - 230), (173, hor - 262)], fill=(20, 22, 30, 255))
        d.ellipse((165, hor - 222, 181, hor - 206), fill=(255, 220, 140, 255))
    img = over(img, sea)
    img = radial(img, 173, H * 0.56 - 214, 140, (255, 214, 140), 0.3)
    img = deco_border(img, color=(170, 150, 100))
    return finish(img, 6, warm=0.07)


os.makedirs(OUT, exist_ok=True)
for name, fn in (('art-1', metropolis), ('art-2', peacock), ('art-3', liner), ('art-4', montecarlo), ('art-5', fountain), ('wing-a', seascape)):
    im = fn()
    im.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=86, method=6)
    print(name)
