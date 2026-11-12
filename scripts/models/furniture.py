"""
Mobiliario del casino modelado a mano (Blender): taburete, mesa de blackjack, mesa de ruleta, banco tapizado,
lámpara de pie art déco y pedestal. Un GLB por pieza en assets/models/.
Ejecutar:  python scripts/models/furniture.py assets/models
Las claves de material (brass, lacquer, seat, felt, woodDark…) las sustituye el juego por los suyos.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import TAU, box, cyl, export, frame_molding, join_static, lathe, mat, pivot, profile_curve, reset, ring, shape, tube  # noqa: E402

OUT = sys.argv[-1] if not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models')


def mats():
    return dict(
        brass=mat('brass', 0xd9b986, 1, 0.3), lacquer=mat('lacquer', 0x0b0709, 0, 0.3), black=mat('black', 0x0a080b, 0, 0.6),
        seat=mat('seat', 0x6a0f20, 0, 0.8), gold=mat('gold', 0xd4af37, 1, 0.3), wood=mat('woodDark', 0x3a2212, 0, 0.5),
        leather=mat('leather', 0x2a1510, 0, 0.55), felt=mat('felt', 0x0d5a32, 0, 1.0), steel=mat('steel', 0x8a8d92, 1, 0.35),
        chrome=mat('chrome', 0xc8ccd2, 1, 0.12), marble=mat('marbleLight', 0xb8afa1, 0, 0.26), shade=mat('shade', 0x3a2410, 0, 0.6, 0xffc070, 1.3),
        paper=mat('paper', 0xb9b2a2, 0, 1.0),
    )


def tufted_cushion(cx, cy, cz, R, H, M, key='seat', buttons=True):
    """Cojín redondo capitoné con ribete y botones."""
    prof = [(0, 0), (R * 0.88, 0), (R * 0.98, H * 0.18), (R, H * 0.5), (R * 0.97, H * 0.78), (R * 0.85, H * 0.95), (R * 0.5, H * 1.02), (0, H * 1.04)]
    lathe(prof, cx, cy, cz, M[key], seg=22)
    ring(R * 0.99, 0.006, cx, cy + H * 0.5, cz, M['brass'], seg=22, rseg=4)
    if buttons:
        for k in range(6):
            a = k / 6 * TAU
            lathe([(0, 0), (0.012, 0), (0.011, 0.006), (0, 0.009)], cx + math.cos(a) * R * 0.5, cy + H * 0.98, cz + math.sin(a) * R * 0.5, M['brass'], seg=6)
        lathe([(0, 0), (0.012, 0), (0.011, 0.006), (0, 0.009)], cx, cy + H * 1.02, cz, M['brass'], seg=6)


# ------------------------------------------------------------------ taburete (con respaldo opcional: nodo «Back»)
def stool():
    reset()
    M = mats()
    lathe([(0, 0), (0.215, 0), (0.222, 0.008), (0.215, 0.018), (0.19, 0.03), (0.12, 0.05), (0.06, 0.062), (0, 0.064)], 0, 0, 0, M['lacquer'], seg=20)
    ring(0.218, 0.006, 0, 0.012, 0, M['brass'], seg=20)
    lathe([(0, 0), (0.07, 0), (0.07, 0.015), (0.05, 0.03), (0, 0.03)], 0, 0.06, 0, M['brass'], seg=20)
    cyl(0.024, 0.03, 0.4, 0, 0.27, 0, M['brass'], seg=20)
    lathe([(0, 0), (0.04, 0), (0.046, 0.012), (0.04, 0.024), (0, 0.024)], 0, 0.24, 0, M['brass'], seg=12)  # collarín
    ring(0.17, 0.011, 0, 0.27, 0, M['brass'], seg=20, rseg=6)  # reposapiés
    for k in range(4):
        a = k / 4 * TAU + math.pi / 4
        tube([(math.cos(a) * 0.03, 0.27, math.sin(a) * 0.03), (math.cos(a) * 0.165, 0.27, math.sin(a) * 0.165)], 0.007, M['brass'], smooth_path=False, res=1)
    lathe([(0, 0), (0.12, 0), (0.15, 0.025), (0.16, 0.035), (0, 0.035)], 0, 0.46, 0, M['black'], seg=20)
    tufted_cushion(0, 0.49, 0, 0.2, 0.09, M)
    # respaldo curvo tapizado sobre dos varillas de latón
    back = pivot('Back', 0, 0, 0)
    for s in (-1, 1):
        tube([(s * 0.12, 0.5, -0.15), (s * 0.13, 0.62, -0.18), (s * 0.13, 0.8, -0.2)], 0.011, M['brass'], parent=back, res=1)
    a0, a1 = math.radians(38), math.radians(142)
    R, Rin = 0.24, 0.19
    pts = [(math.cos(a0 + (a1 - a0) * i / 16) * R, math.sin(a0 + (a1 - a0) * i / 16) * R) for i in range(17)]
    pts += [(math.cos(a1 - (a1 - a0) * i / 16) * Rin, math.sin(a1 - (a1 - a0) * i / 16) * Rin) for i in range(17)]
    # silueta del respaldo en planta, extruida en altura → placa curva
    shape(pts, 0.24, 0, 0.84, 0, M['seat'], bevel=0.018, bres=2, facing='y', parent=back)
    ring_pts = [(math.cos(a0 + (a1 - a0) * i / 16) * (R + 0.004), 0.84 + 0.12, math.sin(a0 + (a1 - a0) * i / 16) * (R + 0.004)) for i in range(17)]
    tube([(x, y, -z) for x, y, z in ring_pts], 0.006, M['brass'], smooth_path=False, parent=back, res=1)
    join_static('stool')
    export(os.path.join(OUT, 'stool.glb'))


# ------------------------------------------------------------------ mesa de blackjack
def blackjack():
    reset()
    M = mats()
    # silueta: borde recto del crupier en z = -0.75 y arco hacia +z (igual que la mesa jugable)
    def outline(rx, rz, n=30):
        pts = [(-rx, 0.75), (rx, 0.75)]
        for i in range(n + 1):
            a = i / n * math.pi
            pts.append((math.cos(a) * rx, 0.75 - math.sin(a) * rz))
        return pts  # (x, -z)
    def to_y(pts):
        return [(x, y) for x, y in pts]
    # cuerpo: faldón de madera con paneles
    shape(to_y(outline(1.42, 1.38)), 0.62, 0, 0.47, 0, M['wood'], bevel=0.012, facing='y')
    shape(to_y(outline(1.36, 1.32)), 0.16, 0, 0.08, 0, M['lacquer'], bevel=0.01, facing='y')  # zócalo
    shape(to_y(outline(1.48, 1.44)), 0.03, 0, 0.17, 0, M['brass'], bevel=0.005, facing='y')
    # tablero y paño
    shape(to_y(outline(1.55, 1.58)), 0.05, 0, 0.805, 0, M['wood'], bevel=0.008, facing='y')
    shape(to_y(outline(1.5, 1.53)), 0.03, 0, 0.912, 0, M['felt'], bevel=0.004, facing='y')
    # reposabrazos de cuero: barrido de perfil redondeado por el arco
    prof = profile_curve([(math.cos(a) * 0.07, math.sin(a) * 0.045) for a in [i * TAU / 16 for i in range(16)]], 'arm')
    arc = []
    for i in range(31):
        a = i / 30 * math.pi
        arc.append((math.cos(a) * 1.565, 0.915, -(0.75 - math.sin(a) * 1.6)))
    tube(arc, 0, M['leather'], smooth_path=True, profile=prof)
    tube([(x, 0.862, z) for x, _, z in arc], 0.009, M['gold'], smooth_path=True)  # filete dorado bajo el cuero
    # canto recto del crupier con moldura
    box(3.14, 0.06, 0.05, 0, 0.88, -0.77, M['wood'], r=0.015)
    box(3.16, 0.012, 0.055, 0, 0.85, -0.77, M['gold'], r=0.004)
    # bandeja de fichas encastrada y zapato de cartas
    box(1.12, 0.03, 0.24, 0, 0.918, -0.6, M['steel'], r=0.01)
    for k in range(10):
        box(0.07, 0.012, 0.2, -0.47 + k * 0.105, 0.932, -0.6, M['black'], r=0.004)
    box(0.18, 0.09, 0.11, 0.9, 0.97, -0.48, M['lacquer'], r=0.014)
    box(0.15, 0.012, 0.09, 0.9, 1.018, -0.48, M['paper'], r=0.002, rx=-0.25)
    box(0.12, 0.05, 0.1, -0.9, 0.95, -0.5, M['lacquer'], r=0.01)  # descartes
    # patas torneadas bajo el tablero (delante) — se ven entre el faldón y el suelo
    for a in (0.35, 1.2, 1.94, 2.79):
        x, z = math.cos(a) * 1.3, -(0.75 - math.sin(a) * 1.26)
        lathe([(0, 0), (0.05, 0), (0.05, 0.02), (0.035, 0.04), (0.035, 0.1), (0.045, 0.12), (0, 0.12)], x, 0, z, M['brass'], seg=20)
    join_static('blackjack')
    export(os.path.join(OUT, 'blackjack_table.glb'))


# ------------------------------------------------------------------ mesa de ruleta (hueco para la rueda en +X)
def roulette():
    reset()
    M = mats()
    W, D = 3.1, 1.4
    def rrect(w, d, r, n=8):
        pts = []
        for (cx, cy, a0) in [(w / 2 - r, -d / 2 + r, -math.pi / 2), (w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, math.pi / 2), (-w / 2 + r, -d / 2 + r, math.pi)]:
            for i in range(n + 1):
                a = a0 + i / n * math.pi / 2
                pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        return pts
    # faldón con paneles y zócalo
    shape(rrect(W - 0.1, D - 0.1, 0.3), 0.56, 0, 0.42, 0, M['wood'], bevel=0.012, facing='y')
    shape(rrect(W - 0.2, D - 0.2, 0.26), 0.12, 0, 0.06, 0, M['lacquer'], bevel=0.01, facing='y')
    shape(rrect(W - 0.02, D - 0.02, 0.34), 0.025, 0, 0.14, 0, M['brass'], bevel=0.004, facing='y')
    for s in (-1, 1):
        for k in range(3):
            box(0.8, 0.34, 0.012, -0.95 + k * 0.95, 0.43, s * (D / 2 - 0.045), M['wood'], r=0.01)
            frame_molding(0.74, 0.28, profile_curve([(0, 0), (0.008, 0), (0.008, 0.006), (0, 0.006)], 'p'), -0.95 + k * 0.95, 0.43, s * (D / 2 - 0.035), M['gold'], ry=0 if s > 0 else math.pi)
    # tablero, paño y reposabrazos perimetral
    shape(rrect(W + 0.1, D + 0.1, 0.4), 0.06, 0, 0.8, 0, M['wood'], bevel=0.01, facing='y')
    shape(rrect(W, D, 0.34), 0.03, 0, 0.885, 0, M['felt'], bevel=0.004, facing='y')
    prof = profile_curve([(math.cos(a) * 0.07, math.sin(a) * 0.045) for a in [i * TAU / 16 for i in range(16)]], 'arm')
    path = [(x, 0.875, -y) for x, y in rrect(W + 0.06, D + 0.06, 0.38, 10)]
    tube(path, 0, M['leather'], smooth_path=False, cyclic=True, profile=prof)
    tube([(x, 0.822, z) for x, _, z in path], 0.009, M['gold'], smooth_path=False, cyclic=True)
    # cuenco de la rueda (la rueda que gira la pone el juego encima)
    lathe([(0, 0), (0.6, 0), (0.62, 0.03), (0.6, 0.06), (0, 0.06)], 1.15, 0.86, 0, M['wood'], seg=56)
    ring(0.615, 0.012, 1.15, 0.92, 0, M['gold'], seg=56)
    # patas torneadas
    for x in (-1.3, 0, 1.3):
        for z in (-0.5, 0.5):
            lathe([(0, 0), (0.05, 0), (0.05, 0.02), (0.035, 0.04), (0.035, 0.08), (0.045, 0.1), (0, 0.1)], x, 0, z, M['brass'], seg=20)
    join_static('roulette')
    export(os.path.join(OUT, 'roulette_table.glb'))


# ------------------------------------------------------------------ banco tapizado capitoné
def bench():
    reset()
    M = mats()
    box(1.62, 0.07, 0.52, 0, 0.4, 0, M['wood'], r=0.02)
    box(1.64, 0.012, 0.54, 0, 0.37, 0, M['gold'], r=0.004)
    box(1.52, 0.12, 0.46, 0, 0.49, 0, M['seat'], r=0.05, seg=4)
    for i in range(7):
        for j in range(2):
            lathe([(0, 0), (0.011, 0), (0.01, 0.005), (0, 0.008)], -0.6 + i * 0.2, 0.549, -0.1 + j * 0.2, M['brass'], seg=8)
    tube([(-0.76, 0.43, 0.23), (0.76, 0.43, 0.23)], 0.006, M['brass'], smooth_path=False)
    for s in (-1, 1):
        for z in (-1, 1):
            lathe([(0, 0), (0.03, 0), (0.03, 0.015), (0.02, 0.03), (0.024, 0.3), (0.034, 0.34), (0.03, 0.365), (0, 0.365)], s * 0.7, 0, z * 0.18, M['brass'], seg=16)
    join_static('bench')
    export(os.path.join(OUT, 'bench.glb'))


# ------------------------------------------------------------------ lámpara de pie art déco (pantalla escalonada)
def floor_lamp():
    reset()
    M = mats()
    lathe([(0, 0), (0.2, 0), (0.21, 0.015), (0.19, 0.03), (0.12, 0.045), (0.06, 0.06), (0, 0.06)], 0, 0, 0, M['brass'], seg=40)
    lathe([(0, 0), (0.16, 0), (0.16, 0.01), (0, 0.01)], 0, 0.006, 0, M['black'], seg=40)
    cyl(0.014, 0.016, 1.38, 0, 0.75, 0, M['brass'], seg=14)
    for y in (0.45, 0.95):
        lathe([(0, 0), (0.026, 0), (0.03, 0.012), (0.026, 0.024), (0, 0.024)], 0, y, 0, M['brass'], seg=20)
    lathe([(0, 0), (0.04, 0), (0.05, 0.03), (0.04, 0.06), (0, 0.06)], 0, 1.42, 0, M['brass'], seg=20)
    # pantalla: tres anillos escalonados de cristal ámbar con filo de latón
    for i, (r0, r1, h) in enumerate([(0.12, 0.17, 0.08), (0.17, 0.22, 0.08), (0.22, 0.26, 0.07)]):
        y = 1.47 + i * 0.075
        lathe([(r0, 0), (r1, h), (r1 - 0.004, h), (r0 - 0.004, 0)], 0, y, 0, M['shade'], seg=40)
        ring(r1, 0.004, 0, y + h, 0, M['brass'], seg=40, rseg=6)
    join_static('lamp')
    export(os.path.join(OUT, 'floor_lamp.glb'))


# ------------------------------------------------------------------ pedestal de mármol (conjuntos de decoración)
def pedestal():
    reset()
    M = mats()
    box(0.48, 0.08, 0.48, 0, 0.04, 0, M['marble'], r=0.012)
    box(0.5, 0.014, 0.5, 0, 0.087, 0, M['brass'], r=0.004)
    box(0.42, 0.04, 0.42, 0, 0.114, 0, M['marble'], r=0.01)
    # fuste acanalado
    cyl(0.13, 0.15, 0.72, 0, 0.5, 0, M['marble'], seg=40)
    for k in range(16):
        a = k / 16 * TAU
        box(0.012, 0.66, 0.012, math.cos(a) * 0.136, 0.5, math.sin(a) * 0.136, M['brass'], r=0.004)
    box(0.42, 0.04, 0.42, 0, 0.885, 0, M['marble'], r=0.01)
    box(0.5, 0.014, 0.5, 0, 0.911, 0, M['brass'], r=0.004)
    box(0.48, 0.035, 0.48, 0, 0.933, 0, M['marble'], r=0.01)
    join_static('pedestal')
    export(os.path.join(OUT, 'pedestal.glb'))


# ------------------------------------------------------------------ escultura dorada: esfera armilar sobre peana escalonada
def statue():
    reset()
    M = mats()
    marble = mat('marble', 0x2a2526, 0, 0.25)
    # peana escalonada de mármol con filetes de latón
    box(1.04, 0.14, 1.04, 0, 0.07, 0, marble, r=0.02)
    box(1.06, 0.018, 1.06, 0, 0.15, 0, M['brass'], r=0.005)
    box(0.9, 0.12, 0.9, 0, 0.22, 0, marble, r=0.02)
    box(0.74, 0.78, 0.74, 0, 0.67, 0, marble, r=0.025)
    for s_ in (-1, 1):
        for axis in ('x', 'z'):
            # panel de latón con rayos en cada cara
            off = s_ * 0.372
            x, z = (off, 0) if axis == 'x' else (0, off)
            box(0.012 if axis == 'x' else 0.5, 0.56, 0.5 if axis == 'x' else 0.012, x, 0.67, z, M['gold'], r=0.004)
    box(0.86, 0.06, 0.86, 0, 1.09, 0, M['gold'], r=0.015)
    box(0.7, 0.05, 0.7, 0, 1.145, 0, marble, r=0.012)
    # pie de la esfera: tres patas curvas de latón
    C = 2.12
    for k in range(3):
        a = k / 3 * TAU
        ca, sa = math.cos(a), math.sin(a)
        tube([(ca * 0.26, 1.17, sa * 0.26), (ca * 0.3, 1.35, sa * 0.3), (ca * 0.2, 1.55, sa * 0.2), (ca * 0.05, 1.66, sa * 0.05)], 0.018, M['gold'])
    lathe([(0, 0), (0.09, 0), (0.09, 0.02), (0.05, 0.05), (0.04, 0.12), (0.06, 0.15), (0, 0.15)], 0, 1.62, 0, M['gold'], seg=28)
    # anillos: ecuador ancho, dos meridianos, eclíptica inclinada y eje
    R = 0.46
    ring(R, 0.028, 0, C, 0, M['gold'], seg=72, rseg=8)
    ring(R, 0.016, 0, C, 0, M['gold'], seg=72, rseg=8, rx=math.pi / 2)
    ring(R, 0.016, 0, C, 0, M['gold'], seg=72, rseg=8, rx=math.pi / 2, ry=math.pi / 2)
    ring(R * 0.93, 0.03, 0, C, 0, M['brass'], seg=72, rseg=6, rz=0.41)
    for k in range(24):
        a = k / 24 * TAU
        box(0.012, 0.03, 0.012, math.cos(a) * (R + 0.03), C, math.sin(a) * (R + 0.03), M['brass'], r=0.003, ry=-a)
    tube([(0, C - R - 0.12, 0), (0, C + R + 0.12, 0)], 0.012, M['gold'], smooth_path=False)
    lathe([(0, 0), (0.035, 0), (0.04, 0.03), (0.02, 0.07), (0, 0.11)], 0, C + R + 0.1, 0, M['gold'], seg=20)
    join_static('statue')
    export(os.path.join(OUT, 'statue.glb'))


# ------------------------------------------------------------------ tablero de herramientas de Daniel (pared) y flexo
def pegboard():
    reset()
    M = mats()
    board = mat('pegboard', 0x8a6a48, 0, 0.8)
    red = mat('toolRed', 0xa8202a, 0.3, 0.45)
    yellow = mat('toolYellow', 0xd9a90c, 0.1, 0.4)
    W, H = 1.9, 0.95
    Y = 1.8
    Z = -0.36
    # marco de madera y tablero perforado (agujeros como pequeñas piezas oscuras)
    box(W + 0.06, H + 0.06, 0.03, 0, Y, Z - 0.005, M['wood'], r=0.008)
    box(W, H, 0.012, 0, Y, Z + 0.012, board, r=0.002)
    holes = []
    for i in range(int(W / 0.05)):
        for j in range(int(H / 0.05)):
            x = -W / 2 + 0.025 + i * 0.05
            y = Y - H / 2 + 0.025 + j * 0.05
            holes.append((x, y))
    for x, y in holes:
        box(0.008, 0.008, 0.002, x, y, Z + 0.0185, M['black'])
    F = Z + 0.03
    # llaves fijas de varios tamaños
    for k in range(6):
        L = 0.16 + k * 0.025
        x = -0.85 + k * 0.07
        box(0.016, L, 0.006, x, Y + 0.12 - L / 2, F, M['chrome'], r=0.003)
        ring(0.018 + k * 0.002, 0.005, x, Y + 0.13, F, M['chrome'], seg=14, rseg=5, rx=math.pi / 2)
        ring(0.016 + k * 0.002, 0.005, x, Y + 0.11 - L, F, M['chrome'], seg=14, rseg=5, rx=math.pi / 2)
    # destornilladores de mango rojo/amarillo
    for k in range(5):
        x = -0.38 + k * 0.06
        m = red if k % 2 == 0 else yellow
        cyl(0.014, 0.016, 0.1, x, Y + 0.25, F, m, seg=12, r=0.004)
        cyl(0.004, 0.004, 0.14 + (k % 3) * 0.03, x, Y + 0.13 - (k % 3) * 0.015, F, M['chrome'], seg=8)
    # martillo, alicates y sierra
    box(0.03, 0.3, 0.02, 0.05, Y + 0.05, F, M['wood'], r=0.008)
    box(0.12, 0.035, 0.035, 0.05, Y + 0.21, F, M['steel'], r=0.006)
    for s_ in (-1, 1):
        box(0.014, 0.18, 0.008, 0.2 + s_ * 0.016, Y + 0.06, F, red, r=0.004, rz=s_ * 0.12)
        box(0.012, 0.06, 0.01, 0.2 + s_ * 0.006, Y + 0.18, F, M['steel'], r=0.003)
    box(0.36, 0.09, 0.004, 0.52, Y + 0.18, F, M['chrome'], r=0.002)
    box(0.11, 0.1, 0.03, 0.74, Y + 0.18, F, M['wood'], r=0.01)
    # rollos de cable y cinta
    for k, (x, r) in enumerate([(0.45, 0.07), (0.65, 0.055), (0.8, 0.045)]):
        ring(r, 0.012, x, Y - 0.22, F + 0.01, [M['black'], red, yellow][k], seg=24, rseg=8, rx=math.pi / 2)
    # estante con botes
    box(0.7, 0.02, 0.12, -0.5, Y - 0.32, Z + 0.07, M['wood'], r=0.004)
    for k in range(5):
        cyl(0.03, 0.03, 0.08 + (k % 2) * 0.03, -0.75 + k * 0.12, Y - 0.27 + (k % 2) * 0.015, Z + 0.07, [M['steel'], red, M['chrome'], yellow, M['steel']][k], seg=14, r=0.003)
    # flexo articulado sobre la mesa
    lathe([(0, 0), (0.07, 0), (0.07, 0.015), (0.03, 0.03), (0, 0.03)], 0.55, 0.96, -0.2, M['steel'], seg=20)
    tube([(0.55, 0.99, -0.2), (0.55, 1.25, -0.24)], 0.008, M['steel'], smooth_path=False)
    tube([(0.55, 1.25, -0.24), (0.55, 1.36, -0.04)], 0.008, M['steel'], smooth_path=False)
    lathe([(0, 0), (0.025, 0), (0.07, 0.09), (0.066, 0.09), (0.02, 0.004), (0, 0.004)], 0.55, 1.3, 0.0, M['shade'], seg=20, rx=-2.3)
    join_static('pegboard')
    export(os.path.join(OUT, 'pegboard.glb'))


which = os.environ.get('ONLY')
for fn in [stool, blackjack, roulette, bench, floor_lamp, pedestal, statue, pegboard]:
    if not which or which == fn.__name__:
        fn()
