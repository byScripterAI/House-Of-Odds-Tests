import * as THREE from 'three';
import { gltfLoader } from '../../gfx/gltf.js';

/**
 * MODELOS PROPIOS (modelados a mano en Blender; fuentes en scripts/models/*.py).
 *
 * Los materiales del GLB llevan como nombre una CLAVE: al colocar el modelo se sustituyen por los del juego
 * (oro, cromo, lacado, terciopelo… con su suciedad, reflejos y calidad), así encajan con el resto de la sala.
 * Las claves que no se sustituyen (texturas propias: placa electrónica, rejilla…) se quedan como vienen.
 * Los nodos con nombre en mayúscula son piezas que se animan (puertas, botones…).
 */
export const MODEL_FILES = Object.freeze([
  'classic', 'slot', 'slot_sheet', 'stool', 'blackjack_table', 'roulette_table', 'bench', 'floor_lamp', 'pedestal', 'statue', 'pegboard',
  'pilaster', 'door_frame_22', 'door_leaves_22', 'door_frame_40', 'door_leaves_40', 'pendant', 'counter', 'reception', 'wheel', 'bucket', 'wetsign',
]);

const BASE = new URL('../../../assets/models/', import.meta.url).href;
const templates = new Map();

export async function loadModels(onProgress = () => {}) {
  const loader = gltfLoader();
  let done = 0;
  await Promise.all(MODEL_FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`${BASE}${name}.glb`);
      gltf.scene.traverse((o) => {
        if (o.isMesh) o.userData.sharedAsset = true; // no se libera al reconstruir el casino
      });
      templates.set(name, gltf.scene);
    } catch (e) {
      console.warn('[models] no se pudo cargar', name, e);
    }
    onProgress(++done / MODEL_FILES.length);
  }));
}

export const hasModel = (name) => templates.has(name);

/** Clave de material de un GLB (sin sufijos «.001» de Blender). */
export const matKey = (m) => String(m?.name ?? '').replace(/\.\d+$/, '');

/**
 * Copia del modelo con los materiales sustituidos. `remap(key, original)` devuelve el material del juego o
 * null para conservar el original. Geometría compartida con la plantilla.
 */
export function instantiate(name, remap = () => null) {
  const tpl = templates.get(name);
  if (!tpl) return null;
  const root = tpl.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map((m) => remap(matKey(m), m) ?? m);
    o.material = mats.length === 1 ? mats[0] : mats;
  });
  return root;
}

/** Copia en coma flotante (los GLB comprimidos traen posiciones cuantizadas que no se pueden fusionar). */
function floatGeometry(o) {
  if (o.userData.floatGeo) return o.userData.floatGeo;
  const src = o.geometry;
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = src.attributes[k];
    if (!a) continue;
    const n = a.itemSize;
    const arr = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) {
      arr[i * n] = a.getX(i);
      if (n > 1) arr[i * n + 1] = a.getY(i);
      if (n > 2) arr[i * n + 2] = a.getZ(i);
    }
    g.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  if (src.index) g.setIndex(Array.from(src.index.array));
  if (g.attributes.normal) {
    const nn = g.attributes.normal;
    const v = new THREE.Vector3();
    for (let i = 0; i < nn.count; i++) {
      v.fromBufferAttribute(nn, i).normalize();
      nn.setXYZ(i, v.x, v.y, v.z);
    }
  }
  o.userData.floatGeo = g;
  return g;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/**
 * Añade el modelo a un lote estático (`B` = adaptador de Batch.at): se fusiona con el resto del mobiliario
 * por material, así veinte máquinas cuestan lo mismo que una en llamadas de dibujo.
 * `skip(node)` permite dejar fuera piezas (p. ej. las que se animan aparte).
 */
export function batchModel(B, name, remap = () => null, { skip = null } = {}) {
  const tpl = templates.get(name);
  if (!tpl) return false;
  tpl.updateMatrixWorld(true);
  tpl.traverse((o) => {
    if (!o.isMesh || skip?.(o)) return;
    const mat = remap(matKey(o.material), o.material) ?? o.material;
    if (!mat) return;
    _m.copy(o.matrixWorld).decompose(_p, _q, _s);
    _e.setFromQuaternion(_q, 'XYZ');
    B.add(floatGeometry(o), mat, { x: _p.x, y: _p.y, z: _p.z, rx: _e.x, ry: _e.y, rz: _e.z, sx: _s.x, sy: _s.y, sz: _s.z });
  });
  return true;
}

/** Material de la paleta del casino por clave (las fábricas, p. ej. `woodDark()`, se crean una vez por casino). */
export function paletteMat(ctx, key) {
  const cache = (ctx.modelMats ??= {});
  if (key in cache) return cache[key];
  let m = ctx.M[key];
  if (typeof m === 'function') m = key === 'tint' ? null : m();
  cache[key] = m?.isMaterial ? m : null;
  return cache[key];
}

/** Sustitución estándar: primero `overrides[clave]`, luego la paleta; si no, el material del GLB. */
export const paletteRemap = (ctx, overrides = {}) => (key) => overrides[key] ?? paletteMat(ctx, key);
