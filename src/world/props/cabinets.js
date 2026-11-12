import { stool } from './furniture.js';
import { batchModel } from './models.js';
import { toWorld } from './tables.js';

/** Colores de las máquinas de la sala (mismo modelo, distinta pintura). */
const PAINTS = [0x17603a, 0x8e1424, 0x1a3c86];

/** Materiales compartidos por todas las máquinas de la sala (el brillo se enciende con `setSlotsLit`). */
function slotMaterials(ctx) {
  if (ctx.slotMats) return ctx.slotMats;
  const { kit, M } = ctx;
  const paints = PAINTS.map((color) => kit.make({ color, rough: 0.3, metal: 0.25, envIntensity: 0.9, clearcoat: 0.6, clearcoatRough: 0.12, dirt: 'hall' }));
  const glowFrom = (orig, k = 1) => {
    const m = kit.make({ map: orig?.map ?? null, rough: 0.35, dirt: null });
    if (orig?.map) m.emissiveMap = orig.map;
    m.emissive.set(0xffffff);
    m.userData.glow = k;
    return m;
  };
  const S = (ctx.slotMats = {
    paints,
    lamp: kit.make({ color: 0x3b2a10, emissive: 0xffe0a0, emissiveIntensity: 0, rough: 0.4 }),
    payline: kit.make({ color: 0x400810, emissive: 0xff3050, emissiveIntensity: 0, rough: 0.4 }),
    glow: [],
    lit: null,
  });
  S.glowFor = (key, orig) => (S[key] ??= (() => {
    const m = glowFrom(orig, key === 'reel' ? 0.32 : 0.55);
    S.glow.push(m);
    return m;
  })());
  S.glow.push(S.lamp, S.payline);
  S.lamp.userData.glow = 1.6;
  S.payline.userData.glow = 1.0;
  void M;
  return S;
}

/** Enciende o apaga el brillo de todas las máquinas de la sala (cuando el casino vuelve a abrir). */
export function setSlotsLit(ctx, on) {
  const S = ctx.slotMats;
  if (!S || S.lit === on) return;
  S.lit = on;
  for (const m of S.glow) m.emissiveIntensity = on ? m.userData.glow ?? 0.5 : 0;
}

/**
 * Tragaperras de sala «LUCKY 7» (modelo propio, scripts/models/slot.py) o, tapada, con su funda de tela simulada
 * (scripts/models/slot_sheet.py). Frente hacia +Z, origen en el suelo. Las usan los clientes; el jugador no.
 * state: 'sheet' (cubierta con funda) | 'dead' (apagada) | 'lit' (encendida)
 */
export function oldCabinet(ctx, base, { variant = 0, state = 'dead' } = {}) {
  const { M } = ctx;
  const B = ctx.B.at(base);
  if (state === 'sheet' && batchModel(B, 'slot_sheet', (k) => (k === 'cloth' ? M.cloth : null))) return;
  const S = slotMaterials(ctx);
  const paint = S.paints[variant % S.paints.length];
  const remap = (key, orig) => {
    switch (key) {
      case 'paint': return paint;
      case 'chrome': return M.chrome;
      case 'black': case 'cavity': return M.black;
      case 'gold': return M.gold;
      case 'steel': return M.steel;
      case 'lamp': return S.lamp;
      case 'payline': return S.payline;
      case 'belly': case 'topglass': case 'reel': return S.glowFor(key, orig);
      default: return null;
    }
  };
  if (!batchModel(B, 'slot', remap)) {
    // sin el modelo: bloque sencillo
    ctx.H.box(B, paint, 0.74, 1.9, 0.7, 0, 0.95, 0, { r: 0.03 });
  }
  if (state === 'lit') setSlotsLit(ctx, true);
  // taburete con respaldo
  const sPos = { x: 0, z: 0.95 };
  stool(ctx, B.at({ ...sPos, yaw: Math.PI }), { leather: M.leather, back: true });
  ctx.anchors.push({ type: 'machine-seat', game: 'legacy', ...toWorld(base, sPos.x, sPos.z), yaw: base.yaw + Math.PI, sitY: 0.5, stand: toWorld(base, 0, 0.75) });
}

/** Banco (isla) de máquinas espalda con espalda: `count` por cara. */
export function slotBank(ctx, bank, indexOffset = 0) {
  const states = ['dead', 'sheet', 'dead', 'dead', 'sheet', 'dead'];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < bank.count; i++) {
      const lx = (i - (bank.count - 1) / 2) * 1.0;
      const lz = row === 0 ? 0.42 : -0.42;
      const p = toWorld({ x: bank.x, z: bank.z, yaw: bank.yaw }, lx, lz);
      const n = indexOffset + row * bank.count + i;
      oldCabinet(ctx, { x: p.x, z: p.z, yaw: bank.yaw + (row === 0 ? 0 : Math.PI) }, { variant: n, state: states[n % states.length] });
    }
  }
}
