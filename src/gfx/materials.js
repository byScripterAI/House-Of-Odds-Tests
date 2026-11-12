import * as THREE from 'three';
import { grimify } from './grime.js';
import { grimeMask } from './textures.js';

/**
 * Fábrica de materiales según el nivel de calidad.
 *
 *  - MUY BAJA → Lambert (sin PBR, sin mapas de relieve, metales «falsos» con emisivo).
 *  - BAJA/MEDIA → Standard (rugosidad/metal; relieve solo si hay resolución).
 *  - ALTA/ULTRA → Physical (barniz en madera y mármol, brillo de terciopelo).
 *
 * Todo lo que se crea se registra para poder liberarlo con `dispose()`.
 * Los materiales con `dirt` reciben la capa de suciedad de su zona.
 */
export function createMaterialKit(graphics, { dirt = {} } = {}) {
  const owned = new Set();
  const track = (o) => (owned.add(o), o);
  const cls = graphics.material;
  const mask = grimeMask(graphics.textureSize);
  const aniso = graphics.anisotropy;
  const bumps = graphics.textureSize >= 512 && cls !== 'lambert';

  /** Clona una textura (comparte la imagen) con otra repetición. */
  function tex(base, repeat = [1, 1]) {
    const t = track(base.clone());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = Math.min(aniso, base.anisotropy || aniso);
    t.needsUpdate = true;
    return t;
  }

  /**
   * @param {object} o
   * @param {number|string} [o.color]
   * @param {THREE.Texture} [o.map]
   * @param {THREE.Texture} [o.normalMap]
   * @param {number} [o.rough] @param {number} [o.metal]
   * @param {number|string} [o.emissive] @param {number} [o.emissiveIntensity]
   * @param {number} [o.clearcoat] @param {number} [o.sheen]
   * @param {string|null} [o.dirt] zona cuyo uniform de suciedad usa (null → limpio siempre)
   * @param {number} [o.grimeStrength]
   */
  function make(o = {}) {
    const color = new THREE.Color(o.color ?? 0xffffff);
    const rough = o.rough ?? 0.6;
    const metal = o.metal ?? 0;
    const common = {
      map: o.map ?? null,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite ?? true,
    };
    let m;
    if (cls === 'lambert') {
      // Metales «falsos»: más claros y con algo de emisivo para que sigan brillando.
      const fake = color.clone().multiplyScalar(0.8 + metal * 0.3);
      const emissive = o.emissive !== undefined ? new THREE.Color(o.emissive) : color.clone().multiplyScalar(metal * 0.16);
      m = new THREE.MeshLambertMaterial({ ...common, color: fake, emissive, emissiveIntensity: o.emissiveIntensity ?? 1 });
    } else {
      const params = {
        ...common,
        color,
        roughness: rough,
        metalness: metal,
        emissive: o.emissive !== undefined ? new THREE.Color(o.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: o.emissiveIntensity ?? 1,
        envMapIntensity: o.envIntensity ?? 1,
      };
      if (o.roughnessMap) params.roughnessMap = o.roughnessMap;
      if (o.normalMap && (bumps || o.bakedNormal)) {
        params.normalMap = o.normalMap;
        params.normalScale = new THREE.Vector2(o.normalScale ?? 0.6, o.normalScale ?? 0.6);
      }
      if (cls === 'physical') {
        params.clearcoat = o.clearcoat ?? 0;
        params.clearcoatRoughness = o.clearcoatRough ?? 0.15;
        if (o.sheen) {
          params.sheen = o.sheen;
          params.sheenColor = new THREE.Color(o.sheenColor ?? 0xffb0c0);
          params.sheenRoughness = 0.5;
        }
        m = new THREE.MeshPhysicalMaterial(params);
      } else {
        m = new THREE.MeshStandardMaterial(params);
      }
    }
    if (o.dirt && dirt[o.dirt]) grimify(m, { uniform: dirt[o.dirt], mask, strength: o.grimeStrength ?? 1 });
    if (o.worldUV) m.userData.worldUV = o.worldUV;
    return track(m);
  }

  /** Material sin iluminación (rótulos, neones, pantallas). */
  function basic(o = {}) {
    return track(new THREE.MeshBasicMaterial({ toneMapped: false, ...o }));
  }

  return {
    make,
    basic,
    tex,
    track,
    bumps,
    class: cls,
    dispose() {
      for (const o of owned) o.dispose?.();
      owned.clear();
    },
  };
}
