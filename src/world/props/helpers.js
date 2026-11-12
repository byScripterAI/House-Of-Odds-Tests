import * as THREE from 'three';
import { lathe, roundedBox, seg } from '../../gfx/geometry.js';

/**
 * Atajos para describir muebles: cada función añade una pieza a un Batch (o a
 * un adaptador `batch.at(...)`) con la geometría escalada por el nivel de calidad.
 * Las geometrías se comparten por clave y se liberan con `dispose()`.
 */
export function createHelpers(detail) {
  const geos = new Map();
  const geo = (key, make) => {
    if (!geos.has(key)) geos.set(key, make());
    return geos.get(key);
  };

  const h = {
    detail,
    geo,
    /** Caja (biselada si la calidad lo permite). */
    box(B, mat, w, hgt, d, x, y, z, { r = 0.015, rx, ry, rz } = {}) {
      const bevel = detail >= 0.5 && r > 0;
      const g = geo(`box|${w}|${hgt}|${d}|${bevel ? r : 0}`, () => (bevel ? roundedBox(w, hgt, d, r, detail) : new THREE.BoxGeometry(w, hgt, d)));
      B.add(g, mat, { x, y, z, rx, ry, rz });
    },
    /** Cilindro/cono truncado (ejes Y). */
    cyl(B, mat, rTop, rBottom, hgt, x, y, z, { segments = 20, rx, ry, rz, open = false } = {}) {
      const n = seg(detail, segments, 6);
      const g = geo(`cyl|${rTop}|${rBottom}|${hgt}|${n}|${open}`, () => new THREE.CylinderGeometry(rTop, rBottom, hgt, n, 1, open));
      B.add(g, mat, { x, y, z, rx, ry, rz });
    },
    sphere(B, mat, r, x, y, z, { segments = 14, sx = 1, sy = 1, sz = 1 } = {}) {
      const n = seg(detail, segments, 5);
      const g = geo(`sph|${r}|${n}`, () => new THREE.SphereGeometry(r, n, Math.max(4, Math.round(n * 0.7))));
      B.add(g, mat, { x, y, z, sx, sy, sz });
    },
    torus(B, mat, r, tube, x, y, z, { rx = Math.PI / 2, ry, rz, arc = Math.PI * 2, segments = 28 } = {}) {
      const n = seg(detail, segments, 8);
      const g = geo(`tor|${r}|${tube}|${n}|${arc}`, () => new THREE.TorusGeometry(r, tube, seg(detail, 8, 4), n, arc));
      B.add(g, mat, { x, y, z, rx, ry, rz });
    },
    plane(B, mat, w, d, x, y, z, { rx = -Math.PI / 2, ry, rz } = {}) {
      const g = geo(`pl|${w}|${d}`, () => new THREE.PlaneGeometry(w, d));
      B.add(g, mat, { x, y, z, rx, ry, rz });
    },
    /** Pieza de torno a partir de un perfil [[radio, altura], …]. */
    lathe(B, mat, profile, x, y, z, { segments = 24, sx = 1, sy = 1, sz = 1, ry } = {}) {
      const g = geo(`lathe|${JSON.stringify(profile)}|${seg(detail, segments, 6)}`, () => lathe(profile, detail, segments));
      B.add(g, mat, { x, y, z, sx, sy, sz, ry });
    },
    dispose() {
      for (const g of geos.values()) g.dispose();
      geos.clear();
    },
  };
  return h;
}
