"""
KEY ART de la pantalla de carga: THE CLASSIC en su estrado, en el casino a oscuras (render Cycles).
    /tmp/bpyenv/bin/python scripts/models/keyart.py assets/ui/keyart.png [ancho] [muestras]

Reutiliza el modelo de classic.py (mismas piezas que en el juego) y añade lo que el juego pone en tiempo real
(rodillos, cristal, bombillas). La máquina queda a la derecha del encuadre: a la izquierda va el logotipo.
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib  # noqa: E402

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'assets', 'ui', 'keyart.png'))
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 64

# ---------------------------------------------------------------- el modelo (sin exportar)
lib.export = lambda path: None
src = open(os.path.join(HERE, 'classic.py'), encoding='utf-8').read()
argv = sys.argv
sys.argv = ['classic.py', '/dev/null.glb']
exec(compile(src, 'classic.py', 'exec'), {'__name__': 'classic', '__file__': os.path.join(HERE, 'classic.py')})
sys.argv = argv
V = lib.V
from lib import box, cyl, drum, mat, quad, ring  # noqa: E402

# piezas de tiempo real: rodillos, fondo de la cavidad, cristal, bombillas
STRIP = mat('reelStripArt', 0xffffff, 0, 0.35, image=os.path.join(HERE, 'tex', 'reel_strip.png'))
for k, x in enumerate([-0.37, 0, 0.37]):
    drum(0.36, 0.34, x, 1.45, -0.1, STRIP, seg=64, v0=0.07 * k)
    for s in (-1, 1):
        cyl(0.345, 0.345, 0.02, x + s * 0.18, 1.45, -0.1, mat('reelCap', 0x1b1a1c, 0.9, 0.4), seg=48, axis='x')
GLASS = mat('glassArt', 0xdde8ea, 0, 0.03, alpha=0.12)
quad(1.14, 0.58, 0, 1.45, 0.306, GLASS)
BULB = mat('bulbArt', 0x402810, 0, 0.4, 0xffd9a0, 9.0)


def perim(cx, cy, w, h, n, z):
    total = 2 * (w + h)
    for k in range(n):
        d = (k / n) * total
        if d < w:
            x, y = -w / 2 + d, h / 2
        elif (d := d - w) < h:
            x, y = w / 2, h / 2 - d
        elif (d := d - h) < w:
            x, y = w / 2 - d, -h / 2
        else:
            x, y = -w / 2, -h / 2 + (d - w)
        yield cx + x, cy + y, z


for (x, y, z) in [*perim(0, 1.45, 1.34, 0.78, 34, 0.346), *perim(0, 2.2, 1.4, 0.48, 28, 0.166)]:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, segments=12, ring_count=8, location=V(x, y, z))
    bpy.context.object.data.materials.append(BULB)

# pantalla superior encendida
SCREEN_ART = mat('screenArt', 0x100404, 0, 0.3, 0xd8203a, 1.6)
for o in bpy.data.objects:
    if 'creen' in o.name and o.type == 'MESH':
        o.data.materials.clear()
        o.data.materials.append(SCREEN_ART)
        print('pantalla', o.name)

# ---------------------------------------------------------------- escenario
MARBLE = bpy.data.materials.new('floorArt')
MARBLE.use_nodes = True
nt = MARBLE.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.18
tc = nt.nodes.new('ShaderNodeTexCoord')
wave = nt.nodes.new('ShaderNodeTexWave')
wave.inputs['Scale'].default_value = 0.22
wave.inputs['Distortion'].default_value = 22
wave.inputs['Detail'].default_value = 10
wave.inputs['Detail Roughness'].default_value = 0.7
nt.links.new(tc.outputs['Object'], wave.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.93
ramp.color_ramp.elements[0].color = (0.008, 0.006, 0.006, 1)
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (0.09, 0.075, 0.06, 1)
nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
bpy.context.object.data.materials.append(MARBLE)

DAIS = mat('daisArt', 0x1a1412, 0.0, 0.22)
GOLDRING = mat('goldArt', 0xd4af37, 1, 0.28)
cyl(1.75, 1.83, 0.14, 0, 0.07, 0, DAIS, seg=96)
ring(1.77, 0.03, 0, 0.14, 0, GOLDRING, seg=96)
cyl(2.2, 2.25, 0.06, 0, 0.03, 0, DAIS, seg=96)

# pared del fondo (terciopelo burdeos) con molduras doradas y apliques que darán bokeh
WALL = mat('wallArt', 0x12040a, 0, 0.85)
box(40, 7, 0.3, 0, 3.5, -9.5, WALL)
for x in range(-12, 13, 3):
    box(0.06, 5.0, 0.05, x, 2.6, -9.33, mat('trimArt', 0x6a5420, 1, 0.5))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=V(x + 1.5, 2.7, -9.2))
    bpy.context.object.data.materials.append(mat(f'sconce{x}', 0x402810, 0, 0.4, 0xffc070, 30.0))
# lámparas colgantes desenfocadas a distintas profundidades (bokeh cálido)
OPAL = mat('opalArt', 0x403020, 0, 0.4, 0xffd29a, 14.0)
for (x, y, z) in [(-5.5, 3.1, -3.5), (-3.2, 3.4, -6.0), (-7.4, 2.9, -1.5), (-1.6, 3.3, -4.6), (3.6, 3.3, -5.5), (-4.6, 2.6, -8.2), (5.4, 3.0, -3.0)]:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, segments=24, ring_count=16, location=V(x, y, z))
    bpy.context.object.data.materials.append(OPAL)
    cyl(0.006, 0.006, 3.0, x, y + 1.6, z, mat('rodArt', 0x6a5420, 1, 0.4), seg=8)

# ---------------------------------------------------------------- luces
def light(kind, energy, loc, rot=(0, 0, 0), color=(1, 0.9, 0.75), size=0.3, spot=None):
    d = bpy.data.lights.new(kind + str(len(bpy.data.lights)), kind)
    d.energy = energy
    d.color = color
    if kind in ('AREA',):
        d.size = size
    if kind == 'SPOT':
        d.spot_size = spot or 0.7
        d.spot_blend = 0.6
        d.shadow_soft_size = size
    o = bpy.data.objects.new(d.name, d)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o


def aim(o, game_target):
    d = V(*game_target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o


# foco cenital cálido delante-arriba (el del estrado), recorte rojo por detrás, relleno suave y un panel
# grande para que el oro y el cromo tengan algo que reflejar
aim(light('SPOT', 3200, V(0.9, 5.6, 3.2), color=(1, 0.86, 0.64), size=0.3, spot=math.radians(48)), (0, 1.3, 0))
aim(light('AREA', 700, V(2.6, 3.2, -2.4), color=(1, 0.28, 0.34), size=1.4), (0, 1.5, 0))
aim(light('AREA', 140, V(-3.8, 2.4, 4.8), color=(1, 0.8, 0.58), size=3.0), (0, 1.3, 0))
aim(light('AREA', 90, V(-1.2, 3.4, 3.6), color=(1, 0.9, 0.75), size=2.2), (0, 1.8, 0))

world = bpy.context.scene.world or bpy.data.worlds.new('w')
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.002, 0.002, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1

# ---------------------------------------------------------------- cámara: máquina a la derecha, ligeramente contrapicada
cam_d = bpy.data.cameras.new('cam')
cam_d.lens = 38
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 1.25
cam = bpy.data.objects.new('cam', cam_d)
bpy.context.scene.collection.objects.link(cam)
cam.location = V(-1.95, 1.05, 7.4)
target = V(-1.55, 1.42, 0)
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
focus = bpy.data.objects.new('focus', None)
focus.location = V(0, 1.4, 0.3)
bpy.context.scene.collection.objects.link(focus)
cam_d.dof.focus_object = focus
bpy.context.scene.camera = cam

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.render.resolution_x = WIDTH
sc.render.resolution_y = round(WIDTH * 9 / 16)
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = 0.6
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = OUT
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.render.render(write_still=True)
print('key art', OUT)
