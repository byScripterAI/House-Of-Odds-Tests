"""
Funda antipolvo sobre una tragaperras: simulación de tela real (Blender) que cae sobre la forma de la máquina.
Ejecutar:  python scripts/models/slot_sheet.py assets/models/slot_sheet.glb
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from lib import V, box, export, mat, reset, smooth  # noqa: E402

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models', 'slot_sheet.glb')
reset()
CLOTH = mat('cloth', 0xa69d8a, 0, 1.0, double=True)

# forma de la máquina (colisionador): cuerpo, cubierta, torre, cabecera, copete y palanca
parts = [
    box(0.78, 0.86, 0.72, 0, 0.43, 0, None, name='c1'),
    box(0.78, 0.12, 0.36, 0, 0.9, 0.24, None, name='c2'),
    box(0.74, 0.92, 0.6, 0, 1.39, -0.04, None, name='c3'),
    box(0.06, 0.1, 0.1, 0.0, 1.9, -0.1, None, name='c4'),
    box(0.06, 0.45, 0.06, 0.45, 1.3, -0.03, None, name='c5'),
]
for p in parts:
    p.modifiers.new('col', 'COLLISION')
    p.collision.thickness_outer = 0.012
    p.collision.cloth_friction = 12
floor = box(4, 0.02, 4, 0, -0.01, 0, None, name='floor')
floor.modifiers.new('col', 'COLLISION')
floor.collision.cloth_friction = 20

# sábana: cuadrado 3,9 × 3,9 m un poco por encima, ligeramente girado (caída natural)
bm = bmesh.new()
bm.loops.layers.uv.new('UVMap')
bmesh.ops.create_grid(bm, x_segments=84, y_segments=84, size=1.95, calc_uvs=True)
me = bpy.data.meshes.new('sheet')
bm.to_mesh(me)
bm.free()
sheet = bpy.data.objects.new('sheet', me)
bpy.context.scene.collection.objects.link(sheet)
sheet.location = V(0.02, 2.1, -0.02)
sheet.rotation_euler = (0.04, -0.03, 0.35)
me.materials.append(CLOTH)
cl = sheet.modifiers.new('cloth', 'CLOTH')
s = cl.settings
s.quality = 10
s.mass = 0.25
s.tension_stiffness = 12
s.compression_stiffness = 12
s.shear_stiffness = 6
s.bending_stiffness = 0.4
s.air_damping = 1.2
cl.collision_settings.use_self_collision = True
cl.collision_settings.self_distance_min = 0.006
cl.collision_settings.distance_min = 0.01
cl.point_cache.frame_start = 1
cl.point_cache.frame_end = 130
sc = bpy.context.scene
sc.frame_start = 1
sc.frame_end = 130
for f in range(1, 131):
    sc.frame_set(f)
# congela el resultado como malla y le da grosor
dg = bpy.context.evaluated_depsgraph_get()
final = bpy.data.meshes.new_from_object(sheet.evaluated_get(dg))
o = bpy.data.objects.new('sheet_final', final)
o.matrix_world = sheet.matrix_world.copy()
bpy.context.scene.collection.objects.link(o)
for ob in [*parts, floor, sheet]:
    bpy.data.objects.remove(ob)
# un par de suavizados y grosor
sm = o.modifiers.new('sm', 'LAPLACIANSMOOTH')
sm.iterations = 12
sm.lambda_factor = 0.6
sm.use_volume_preserve = True
sm.use_normalized = True
so = o.modifiers.new('so', 'SOLIDIFY')
so.thickness = 0.006
smooth(o, 80, weighted=False)
export(os.path.abspath(OUT))
