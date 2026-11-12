"""
Pequeña biblioteca de modelado para Blender (bpy) usada por los scripts de scripts/models/.

Convención: las funciones reciben coordenadas DEL JUEGO (metros, Y arriba, +Z = frente del objeto) y las
convierten a las de Blender (Z arriba, frente = -Y). Al exportar a glTF (+Y arriba) vuelven a quedar como en
el juego. Los nombres de material son CLAVES que el juego sustituye por sus materiales (oro, cromo, lacado…):
ver src/world/props/models.js. Los nombres de objeto que empiezan por una mayúscula se exportan sueltos (piezas
que se animan: puertas, botones…); el resto se fusiona por material para que el juego los dibuje de una vez.
"""
import math
import os
import bpy  # noqa: I001 (bpy antes que bmesh)
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_BOLD = os.path.join(HERE, 'fonts', 'cinzel-latin-700-normal.ttf')
FONT_REG = os.path.join(HERE, 'fonts', 'cinzel-latin-400-normal.ttf')
TAU = math.pi * 2


def V(x, y, z):
    """Juego → Blender."""
    return Vector((x, -z, y))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


# ------------------------------------------------------------------ materiales
MATS = {}


def srgb(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    return tuple(srgb((h >> s) & 255) for s in (16, 8, 0))


def mat(name, color=0xcccccc, metal=0.0, rough=0.5, emissive=None, strength=1.0, alpha=1.0, image=None, double=False):
    """Material PBR. Si `name` es una clave del juego, este color solo sirve de vista previa."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hexrgb(color), 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emissive is not None:
        b.inputs['Emission Color'].default_value = (*hexrgb(emissive), 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            m.blend_method = 'BLEND'
    if image:
        img = bpy.data.images.load(image)
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        m.node_tree.links.new(tex.outputs['Color'], b.inputs['Base Color'])
        if alpha < 1 or image.endswith('.png') and 'alpha' in name:
            m.node_tree.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    m.use_backface_culling = not double
    MATS[name] = m
    return m


# ------------------------------------------------------------------ utilidades de malla
def _obj(bm, name, material):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if material is not None:
        me.materials.append(material)
    return o


def place(o, x=0, y=0, z=0, rx=0, ry=0, rz=0, parent=None):
    """Coloca un objeto (coordenadas y giros del juego; orden de giro Y·X·Z como en el juego)."""
    o.rotation_mode = 'XYZ'
    m = Matrix.Translation(V(x, y, z)) @ Matrix.Rotation(ry, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(-rz, 4, 'Y')
    o.matrix_world = m @ o.matrix_world
    if parent is not None:
        parent_keep(o, parent)
    return o


def smooth(o, angle=38, weighted=True):
    me = o.data
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        pass
    if weighted:
        mod = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        mod.mode = 'FACE_AREA'
        mod.weight = 80
    return o


def bevel_bm(bm, r, seg=3, angle=0.5):
    if r <= 0:
        return
    edges = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > angle]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=r, offset_type='OFFSET', segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)


def box(w, h, d, x=0, y=0, z=0, m=None, r=0.0, seg=3, name='box', rx=0, ry=0, rz=0, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bevel_bm(bm, min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4), seg if r >= 0.006 else 1)
    o = _obj(bm, name, m)
    if r > 0:
        smooth(o)
    return place(o, x, y, z, rx, ry, rz, parent)


def cyl(rt, rb, h, x=0, y=0, z=0, m=None, seg=32, axis='y', r=0.0, bseg=2, name='cyl', rx=0, ry=0, rz=0, parent=None, caps=True):
    """Cilindro/cono. axis: eje del juego ('y' vertical, 'x' o 'z')."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=rb, radius2=rt, depth=h)
    if r > 0:
        bevel_bm(bm, r, bseg, 0.7)
    o = _obj(bm, name, m)
    smooth(o, 50)
    if axis == 'x':
        o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Y') @ o.matrix_world
    elif axis == 'z':
        o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    return place(o, x, y, z, rx, ry, rz, parent)


def lathe(profile, x=0, y=0, z=0, m=None, seg=40, name='lathe', angle=TAU, rx=0, ry=0, rz=0, parent=None, sharp=60):
    """Sólido de revolución alrededor del eje vertical del juego. profile: [(radio, altura)…] de abajo arriba."""
    bm = bmesh.new()
    verts = [bm.verts.new((rr, 0, yy)) for rr, yy in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    ret = bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=angle, steps=seg, use_merge=angle >= TAU - 1e-6)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _obj(bm, name, m)
    smooth(o, sharp, weighted=False)
    return place(o, x, y, z, rx, ry, rz, parent)


def _curve_to_mesh(c, name, material):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(c.evaluated_get(dg))
    o = link(bpy.data.objects.new(name, me))
    o.matrix_world = c.matrix_world.copy()
    me.materials.clear()
    if material is not None:
        me.materials.append(material)
    data = c.data
    bpy.data.objects.remove(c)
    if data.users == 0:
        bpy.data.curves.remove(data)
    return o


def shape(outline, depth, x=0, y=0, z=0, m=None, holes=(), bevel=0.0, bres=2, name='shape', facing='z', rx=0, ry=0, rz=0, parent=None, smooth_angle=40):
    """Silueta 2D extruida. outline/holes: [(u,v)…]. facing 'z': plano XY del juego (mira al frente);
    'x': plano ZY (u = -z, v = y, mira a +X); 'y': plano XZ (u = x, v = -z, tumbado)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = depth / 2
    cu.bevel_depth = bevel
    cu.bevel_resolution = bres
    for loop in [outline, *holes]:
        sp = cu.splines.new('POLY')
        sp.points.add(len(loop) - 1)
        for i, (u, v) in enumerate(loop):
            sp.points[i].co = (u, v, 0, 1)
        sp.use_cyclic_u = True
    c = link(bpy.data.objects.new(name, cu))
    o = _curve_to_mesh(c, name, m)
    if facing == 'z':
        o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    elif facing == 'x':
        o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    smooth(o, smooth_angle)
    return place(o, x, y, z, rx, ry, rz, parent)


def text(s, size, depth, x=0, y=0, z=0, m=None, bevel=0.0015, font=FONT_BOLD, name='text', spacing=1.0, rx=0, ry=0, rz=0, parent=None, align='CENTER', res=4):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = s
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.space_character = spacing
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.extrude = depth / 2
    cu.bevel_depth = bevel
    cu.bevel_resolution = 1
    cu.resolution_u = res
    c = link(bpy.data.objects.new(name, cu))
    o = _curve_to_mesh(c, name, m)
    o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    smooth(o, 35, weighted=False)
    return place(o, x, y, z, rx, ry, rz, parent)


def text_outline(s, size, radius, x=0, y=0, z=0, m=None, font=FONT_BOLD, name='neon', spacing=1.05, res=4, parent=None, rx=0, ry=0, rz=0):
    """Contorno de las letras como TUBO (letreros de neón)."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = s
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.space_character = spacing
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = res
    c = link(bpy.data.objects.new(name, cu))
    # texto → curva (contornos) → tubo
    dg = bpy.context.evaluated_depsgraph_get()
    tmp = bpy.data.curves.new(name + '_c', 'CURVE')
    tmp.dimensions = '3D'
    me = bpy.data.meshes.new_from_object(c.evaluated_get(dg))  # caras de las letras
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    loops = _boundary_loops(bm)
    bm.free()
    for loop in loops:
        sp = tmp.splines.new('POLY')
        sp.points.add(len(loop) - 1)
        for i, p in enumerate(loop):
            sp.points[i].co = (p.x, p.y, 0, 1)
        sp.use_cyclic_u = True
    tmp.bevel_depth = radius
    tmp.bevel_resolution = 2
    tmp.use_fill_caps = True
    bpy.data.objects.remove(c)
    co = link(bpy.data.objects.new(name, tmp))
    o = _curve_to_mesh(co, name, m)
    o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    smooth(o, 70, weighted=False)
    return place(o, x, y, z, rx, ry, rz, parent)


def _boundary_loops(bm):
    edges = {e for e in bm.edges if e.is_boundary}
    loops = []
    while edges:
        e = edges.pop()
        start, cur = e.verts[0], e.verts[1]
        loop = [start.co.copy()]
        prev = e
        while cur is not start:
            loop.append(cur.co.copy())
            nxt = next((f for f in cur.link_edges if f in edges and f is not prev), None)
            if nxt is None:
                break
            edges.discard(nxt)
            prev = nxt
            cur = nxt.other_vert(cur)
        if len(loop) > 2:
            loops.append(loop)
    return loops


def tube(points, radius, m=None, name='tube', res=3, smooth_path=True, cyclic=False, caps=True, parent=None, profile=None):
    """Tubo/cable por una lista de puntos del juego (curva suave). `profile`: curva de perfil opcional."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    if smooth_path:
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(points) - 1)
        for i, p in enumerate(points):
            bp = sp.bezier_points[i]
            bp.co = V(*p)
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp = cu.splines.new('POLY')
        sp.points.add(len(points) - 1)
        for i, p in enumerate(points):
            sp.points[i].co = (*V(*p), 1)
    sp.use_cyclic_u = cyclic
    cu.resolution_u = 6
    if profile is not None:
        cu.bevel_mode = 'OBJECT'
        cu.bevel_object = profile
    else:
        cu.bevel_depth = radius
        cu.bevel_resolution = res
    cu.use_fill_caps = caps
    c = link(bpy.data.objects.new(name, cu))
    o = _curve_to_mesh(c, name, m)
    smooth(o, 60, weighted=False)
    if parent is not None:
        parent_keep(o, parent)
    return o


def profile_curve(pts, name='profile'):
    """Perfil 2D (u,v) para barridos (molduras)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, (u, v) in enumerate(pts):
        sp.points[i].co = (u, v, 0, 1)
    sp.use_cyclic_u = True
    return link(bpy.data.objects.new(name, cu))


def frame_molding(w, h, prof, x=0, y=0, z=0, m=None, name='molding', parent=None, rx=0, ry=0, rz=0):
    """Moldura rectangular (barrido de `prof` por un rectángulo w×h en el plano frontal), ingletes limpios."""
    hw, hh = w / 2, h / 2
    # rectángulo en el plano XY del juego (Z del juego = 0)
    pts = [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)]
    o = tube(pts, 0, m, name, smooth_path=False, cyclic=True, profile=prof)
    smooth(o, 40)
    return place(o, x, y, z, rx, ry, rz, parent)


