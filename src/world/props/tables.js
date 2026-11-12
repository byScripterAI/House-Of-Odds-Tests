import * as THREE from 'three';
import { extrude } from '../../gfx/geometry.js';
import { blackjackLayout, isRedNumber, rouletteLayout } from '../../gfx/textures.js';
import { stool } from './furniture.js';
import { batchModel, hasModel, paletteMat, paletteRemap } from './models.js';

/** Local → mundo para anclas (misma convención que Object3D.rotation.y). */
export function toWorld(base, lx, lz) {
  const c = Math.cos(base.yaw);
  const s = Math.sin(base.yaw);
  return { x: base.x + lx * c + lz * s, z: base.z - lx * s + lz * c };
}

function decalMaterial(ctx, map) {
  const m = ctx.kit.make({ map, transparent: true, depthWrite: false, rough: 1 });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

/** Mesa de blackjack semicircular. Local: crupier en -Z, jugadores en el lado curvo (+Z). */
export function blackjackTable(ctx, base, { id, felt = 'green', stools = true } = {}) {
  const { H, M, anchors } = ctx;
  const B = ctx.B.at(base);
  const D = ctx.g.detail;
  // Silueta: borde recto del crupier en z=-0.75 y arco hacia +z.
  const outline = (rx, rz, inset = 0) => {
    const pts = [];
    const n = Math.max(10, Math.round(26 * D));
    pts.push([-rx + inset, 0.75 - inset]);
    pts.push([rx - inset, 0.75 - inset]);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI; // 0 → π por abajo (y de forma negativa)
      pts.push([Math.cos(a) * (rx - inset), 0.75 - Math.sin(a) * (rz - inset)]);
    }
    return pts;
  };
  const geo = (key, pts, depth, bevel) => H.geo(key, () => extrude(pts, depth, { bevel, detail: D }).rotateX(-Math.PI / 2));
  // mesa modelada a mano (scripts/models/furniture.py): faldón, paño, reposabrazos de cuero, bandeja y zapato
  const modeled = hasModel('blackjack_table') && batchModel(B, 'blackjack_table', paletteRemap(ctx, { felt: paletteMat(ctx, felt === 'red' ? 'feltRed' : 'feltGreen') }));
  if (modeled) {
    const layout = decalMaterial(ctx, blackjackLayout(Math.min(1024, ctx.g.textureSize * 2)));
    H.plane(B, layout, 3.0, 1.8, 0, 0.936, 0.1);
  }
  if (!modeled) {
  const rim = geo('bj-rim', outline(1.62, 1.65), 0.08, 0.012);
  const top = geo('bj-felt', outline(1.5, 1.53), 0.03, 0.004);
  const base1 = geo('bj-base', outline(1.45, 1.4), 0.78, 0.01);
  B.add(base1, M.woodDark(), { y: 0.0 });
  B.add(rim, M.leather, { y: 0.82 });
  B.add(top, felt === 'red' ? M.feltRed() : M.feltGreen(), { y: 0.9 });
  // franja dorada en el canto
  B.add(geo('bj-trim', outline(1.64, 1.67), 0.02, 0.004), M.gold, { y: 0.8 });
  // trazado del paño
  const layout = decalMaterial(ctx, blackjackLayout(Math.min(1024, ctx.g.textureSize * 2)));
  H.plane(B, layout, 3.0, 1.8, 0, 0.936, 0.1);
  // bandeja de fichas del crupier y zapato de cartas
  H.box(B, M.steel, 1.1, 0.04, 0.22, 0, 0.915, -0.6, { r: 0.01 });
  const colors = [0xb21a2c, 0x111111, 0x1f6b3f, 0x1d3fa0, 0xe8e0c8];
  colors.forEach((c, k) => {
    const chip = ctx.chip(c);
    for (let i = 0; i < 5; i++) H.cyl(B, chip, 0.022, 0.022, 0.008, -0.42 + k * 0.21, 0.938 + i * 0.009, -0.6, { segments: 10 });
  });
  H.box(B, M.carbon, 0.16, 0.08, 0.1, 0.9, 0.97, -0.48, { r: 0.012 });
  H.box(B, M.paper, 0.13, 0.012, 0.07, 0.9, 1.016, -0.48, { r: 0 });
  } else {
    const colors = [0xb21a2c, 0x111111, 0x1f6b3f, 0x1d3fa0, 0xe8e0c8];
    colors.forEach((c, k) => {
      const chip = ctx.chip(c);
      for (let i = 0; i < 5; i++) H.cyl(B, chip, 0.022, 0.022, 0.008, -0.42 + k * 0.21, 0.938 + i * 0.009, -0.6, { segments: 10 });
    });
  }
  // taburetes y anclas
  const seats = [];
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    const lx = Math.sin(a) * 1.72;
    const lz = 0.78 + Math.cos(a) * 0.55;
    if (stools) stool(ctx, B.at({ x: lx, z: lz }), { leather: M.velvet });
    seats.push({ lx, lz, yaw: Math.PI + a * 0.9 });
  }
  const dealer = toWorld(base, 0, -1.2);
  anchors.push({ type: 'dealer', game: 'blackjack', id, ...dealer, yaw: base.yaw });
  seats.forEach((s, i) => anchors.push({ type: 'table-seat', game: 'blackjack', id, seat: i, ...toWorld(base, s.lx, s.lz), yaw: base.yaw + s.yaw, sitY: 0.5 }));
}

