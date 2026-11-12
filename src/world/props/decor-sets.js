import * as THREE from 'three';
import { Batch } from '../../gfx/geometry.js';
import { glowTexture } from '../procedural-textures.js';
import { COUNTER, HALL, RECEPTION } from '../layout.js';
import { placeProp } from './assets.js';
import { batchModel, hasModel, paletteRemap } from './models.js';
import { painting } from './decor.js';

/**
 * CONJUNTOS DE DECORACIÓN que vende Sofía. Cada conjunto es un grupo de piezas reales repartidas por la sala;
 * se ve solo si se ha comprado y aparece con una animación pieza a pieza. `focus` es el encuadre de la
 * cámara en la presentación de la compra.
 */
export const DECOR_SETS = Object.freeze({
  'decor-vases': Object.freeze({ focus: { x: 0, y: 1.1, z: 8.2, r: 5.2, h: 1.4 } }),
  'decor-gallery': Object.freeze({ focus: { x: 0, y: 2.3, z: 0, r: 6.5, h: 1.2 } }),
  'decor-velvet': Object.freeze({ focus: { x: 0, y: 0.8, z: 7.6, r: 4.2, h: 1.4 } }),
  'decor-lamps': Object.freeze({ focus: { x: 0, y: 1.4, z: 1.5, r: 7, h: 1.8 } }),
  'decor-busts': Object.freeze({ focus: { x: 0, y: 1.3, z: -3.2, r: 5.2, h: 1.2 } }),
});

const item = (set, obj) => {
  set.group.add(obj);
  set.items.push(obj);
  return obj;
};
const adopt = (set, obj) => {
  if (!obj) return null;
  obj.removeFromParent();
  return item(set, obj);
};

/** Pedestal de mármol con moldura de latón (para jarrones y bustos). */
function pedestal(ctx, x, z, h = 0.95) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (hasModel('pedestal')) {
    // pedestal de mármol acanalado modelado a mano (0,95 m); se estira si hace falta más alto
    const b = new Batch();
    batchModel(b.at({ scale: 1 }), 'pedestal', paletteRemap(ctx));
    b.build(g, { cast: ctx.g.shadows });
    g.scale.y = h / 0.95;
    return g;
  }
  const b = new Batch();
  const { H, M } = ctx;
  H.box(b, M.marbleLight, 0.46, 0.08, 0.46, 0, 0.04, 0, { r: 0.01 });
  H.box(b, M.marbleLight, 0.32, h - 0.16, 0.32, 0, h / 2, 0, { r: 0.012 });
  H.box(b, M.brass, 0.36, 0.02, 0.36, 0, 0.1, 0, { r: 0.004 });
  H.box(b, M.marbleLight, 0.44, 0.08, 0.44, 0, h - 0.04, 0, { r: 0.01 });
  H.box(b, M.brass, 0.46, 0.015, 0.46, 0, h - 0.09, 0, { r: 0.003 });
  b.build(g, { cast: ctx.g.shadows });
  return g;
}

