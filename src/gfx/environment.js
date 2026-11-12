import * as THREE from 'three';

/**
 * Entorno reflejado (PMREM) generado a partir de paneles de luz de colores,
 * para que metales dorados, mármol y cristal tengan algo que reflejar.
 * Devuelve el render target; el llamante lo libera con `.dispose()`.
 */
export function buildEnvironment(renderer, { warm = 0xfff0d0, accent = 0xc42240, gold = 0xd4af37 } = {}) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0a0608);
  const panel = (w, h, color, k, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  panel(8, 1.2, warm, 6, 0, 9, 0, Math.PI / 2);
  panel(10, 1, 0xffc070, 3, 0, 8, 6, Math.PI / 2);
  panel(8, 4, accent, 2.5, -9, 3, 0, 0, Math.PI / 2);
  panel(8, 4, accent, 2.5, 9, 3, 0, 0, Math.PI / 2);
  panel(6, 3, gold, 1.5, 0, 2, -9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  env.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return target;
}
