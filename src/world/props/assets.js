import * as THREE from 'three';
import { gltfLoader } from '../../gfx/gltf.js';

/**
 * MOBILIARIO Y ATREZO REAL (modelos escaneados o modelados a mano). Se cargan una vez en la pantalla de
 * carga y cada colocación es un clon que comparte geometría, materiales y texturas. Créditos y licencias en
 * assets/props/LICENSE-props.txt, CREDITS.md y la pantalla de créditos.
 *
 *  Khronos glTF Sample Assets:  plant (CC BY 4.0 / CC0) · vase (jarrones con flores, CC0)
 *  Poly Haven (CC0):             armchair · sofa · coffee_table · chandelier_01 · chandelier_03 · console ·
 *                                nightstand · brass_vase · bust · tool_chest · work_table · ladder · crate · crate_01 ·
 *                                cardboard_box · utility_box · power_box
 */
export const PROP_FILES = Object.freeze([
  'plant', 'vase', 'armchair', 'sofa', 'coffee_table', 'chandelier_01', 'chandelier_03', 'console', 'nightstand',
  'brass_vase', 'bust', 'tool_chest', 'work_table', 'ladder', 'crate', 'crate_01', 'cardboard_box', 'utility_box', 'power_box',
]);

const BASE = new URL('../../../assets/props/', import.meta.url).href;
/** Escala propia de algunos modelos (para que encajen en tamaño con el resto del mobiliario). */
export const PROP_SCALE = Object.freeze({ sofa: 1.25 });
const templates = new Map();

export async function loadProps(onProgress = () => {}) {
  const loader = gltfLoader();
  let done = 0;
  await Promise.all(PROP_FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`${BASE}${name}.glb`);
      const root = gltf.scene;
      // la maceta de muestra trae dos luciérnagas animadas (6 mallas diminutas por planta): fuera
      const drop = [];
      root.traverse((o) => {
        if (/firefly/i.test(o.name)) drop.push(o);
      });
      for (const o of drop) o.removeFromParent();
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.sharedAsset = true; // no se libera al reconstruir el casino
        for (const m of [].concat(o.material)) {
          m.envMapIntensity = 0.8;
          if (m.transparent && m.opacity < 1) o.castShadow = false;
        }
      });
      // apoyado en el suelo y centrado en XZ
      // tamaño de casino: el sofá de muestra era pequeño al lado de los sillones (0,8 m de alto frente a 1,07)
      const k = PROP_SCALE[name] ?? 1;
      root.scale.multiplyScalar(k);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      root.position.set(root.position.x - c.x, root.position.y - box.min.y, root.position.z - c.z);
      const wrap = new THREE.Group();
      wrap.add(root);
      wrap.userData.size = box.getSize(new THREE.Vector3());
      templates.set(name, wrap);
    } catch (e) {
      console.warn('[props] no se pudo cargar', name, e);
    }
    onProgress(++done / PROP_FILES.length);
  }));
}

export const hasProp = (name) => templates.has(name);

/**
 * Coloca un mueble real. `height` escala para alcanzar esa altura (m); si no, `scale`.
 * Devuelve el grupo (o null si el recurso no está: el llamante usa su versión procedural).
 */
export function placeProp(ctx, name, { x = 0, y = 0, z = 0, yaw = 0, scale = 1, height = null, tint = null } = {}) {
  const tpl = templates.get(name);
  if (!tpl) return null;
  const g = tpl.clone(true);
  const k = height ? height / tpl.userData.size.y : scale;
  g.scale.setScalar(k);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !!ctx.g.shadows && ![].concat(o.material).some((m) => m.transparent);
    o.receiveShadow = true;
    if (tint) {
      // recolor sin tocar el original: material propio solo para esta pieza
      o.material = [].concat(o.material).map((m) => {
        const c = m.clone();
        c.color?.multiply(new THREE.Color(tint));
        ctx.track(c);
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    }
  });
  g.updateMatrixWorld(true);
  ctx.root.add(g);
  return g;
}
