"""
Arquitectura y piezas grandes del casino modeladas a mano (Blender): pilastra art déco, puertas dobles con su
marco (2,2 m y 4 m), lámpara colgante, mostrador de servicios, recepción, rueda de ruleta, cubo y caballete de
«suelo mojado». Un GLB por pieza en assets/models/.
Ejecutar:  python scripts/models/architecture.py assets/models        (ONLY=pendant para una sola)
Las claves de material (gold, brass, woodDark, marble, opal, glow…) las sustituye el juego por las suyas.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import TAU, box, cyl, export, frame_molding, join_static, lathe, mat, pivot, profile_curve, quad, reset, ring, shape, tube  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[-1] if not sys.argv[-1].endswith('.py') else os.path.join(HERE, '..', '..', 'assets', 'models')


def mats():
    return dict(
        gold=mat('gold', 0xd4af37, 1, 0.3), brass=mat('brass', 0xd9b986, 1, 0.3), wood=mat('wood', 0x6a3a1c, 0, 0.45),
        woodDark=mat('woodDark', 0x3a2212, 0, 0.5), marble=mat('marble', 0x1c1816, 0, 0.25), marbleLight=mat('marbleLight', 0xb8afa1, 0, 0.26),
        black=mat('black', 0x0a080b, 0, 0.6), lacquer=mat('lacquer', 0x0b0709, 0, 0.3), glass=mat('glass', 0xbfd4d6, 0, 0.05, alpha=0.16),
        mirror=mat('mirror', 0x8a8580, 1, 0.14), steel=mat('steel', 0x8a8d92, 1, 0.35), paper=mat('paper', 0xb9b2a2, 0, 1),
    )


def deco_steps(w0, h0, steps, dw, dh):
    """Silueta escalonada art déco (zigurat) centrada: base w0, `steps` escalones de dw×dh y remate de alto h0."""
    left = [(-w0 / 2, 0)]
    w, y = w0, 0
    for _ in range(steps):
        y += dh
        left.append((-w / 2, y))
        w -= 2 * dw
        left.append((-w / 2, y))
    y += h0
    left.append((-w / 2, y))
    return left + [(-x, yy) for (x, yy) in reversed(left)]


# ------------------------------------------------------------------ pilastra (local +Z hacia la sala; muro en z = -0.35)
def pilaster():
    reset()
    M = mats()
    sconce = mat('sconceGlass', 0x3b2a10, 0, 0.4, 0xffe0a0, 1.6)
    # basa: plinto de mármol escalonado con filete dorado
    box(0.7, 0.26, 0.64, 0, 0.13, -0.03, M['marble'], r=0.012)
    box(0.62, 0.1, 0.58, 0, 0.31, -0.05, M['marble'], r=0.01)
    box(0.66, 0.025, 0.6, 0, 0.27, -0.04, M['gold'], r=0.004)
    box(0.56, 0.05, 0.52, 0, 0.385, -0.06, M['gold'], r=0.008)
    # fuste acanalado: sección con 5 estrías en la cara frontal
    W, Dp = 0.48, 0.3
    outline = [(-W / 2, -0.33)]
    outline += [(-W / 2, -0.33 + Dp - 0.02)]
    n = 5
    span = W - 0.08
    for k in range(n):
        x0 = -span / 2 + k * span / n
        x1 = x0 + span / n
        outline.append((x0 + 0.008, -0.33 + Dp))
        for j in range(1, 8):
            a = math.pi * j / 8
            outline.append((x0 + 0.008 + (x1 - x0 - 0.016) * (1 - math.cos(a)) / 2, -0.33 + Dp - math.sin(a) * 0.022))
        outline.append((x1 - 0.008, -0.33 + Dp))
    outline += [(W / 2, -0.33 + Dp - 0.02), (W / 2, -0.33)]
    # shape facing 'y': u = x, v = -z, extruido en vertical
    fl = shape([(u, -v) for (u, v) in outline], 4.18, 0, 2.5, 0, M['marble'], facing='y', bevel=0.004, bres=1, smooth_angle=30)
    del fl
    # filetes dorados en el fondo de cada estría (líneas finas)
    for k in range(n):
        x = -span / 2 + (k + 0.5) * span / n
        box(0.012, 4.0, 0.006, x, 2.5, -0.33 + Dp - 0.018, M['gold'])
    # capitel: banda dorada, abanico art déco y cornisa escalonada
    box(0.56, 0.06, 0.4, 0, 4.62, -0.15, M['gold'], r=0.01)
    box(0.6, 0.34, 0.42, 0, 4.82, -0.14, M['marble'], r=0.012)
    for k in range(7):
        a = math.radians(-60 + k * 20)
        L = 0.24
        box(0.018, L, 0.012, math.sin(a) * L / 2, 4.66 + math.cos(a) * L / 2, 0.075, M['gold'], rz=-a)
    lathe([(0, 0), (0.055, 0), (0.05, 0.012), (0, 0.016)], 0, 4.66, 0.07, M['gold'], seg=16, rx=math.pi / 2)
    for i, (w, h, d) in enumerate([(0.68, 0.06, 0.5), (0.74, 0.07, 0.56), (0.8, 0.05, 0.62)]):
        box(w, h, d, 0, 5.02 + i * 0.065, -0.33 + d / 2, M['gold' if i == 1 else 'marble'], r=0.008)
    box(0.84, 0.3, 0.66, 0, 5.37, -0.02, M['marble'], r=0.01)
    box(0.86, 0.025, 0.68, 0, 5.21, -0.02, M['gold'], r=0.004)
    # aplique: placa escalonada, brazo y tulipa de cristal
    shape(deco_steps(0.14, 0.12, 2, 0.02, 0.03), 0.02, 0, 2.42, 0.0, M['brass'], bevel=0.003, bres=1)
    tube([(0, 2.52, 0.01), (0, 2.58, 0.1), (0, 2.66, 0.14)], 0.009, M['brass'])
    lathe([(0, 0), (0.035, 0), (0.035, 0.012), (0.03, 0.02)], 0, 2.65, 0.14, M['brass'], seg=16)
    lathe([(0.03, 0), (0.06, 0.05), (0.085, 0.13), (0.09, 0.17), (0.085, 0.18), (0.03, 0.02)], 0, 2.66, 0.14, sconce, seg=20)
    ring(0.09, 0.006, 0, 2.83, 0.14, M['brass'], seg=24, rseg=6)
    join_static('pilaster')
    export(os.path.join(OUT, 'pilaster.glb'))


# ------------------------------------------------------------------ puertas dobles (marco y hojas por separado)
DOOR_H = 3.0


def door(width):
    tag = f'{round(width * 10):02d}'
    # --- marco (arquitrabe escalonado, jambas forradas y remate) — local +Z hacia la sala, muro de -0.18 a -0.58
    reset()
    M = mats()
    glow = mat('glow', 0x000000, 0, 0.5, 0xff40c0, 1.4)
    prof = profile_curve([(0, 0), (0.17, 0), (0.17, 0.035), (0.14, 0.05), (0.13, 0.085), (0.1, 0.1), (0.085, 0.13), (0.05, 0.15), (0.03, 0.17), (0, 0.17)], 'arch')
    # rectángulo cerrado con el lado inferior bajo el suelo (no se ve)
    hw = width / 2 + 0.085
    top = DOOR_H + 0.085
    frame_molding(2 * hw, top + 0.6, prof, 0, (top - 0.6) / 2, 0.0, M['gold'])
    # forro de las jambas y del dintel (espesor del muro) en madera oscura
    for s in (-1, 1):
        box(0.04, DOOR_H, 0.42, s * (width / 2 + 0.02), DOOR_H / 2, -0.2, M['woodDark'])
    box(width + 0.08, 0.04, 0.42, 0, DOOR_H + 0.02, -0.2, M['woodDark'])
    # remate art déco sobre el marco: zigurat con abanico y clave
    sh = deco_steps(min(1.4, width * 0.55), 0.06, 3, 0.09, 0.035)
    shape(sh, 0.06, 0, top + 0.16, 0.04, M['gold'], bevel=0.004, bres=1)
    for k in range(9):
        a = math.radians(-64 + k * 16)
        L = 0.2
        box(0.014, L, 0.01, math.sin(a) * L / 2, top + 0.17 + math.cos(a) * L / 2 * 0.6, 0.075, M['black'], rz=-a)
    shape([(-0.07, 0), (0.07, 0), (0.05, 0.16), (-0.05, 0.16)], 0.08, 0, top + 0.05, 0.05, M['marble'], bevel=0.004, bres=1)
    # tira luminosa de la zona (se omite en puertas sin zona)
    for s in (-1, 1):
        box(0.03, DOOR_H - 0.12, 0.012, s * (width / 2 - 0.035), DOOR_H / 2 - 0.02, 0.025, glow)
    box(width - 0.1, 0.03, 0.012, 0, DOOR_H - 0.07, 0.025, glow)
    join_static(f'doorframe{tag}')
    export(os.path.join(OUT, f'door_frame_{tag}.glb'))

    # --- hojas: bastidor, cuarterones con moldura, placa de empuje, tirador y zócalo de latón
    reset()
    M = mats()
    leaf_w = width / 2 - 0.02
    H = DOOR_H - 0.04
    pan = profile_curve([(0, 0), (0.035, 0), (0.035, 0.008), (0.022, 0.014), (0.012, 0.02), (0, 0.02)], 'pan')
    for s in (-1, 1):
        cx = s * (leaf_w / 2 + 0.01)
        box(leaf_w, H, 0.07, cx, H / 2, -0.02, M['woodDark'], r=0.008)
        # cuarterones: inferior (bajo), central (alto) y superior
        for (y0, y1) in [(0.32, 1.0), (1.18, 2.28), (2.44, H - 0.14)]:
            pw = leaf_w - 0.26
            ph = y1 - y0
            box(pw - 0.02, ph - 0.02, 0.025, cx, (y0 + y1) / 2, 0.02, M['wood'], r=0.01)
            frame_molding(pw, ph, pan, cx, (y0 + y1) / 2, 0.015, M['gold'])
        # rombo central art déco en el cuarterón alto
        shape([(0, -0.16), (0.1, 0), (0, 0.16), (-0.1, 0)], 0.012, cx, 1.73, 0.04, M['gold'], bevel=0.002, bres=1)
        # zócalo y placa de empuje de latón
        box(leaf_w - 0.06, 0.2, 0.006, cx, 0.12, 0.018, M['brass'], r=0.002)
        box(0.12, 0.34, 0.006, s * 0.16, 1.32, 0.018, M['brass'], r=0.003)
        # tirador vertical
        hx = s * 0.12
        cyl(0.016, 0.016, 0.48, hx, 1.3, 0.085, M['brass'], seg=14)
        for y in (1.1, 1.5):
            cyl(0.01, 0.01, 0.07, hx, y, 0.05, M['brass'], seg=10, axis='z')
            cyl(0.022, 0.022, 0.008, hx, y, 0.018, M['brass'], seg=14, axis='z')
    join_static(f'doorleaves{tag}')
    export(os.path.join(OUT, f'door_leaves_{tag}.glb'))


def doors():
    door(2.2)
    door(4.0)


# ------------------------------------------------------------------ lámpara colgante (origen en el techo, cuelga hacia -y)
def pendant():
    reset()
    M = mats()
    opal = mat('opal', 0xfff4e4, 0, 0.35, 0xffd9a8, 1.25)
    drop = 1.35
    # florón escalonado
    lathe([(0, 0), (0.12, 0), (0.12, -0.015), (0.1, -0.03), (0.085, -0.035), (0.07, -0.06), (0.03, -0.07), (0, -0.07)], 0, 0, 0, M['brass'], seg=20)
    ring(0.1, 0.006, 0, -0.03, 0, M['gold'], seg=20, rseg=6)
    # varilla con nudos
    cyl(0.008, 0.008, drop - 0.12, 0, -0.07 - (drop - 0.12) / 2, 0, M['brass'], seg=8)
    for y in (-0.5, -0.95):
        lathe([(0, -0.02), (0.016, -0.012), (0.018, 0), (0.016, 0.012), (0, 0.02)], 0, y, 0, M['brass'], seg=12)
    # galería: copa escalonada que sujeta el globo
    gy = -drop - 0.02
    lathe([(0.012, 0.09), (0.03, 0.08), (0.06, 0.04), (0.085, 0.025), (0.09, 0.0), (0.08, -0.008), (0.012, 0.06)], 0, gy, 0, M['brass'], seg=20)
    # globo de cristal opalino (achatado) con bandas doradas y remate
    cy = gy - 0.17
    lathe([(0.0, 0.17), (0.07, 0.16), (0.13, 0.12), (0.165, 0.05), (0.17, 0.0), (0.16, -0.06), (0.13, -0.12), (0.07, -0.16), (0.0, -0.17)], 0, cy, 0, opal, seg=24)
    ring(0.171, 0.007, 0, cy, 0, M['gold'], seg=24, rseg=6)
    for k in range(4):
        a = k * TAU / 4
        pts = [(math.cos(a) * 0.09 * (1 - abs(t - 0.5)) + math.cos(a) * 0.17 * math.sin(math.pi * t), cy + 0.17 - 0.34 * t, math.sin(a) * 0.17 * math.sin(math.pi * t)) for t in [i / 10 for i in range(11)]]
        pts = [(math.cos(a) * 0.172 * math.sin(math.pi * t), cy + 0.17 * math.cos(math.pi * t), math.sin(a) * 0.172 * math.sin(math.pi * t)) for t in [i / 8 for i in range(9)]]
        tube(pts, 0.004, M['gold'], res=2)
    lathe([(0, 0), (0.03, 0), (0.028, -0.02), (0.012, -0.05), (0.006, -0.07), (0, -0.075)], 0, cy - 0.165, 0, M['brass'], seg=16)
    join_static('pendant')
    export(os.path.join(OUT, 'pendant.glb'))


# ------------------------------------------------------------------ mostrador de servicios (5,2 m; frente a +Z)
def counter():
    reset()
    M = mats()
    W, D = 5.2, 1.0
    fz = D / 2
    # zócalo lacado retranqueado y cuerpo
    box(W - 0.1, 0.12, D - 0.08, 0, 0.06, -0.03, M['lacquer'], r=0.01)
    box(W, 0.93, D, 0, 0.585, 0, M['woodDark'], r=0.02)
    # frente: pilastrillas acanaladas entre paneles con rombo dorado
    bays = 6
    bw = (W - 0.3) / bays
    for k in range(bays + 1):
        x = -W / 2 + 0.15 + k * bw
        box(0.09, 0.82, 0.04, x, 0.58, fz + 0.02, M['wood'], r=0.012)
        for dx in (-0.025, 0, 0.025):
            box(0.008, 0.78, 0.006, x + dx, 0.58, fz + 0.042, M['woodDark'])
    pan = profile_curve([(0, 0), (0.03, 0), (0.03, 0.006), (0.018, 0.012), (0, 0.016)], 'cpan')
    for k in range(bays):
        x = -W / 2 + 0.15 + (k + 0.5) * bw
        frame_molding(bw - 0.2, 0.56, pan, x, 0.6, fz + 0.002, M['gold'])
        shape([(0, -0.09), (0.06, 0), (0, 0.09), (-0.06, 0)], 0.01, x, 0.6, fz + 0.012, M['gold'], bevel=0.002, bres=1)
    for y in (0.2, 0.98):
        box(W - 0.06, 0.03, 0.02, 0, y, fz + 0.03, M['brass'], r=0.005)
    # encimera de mármol con canto redondeado y filete dorado
    edge = profile_curve([(0, 0), (0.035, 0), (0.05, 0.012), (0.055, 0.035), (0.05, 0.058), (0.035, 0.07), (0, 0.07)], 'top')
    box(W + 0.1, 0.07, D + 0.36, 0, 1.085, 0.15, M['marble'], r=0.03)
    box(W + 0.12, 0.022, D + 0.38, 0, 1.04, 0.15, M['gold'], r=0.006)
    del edge
    # barra reposapiés con soportes y barandilla superior
    cyl(0.026, 0.026, W - 0.2, 0, 0.16, fz + 0.26, M['brass'], seg=14, axis='x')
    for x in (-W / 2 + 0.3, -W / 6, W / 6, W / 2 - 0.3):
        tube([(x, 0.0, fz + 0.04), (x, 0.08, fz + 0.2), (x, 0.16, fz + 0.26)], 0.012, M['brass'])
    cyl(0.016, 0.016, W - 0.1, 0, 1.17, fz + 0.32, M['brass'], seg=12, axis='x')
    for x in (-W / 2 + 0.2, -W / 4, W / 4, W / 2 - 0.2):
        cyl(0.011, 0.011, 0.06, x, 1.14, fz + 0.32, M['brass'], seg=8)
    # trasera: mueble bar con arcos de espejo, baldas y cornisa
    bz = -fz - 0.6
    box(W + 0.6, 0.95, 0.5, 0, 0.475, bz + 0.05, M['woodDark'], r=0.02)
    box(W + 0.64, 0.04, 0.54, 0, 0.97, bz + 0.05, M['marble'], r=0.01)
    box(W + 0.6, 2.0, 0.16, 0, 1.95, bz - 0.2, M['woodDark'], r=0.015)
    arches = 4
    aw = (W - 0.3) / arches
    for k in range(arches):
        x = -W / 2 + 0.15 + (k + 0.5) * aw
        # espejo con remate en arco
        outline = [(-aw / 2 + 0.08, 0), (aw / 2 - 0.08, 0)] + [((aw / 2 - 0.08) * math.cos(a), 0.95 + (aw / 2 - 0.08) * math.sin(a) * 0.6) for a in [i * math.pi / 16 for i in range(17)]] + [(-aw / 2 + 0.08, 0)]
        shape(outline[:-1], 0.01, x, 1.08, bz - 0.11, M['mirror'])
        frame_molding(aw - 0.14, 0.04, pan, x, 1.06, bz - 0.1, M['gold'])
        tube([((aw / 2 - 0.05) * math.cos(a) + x, 2.03 + (aw / 2 - 0.05) * math.sin(a) * 0.6, bz - 0.1) for a in [i * math.pi / 16 for i in range(17)]], 0.014, M['gold'], smooth_path=False, res=2)
        for s in (-1, 1):
            box(0.06, 1.0, 0.05, x + s * (aw / 2 - 0.05), 1.55, bz - 0.09, M['wood'], r=0.01)
    for y in (1.3, 1.78):
        box(W - 0.4, 0.04, 0.34, 0, y, bz + 0.02 - 0.0, M['wood'], r=0.008)
    box(W + 0.7, 0.12, 0.3, 0, 2.98, bz - 0.12, M['woodDark'], r=0.02)
    box(W + 0.74, 0.03, 0.32, 0, 2.91, bz - 0.12, M['gold'], r=0.005)
    shape(deco_steps(1.6, 0.18, 3, 0.18, 0.06), 0.08, 0, 3.04, bz - 0.12, M['woodDark'], bevel=0.006, bres=1)
    # mamparas laterales: madera abajo, cristal arriba con junquillos dorados
    for s in (-1, 1):
        x = s * (W / 2 + 0.55)
        box(0.1, 1.2, 2.2, x, 0.6, -1.0, M['woodDark'], r=0.015)
        box(0.12, 0.04, 2.24, x, 1.22, -1.0, M['gold'], r=0.006)
        box(0.03, 1.1, 2.1, x, 1.79, -1.0, M['glass'])
        box(0.05, 0.04, 2.2, x, 2.36, -1.0, M['gold'], r=0.006)
        for z in (-2.08, 0.08):
            box(0.06, 1.18, 0.05, x, 1.8, z, M['gold'], r=0.008)
    join_static('counter')
    export(os.path.join(OUT, 'counter.glb'))


# ------------------------------------------------------------------ recepción (4,2 m; frente a +Z)
def reception():
    reset()
    M = mats()
    W, D = 4.2, 0.9
    fz = D / 2
    box(W - 0.08, 0.1, D - 0.08, 0, 0.05, -0.02, M['lacquer'], r=0.01)
    # frente curvo en los extremos (planta de estadio) acanalado
    box(W - 0.3, 0.92, D, 0, 0.56, 0, M['woodDark'], r=0.02)
    for s in (-1, 1):
        cyl(D / 2, D / 2, 0.92, s * (W / 2 - 0.15 - D / 2 + 0.3), 0.56, 0, M['woodDark'], seg=32, r=0.015)
    n = int((W - 0.6) / 0.11)
    for i in range(n):
        x = -(W - 0.6) / 2 + (i + 0.5) * (W - 0.6) / n
        box(0.045, 0.66, 0.03, x, 0.52, fz + 0.012, M['wood'], r=0.012)
    for y in (0.17, 0.87):
        box(W - 0.5, 0.025, 0.012, 0, y, fz + 0.03, M['brass'], r=0.004)
        for s in (-1, 1):
            ring(D / 2 + 0.01, 0.008, s * (W / 2 - 0.15 - D / 2 + 0.3), y, 0, M['brass'], seg=32, rseg=4)
    # placa central con rombo
    box(0.74, 0.18, 0.014, 0, 0.66, fz + 0.034, M['brass'], r=0.006)
    box(0.66, 0.12, 0.004, 0, 0.66, fz + 0.043, M['black'], r=0.002)
    shape([(0, -0.045), (0.045, 0), (0, 0.045), (-0.045, 0)], 0.008, 0, 0.66, fz + 0.048, M['gold'], bevel=0.002, bres=1)
    # encimera de trabajo y repisa elevada de mármol con filete dorado
    box(W + 0.06, 0.04, D + 0.06, 0, 1.04, -0.02, M['marbleLight'], r=0.012)
    box(W - 0.1, 0.16, 0.08, 0, 1.13, fz - 0.06, M['woodDark'], r=0.01)
    box(W + 0.12, 0.035, 0.36, 0, 1.225, fz + 0.04, M['marbleLight'], r=0.014)
    box(W + 0.14, 0.015, 0.37, 0, 1.2, fz + 0.04, M['gold'], r=0.004)
    # columnas de esquina con capitel
    for s in (-1, 1):
        x = s * (W / 2 + 0.02)
        lathe([(0, 0), (0.1, 0), (0.1, 0.04), (0.085, 0.06), (0.08, 0.08), (0.08, 0.98), (0.095, 1.0), (0.095, 1.03), (0, 1.03)], x, 0.0, fz - 0.2, M['woodDark'], seg=24)
        ring(0.082, 0.008, x, 0.12, fz - 0.2, M['brass'], seg=24, rseg=4)
        ring(0.082, 0.008, x, 0.95, fz - 0.2, M['brass'], seg=24, rseg=4)
    join_static('reception')
    export(os.path.join(OUT, 'reception.glb'))


# ------------------------------------------------------------------ rueda de ruleta (estática + nodo «Rotor» que gira)
def wheel():
    reset()
    M = mats()
    wood = mat('bowlWood', 0x4a2412, 0, 0.28)
    rotor_wood = mat('rotorWood', 0x3a1c0e, 0.05, 0.32)
    gold = M['gold']
    brass = mat('fret', 0xb8892a, 0.9, 0.3)
    H_DISC = 0.062
    # cuenco: la pista de la bola respeta la curva del juego (bowlHeight) y el canto lleva chapa y filetes
    prof = [(0.352, 0.035), (0.36, H_DISC), (0.39, 0.075), (0.445, 0.112), (0.49, 0.126), (0.52, 0.132), (0.538, 0.122), (0.545, 0.07), (0.548, 0.02), (0.54, 0.0)]
    lathe(prof, 0, 0, 0, wood, seg=96)
    lathe([(0.54, 0.0), (0.6, 0.0), (0.62, 0.02), (0.625, 0.07), (0.6, 0.1), (0.56, 0.11), (0.538, 0.122)], 0, 0, 0, mat('cabinet', 0x2a1408, 0, 0.35), seg=96)
    ring(0.527, 0.011, 0, 0.132, 0, gold, seg=96, rseg=8)
    ring(0.612, 0.006, 0, 0.06, 0, gold, seg=96, rseg=6)
    cyl(0.36, 0.36, 0.004, 0, 0.002, 0, mat('bowlFloor', 0x0c0806, 0, 0.9), seg=48)
    # rombos deflectores en la pista
    for k in range(8):
        a = k / 8 * TAU + 0.2
        r = 0.405
        y = H_DISC + (0.115 - H_DISC) * ((r - 0.355) / (0.445 - 0.355)) ** 2 + 0.006
        shape([(0, -0.016), (0.009, 0), (0, 0.016), (-0.009, 0)], 0.01, math.cos(a) * r, y, -math.sin(a) * r, gold, facing='y', bevel=0.003, bres=1, ry=a)
    # rotor (gira en el juego): cuerpo, trastes, cono torneado, aros y torreta con cuatro brazos
    R = pivot('Rotor', 0, 0, 0)
    lathe([(0, H_DISC - 0.056), (0.33, H_DISC - 0.056), (0.355, H_DISC - 0.03), (0.358, H_DISC - 0.008), (0.355, H_DISC), (0, H_DISC)], 0, 0, 0, rotor_wood, seg=72, parent=R)
    POCKET = TAU / 37
    for i in range(37):
        a = -i * POCKET - POCKET / 2
        box(0.084, 0.012, 0.0035, math.cos(a) * 0.243, H_DISC + 0.006, -math.sin(a) * 0.243, brass, r=0.0015, ry=a, parent=R)
    lathe([(0.2, H_DISC), (0.19, H_DISC + 0.012), (0.12, H_DISC + 0.045), (0.06, H_DISC + 0.066), (0.045, H_DISC + 0.07), (0, H_DISC + 0.07)], 0, 0, 0, rotor_wood, seg=56, parent=R)
    ring(0.2, 0.006, 0, H_DISC + 0.002, 0, gold, seg=56, rseg=6, parent=R)
    ring(0.12, 0.004, 0, H_DISC + 0.045, 0, gold, seg=40, rseg=6, parent=R)
    lathe([(0.026, 0), (0.024, 0.02), (0.016, 0.04), (0.018, 0.06), (0.012, 0.07), (0.022, 0.08), (0.02, 0.09), (0, 0.095)], 0, H_DISC + 0.065, 0, gold, seg=20, parent=R)
    for k in range(4):
        a = k / 4 * TAU
        tube([(math.cos(a) * 0.015, H_DISC + 0.125, -math.sin(a) * 0.015), (math.cos(a) * 0.19, H_DISC + 0.125, -math.sin(a) * 0.19)], 0.006, gold, smooth_path=False, res=2, parent=R)
        lathe([(0, -0.012), (0.012, -0.006), (0.013, 0), (0.012, 0.006), (0, 0.012)], math.cos(a) * 0.2, H_DISC + 0.125, -math.sin(a) * 0.2, gold, seg=12, parent=R)
    lathe([(0, 0), (0.014, 0), (0.022, 0.012), (0.02, 0.022), (0.01, 0.03), (0, 0.032)], 0, H_DISC + 0.135, 0, gold, seg=16, parent=R)
    join_static('wheel')
    export(os.path.join(OUT, 'wheel.glb'))


# ------------------------------------------------------------------ cubo de zinc y caballete de «suelo mojado»
def bucket():
    reset()
    M = mats()
    tin = mat('tin', 0x8c9196, 0.85, 0.38)
    lathe([(0, 0), (0.158, 0), (0.162, 0.006), (0.168, 0.06), (0.176, 0.13), (0.186, 0.2), (0.196, 0.28), (0.202, 0.296), (0.205, 0.3), (0.198, 0.3), (0.19, 0.29), (0.18, 0.205), (0.17, 0.13), (0.16, 0.06), (0.152, 0.012), (0, 0.012)], 0, 0, 0, tin, seg=40)
    for y, r in ((0.07, 0.169), (0.22, 0.189)):
        ring(r, 0.004, 0, y, 0, tin, seg=40, rseg=4)
    ring(0.204, 0.007, 0, 0.298, 0, tin, seg=40, rseg=6)
    for s in (-1, 1):
        cyl(0.02, 0.02, 0.02, s * 0.2, 0.25, 0, tin, seg=10, axis='x')
    tube([(-0.205, 0.25, 0), (-0.16, 0.38, 0.02), (0, 0.44, 0.03), (0.16, 0.38, 0.02), (0.205, 0.25, 0)], 0.004, M['steel'])
    cyl(0.012, 0.012, 0.09, 0, 0.44, 0.03, M['black'], seg=10, axis='x')
    join_static('bucket')
    export(os.path.join(OUT, 'bucket.glb'))


def wetsign():
    reset()
    M = mats()
    from PIL import Image, ImageDraw
    tex = os.path.join(HERE, 'tex', 'wetsign.png')
    im = Image.new('RGB', (256, 512), (216, 178, 28))
    d = ImageDraw.Draw(im)
    # triángulo de aviso con persona resbalando (pictograma universal, sin texto)
    d.polygon([(128, 70), (228, 250), (28, 250)], outline=(12, 10, 8), width=14)
    d.ellipse((110, 120, 134, 144), fill=(12, 10, 8))
    d.line([(122, 146), (108, 196)], fill=(12, 10, 8), width=10)
    d.line([(116, 160), (146, 150)], fill=(12, 10, 8), width=8)
    d.line([(116, 160), (88, 178)], fill=(12, 10, 8), width=8)
    d.line([(108, 196), (140, 214)], fill=(12, 10, 8), width=9)
    d.line([(108, 196), (82, 228)], fill=(12, 10, 8), width=9)
    d.line([(60, 236), (196, 236)], fill=(12, 10, 8), width=6)
    for k in range(3):
        y = 300 + k * 52
        d.rectangle((48, y, 208, y + 24), fill=(12, 10, 8))
    im.save(tex)
    face = mat('wetFace', 0xffffff, 0, 0.45, image=tex, double=True)
    yellow = mat('yellowPlastic', 0xd8b21c, 0, 0.45)
    for s in (-1, 1):
        box(0.32, 0.62, 0.016, 0, 0.3, s * 0.1, yellow, r=0.006, rx=-s * 0.3)
        off = 0.0095
        quad(0.27, 0.54, 0, 0.3 + off * math.sin(0.3), s * (0.1 + off * math.cos(0.3)), face, rx=-s * 0.3)
        box(0.24, 0.05, 0.004, 0, 0.56, s * 0.088, M['black'], rx=-s * 0.3)
    box(0.12, 0.04, 0.05, 0, 0.6, 0, yellow, r=0.012)
    for x in (-0.12, 0.12):
        cyl(0.008, 0.008, 0.05, x, 0.6, 0, M['black'], seg=8, axis='z')
    join_static('wetsign')
    export(os.path.join(OUT, 'wetsign.glb'))


which = os.environ.get('ONLY')
for fn in [pilaster, doors, pendant, counter, reception, wheel, bucket, wetsign]:
    if not which or which == fn.__name__:
        fn()
