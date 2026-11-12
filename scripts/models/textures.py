"""Texturas pintadas por código para los modelos (PIL). Se guardan en scripts/models/tex/ y van dentro del GLB."""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'tex')
os.makedirs(OUT, exist_ok=True)
FONT = os.path.join(HERE, 'fonts', 'cinzel-latin-700-normal.ttf')
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def pcb(path, seed=3):
    rnd = random.Random(seed)
    W = 512
    im = Image.new('RGB', (W, W), (18, 74, 44))
    d = ImageDraw.Draw(im)
    # pistas de cobre bajo la máscara
    for _ in range(160):
        x, y = rnd.randrange(W), rnd.randrange(W)
        pts = [(x, y)]
        for _ in range(rnd.randint(2, 5)):
            if rnd.random() < 0.5:
                x += rnd.choice([-1, 1]) * rnd.randint(20, 120)
            else:
                y += rnd.choice([-1, 1]) * rnd.randint(20, 120)
            pts.append((x, y))
        d.line(pts, fill=(44, 120, 66), width=rnd.choice([2, 3, 3, 5]))
        for p in (pts[0], pts[-1]):
            d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], fill=(196, 168, 92))
    # serigrafía
    f = ImageFont.truetype(MONO, 14)
    for i in range(26):
        d.text((rnd.randrange(W - 40), rnd.randrange(W - 20)), rnd.choice(['R', 'C', 'U', 'Q', 'D', 'K']) + str(rnd.randint(1, 64)), fill=(222, 230, 214), font=f)
    d.rectangle([6, 6, W - 7, W - 7], outline=(222, 230, 214), width=2)
    d.text((14, W - 30), 'HO-1962  REV C', fill=(222, 230, 214), font=ImageFont.truetype(MONO, 18))
    # taladros
    for (x, y) in [(20, 20), (W - 20, 20), (20, W - 20), (W - 20, W - 20)]:
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(206, 176, 98))
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(20, 20, 20))
    im.save(path)


def grille(path):
    W = 256
    im = Image.new('RGB', (W, W), (40, 38, 40))
    d = ImageDraw.Draw(im)
    step = 12
    for j in range(0, W + step, step):
        for i in range(0, W + step, step):
            ox = (step / 2) if (j // step) % 2 else 0
            x, y = i + ox, j
            d.ellipse([x - 3.6, y - 3.6, x + 3.6, y + 3.6], fill=(4, 4, 5))
    im.save(path)


def diagram(path):
    """Esquema eléctrico pegado por dentro de la tapa de servicio."""
    W, H = 384, 512
    im = Image.new('RGB', (W, H), (226, 216, 190))
    d = ImageDraw.Draw(im)
    rnd = random.Random(7)
    d.rectangle([8, 8, W - 9, H - 9], outline=(60, 50, 40), width=3)
    d.text((22, 18), 'THE CLASSIC', fill=(40, 30, 24), font=ImageFont.truetype(FONT, 30))
    d.text((22, 58), 'WIRING DIAGRAM  ·  SERVICE ONLY', fill=(90, 30, 30), font=ImageFont.truetype(SANS, 13))
    d.line([(22, 82), (W - 22, 82)], fill=(60, 50, 40), width=2)
    for _ in range(40):
        x, y = rnd.randrange(30, W - 60), rnd.randrange(100, H - 80)
        if rnd.random() < 0.5:
            d.rectangle([x, y, x + rnd.randint(18, 40), y + 14], outline=(40, 30, 24), width=2)
        else:
            d.line([(x, y), (x + rnd.randint(-90, 90), y), (x + rnd.randint(-90, 90), y + rnd.randint(10, 60))], fill=(40, 30, 24), width=2)
    d.text((22, H - 60), '1. OPEN DOOR   2. CHECK FUSES', fill=(40, 30, 24), font=ImageFont.truetype(SANS, 13))
    d.text((22, H - 40), '3. PRESS RESET TO REALIGN REELS', fill=(140, 20, 20), font=ImageFont.truetype(SANS, 13))
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    im.save(path)


def reel_strip(path):
    """Tira de rodillo clásica (7, BAR, cereza, campana) para las máquinas de la sala."""
    W, H = 256, 1024
    im = Image.new('RGB', (W, H), (243, 237, 222))
    d = ImageDraw.Draw(im)
    syms = ['7', 'BAR', 'cherry', 'bell', 'BARBAR', '7', 'cherry', 'bell']
    cell = H // len(syms)
    for i, s in enumerate(syms):
        cy = i * cell + cell // 2
        cx = W // 2
        if s == '7':
            d.text((cx, cy + 6), '7', fill=(178, 18, 40), font=ImageFont.truetype(FONT, 110), anchor='mm', stroke_width=3, stroke_fill=(90, 8, 18))
        elif s.startswith('BAR'):
            n = 2 if s == 'BARBAR' else 1
            for k in range(n):
                y = cy + (k - (n - 1) / 2) * 46
                d.rounded_rectangle([cx - 82, y - 20, cx + 82, y + 20], 6, fill=(20, 18, 22))
                d.text((cx, y + 1), 'BAR', fill=(243, 237, 222), font=ImageFont.truetype(FONT, 30), anchor='mm')
        elif s == 'cherry':
            d.line([(cx - 22, cy + 10), (cx + 4, cy - 46), (cx + 34, cy - 40)], fill=(42, 106, 32), width=7)
            d.line([(cx + 26, cy + 14), (cx + 6, cy - 44)], fill=(42, 106, 32), width=7)
            for (x, y) in [(cx - 26, cy + 22), (cx + 26, cy + 26)]:
                d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(192, 16, 42))
                d.ellipse([x - 14, y - 16, x - 4, y - 6], fill=(255, 150, 160))
        else:
            d.polygon([(cx, cy - 50), (cx + 34, cy - 30), (cx + 44, cy + 26), (cx - 44, cy + 26), (cx - 34, cy - 30)], fill=(216, 165, 42))
            d.ellipse([cx - 10, cy + 22, cx + 10, cy + 42], fill=(170, 120, 20))
            d.line([(cx - 20, cy - 26), (cx - 26, cy + 14)], fill=(255, 230, 150), width=6)
        d.line([(0, i * cell), (W, i * cell)], fill=(212, 200, 172), width=2)
    im.save(path)