def empty(name, x=0, y=0, z=0, parent=None):
    e = link(bpy.data.objects.new(name, None))
    e.matrix_world = Matrix.Translation(V(x, y, z))
    if parent is not None:
        parent_keep(e, parent)
    return e


def pivot(name, x=0, y=0, z=0):
    """Nodo para piezas que se animan (bisagra, botón). Sus hijos se exportan sueltos."""
    return empty(name, x, y, z)


def parent_keep(child, par):
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    child.matrix_world = mw


# ------------------------------------------------------------------ fusión y exportación
def apply_modifiers(o):
    if o.type != 'MESH' or not o.modifiers:
        return
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def join_static(root_name='model'):
    """Aplica modificadores y fusiona por material todo lo que no cuelga de un pivote."""
    for o in list(bpy.context.scene.objects):
        apply_modifiers(o)
    static = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent is None and not o.name[0].isupper()]
    groups = {}
    for o in static:
        key = o.data.materials[0].name if o.data.materials else '_'
        groups.setdefault(key, []).append(o)
    out = []
    for key, objs in groups.items():
        if len(objs) > 1:
            with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, object=objs[0]):
                bpy.ops.object.join()
        objs[0].name = f'{root_name}_{key}'
        objs[0].data.name = objs[0].name
        objs[0].data.transform(objs[0].matrix_world)
        objs[0].matrix_world = Matrix()
        out.append(objs[0])
    # piezas animadas: también fusionadas por material dentro de cada pivote
    for p in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
        kids = [c for c in p.children if c.type == 'MESH']
        g = {}
        for c in kids:
            g.setdefault(c.data.materials[0].name if c.data.materials else '_', []).append(c)
        for key, objs in g.items():
            if len(objs) > 1:
                with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, object=objs[0]):
                    bpy.ops.object.join()
            objs[0].name = f'{p.name}_{key}'
            objs[0].data.transform(objs[0].matrix_local)
            objs[0].matrix_local = Matrix()
    for o in [o for o in bpy.context.scene.objects if o.type == 'CURVE']:
        bpy.data.objects.remove(o)
    return out


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_extras=False, export_cameras=False, export_lights=False, use_selection=False)
    tris = sum(len(o.data.loop_triangles) if o.type == 'MESH' and o.data.calc_loop_triangles() is None else 0 for o in bpy.context.scene.objects)
    print('exported', path, 'objects', len(bpy.context.scene.objects), 'tris', tris)


