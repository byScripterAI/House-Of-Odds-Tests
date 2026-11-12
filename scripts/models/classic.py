"""
THE CLASSIC — mueble modelado a mano (Blender, bpy). Ejecutar:
    python scripts/models/classic.py assets/models/classic.glb

Lo que se mueve o cambia en el juego va en nodos con nombre:
  SpinButton (pulsador)  ·  ServiceDoor (tapa lateral derecha, bisagra delantera)  ·  ResetButton (seta de reinicio)
  StatusLED (piloto)  ·  Screen, BetScreen, SpinPlate (planos con UV para las texturas de la pantalla)
Los rodillos, el cristal, la línea de pago, las bombillas y las partículas los pone el juego
(src/machines/classic.js) con las mismas medidas que aquí (ventana 1,14 × 0,58 centrada a 1,45 m).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (TAU, box, deco_rect, cut, cyl, empty, export, frame_molding, join_static, lathe, mat, parent_keep, pivot,
                 profile_curve, quad, reset, ring, shape, text, tube)

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')
OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(HERE, '..', '..', 'assets', 'models', 'classic.glb')

reset()

# ---------------------------------------------------------------- materiales (claves que sustituye el juego)
BODY = mat('body', 0x1a1518, 0.5, 0.35)
GOLD = mat('gold', 0xd4af37, 1, 0.26)
VELVET = mat('velvet', 0x5a0d1d, 0, 0.95)
BLACK = mat('black', 0x050304, 0, 0.8)
CAVITY = mat('cavity', 0x0b0507, 0, 0.9)
STEEL = mat('steel', 0x9a9da3, 1, 0.28)
CHROME = mat('chrome', 0xc8ccd2, 1, 0.12)
DARK = mat('dark', 0x1b1a1c, 0.9, 0.4)
STRIP = mat('strip', 0x300509, 0, 0.5, 0xc42240, 1.3)
LAMP = mat('lamp', 0x402810, 0, 0.5, 0xffd9a0, 1.2)
BUTTON = mat('button', 0x8c1226, 0.1, 0.25, 0xff2a48, 0.6)
BUTTON_S = mat('buttonSmall', 0x2a2f36, 0, 0.3, 0x4f6a8c, 0.4)
BAY = mat('bay', 0x2c2e31, 0.7, 0.55)
RUBBER = mat('rubber', 0x0c0c0d, 0, 0.75)
# propios del modelo (se quedan tal cual)
PCB = mat('pcb', 0xffffff, 0.1, 0.45, image=os.path.join(TEX, 'pcb.png'))
GRILLE = mat('grille', 0xffffff, 0.6, 0.5, image=os.path.join(TEX, 'grille.png'))
DIAGRAM = mat('diagram', 0xffffff, 0, 0.85, image=os.path.join(TEX, 'diagram.png'))
YELLOW = mat('yellowPlastic', 0xe8b20e, 0, 0.35)
RESET_RED = mat('reset', 0xb0101e, 0, 0.3, 0xff2030, 0.0)
LED = mat('led', 0x400808, 0, 0.3, 0xff2020, 2.0)
RELAY = mat('relay', 0x3a5f8a, 0.1, 0.25)
WIRES = {k: mat(f'wire{k}', c, 0, 0.45) for k, c in {'Red': 0xb5121e, 'Yellow': 0xd9a90c, 'Black': 0x121214, 'Blue': 0x1f4fa8, 'Green': 0x1d7a3a, 'White': 0xd8d4c8}.items()}
CHIP = mat('chip', 0x111112, 0.2, 0.4)
CAP = mat('capacitor', 0x1d3f8a, 0.3, 0.35)
SCREEN_M = mat('screen', 0x101010, 0, 0.3)

# ---------------------------------------------------------------- medidas
W = 1.44           # ancho del mueble
HW = W / 2
Z0, Z1 = -0.61, 0.41   # fondo y frente del cuerpo inferior
REEL_Y = 1.45
WIN_W, WIN_H = 1.14, 0.58
FRONT = 0.3        # plano frontal de la torre de rodillos
TOWER_Y0, TOWER_Y1 = 1.06, 1.9
HEAD_Y0, HEAD_Y1 = 1.9, 2.5
HEAD_Z0, HEAD_Z1 = -0.62, 0.12
SCR_W, SCR_H, SCR_Y = 1.2, 0.36, 2.2
SLOPE = (1.06 - 0.975) / 0.6


def deck_y(z):
    """Altura de la cubierta de botones (inclinada hacia el jugador)."""
    return 1.06 - (z - 0.2) * SLOPE + 0.012


DECK_RX = math.atan(SLOPE)

# ---------------------------------------------------------------- zócalo
box(1.62, 0.06, 1.12, 0, 0.03, -0.09, BLACK, r=0.01)                      # retranqueo (sombra)
box(1.68, 0.09, 1.2, 0, 0.105, -0.09, BODY, r=0.022)                      # zócalo lacado
box(1.7, 0.022, 1.22, 0, 0.152, -0.09, GOLD, r=0.008)                     # filete de latón

# ---------------------------------------------------------------- cuerpo inferior (con hueco de servicio a la derecha)
lower = box(W, 0.76, Z1 - Z0, 0, 0.163 + 0.38, (Z0 + Z1) / 2, BODY, r=0.02, name='lower')
BAY_Z0, BAY_Z1, BAY_Y0, BAY_Y1 = -0.42, 0.26, 0.24, 0.84
BAY_X = 0.36  # fondo del hueco
cutter = box(0.6, BAY_Y1 - BAY_Y0, BAY_Z1 - BAY_Z0, BAY_X + 0.3, (BAY_Y0 + BAY_Y1) / 2, (BAY_Z0 + BAY_Z1) / 2, None, name='cutter')
cut(lower, cutter)
# forro del hueco (chapa)
by, bz = (BAY_Y0 + BAY_Y1) / 2, (BAY_Z0 + BAY_Z1) / 2
bh, bd = BAY_Y1 - BAY_Y0, BAY_Z1 - BAY_Z0
box(0.012, bh, bd, BAY_X + 0.006, by, bz, BAY)
box(HW + 0.06 - BAY_X, 0.012, bd, (BAY_X + HW + 0.06) / 2, BAY_Y0 + 0.006, bz, BAY)
box(HW + 0.06 - BAY_X, 0.012, bd, (BAY_X + HW + 0.06) / 2, BAY_Y1 - 0.006, bz, BAY)
box(HW + 0.06 - BAY_X, bh, 0.012, (BAY_X + HW + 0.06) / 2, by, BAY_Z0 + 0.006, BAY)
box(HW + 0.06 - BAY_X, bh, 0.012, (BAY_X + HW + 0.06) / 2, by, BAY_Z1 - 0.006, BAY)

# frente: panza con terciopelo, moldura, emblema
box(1.2, 0.5, 0.03, 0, 0.6, Z1 + 0.015, BODY, r=0.012)
box(1.0, 0.38, 0.012, 0, 0.6, Z1 + 0.033, VELVET, r=0.004)
half_round = profile_curve([(math.cos(a) * 0.012, math.sin(a) * 0.009) for a in [i * math.pi / 8 for i in range(9)]] + [(-0.012, -0.002), (0.012, -0.002)], 'hr')
frame_molding(1.03, 0.41, half_round, 0, 0.6, Z1 + 0.03, GOLD)
frame_molding(1.17, 0.47, half_round, 0, 0.6, Z1 + 0.03, GOLD)
# emblema art déco: rombo con abanico
shape([(0, -0.09), (0.11, 0), (0, 0.09), (-0.11, 0)], 0.008, 0, 0.6, Z1 + 0.043, GOLD, holes=[[(0, -0.07), (-0.085, 0), (0, 0.07), (0.085, 0)]], bevel=0.0015)
for k in range(7):
    a = math.pi * (0.15 + 0.7 * k / 6)
    shape([(0, 0), (math.cos(a - 0.05) * 0.06, math.sin(a - 0.05) * 0.06), (math.cos(a + 0.05) * 0.06, math.sin(a + 0.05) * 0.06)], 0.005, 0, 0.565, Z1 + 0.042, GOLD, bevel=0.001)
text('C', 0.06, 0.008, 0, 0.6, Z1 + 0.044, GOLD, bevel=0.0008, res=3)
# esquinas de latón
for s in (-1, 1):
    box(0.018, 0.76, 0.018, s * (HW - 0.004), 0.543, Z1 - 0.004, GOLD, r=0.006)
# altavoces y bandeja
for s in (-1, 1):
    cyl(0.07, 0.07, 0.008, s * 0.42, 0.25, Z1 + 0.004, GRILLE, seg=40, axis='z')
    ring(0.074, 0.008, s * 0.42, 0.25, Z1 + 0.008, CHROME, rx=math.pi / 2)
box(0.5, 0.11, 0.17, 0, 0.245, Z1 + 0.06, STEEL, r=0.03, name='tray')
box(0.44, 0.07, 0.13, 0, 0.27, Z1 + 0.075, BLACK, r=0.02)
tube([(-0.25, 0.3, Z1 + 0.145), (0.25, 0.3, Z1 + 0.145)], 0.008, CHROME, smooth_path=False)
# cerradura de la panza
cyl(0.018, 0.018, 0.02, 0.5, 0.78, Z1 + 0.04, CHROME, seg=24, axis='z', r=0.003)
box(0.004, 0.016, 0.004, 0.5, 0.78, Z1 + 0.051, BLACK)

# relleno entre el cuerpo inferior y la torre
box(W, 0.15, 0.8, 0, 0.995, -0.21, BODY, r=0.01)

# ---------------------------------------------------------------- cubierta de botones (perfil lateral extruido)
deck = [(-0.18, 0.92), (-0.8, 0.92), (-0.84, 0.945), (-0.84, 0.965), (-0.8, 0.975 + 0.0), (-0.2, 1.06), (-0.18, 1.06)]
shape(deck, W, 0, 0, 0, BODY, bevel=0.01, facing='x')
box(W - 0.06, 0.012, 0.6, 0, deck_y(0.5) - 0.006, 0.5, STEEL, r=0.004, rx=DECK_RX)
tube([(-HW + 0.01, 0.955, 0.845), (HW - 0.01, 0.955, 0.845)], 0.012, CHROME, smooth_path=False)
# pulsador central (se hunde al jugar)
bz_ = 0.5
by_ = deck_y(bz_)
lathe([(0, 0), (0.21, 0), (0.215, 0.012), (0.2, 0.026), (0.165, 0.03), (0.16, 0.02), (0, 0.02)], 0, by_, bz_, GOLD, seg=48, rx=DECK_RX)
spin = pivot('SpinButton', 0, by_, bz_)
lathe([(0, 0), (0.15, 0), (0.15, 0.05), (0.145, 0.07), (0.12, 0.09), (0.07, 0.102), (0, 0.105)], 0, by_, bz_, BUTTON, seg=48, rx=DECK_RX, parent=spin)
# botonera pequeña
for x in (-0.55, -0.38, 0.38, 0.55):
    z = 0.66
    y = deck_y(z)
    box(0.11, 0.012, 0.075, x, y, z, CHROME, r=0.004, rx=DECK_RX)
    box(0.09, 0.022, 0.055, x, y + 0.012, z, BUTTON_S, r=0.008, rx=DECK_RX)
# pilotos
for i in range(5):
    z = 0.76
    box(0.045, 0.01, 0.022, -0.2 + i * 0.1, deck_y(z) + 0.002, z, STRIP if i % 2 else LAMP, r=0.003, rx=DECK_RX)
# placa del pulsador (textura del juego)
quad(0.34, 0.075, 0, deck_y(0.72) + 0.002, 0.72, None, facing='y', name='SpinPlate', rx=DECK_RX)
# pantalla de apuesta: carcasa en cuña y plano con UV
lz, lx = 0.38, -0.47
box(0.5, 0.06, 0.2, lx, deck_y(lz) + 0.02, lz, BLACK, r=0.01, rx=-0.45)
frame_molding(0.45, 0.13, half_round, lx, deck_y(lz) + 0.052, lz + 0.01, CHROME, rx=-math.pi / 2 - 0.45)
quad(0.42, 0.118, lx, deck_y(lz) + 0.052, lz + 0.01, None, facing='y', name='BetScreen', rx=-0.45)
# monedero y billetero (derecha)
cx = 0.47
box(0.3, 0.05, 0.16, cx, deck_y(0.38) + 0.018, 0.38, BLACK, r=0.01, rx=-0.45)
box(0.12, 0.016, 0.07, cx - 0.06, deck_y(0.38) + 0.048, 0.39, CHROME, r=0.006, rx=-0.45)
box(0.06, 0.02, 0.006, cx - 0.06, deck_y(0.38) + 0.052, 0.39, BLACK, rx=-0.45)
box(0.11, 0.02, 0.05, cx + 0.08, deck_y(0.38) + 0.048, 0.39, mat('acceptor', 0x0a2014, 0, 0.3, 0x30ff90, 0.8), r=0.006, rx=-0.45)

# ---------------------------------------------------------------- torre de rodillos (hueca) y bisel
TD = FRONT - (-0.62)
TZ = (FRONT + -0.62) / 2
box(W, TOWER_Y1 - TOWER_Y0, 0.1, 0, (TOWER_Y0 + TOWER_Y1) / 2, -0.57, BODY, r=0.015)
for s in (-1, 1):
    box(0.15, TOWER_Y1 - TOWER_Y0, TD, s * (HW - 0.075), (TOWER_Y0 + TOWER_Y1) / 2, TZ, BODY, r=0.015)
topH = TOWER_Y1 - (REEL_Y + WIN_H / 2)
botH = (REEL_Y - WIN_H / 2) - TOWER_Y0
box(WIN_W, topH, TD, 0, TOWER_Y1 - topH / 2, TZ, BODY, r=0.01)
box(WIN_W, botH, TD, 0, TOWER_Y0 + botH / 2, TZ, BODY, r=0.01)
# forro interior oscuro
box(WIN_W, WIN_H, 0.01, 0, REEL_Y, -0.515, CAVITY)
box(WIN_W, 0.006, TD - 0.12, 0, REEL_Y + WIN_H / 2 - 0.003, TZ - 0.05, CAVITY)
box(WIN_W, 0.006, TD - 0.12, 0, REEL_Y - WIN_H / 2 + 0.003, TZ - 0.05, CAVITY)
for s in (-1, 1):
    box(0.006, WIN_H, TD - 0.12, s * (WIN_W / 2 - 0.003), REEL_Y, TZ - 0.05, CAVITY)
# rieles de luz interiores
for y in (REEL_Y + WIN_H / 2 - 0.016, REEL_Y - WIN_H / 2 + 0.016):
    box(WIN_W - 0.02, 0.018, 0.04, 0, y, 0.24, LAMP, r=0.004)
# separadores entre rodillos
for x in (-0.185, 0.185):
    box(0.026, WIN_H, 0.07, x, REEL_Y, 0.25, BLACK, r=0.004)
# bisel art déco escalonado (oro) con ventana
ow, oh = WIN_W + 0.24, WIN_H + 0.2
st = 0.045
outline = deco_rect(ow, oh, st)
win = [(-WIN_W / 2, -WIN_H / 2), (WIN_W / 2, -WIN_H / 2), (WIN_W / 2, WIN_H / 2), (-WIN_W / 2, WIN_H / 2)]
shape(outline, 0.03, 0, REEL_Y, FRONT + 0.015, GOLD, holes=[win], bevel=0.004)
frame_molding(WIN_W + 0.012, WIN_H + 0.012, half_round, 0, REEL_Y, FRONT + 0.03, CHROME)
# casquillos de las bombillas (el juego pone las bombillas en estos puntos)


def perimeter(cx, cy, w, h, n):
    total = 2 * (w + h)
    out = []
    for k in range(n):
        d = (k / n) * total
        if d < w:
            x, y = -w / 2 + d, h / 2
        elif (d := d - w) < h:
            x, y = w / 2, h / 2 - d
        elif (d := d - h) < w:
            x, y = w / 2 - d, -h / 2
        else:
            d -= w
            x, y = -w / 2, -h / 2 + d
        out.append((cx + x, cy + y))
    return out


socket = [(0, 0), (0.017, 0), (0.019, 0.006), (0.016, 0.012), (0.013, 0.012), (0.013, 0.004), (0, 0.004)]
for (x, y) in perimeter(0, REEL_Y, WIN_W + 0.2, WIN_H + 0.2, 34):
    lathe(socket, x, y, FRONT + 0.03, CHROME, seg=14, rx=math.pi / 2)
# cornisa entre torre y cabecera
box(W + 0.02, 0.04, 0.12, 0, TOWER_Y1, FRONT - 0.05, GOLD, r=0.012)

# ---------------------------------------------------------------- cabecera con pantalla
box(W, HEAD_Y1 - HEAD_Y0, HEAD_Z1 - HEAD_Z0, 0, (HEAD_Y0 + HEAD_Y1) / 2, (HEAD_Z0 + HEAD_Z1) / 2, BODY, r=0.018)
sw, sh = SCR_W + 0.2, SCR_H + 0.14
souter = deco_rect(sw, sh, st)
shole = [(-SCR_W / 2, -SCR_H / 2), (SCR_W / 2, -SCR_H / 2), (SCR_W / 2, SCR_H / 2), (-SCR_W / 2, SCR_H / 2)]
shape(souter, 0.03, 0, SCR_Y, HEAD_Z1 + 0.015, GOLD, holes=[shole], bevel=0.004)
box(SCR_W + 0.02, SCR_H + 0.02, 0.02, 0, SCR_Y, HEAD_Z1 - 0.004, BLACK)
quad(SCR_W, SCR_H, 0, SCR_Y, HEAD_Z1 + 0.004, SCREEN_M, name='Screen')
for (x, y) in perimeter(0, SCR_Y, SCR_W + 0.2, SCR_H + 0.12, 28):
    lathe(socket, x, y, HEAD_Z1 + 0.03, CHROME, seg=14, rx=math.pi / 2)

# ---------------------------------------------------------------- corona art déco
AW, AH = 0.7, 0.34
CZ0, CZ1 = -0.5, 0.12
arch = [(HW, 0)] + [(math.cos(i / 40 * math.pi) * AW, 0.04 + math.sin(i / 40 * math.pi) * AH) for i in range(41)] + [(-HW, 0)]
shape(arch, CZ1 - CZ0, 0, HEAD_Y1, (CZ0 + CZ1) / 2, BODY, bevel=0.008)
# aro dorado del arco
outer = [(math.cos(i / 48 * math.pi) * (AW + 0.03), 0.04 + math.sin(i / 48 * math.pi) * (AH + 0.03)) for i in range(49)]
inner = [(math.cos(i / 48 * math.pi) * (AW - 0.03), 0.04 + math.sin(i / 48 * math.pi) * (AH - 0.03)) for i in range(48, -1, -1)]
shape(outer + inner, CZ1 - CZ0 + 0.02, 0, HEAD_Y1, (CZ0 + CZ1) / 2, GOLD, bevel=0.004)
# rayos de sol
for k in range(13):
    a = math.pi * (0.06 + 0.88 * k / 12)
    r0, r1 = 0.16, AH * 0.95
    w0, w1 = 0.012, 0.035
    ca, sa = math.cos(a), math.sin(a)
    px, py = -sa, ca
    pts = [(ca * r0 + px * w0, sa * r0 + py * w0), (ca * r1 * AW / AH * 0.93 + px * w1, sa * r1 + py * w1), (ca * r1 * AW / AH * 0.93 - px * w1, sa * r1 - py * w1), (ca * r0 - px * w0, sa * r0 - py * w0)]
    shape(pts, 0.008 if k % 2 == 0 else 0.004, 0, HEAD_Y1 + 0.04, CZ1 + 0.012, GOLD, bevel=0.0015)
# sol central
lathe([(0, 0), (0.14, 0), (0.14, 0.012), (0.125, 0.02), (0, 0.024)], 0, HEAD_Y1 + 0.04, CZ1, GOLD, seg=48, rx=math.pi / 2)
# placa con el nombre en letras de latón
plate = [(-0.46, -0.075), (0.46, -0.075), (0.5, -0.035), (0.5, 0.035), (0.46, 0.075), (-0.46, 0.075), (-0.5, 0.035), (-0.5, -0.035)]
PY = HEAD_Y1 + 0.075
shape(plate, 0.025, 0, PY, CZ1 + 0.03, BLACK, bevel=0.004)
ring_pts = [(x * 1.04, y * 1.14) for x, y in plate]
shape(ring_pts, 0.02, 0, PY, CZ1 + 0.026, GOLD, holes=[plate[::-1]], bevel=0.003)
text('THE CLASSIC', 0.082, 0.012, 0, PY - 0.004, CZ1 + 0.048, GOLD, bevel=0.0012, spacing=1.08)
# remate: aguja con luz de servicio
top = HEAD_Y1 + 0.04 + AH + 0.03
lathe([(0, 0), (0.07, 0), (0.07, 0.02), (0.045, 0.035), (0.04, 0.09), (0.055, 0.1), (0.03, 0.12), (0, 0.12)], 0, top - 0.02, (CZ0 + CZ1) / 2 + 0.05, GOLD, seg=32)
lathe([(0, 0), (0.035, 0), (0.035, 0.08), (0.02, 0.1), (0, 0.105)], 0, top + 0.1, (CZ0 + CZ1) / 2 + 0.05, LAMP, seg=24)

# ---------------------------------------------------------------- costados: silueta lacada con canto de latón y filete de luz
side = [(0.68, 0.0), (-0.47, 0.0), (-0.47, 0.9), (-0.85, 0.925), (-0.85, 1.0), (-0.36, 1.08), (-0.36, 1.93), (-0.15, 1.96), (-0.15, HEAD_Y1), (0.68, HEAD_Y1)]
door_hole = [(-BAY_Z1, BAY_Y0), (-BAY_Z0, BAY_Y0), (-BAY_Z0, BAY_Y1), (-BAY_Z1, BAY_Y1)]
for s in (-1, 1):
    x = s * (HW + 0.025)
    holes = [door_hole[::-1]] if s > 0 else []
    shape(side, 0.05, x, 0, 0, BODY, holes=holes, bevel=0.01, facing='x')
    # canto de latón por el perfil delantero
    edge = [(x + s * 0.027, y, -u) for (u, y) in side[1:9]]
    tube(edge, 0.009, GOLD, smooth_path=False)
    # filete de luz (el juego lo hace latir)
    tube([(x + s * 0.03, 0.12, 0.42), (x + s * 0.03, 0.9, 0.42)], 0.006, STRIP, smooth_path=False)
    tube([(x + s * 0.03, 1.15, 0.31), (x + s * 0.03, 1.9, 0.31)], 0.006, STRIP, smooth_path=False)
    # marco del hueco de servicio
    if s > 0:
        frame_molding(BAY_Z1 - BAY_Z0 + 0.02, BAY_Y1 - BAY_Y0 + 0.02, half_round, x + 0.026, (BAY_Y0 + BAY_Y1) / 2, (BAY_Z0 + BAY_Z1) / 2, GOLD, ry=math.pi / 2)

# ---------------------------------------------------------------- tapa de servicio (bisagra en el canto delantero)
DX = HW + 0.05
door = pivot('ServiceDoor', DX, 0, BAY_Z1)
dz = (BAY_Z0 + BAY_Z1) / 2
dw = BAY_Z1 - BAY_Z0 - 0.006
box(0.025, bh - 0.006, dw, DX - 0.012, by, dz, BODY, r=0.006, parent=door)
frame_molding(dw - 0.08, bh - 0.08, half_round, DX + 0.001, by, dz, GOLD, ry=math.pi / 2, parent=door)
for k in range(6):  # rejilla de ventilación
    box(0.012, 0.012, 0.32, DX + 0.004, by - 0.13 + k * 0.03, dz - 0.05, GOLD, r=0.004, rx=0.0, parent=door)
cyl(0.016, 0.016, 0.02, DX + 0.006, by + 0.16, BAY_Z0 + 0.08, CHROME, seg=24, axis='x', r=0.003, parent=door)
box(0.004, 0.014, 0.003, DX + 0.017, by + 0.16, BAY_Z0 + 0.08, BLACK, parent=door)
box(0.012, 0.05, 0.016, DX + 0.006, by, BAY_Z0 + 0.06, CHROME, r=0.005, parent=door)  # tirador
box(0.004, 0.05, 0.16, DX + 0.002, by + 0.2, dz + 0.04, GOLD, r=0.002, parent=door)     # placa
text('SERVICE', 0.026, 0.003, DX + 0.006, by + 0.2, dz + 0.04, BLACK, ry=math.pi / 2, parent=door, bevel=0, res=2)
quad(0.26, 0.34, DX - 0.026, by, dz, DIAGRAM, facing='x', name='diagram', ry=math.pi, parent=door)  # esquema por dentro
for y in (BAY_Y0 + 0.06, BAY_Y1 - 0.06):  # bisagras
    cyl(0.008, 0.008, 0.06, DX, y, BAY_Z1 - 0.004, CHROME, seg=12)

# ---------------------------------------------------------------- interior de servicio
IX = BAY_X + 0.012
pcb_y, pcb_z = by + 0.08, dz - 0.08
box(0.01, 0.3, 0.36, IX + 0.03, pcb_y, pcb_z, BAY)  # placa de montaje
quad(0.34, 0.28, IX + 0.036, pcb_y, pcb_z, PCB, facing='x', name='pcb')
for (yy, zz) in [(pcb_y + 0.13, pcb_z - 0.16), (pcb_y + 0.13, pcb_z + 0.16), (pcb_y - 0.13, pcb_z - 0.16), (pcb_y - 0.13, pcb_z + 0.16)]:
    cyl(0.006, 0.006, 0.02, IX + 0.03, yy, zz, CHROME, seg=10, axis='x')
import random
rnd = random.Random(4)
for k in range(9):  # chips
    box(0.008, 0.03 + rnd.random() * 0.03, 0.05 + rnd.random() * 0.04, IX + 0.043, pcb_y - 0.1 + (k % 3) * 0.08, pcb_z - 0.1 + (k // 3) * 0.09, CHIP, r=0.002)
for k in range(7):  # condensadores
    cyl(0.009, 0.009, 0.03, IX + 0.054, pcb_y + 0.11, pcb_z - 0.12 + k * 0.035, CAP, seg=14, axis='x', r=0.002)
# relés y regleta
for k in range(4):
    box(0.04, 0.05, 0.035, IX + 0.03, BAY_Y0 + 0.07, BAY_Z0 + 0.08 + k * 0.05, RELAY, r=0.004)
box(0.03, 0.03, 0.5, IX + 0.02, BAY_Y1 - 0.06, dz, BLACK, r=0.004)
for k in range(10):
    cyl(0.006, 0.006, 0.008, IX + 0.037, BAY_Y1 - 0.06, dz - 0.22 + k * 0.049, STEEL, seg=10, axis='x')
# mazos de cables (de la regleta a la placa y hacia la torre)
cols = list(WIRES.values())
for k in range(10):
    z0 = dz - 0.22 + k * 0.049
    m = cols[k % len(cols)]
    tube([(IX + 0.04, BAY_Y1 - 0.06, z0), (IX + 0.07 + 0.01 * (k % 3), BAY_Y1 - 0.1, z0 + 0.02), (IX + 0.08, pcb_y + 0.17, pcb_z + 0.05 * (k % 4 - 1.5)), (IX + 0.05, pcb_y + 0.14, pcb_z - 0.1 + k * 0.02)], 0.0045, m)
for k in range(6):
    m = cols[(k + 2) % len(cols)]
    tube([(IX + 0.05, pcb_y - 0.14, pcb_z + 0.15 - k * 0.012), (IX + 0.09, BAY_Y0 + 0.12, pcb_z + 0.22), (IX + 0.07, BAY_Y0 + 0.1, BAY_Z0 + 0.1 + k * 0.05)], 0.004, m)
# transformador y portafusibles en el suelo del hueco
TRAFO = mat('trafo', 0x6b4a2a, 0.9, 0.35)
box(0.12, 0.1, 0.12, IX + 0.08, BAY_Y0 + 0.062, BAY_Z0 + 0.12, BAY, r=0.006)
cyl(0.045, 0.045, 0.07, IX + 0.08, BAY_Y0 + 0.07, BAY_Z0 + 0.12, TRAFO, seg=24, axis='z', r=0.006)
for k in range(4):
    box(0.035, 0.03, 0.03, IX + 0.03, BAY_Y0 + 0.03, dz + 0.02 + k * 0.04, BLACK, r=0.004)
    cyl(0.007, 0.007, 0.03, IX + 0.03, BAY_Y0 + 0.052, dz + 0.02 + k * 0.04, mat('fuse', 0xd8d4c8, 0.2, 0.2), seg=12, axis='z')
# seta de reinicio sobre caja amarilla, y piloto
rz_, ry_ = BAY_Z1 - 0.12, BAY_Y0 + 0.17
box(0.06, 0.12, 0.11, IX + 0.03, ry_, rz_, YELLOW, r=0.01)
text('RESET', 0.018, 0.002, IX + 0.061, ry_ - 0.045, rz_, BLACK, ry=math.pi / 2, bevel=0, res=2)
ring(0.03, 0.006, IX + 0.062, ry_ + 0.01, rz_, CHROME, rz=math.pi / 2)
rb = pivot('ResetButton', IX + 0.062, ry_ + 0.01, rz_)
lathe([(0, 0), (0.016, 0), (0.016, 0.018), (0.034, 0.024), (0.036, 0.034), (0.03, 0.044), (0, 0.048)], IX + 0.062, ry_ + 0.01, rz_, RESET_RED, seg=32, rz=-math.pi / 2, parent=rb)
led = lathe([(0, 0), (0.008, 0), (0.008, 0.006), (0.006, 0.011), (0, 0.013)], IX + 0.062, ry_ + 0.08, rz_, LED, seg=16, rz=-math.pi / 2, name='StatusLED')
cyl(0.011, 0.011, 0.004, IX + 0.062, ry_ + 0.08, rz_, CHROME, seg=16, axis='x')

# ---------------------------------------------------------------- trasera: rejillas y cable de corriente
for k in range(8):
    box(0.7, 0.014, 0.012, 0, 0.5 + k * 0.045, Z0 - 0.004, BLACK, r=0.004)
tube([(0.4, 0.25, Z0 - 0.01), (0.42, 0.12, Z0 - 0.08), (0.5, 0.012, Z0 - 0.25), (0.7, 0.012, Z0 - 0.5)], 0.008, RUBBER)

join_static('classic')
export(os.path.abspath(OUT))
