import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Utilidades de geometría procedural.
 *
 *  - seg(detail, n): nº de segmentos escalado por el nivel de calidad (modelos más/menos finos).
 *  - roundedBox: caja con aristas biseladas (nada de «cajas» cortantes: así se ve la luz en los bordes).
 *  - Batch: acumula piezas estáticas y las FUSIONA por material → pocas llamadas de dibujo.
 */

export const seg = (detail, n, min = 3) => Math.max(min, Math.round(n * detail));

export function roundedBox(w, h, d, r, detail = 1) {
  const radius = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return new RoundedBoxGeometry(w, h, d, detail >= 1 ? 3 : 1, Math.max(0.001, radius));
}

/** Quita atributos que no comparten todas las piezas para poder fusionarlas. */
function normalize(geometry) {
  const g = geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

export class Batch {
  #items = new Map(); // material → [geometry]
  #temp = new THREE.Object3D();

  /**
   * @param {THREE.BufferGeometry} geometry (se clona; la original puede reutilizarse)
   * @param {THREE.Material} material
   * @param {{x?:number,y?:number,z?:number,rx?:number,ry?:number,rz?:number,sx?:number,sy?:number,sz?:number}} t
   */
  add(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const o = this.#temp;
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    const g = normalize(geometry);
    g.applyMatrix4(o.matrix);
    if (!this.#items.has(material)) this.#items.set(material, []);
    this.#items.get(material).push(g);
    return this;
  }

  /**
   * Adaptador con transformación de padre: lo que se añada se coloca en (x,y,z) con giro `yaw`.
   * Permite que un mueble se describa en coordenadas locales y se instancie en cualquier sitio.
   */
  at({ x = 0, y = 0, z = 0, yaw = 0, scale = 1 } = {}) {
    const parent = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    const self = this;
    const local = new THREE.Object3D();
    const adapter = {
      add(geometry, material, { x: lx = 0, y: ly = 0, z: lz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
        local.position.set(lx, ly, lz);
        local.rotation.set(rx, ry, rz);
        local.scale.set(sx, sy, sz);
        local.updateMatrix();
        const g = normalize(geometry);
        g.applyMatrix4(local.matrix).applyMatrix4(parent);
        if (!self.#items.has(material)) self.#items.set(material, []);
        self.#items.get(material).push(g);
        return adapter;
      },
      at(t) {
        // composición: hijo dentro de este adaptador
        const inner = new THREE.Matrix4().compose(
          new THREE.Vector3(t.x ?? 0, t.y ?? 0, t.z ?? 0),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw ?? 0),
          new THREE.Vector3(t.scale ?? 1, t.scale ?? 1, t.scale ?? 1),
        );
        const composed = parent.clone().multiply(inner);
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        composed.decompose(p, q, s);
        const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        return self.at({ x: p.x, y: p.y, z: p.z, yaw: e.y, scale: s.x });
      },
    };
    return adapter;
  }

  get size() {
    let n = 0;
    for (const list of this.#items.values()) n += list.length;
    return n;
  }

  /**
   * Fusiona por material y añade las mallas al padre.
   * @returns {THREE.Mesh[]}
   */
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [material, list] of this.#items) {
      const indexed = list.every((g) => g.index);
      const parts = indexed ? list : list.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(parts, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      if (material.userData?.worldUV) worldBoxUV(merged, material.userData.worldUV);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.#items.clear();
    return meshes;
  }
}

/**
 * UV en coordenadas de mundo (proyección por caras según la normal): la textura mantiene su escala
 * real en cualquier pieza, sin depender de cómo se modeló. `tile` = metros por repetición.
 */
export function worldBoxUV(geometry, tile = 2.4) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  if (!pos || !nor) return geometry;
  let uv = geometry.attributes.uv;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geometry.setAttribute('uv', uv);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x / tile, -z / tile);
    else if (ax >= az) uv.setXY(i, (nor.getX(i) > 0 ? -z : z) / tile, y / tile);
    else uv.setXY(i, (nor.getZ(i) > 0 ? x : -x) / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Perfil de torno (Lathe) a partir de pares [radio, altura]. */
export function lathe(points, detail = 1, segments = 24) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg(detail, segments, 6));
}

/** Extruye una silueta 2D (array de [x,y]) con bisel. */
export function extrude(points, depth, { bevel = 0.01, detail = 1 } = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: detail >= 1 ? 2 : 1,
    curveSegments: seg(detail, 8, 2),
  });
}

/** Caja cuyas UV están en «teselas» de `tile` metros: la textura no se estira según el tamaño del muro. */
export function tiledBox(w, h, d, tile = 2.4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [a, b] = dims[Math.floor(i / 4)];
    uv.setXY(i, (uv.getX(i) * a) / tile, (uv.getY(i) * b) / tile);
  }
  return g;
}

/** Plano horizontal (suelo/techo) con UV en teselas de `tile` metros. */
export function tiledPlane(w, d, tile = 2.4) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  return g;
}