def quad(w, h, x=0, y=0, z=0, m=None, facing='z', name='quad', rx=0, ry=0, rz=0, parent=None):
    """Rectángulo con UV 0..1 (para texturas y pantallas). facing: 'z' mira al frente, 'x' a +X, 'y' arriba."""
    hw, hh = w / 2, h / 2
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for i, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = (u, v)
    o = link(bpy.data.objects.new(name, me))
    # plano XZ de Blender mira a -Y = frente del juego
    if facing == 'x':
        o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Z') @ o.matrix_world
    elif facing == 'y':
        o.matrix_world = Matrix.Rotation(-math.pi / 2, 4, 'X') @ o.matrix_world
    if m is not None:
        me.materials.append(m)
    return place(o, x, y, z, rx, ry, rz, parent)


def cut(target, cutter):
    """Resta `cutter` de `target` (booleana exacta) y borra el cortador."""
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    for mm in [mm for mm in target.modifiers if mm.name != 'cut']:
        target.modifiers.remove(mm)
    apply_modifiers(target)
    bpy.data.objects.remove(cutter)
    smooth(target)
    return target


def ring(R, r, x=0, y=0, z=0, m=None, seg=40, rseg=10, name='ring', rx=0, ry=0, rz=0, parent=None):
    """Toro (aro) horizontal de radio R y sección r."""
    prof = [(R + r * math.cos(a), r * math.sin(a)) for a in [math.pi * 1.5 - i * TAU / rseg for i in range(rseg + 1)]]
    return lathe(prof, x, y, z, m, seg, name, rx=rx, ry=ry, rz=rz, parent=parent, sharp=80)


