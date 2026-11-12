"""
Tragaperras de sala «LUCKY 7» (decorado: la usan los clientes, el jugador no). Un solo modelo; el juego la pinta de
verde, rojo o azul cambiando el material `paint`. Ejecutar:  python scripts/models/slot.py assets/models/slot.glb
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import box, cyl, deco_rect, drum, export, frame_molding, join_static, lathe, mat, profile_curve, quad, reset, ring, shape, text, tube

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')
OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(HERE, '..', '..', 'assets', 'models', 'slot.glb')
reset()

PAINT = mat('paint', 0x1d6b3f, 0.35, 0.3)
CHROME = mat('chrome', 0xc8ccd2, 1, 0.12)
BLACK = mat('black', 0x0a080b, 0, 0.6)
GOLD = mat('gold', 0xd4af37, 1, 0.3)
STEEL = mat('steel', 0x8a8d92, 1, 0.3)
LAMP = mat('lamp', 0x3b2a10, 0, 0.4, 0xffe0a0, 1.6)
BELLY = mat('belly', 0xffffff, 0, 0.35, image=os.path.join(TEX, 'belly.png'))
TOP = mat('topglass', 0xffffff, 0, 0.3, image=os.path.join(TEX, 'topglass.png'))
REEL = mat('reel', 0xffffff, 0, 0.5, image=os.path.join(TEX, 'reel_strip.png'))
RED = mat('knob', 0xb21a2c, 0.1, 0.25)
BTN = [mat(f'btn{i}', c, 0, 0.3) for i, c in enumerate([0xb21a2c, 0xd8a52a, 0x1f6b3f, 0x1a3a8a, 0xd8d4c8])]
PAYLINE = mat('payline', 0x400810, 0, 0.4, 0xff3050, 1.0)
CAVITY = mat('cavity', 0x0b0507, 0, 0.9)

W, D = 0.74, 0.7
HW = W / 2
FZ = D / 2 - 0.04  # frente del cuerpo
hr = profile_curve([(math.cos(a) * 0.008, math.sin(a) * 0.006) for a in [i * math.pi / 6 for i in range(7)]] + [(-0.008, -0.001), (0.008, -0.001)], 'hr')

# zócalo cromado y cuerpo bajo
box(W + 0.04, 0.08, D + 0.04, 0, 0.04, 0, BLACK, r=0.01)
box(W + 0.05, 0.03, D + 0.05, 0, 0.085, 0, CHROME, r=0.008)
box(W, 0.78, D - 0.08, 0, 0.1 + 0.39, -0.04, PAINT, r=0.025)
# panza: cristal con dibujo y marco cromado
box(0.6, 0.42, 0.02, 0, 0.56, FZ + 0.01, BLACK, r=0.006)
quad(0.56, 0.38, 0, 0.56, FZ + 0.021, BELLY, name='belly')
frame_molding(0.58, 0.4, hr, 0, 0.56, FZ + 0.022, CHROME)
# bandeja
box(0.36, 0.1, 0.14, 0, 0.21, FZ + 0.05, CHROME, r=0.025)
box(0.3, 0.06, 0.1, 0, 0.23, FZ + 0.07, BLACK, r=0.015)
# cubierta inclinada con botones
SL = 0.16
box(W, 0.07, 0.3, 0, 0.9, FZ + 0.06, PAINT, r=0.02, rx=SL)
box(W - 0.06, 0.012, 0.24, 0, 0.94, FZ + 0.07, STEEL, r=0.004, rx=SL)
for i, m in enumerate(BTN):
    x = -0.24 + i * 0.12
    box(0.08, 0.012, 0.05, x, 0.948, FZ + 0.14, CHROME, r=0.004, rx=SL)
    box(0.065, 0.02, 0.038, x, 0.957, FZ + 0.14, m, r=0.007, rx=SL)
box(0.08, 0.012, 0.03, 0.22, 0.952, FZ + 0.01, CHROME, r=0.004, rx=SL)
box(0.04, 0.013, 0.006, 0.22, 0.958, FZ + 0.01, BLACK, rx=SL)
tube([(-HW, 0.89, FZ + 0.215), (HW, 0.89, FZ + 0.215)], 0.009, CHROME, smooth_path=False)
# torre de rodillos (hueca) con ventana
Y0, Y1 = 0.93, 1.55
RY = 1.24
WW, WH = 0.54, 0.3
box(W, Y1 - Y0, 0.06, 0, (Y0 + Y1) / 2, -D / 2 + 0.07, PAINT, r=0.01)
for s in (-1, 1):
    box(0.1, Y1 - Y0, D - 0.12, s * (HW - 0.05), (Y0 + Y1) / 2, -0.03, PAINT, r=0.012)
box(WW, Y1 - (RY + WH / 2), D - 0.12, 0, (Y1 + RY + WH / 2) / 2, -0.03, PAINT, r=0.01)
box(WW, (RY - WH / 2) - Y0, D - 0.12, 0, (Y0 + RY - WH / 2) / 2, -0.03, PAINT, r=0.01)
box(WW, WH, 0.01, 0, RY, -0.24, CAVITY)
for i, x in enumerate((-0.17, 0, 0.17)):
    drum(0.15, 0.15, x, RY, -0.06, REEL, seg=40, v0=i * 0.375 + 0.0625)
    for sx in (-1, 1):
        cyl(0.152, 0.152, 0.008, x + sx * 0.079, RY, -0.06, BLACK, seg=40, axis='x')
for x in (-0.085, 0.085):
    box(0.012, WH, 0.04, x, RY, 0.07, BLACK)
quad(WW, 0.008, 0, RY, FZ - 0.025 + 0.004, PAYLINE, name='payline')
shape(deco_rect(WW + 0.12, WH + 0.1, 0.022), 0.022, 0, RY, FZ - 0.02, CHROME, holes=[[(-WW / 2, -WH / 2), (WW / 2, -WH / 2), (WW / 2, WH / 2), (-WW / 2, WH / 2)]], bevel=0.003)
# cabecera con cristal «JACKPOT» y copete
box(W, 0.3, D - 0.12, 0, Y1 + 0.15, -0.06, PAINT, r=0.02)
quad(0.6, 0.15, 0, Y1 + 0.15, FZ - 0.06 + 0.002 + 0.0, TOP, name='topglass')
frame_molding(0.62, 0.17, hr, 0, Y1 + 0.15, FZ - 0.058, CHROME)
box(W + 0.02, 0.03, D - 0.1, 0, Y1 + 0.31, -0.06, CHROME, r=0.01)
lathe([(0, 0), (0.05, 0), (0.05, 0.02), (0.03, 0.03), (0.03, 0.05), (0, 0.05)], 0, Y1 + 0.325, -0.1, CHROME, seg=24)
lathe([(0, 0), (0.04, 0), (0.042, 0.1), (0.03, 0.13), (0, 0.135)], 0, Y1 + 0.37, -0.1, LAMP, seg=24)
# perfiles cromados de las esquinas delanteras
for s in (-1, 1):
    tube([(s * HW, 0.1, FZ + 0.004), (s * HW, 0.86, FZ + 0.004)], 0.008, CHROME, smooth_path=False)
    tube([(s * HW, 0.95, FZ - 0.02), (s * HW, Y1 + 0.3, FZ - 0.05)], 0.008, CHROME, smooth_path=False)
# palanca (derecha)
cyl(0.055, 0.055, 0.05, HW + 0.025, 1.1, -0.05, CHROME, seg=28, axis='x', r=0.008)
cyl(0.03, 0.03, 0.04, HW + 0.065, 1.1, -0.05, BLACK, seg=20, axis='x', r=0.004)
tube([(HW + 0.075, 1.1, -0.05), (HW + 0.085, 1.3, -0.03), (HW + 0.085, 1.48, 0.0)], 0.011, CHROME)
lathe([(0, 0), (0.025, 0.004), (0.04, 0.03), (0.042, 0.05), (0.035, 0.075), (0.015, 0.088), (0, 0.09)], HW + 0.085, 1.46, 0.0, RED, seg=24)
# trasera con rejilla
for k in range(6):
    box(0.4, 0.012, 0.01, 0, 0.5 + k * 0.04, -D / 2 + 0.035, BLACK, r=0.003)

join_static('slot')
export(os.path.abspath(OUT))