def belly_art(path):
    """Cristal de panza de las máquinas de la sala: «LUCKY 7» art déco (sirve para todos los colores)."""
    W, H = 512, 384
    im = Image.new('RGB', (W, H), (14, 10, 12))
    d = ImageDraw.Draw(im)
    for k in range(18):
        a = math.pi * (k / 17)
        d.line([(W / 2, H * 0.98), (W / 2 + math.cos(a) * 700, H * 0.98 - math.sin(a) * 700)], fill=(52, 38, 18), width=10)
    d.rectangle([10, 10, W - 11, H - 11], outline=(212, 175, 55), width=6)
    d.rectangle([22, 22, W - 23, H - 23], outline=(120, 92, 30), width=2)
    d.text((W / 2, H * 0.36), 'LUCKY', fill=(244, 222, 150), font=ImageFont.truetype(FONT, 76), anchor='mm', stroke_width=2, stroke_fill=(90, 60, 10))
    d.text((W / 2, H * 0.7), '7', fill=(214, 40, 56), font=ImageFont.truetype(FONT, 150), anchor='mm', stroke_width=5, stroke_fill=(244, 222, 150))
    for sx in (-1, 1):
        cx = W / 2 + sx * 150
        d.polygon([(cx, H * 0.6), (cx + 18, H * 0.7), (cx, H * 0.8), (cx - 18, H * 0.7)], fill=(212, 175, 55))
    im.save(path)


def top_glass(path):
    W, H = 512, 128
    im = Image.new('RGB', (W, H), (16, 10, 12))
    d = ImageDraw.Draw(im)
    d.rectangle([4, 4, W - 5, H - 5], outline=(212, 175, 55), width=4)
    d.text((W / 2, H / 2 + 4), 'JACKPOT', fill=(250, 236, 196), font=ImageFont.truetype(FONT, 72), anchor='mm', stroke_width=2, stroke_fill=(150, 100, 20))
    im.save(path)


if __name__ == '__main__':
    pcb(os.path.join(OUT, 'pcb.png'))
    grille(os.path.join(OUT, 'grille.png'))
    diagram(os.path.join(OUT, 'diagram.png'))
    reel_strip(os.path.join(OUT, 'reel_strip.png'))
    belly_art(os.path.join(OUT, 'belly.png'))
    top_glass(os.path.join(OUT, 'topglass.png'))
    print('ok')