def deco_rect(w, h, s):
    """Rectángulo con esquinas escalonadas art déco (polígono CCW)."""
    hw, hh = w / 2, h / 2
    corners = [((hw, -hh), (1, 0), (0, 1)), ((hw, hh), (0, 1), (-1, 0)), ((-hw, hh), (-1, 0), (0, -1)), ((-hw, -hh), (0, -1), (1, 0))]
    pts = []
    for (cx, cy), (ix, iy), (ox, oy) in corners:
        pts += [(cx - ix * 2 * s, cy - iy * 2 * s), (cx - ix * 2 * s + ox * s, cy - iy * 2 * s + oy * s), (cx - ix * s + ox * s, cy - iy * s + oy * s),
                (cx - ix * s + ox * 2 * s, cy - iy * s + oy * 2 * s), (cx + ox * 2 * s, cy + oy * 2 * s)]
    return pts


def drum(radius, width, x=0, y=0, z=0, m=None, seg=48, name='drum', v0=0.0, parent=None):
    """Tambor de rodillo con UV (u = ancho, v = vuelta completa), eje X del juego. v0 gira la tira."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(seg + 1):
        a = i / seg * TAU
        ca, sa = math.cos(a), math.sin(a)
        # juego: y = r·sen, z = r·cos  →  Blender (x, -z, y)
        rows.append((bm.verts.new((-width / 2, -radius * ca, radius * sa)), bm.verts.new((width / 2, -radius * ca, radius * sa)), i / seg))
    for i in range(seg):
        a0, b0, v_a = rows[i]
        a1, b1, v_b = rows[i + 1]
        f = bm.faces.new((a0, b0, b1, a1))
        for loop, (u, v) in zip(f.loops, [(0, v_a), (1, v_a), (1, v_b), (0, v_b)]):
            loop[uvl].uv = (u, (v + v0) % 1.0 if False else v + v0)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _obj(bm, name, m)
    o.data.shade_smooth()
    return place(o, x, y, z, parent=parent)