/** Medidas compartidas con las vistas jugables (games/*-view.js). */
export const ROULETTE_GEOM = Object.freeze({ wheelX: 1.15, topY: 0.9, layout: Object.freeze({ x: -0.5, y: 0.906, z: 0, w: 2.1, d: 1.05 }) });
export const BLACKJACK_GEOM = Object.freeze({ feltY: 0.938, shoe: Object.freeze({ x: 0.9, y: 1.03, z: -0.48 }), tray: Object.freeze({ x: 0, y: 0.94, z: -0.6 }) });

/**
 * Mesa de ruleta. Local: crupier en -Z, jugadores en +Z, rueda a la derecha (+X).
 * `wheel: false` deja el hueco de la rueda vacío: la pone la vista jugable (games/roulette-view.js), que gira de verdad.
 */
export function rouletteTable(ctx, base, { id, wheel = true } = {}) {
  const { H, M, anchors } = ctx;
  const B = ctx.B.at(base);
  const D = ctx.g.detail;
  // mesa modelada a mano (scripts/models/furniture.py) con el cuenco de la rueda en +X
  const modeled = hasModel('roulette_table') && batchModel(B, 'roulette_table', paletteRemap(ctx, { felt: paletteMat(ctx, 'feltGreen') }));
  if (!modeled) {
    H.box(B, M.woodDark(), 3.1, 0.78, 1.4, 0, 0.39, 0, { r: 0.02 });
    H.box(B, M.leather, 3.34, 0.1, 1.64, 0, 0.83, 0, { r: 0.04 });
    H.box(B, M.gold, 3.38, 0.025, 1.68, 0, 0.79, 0, { r: 0.006 });
    H.box(B, M.feltGreen(), 3.14, 0.03, 1.44, 0, 0.885, 0, { r: 0.004 });
  }
  // paño de apuestas
  const layout = decalMaterial(ctx, rouletteLayout(Math.min(1024, ctx.g.textureSize * 2)));
  H.plane(B, layout, 2.1, 1.05, -0.5, 0.906, 0.0);
  // rueda: cuenco de madera + pista + cono dorado + casillas
  const wx = ROULETTE_GEOM.wheelX;
  if (wheel) {
    const bowl = [[0, 0], [0.5, 0], [0.52, 0.03], [0.5, 0.1], [0.44, 0.13], [0.38, 0.1], [0.3, 0.07], [0.2, 0.08], [0, 0.1]];
    H.lathe(B, M.woodDark(), bowl, wx, 0.9, 0, { segments: 40 });
    H.torus(B, M.gold, 0.5, 0.016, wx, 1.02, 0, { segments: 40 });
    const red = ctx.kit.make({ color: 0xa4182c, rough: 0.4 });
    const black = ctx.kit.make({ color: 0x0b0b0d, rough: 0.4 });
    const green = ctx.kit.make({ color: 0x0c7a3c, rough: 0.4 });
    const order = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    order.forEach((n, i) => {
      const a = (i / order.length) * Math.PI * 2;
      const mat = n === 0 ? green : isRedNumber(n) ? red : black;
      H.box(B, mat, 0.05, 0.012, 0.085, wx + Math.cos(a) * 0.31, 1.0, Math.sin(a) * 0.31, { r: 0, ry: -a });
    });
    H.cyl(B, M.brass, 0.12, 0.2, 0.1, wx, 1.05, 0, { segments: 20 });
    H.sphere(B, M.gold, 0.035, wx, 1.12, 0, { segments: 10 });
    for (let k = 0; k < 4; k++) H.box(B, M.gold, 0.28, 0.012, 0.014, wx + Math.cos(k * Math.PI / 2) * 0.14, 1.11, Math.sin(k * Math.PI / 2) * 0.14, { r: 0, ry: -k * Math.PI / 2 });
  }
  // fichas sobre el paño
  [0xb21a2c, 0x111111, 0x1f6b3f].forEach((c, k) => {
    const chip = ctx.chip(c);
    for (let i = 0; i < 4 + k; i++) H.cyl(B, chip, 0.022, 0.022, 0.008, -1.3 + k * 0.11, 0.912 + i * 0.009, -0.55, { segments: 10 });
  });
  // taburetes y anclas
  const xs = [-1.2, -0.4, 0.4];
  xs.forEach((lx, i) => {
    stool(ctx, B.at({ x: lx, z: 1.12 }), { leather: M.velvet });
    anchors.push({ type: 'table-seat', game: 'roulette', id, seat: i, ...toWorld(base, lx, 1.12), yaw: base.yaw + Math.PI, sitY: 0.5 });
  });
  anchors.push({ type: 'dealer', game: 'roulette', id, ...toWorld(base, 0.5, -1.15), yaw: base.yaw });
  void D;
  void THREE;
}