export function buildDecorSets(ctx, { addCollider }) {
  const sets = new Map();
  const make = (id) => {
    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    ctx.root.add(group);
    const set = { id, group, items: [], colliders: [], ...DECOR_SETS[id] };
    sets.set(id, set);
    return set;
  };

  // ---------------- jarrones con flores: recepción, mostrador y dos pedestales a la entrada
  {
    const s = make('decor-vases');
    const vase = (x, y, z, height, yaw = 0) => adopt(s, placeProp(ctx, 'vase', { x, y, z, yaw, height }));
    vase(RECEPTION.x + 1.75, 1.06, RECEPTION.z + 0.05, 0.5, 0.6);
    vase(COUNTER.x - 1.9, 1.12, COUNTER.z + 0.25, 0.45, 2.1);
    for (const sx of [-1, 1]) {
      item(s, pedestal(ctx, sx * 4.55, 10.35));
      // jarrón de latón grabado (real) sobre el pedestal; si no está, jarrón con flores
      if (!adopt(s, placeProp(ctx, 'brass_vase', { x: sx * 4.55, y: 0.95, z: 10.35, yaw: sx * 0.8 }))) vase(sx * 4.55, 0.95, 10.35, 0.62, sx * 0.8);
      s.colliders.push(addCollider(sx * 4.55, 10.35, 0.5, 0.5, false));
    }
  }

  // ---------------- galería de óleos con luz de cuadro (sin luces dinámicas: el brillo va en el emisivo)
  {
    const s = make('decor-gallery');
    const spots = [
      { x: 8.6, y: 2.75, z: HALL.minZ + 0.05, yaw: 0, seed: 'gal-1', w: 1.3, h: 1.0 },
      { x: -3.7, y: 2.95, z: HALL.minZ + 0.05, yaw: 0, seed: 'gal-2', w: 1.1, h: 0.85 },
      { x: HALL.maxX - 0.05, y: 2.65, z: -0.95, yaw: -Math.PI / 2, seed: 'gal-3', w: 1.0, h: 1.3 },
      { x: HALL.minX + 0.05, y: 2.65, z: -0.95, yaw: Math.PI / 2, seed: 'gal-4', w: 1.0, h: 1.3 },
    ];
    const lampGlow = ctx.kit.make({ color: 0x3b2a10, emissive: 0xffe2b0, emissiveIntensity: 2.2, rough: 0.4 });
    const wash = ctx.kit.basic({ map: ctx.track(glowTexture()), color: 0xffd9a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    wash.toneMapped = true;
    for (const p of spots) {
      const grp = painting(ctx, p);
      adopt(s, grp);
      // lámpara de cuadro: brazo de latón y tubo encendido sobre el marco
      const b = new Batch();
      const top = p.h / 2 + 0.25;
      ctx.H.box(b, ctx.M.brass, 0.03, 0.03, 0.22, 0, top + 0.02, 0.11, { r: 0.008, rx: -0.5 });
      ctx.H.cyl(b, ctx.M.brass, 0.035, 0.035, p.w * 0.7, 0, top + 0.06, 0.22, { segments: 14, rz: Math.PI / 2 });
      ctx.H.box(b, lampGlow, p.w * 0.66, 0.012, 0.03, 0, top + 0.03, 0.22, { r: 0 });
      b.build(grp, { cast: false });
      // reflejo cálido de la luz sobre el lienzo
      const glow = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(p.w * 1.3, p.h * 0.9)), wash);
      glow.position.set(0, p.h * 0.12, 0.06);
      grp.add(glow);
    }
  }

  // ---------------- sofás de terciopelo a ambos lados del pasillo central
  {
    const s = make('decor-velvet');
    for (const sx of [-1, 1]) {
      const x = sx * 3.25;
      const sofa = adopt(s, placeProp(ctx, 'sofa', { x, z: 8.0, yaw: -sx * Math.PI / 2 }));
      if (!sofa) continue;
      s.colliders.push(addCollider(x, 8.0, 0.8, 1.7, false));
      // mesilla clásica a cada lado con flores
      for (const z of [6.95, 9.05]) {
        const ns = adopt(s, placeProp(ctx, 'nightstand', { x, z, yaw: -sx * Math.PI / 2 }));
        if (!ns) continue;
        adopt(s, placeProp(ctx, 'vase', { x, y: 0.7, z, height: 0.34 }));
        s.colliders.push(addCollider(x, z, 0.5, 0.6, false));
      }
    }
  }

  // ---------------- lámparas de pie art déco junto a las paredes (pantalla encendida y halo en el suelo)
  {
    const s = make('decor-lamps');
    const shade = ctx.kit.make({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.3, rough: 0.6, side: THREE.DoubleSide });
    const pool = ctx.kit.basic({ map: ctx.track(glowTexture()), color: 0xffb860, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
    pool.toneMapped = true;
    const spots = [[-13.2, -6.5], [13.2, -6.4], [-13.2, -1.3], [13.2, 6.0], [-7.9, 10.45], [7.9, 10.45]];
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const b = new Batch();
      const { H, M } = ctx;
      if (hasModel('floor_lamp')) {
        batchModel(b.at({}), 'floor_lamp', paletteRemap(ctx, { shade }));
        b.build(g, { cast: ctx.g.shadows });
        const halo = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(1.6, 1.6)), pool);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.012;
        g.add(halo);
        item(s, g);
        s.colliders.push(addCollider(x, z, 0.42, 0.42, false));
        continue;
      }
      H.lathe(b, M.brass, [[0, 0], [0.2, 0], [0.21, 0.02], [0.12, 0.05], [0.03, 0.08], [0, 0.08]], 0, 0, 0, { segments: 24 });
      H.cyl(b, M.brass, 0.014, 0.014, 1.42, 0, 0.78, 0, { segments: 10 });
      for (const y of [0.45, 0.95]) H.torus(b, M.brass, 0.022, 0.006, 0, y, 0, { rx: Math.PI / 2, segments: 12 });
      H.lathe(b, shade, [[0.13, 0], [0.22, 0], [0.12, 0.3], [0.07, 0.3]], 0, 1.42, 0, { segments: 24 });
      H.cyl(b, M.brass, 0.05, 0.03, 0.06, 0, 1.43, 0, { segments: 12 });
      b.build(g, { cast: ctx.g.shadows });
      const halo = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(1.6, 1.6)), pool);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.012;
      g.add(halo);
      item(s, g);
      s.colliders.push(addCollider(x, z, 0.42, 0.42, false));
    }
  }

  // ---------------- bustos de mármol en pedestales alrededor del estrado de THE CLASSIC
  {
    const s = make('decor-busts');
    for (const [x, z, yaw] of [[-3.3, -6.6, -2.37], [3.3, -6.6, 2.37], [-3.3, 0.2, -0.77], [3.3, 0.2, 0.77]]) { // miran hacia fuera, a los visitantes
      item(s, pedestal(ctx, x, z, 1.1));
      if (!adopt(s, placeProp(ctx, 'bust', { x, y: 1.1, z, yaw, scale: 1.25 }))) adopt(s, placeProp(ctx, 'brass_vase', { x, y: 1.1, z, yaw }));
      s.colliders.push(addCollider(x, z, 0.5, 0.5, false));
    }
  }

  return sets;
}
