import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { bakeMaterial } from '../gfx/shader-textures.js';
import { bumpNormal, felt } from '../gfx/textures.js';

/**
 * Paleta de materiales del casino (dirección de arte: gran casino art déco).
 *
 * Las superficies grandes usan materiales horneados en la GPU (gfx/shader-textures.js) con color,
 * rugosidad y relieve coherentes, mapeados en coordenadas de mundo (`worldUV`: metros por repetición),
 * así la escala es real en cualquier pieza. Todo lo «de superficie» lleva suciedad de la zona `hall`;
 * los emisivos no. Los reflejos son contenidos: nada de suelos-espejo ni barnices exagerados.
 */
export function createPalette(kit, g, renderer) {
  const size = Math.max(512, Math.min(1024, g.textureSize)); // con UV de mundo 1024 basta y cabe en GPUs modestas
  const clear = g.material === 'physical';
  const dirt = 'hall';
  const baked = (r) => bakeMaterial(renderer, r, size);
  const marble = baked('marble');
  const walnut = baked('walnut');
  const silk = baked('damask');
  const rug = baked('carpet');
  const plaster = baked('plaster');
  const leatherTex = baked('leather');
  const brushed = baked('brushed');
  const fabricBump = bumpNormal(Math.min(size, 512), { scale: 64, strength: 1.6, seed: 'fabric' });

  const surface = (tex, o) => kit.make({ map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, bakedNormal: true, rough: 1, ...o });

  const M = {
    // losas de mármol de 1,2 m (la textura cubre 4×4 losas)
    floor: () => surface(marble, { normalScale: 0.55, envIntensity: 1, clearcoat: clear ? 0.12 : 0, clearcoatRough: 0.2, dirt, worldUV: 4.8 }),
    carpet: () => surface(rug, { normalScale: 0.8, envIntensity: 0.4, dirt, worldUV: 2.4 }),
    wall: () => surface(silk, { normalScale: 0.35, envIntensity: 0.6, sheen: clear ? 0.35 : 0, sheenColor: 0xff8a90, dirt, worldUV: 2.4 }),
    wallPlain: kit.make({ color: 0x2a1a1c, rough: 0.85, dirt }),
    ceiling: surface(plaster, { normalScale: 0.4, envIntensity: 0.5, dirt, grimeStrength: 1.1, worldUV: 3 }),
    wood: () => surface(walnut, { color: 0xffd2a8, normalScale: 0.45, envIntensity: 0.8, clearcoat: clear ? 0.2 : 0, dirt, worldUV: 1.6 }),
    woodDark: () => surface(walnut, { normalScale: 0.45, envIntensity: 0.8, clearcoat: clear ? 0.25 : 0, dirt, worldUV: 1.6 }),
    gold: kit.make({ color: PALETTE.gold, metal: 1, rough: 0.4, envIntensity: 0.75, dirt }),
    brass: surface(brushed, { metal: 1, color: 0xd9b986, envIntensity: 0.8, dirt, worldUV: 1 }),
    chrome: kit.make({ color: 0xb9bcc0, metal: 1, rough: 0.26, envIntensity: 0.8, dirt }),
    steel: kit.make({ color: 0x4a4d52, metal: 0.8, rough: 0.5, dirt }),
    carbon: kit.make({ color: 0x161416, metal: 0.4, rough: 0.45, dirt }),
    black: kit.make({ color: 0x0a080b, rough: 0.6, dirt }),
    lacquer: kit.make({ color: 0x0b0709, rough: 0.3, metal: 0, envIntensity: 0.65, clearcoat: clear ? 0.5 : 0, dirt }),
    marble: surface(marble, { normalScale: 0.4, envIntensity: 1, dirt, worldUV: 4.8 }),
    marbleLight: kit.make({ color: 0xb8afa1, metal: 0, rough: 0.26, envIntensity: 0.8, dirt }),
    velvet: kit.make({ color: 0x6a0f20, rough: 0.92, normalMap: fabricBump, normalScale: 0.4, sheen: 0.7, sheenColor: 0xff7088, dirt }),
    velvetGreen: kit.make({ color: 0x0d4032, rough: 0.92, sheen: 0.5, sheenColor: 0x70ffc0, dirt }),
    leather: surface(leatherTex, { normalScale: 0.6, envIntensity: 0.7, clearcoat: clear ? 0.15 : 0, dirt, worldUV: 0.8 }),
    feltGreen: () => kit.make({ map: felt(Math.min(size, 512)), rough: 1, dirt }),
    feltRed: () => kit.make({ map: felt(Math.min(size, 512), [112, 18, 36]), rough: 1, dirt }),
    glass: kit.make({ color: 0xbfd4d6, metal: 0, rough: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    cloth: kit.make({ color: 0xa69d8a, rough: 1, normalMap: fabricBump, bakedNormal: true, normalScale: 0.7, side: THREE.DoubleSide, dirt, grimeStrength: 1.3 }),
    paper: kit.make({ color: 0xb9b2a2, rough: 1, dirt }),
    // emisivos: sin suciedad
    amber: kit.make({ color: 0x3b1d05, emissive: 0xffa43a, emissiveIntensity: 0.9, rough: 0.3 }),
    bulb: kit.make({ color: 0x3b2a10, emissive: 0xffe0a0, emissiveIntensity: 1.6, rough: 0.4 }),
    bulbDead: kit.make({ color: 0x1b1712, rough: 0.5 }),
    // apliques fundidos que se reparan al arreglar la instalación eléctrica (emisivo 0 → encendido)
    sconceDead: kit.make({ color: 0x1b1712, emissive: 0xffe0a0, emissiveIntensity: 0, rough: 0.5 }),
    cove: kit.make({ color: 0x2a1404, emissive: 0xffb45a, emissiveIntensity: 1.4 }),
    downlight: kit.make({ color: 0x302010, emissive: 0xfff0d6, emissiveIntensity: 2.2 }),
    screenOff: kit.make({ color: 0x050607, rough: 0.2, metal: 0.4 }),
    screenGlow: kit.make({ color: 0x06241e, emissive: 0x66ffcc, emissiveIntensity: 1.1 }),
  };

  /** Pinturas decorativas para cuadros. */
  M.tint = (hex, opts = {}) => kit.make({ color: hex, rough: 0.6, dirt, ...opts });
  return M;
}
