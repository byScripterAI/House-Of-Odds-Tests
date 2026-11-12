import * as THREE from 'three';
import { tiledBox, tiledPlane } from '../../gfx/geometry.js';
import { COUNTER, DOORS, HALL, PILASTERS, RECEPTION, doorPlacement, doorsOn, wallRuns } from '../layout.js';

const DOOR_H = 3.0;

/** Suelo, techo, muros con huecos de puerta, cabeceros, zócalos y molduras. */
export function buildShell(ctx) {
  const { H, M, B, g } = ctx;
  const { minX, maxX, minZ, maxZ, height: Hh, wall: t } = HALL;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const wallMat = M.wall([1, 1]);
  const ceilMat = M.ceiling;

  // suelo y techo
  B.add(tiledPlane(w + 0.2, d + 0.2, 2.4), M.floor([1, 1]), { y: 0, rx: -Math.PI / 2 });
  B.add(tiledPlane(w + 0.2, d + 0.2, 3), ceilMat, { y: Hh, rx: Math.PI / 2 });

  // muros exteriores con huecos
  const wallBox = (len, h, th) => H.geo(`wall|${len.toFixed(3)}|${h}|${th}`, () => tiledBox(len, h, th, 2.4));
  const addRuns = (wall, from, to, place) => {
    for (const [a, b] of wallRuns(from, to, doorsOn(wall))) {
      const len = b - a;
      B.add(wallBox(len, Hh, t), wallMat, place((a + b) / 2, len));
    }
  };
  addRuns('north', minX - t, maxX + t, (c) => ({ x: c, y: Hh / 2, z: minZ - t / 2 }));
  addRuns('south', minX - t, maxX + t, (c) => ({ x: c, y: Hh / 2, z: maxZ + t / 2 }));
  for (const [wall, x] of [['west', minX - t / 2], ['east', maxX + t / 2]]) {
    for (const [a, b] of wallRuns(minZ, maxZ, doorsOn(wall))) {
      B.add(H.geo(`wallz|${(b - a).toFixed(3)}`, () => tiledBox(t, Hh, b - a, 2.4)), wallMat, { x, y: Hh / 2, z: (a + b) / 2 });
    }
  }
  // cabeceros sobre cada puerta y marco dorado
  for (const door of DOORS) {
    const p = doorPlacement(door);
    const along = door.wall === 'north' || door.wall === 'south';
    const hdr = Hh - DOOR_H;
    const dx = along ? door.width + 0.5 : t;
    const dz = along ? t : door.width + 0.5;
    // el cabecero va en el eje del muro (nunca sobresale hacia la sala)
    const cx = door.wall === 'west' ? minX - t / 2 : door.wall === 'east' ? maxX + t / 2 : p.x;
    const cz = door.wall === 'north' ? minZ - t / 2 : door.wall === 'south' ? maxZ + t / 2 : p.z;
    B.add(H.geo(`hdr|${dx}|${dz}`, () => tiledBox(dx, hdr, dz, 2.4)), wallMat, { x: cx, y: DOOR_H + hdr / 2, z: cz });
  }

  // zócalo de madera + moldura dorada + rodapié (a lo largo de los muros, salvo puertas)
  const wain = (alongX, from, to, fixed, face) => {
    // face = +1/-1: hacia dónde mira el muro (interior)
    const doors = alongX ? doorsOn(fixed < 0 ? 'north' : 'south') : doorsOn(fixed < 0 ? 'west' : 'east');
    for (const [a, b] of wallRuns(from, to, doors)) {
      const len = b - a;
      const c = (a + b) / 2;
      const off = fixed + face * 0.04;
      const sx = alongX ? len : 0.08;
      const sz = alongX ? 0.08 : len;
      const px = alongX ? c : off;
      const pz = alongX ? off : c;
      B.add(H.geo(`wain|${sx.toFixed(3)}|${sz.toFixed(3)}`, () => tiledBox(sx, 1.15, sz, 1.2)), M.woodDark([1, 1]), { x: px, y: 0.575, z: pz });
      // paneles en relieve: marcos de 1,2 m con moldura
      const panels = Math.max(1, Math.round(len / 1.2));
      const pw = len / panels;
      for (let k = 0; k < panels; k++) {
        const pc = a + pw * (k + 0.5);
        const fo = fixed + face * 0.088;
        const fx = alongX ? pc : fo;
        const fz = alongX ? fo : pc;
        const across = (l) => (alongX ? [l, 0.025] : [0.025, l]);
        const [h1x, h1z] = across(pw - 0.24);
        H.box(B, M.woodDark(), h1x, 0.045, h1z, fx, 0.98, fz, { r: 0 });
        H.box(B, M.woodDark(), h1x, 0.045, h1z, fx, 0.2, fz, { r: 0 });
        const off = (pw - 0.24) / 2;
        for (const sgn of [-1, 1]) {
          H.box(B, M.woodDark(), alongX ? 0.045 : 0.025, 0.82, alongX ? 0.025 : 0.045, alongX ? pc + sgn * off : fo, 0.59, alongX ? fo : pc + sgn * off, { r: 0 });
        }
      }
      const mx = alongX ? len : 0.13;
      const mz = alongX ? 0.13 : len;
      B.add(H.geo(`mold|${mx.toFixed(3)}|${mz.toFixed(3)}`, () => new THREE.BoxGeometry(mx, 0.05, mz)), M.gold, { x: alongX ? c : fixed + face * 0.065, y: 1.17, z: alongX ? fixed + face * 0.065 : c });
      B.add(H.geo(`base|${mx.toFixed(3)}|${mz.toFixed(3)}`, () => new THREE.BoxGeometry(mx + (alongX ? 0 : 0.04), 0.14, mz + (alongX ? 0.04 : 0))), M.black, { x: alongX ? c : fixed + face * 0.07, y: 0.07, z: alongX ? fixed + face * 0.07 : c });
    }
  };
  wain(true, minX, maxX, minZ, 1);
  wain(true, minX, maxX, maxZ, -1);
  wain(false, minZ, maxZ, minX, 1);
  wain(false, minZ, maxZ, maxX, -1);

  // ---------------- techo artesonado: vigas en cuadrícula con filete dorado, foseado perimetral con luz
  // indirecta (línea emisiva cálida), cornisa escalonada y focos empotrados en el centro de cada casetón
  const nx = 7;
  const nz = 5;
  const cw = w / nx;
  const cd = d / nz;
  const beamH = 0.38;
  for (let i = 1; i < nx; i++) {
    const x = minX + i * cw;
    H.box(B, M.woodDark(), 0.34, beamH, d - 1.2, x, Hh - beamH / 2, 0, { r: 0.015 });
    H.box(B, M.gold, 0.36, 0.025, d - 1.2, x, Hh - beamH, 0, { r: 0 });
  }
  for (let k = 1; k < nz; k++) {
    const z = minZ + k * cd;
    H.box(B, M.woodDark(), w - 1.2, beamH, 0.34, 0, Hh - beamH / 2, z, { r: 0.015 });
    H.box(B, M.gold, w - 1.2, 0.025, 0.36, 0, Hh - beamH, z, { r: 0 });
  }
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const x = minX + (i + 0.5) * cw;
      const z = minZ + (k + 0.5) * cd;
      if (Math.abs(x) < 1.5 && Math.abs(z - (-3.2)) < 2) continue; // hueco para la lámpara de araña
      // moldura interior del casetón y foco empotrado
      H.box(B, M.gold, cw - 0.6, 0.02, 0.04, x, Hh - 0.012, z - cd / 2 + 0.3, { r: 0 });
      H.box(B, M.gold, cw - 0.6, 0.02, 0.04, x, Hh - 0.012, z + cd / 2 - 0.3, { r: 0 });
      H.box(B, M.gold, 0.04, 0.02, cd - 0.6, x - cw / 2 + 0.3, Hh - 0.012, z, { r: 0 });
      H.box(B, M.gold, 0.04, 0.02, cd - 0.6, x + cw / 2 - 0.3, Hh - 0.012, z, { r: 0 });
      H.cyl(B, M.brass, 0.14, 0.14, 0.02, x, Hh - 0.012, z, { segments: 20 });
      H.cyl(B, M.downlight, 0.09, 0.09, 0.012, x, Hh - 0.024, z, { segments: 16 });
    }
  }
  // foseado perimetral (soffit) con tira de luz hacia el techo
  const soff = 0.6;
  const drop = 0.42;
  const ring = [
    [w, soff, 0, minZ + soff / 2],
    [w, soff, 0, maxZ - soff / 2],
    [soff, d - 2 * soff, minX + soff / 2, 0],
    [soff, d - 2 * soff, maxX - soff / 2, 0],
  ];
  for (const [sx, sz, x, z] of ring) {
    H.box(B, M.ceiling, sx, drop, sz, x, Hh - drop / 2, z, { r: 0 });
  }
  const strip = [
    [w - 2 * soff, 0.05, 0, minZ + soff + 0.03],
    [w - 2 * soff, 0.05, 0, maxZ - soff - 0.03],
    [0.05, d - 2 * soff, minX + soff + 0.03, 0],
    [0.05, d - 2 * soff, maxX - soff - 0.03, 0],
  ];
  for (const [sx, sz, x, z] of strip) H.box(B, M.cove, sx, 0.03, sz, x, Hh - drop + 0.02, z, { r: 0 });
  // cornisa: tres escalones con filete dorado
  const crown = (sx, sz, x, z) => {
    H.box(B, M.woodDark(), sx, 0.12, sz, x, Hh - drop - 0.06, z, { r: 0.01 });
    H.box(B, M.gold, sx, 0.03, sz, x, Hh - drop - 0.135, z, { r: 0 });
  };
  crown(w, soff + 0.08, 0, minZ + (soff + 0.08) / 2);
  crown(w, soff + 0.08, 0, maxZ - (soff + 0.08) / 2);
  crown(soff + 0.08, d, minX + (soff + 0.08) / 2, 0);
  crown(soff + 0.08, d, maxX - (soff + 0.08) / 2, 0);
  // listelo dorado a 3,2 m (separa la seda del friso superior)
  H.box(B, M.gold, w, 0.035, 0.05, 0, 3.25, minZ + 0.03, { r: 0 });
  H.box(B, M.gold, w, 0.035, 0.05, 0, 3.25, maxZ - 0.03, { r: 0 });
  H.box(B, M.gold, 0.05, 0.035, d, minX + 0.03, 3.25, 0, { r: 0 });
  H.box(B, M.gold, 0.05, 0.035, d, maxX - 0.03, 3.25, 0, { r: 0 });
  // cenefa del suelo: banda de mármol con filetes de latón a 0,6 m de los muros
  const band = (sx, sz, x, z) => {
    H.box(B, M.brass, sx, 0.004, 0.03, x, 0.002, z - sz / 2, { r: 0 });
    H.box(B, M.brass, sx, 0.004, 0.03, x, 0.002, z + sz / 2, { r: 0 });
  };
  band(w - 1.2, 0.35, 0, minZ + 0.8);
  band(w - 1.2, 0.35, 0, maxZ - 0.8);
  for (const x of [minX + 0.8, maxX - 0.8]) {
    H.box(B, M.brass, 0.03, 0.004, d - 1.25, x - 0.175, 0.002, 0, { r: 0 });
    H.box(B, M.brass, 0.03, 0.004, d - 1.25, x + 0.175, 0.002, 0, { r: 0 });
  }
  void g;
}

/** Pilastras acanaladas con capitel dorado y aplique (algunos apagados). */
export function buildPilasters(ctx) {
  const { H, M, B } = ctx;
  PILASTERS.forEach((p, i) => {
    const inward = p.side === 'west' ? 1 : -1;
    const A = B.at({ x: p.x, z: p.z, yaw: p.side === 'west' ? Math.PI / 2 : -Math.PI / 2 });
    // local +Z apunta hacia el interior del salón
    H.box(A, M.marble, 0.66, 0.34, 0.66, 0, 0.17, 0, { r: 0.02 });
    H.box(A, M.gold, 0.7, 0.05, 0.7, 0, 0.36, 0, { r: 0.01 });
    H.box(A, M.marble, 0.48, 4.6, 0.46, 0, 2.7, -0.08, { r: 0.04 });
    for (const x of [-0.14, 0, 0.14]) H.box(A, M.gold, 0.02, 4.4, 0.02, x, 2.7, 0.155, { r: 0 });
    H.box(A, M.gold, 0.66, 0.22, 0.6, 0, 5.1, 0, { r: 0.03 });
    H.box(A, M.marble, 0.72, 0.12, 0.66, 0, 5.28, 0, { r: 0.02 });
    // aplique
    const alive = (i * 5 + 3) % 7 !== 0 && (i * 3 + 1) % 5 !== 0;
    H.box(A, M.brass, 0.1, 0.22, 0.06, 0, 2.55, 0.2, { r: 0.01 });
    H.cyl(A, alive ? M.bulb : M.sconceDead, 0.07, 0.1, 0.2, 0, 2.78, 0.26, { segments: 12 });
    ctx.sconces.push({ x: p.x + inward * 0.35, y: 2.78, z: p.z, alive });
  });
}

/** Mostrador de servicios con trasera, espejo, caja registradora y mamparas laterales. */
export function buildCounter(ctx) {
  const { H, M, B, anchors } = ctx;
  const c = COUNTER;
  const A = B.at({ x: c.x, z: c.z, yaw: 0 }); // frente hacia +Z
  const wdt = c.width;
  // cuerpo con paneles acanalados
  H.box(A, M.woodDark([1, 1]), wdt, 1.05, c.depth, 0, 0.525, 0, { r: 0.02 });
  for (let i = 0; i < Math.round(wdt / 0.18); i++) H.box(A, M.wood([1, 1]), 0.07, 0.8, 0.03, -wdt / 2 + 0.2 + i * 0.18, 0.55, c.depth / 2 + 0.01, { r: 0.01 });
  H.box(A, M.marble, wdt + 0.14, 0.07, c.depth + 0.4, 0, 1.085, 0.15, { r: 0.02 });
  H.box(A, M.gold, wdt + 0.16, 0.025, c.depth + 0.42, 0, 1.04, 0.15, { r: 0.006 });
  H.cyl(A, M.brass, 0.03, 0.03, wdt - 0.2, 0, 0.14, c.depth / 2 + 0.28, { segments: 10, rz: Math.PI / 2 }); // barra para los pies
  for (const x of [-wdt / 2 + 0.3, 0, wdt / 2 - 0.3]) H.cyl(A, M.brass, 0.025, 0.025, 0.14, x, 0.07, c.depth / 2 + 0.28, { segments: 8 });
  // terminal y campanilla sobre el mostrador
  H.box(A, M.carbon, 0.46, 0.32, 0.3, -1.3, 1.28, 0.1, { r: 0.02, rx: -0.2 });
  H.box(A, M.screenGlow, 0.38, 0.22, 0.01, -1.3, 1.3, 0.255, { r: 0 });
  H.cyl(A, M.brass, 0.07, 0.09, 0.04, 0.9, 1.14, 0.2, { segments: 14 });
  H.sphere(A, M.brass, 0.05, 0.9, 1.19, 0.2, { segments: 10, sy: 0.7 });
  // trasera: estanterías, botellas y espejo
  const backZ = -c.depth / 2 - 0.6;
  H.box(A, M.woodDark([1, 1]), wdt + 0.6, 2.9, 0.18, 0, 1.45, backZ - 0.2, { r: 0.02 });
  const mirror = ctx.kit.make({ color: 0x8a8580, metal: 1, rough: 0.14, envIntensity: 0.55, dirt: 'hall' });
  H.box(A, mirror, wdt - 0.5, 1.15, 0.02, 0, 2.28, backZ - 0.1, { r: 0 });
  for (const y of [1.3, 1.78]) H.box(A, M.wood([1, 1]), wdt - 0.4, 0.045, 0.34, 0, y, backZ + 0.02, { r: 0.008 });
  // botellas con etiqueta y cápsula, vasos boca abajo y tira de luz cálida bajo cada balda
  const label = ctx.kit.make({ color: 0xe8dcc0, rough: 0.8 });
  const capsule = ctx.kit.make({ color: 0x7a1622, rough: 0.4, metal: 0.3 });
  const glassware = ctx.kit.make({ color: 0xd8e4e6, rough: 0.04, transparent: true, opacity: 0.28, depthWrite: false, envIntensity: 1.3 });
  const bottle = (x, y, tall, mat, wide = 0.045) => {
    H.lathe(A, mat, [[0, 0], [wide, 0], [wide, tall * 0.62], [wide * 0.8, tall * 0.75], [0.016, tall * 0.86], [0.015, tall + 0.08], [0, tall + 0.08]], x, y, backZ + 0.02, { segments: 12 });
    H.cyl(A, label, wide + 0.002, wide + 0.002, tall * 0.3, x, y + tall * 0.32, backZ + 0.02, { segments: 12, open: true });
    H.cyl(A, capsule, 0.017, 0.017, 0.04, x, y + tall + 0.06, backZ + 0.02, { segments: 8 });
  };
  const bottleMats = [M.amber, ctx.kit.make({ color: 0x1b3d27, rough: 0.12, metal: 0.05, envIntensity: 1.2 }), ctx.kit.make({ color: 0x3a1620, rough: 0.12, metal: 0.05, envIntensity: 1.2 }), ctx.kit.make({ color: 0x2a1a0c, rough: 0.12, envIntensity: 1.2 })];
  for (const [row, y] of [[0, 1.322], [1, 1.802]]) {
    for (let i = 0; i < 11; i++) {
      const x = -wdt / 2 + 0.45 + i * ((wdt - 0.9) / 10) + (row ? 0.12 : 0);
      if ((i + row) % 4 === 3) {
        // pareja de vasos boca abajo
        for (const dx of [-0.05, 0.05]) H.cyl(A, glassware, 0.035, 0.03, 0.1, x + dx, y + 0.05, backZ + 0.02, { segments: 12 });
        continue;
      }
      bottle(x, y, 0.2 + ((i * 7 + row) % 4) * 0.035, bottleMats[(i + row * 2) % 4], (i % 3) === 0 ? 0.05 : 0.04);
    }
    H.box(A, M.cove, wdt - 0.5, 0.012, 0.02, 0, y - 0.052, backZ + 0.17, { r: 0 });
  }
  // barandilla de latón en el borde del mostrador
  H.cyl(A, M.brass, 0.018, 0.018, wdt - 0.1, 0, 1.17, c.depth / 2 + 0.32, { segments: 10, rz: Math.PI / 2 });
  for (const x of [-wdt / 2 + 0.2, -wdt / 4, wdt / 4, wdt / 2 - 0.2]) H.cyl(A, M.brass, 0.012, 0.012, 0.06, x, 1.14, c.depth / 2 + 0.32, { segments: 8 });
  // mamparas laterales de madera y cristal (cierran la zona de personal)
  for (const s of [-1, 1]) {
    const x = s * (wdt / 2 + 0.55);
    H.box(A, M.woodDark([1, 1]), 0.1, 1.2, 2.2, x, 0.6, -1.0, { r: 0.015 });
    H.box(A, M.glass, 0.04, 1.1, 2.1, x, 1.75, -1.0, { r: 0 });
    H.box(A, M.gold, 0.12, 0.04, 2.2, x, 1.22, -1.0, { r: 0.005 });
  }
  // anclas: el empleado detrás del mostrador; el cliente delante
  anchors.push({ type: 'counter-clerk', x: c.x, z: c.z - 0.8, yaw: 0 });
  anchors.push({ type: 'counter-guest', x: c.x + 1.6, z: c.z + 1.1, yaw: Math.PI });
}

/**
 * Recepción / guardarropa (art déco): mostrador de nogal acanalado sobre zócalo lacado, columnas de esquina,
 * filetes de latón, encimera de trabajo y repisa de mármol elevada para el cliente (campanilla, libro de
 * registro abierto, lámpara de banquero), y detrás un casillero de llaves y un perchero con abrigos colgados.
 */
export function buildReception(ctx) {
  const { H, M, B, anchors, kit } = ctx;
  const r = RECEPTION;
  const A = B.at({ x: r.x, z: r.z, yaw: Math.PI }); // local +Z = hacia la sala
  const W = r.width;
  const D = r.depth;
  const fz = D / 2;
  // cuerpo
  H.box(A, M.lacquer, W - 0.08, 0.1, D - 0.08, 0, 0.05, -0.02, { r: 0.01 });
  H.box(A, M.woodDark([1, 1]), W, 0.92, D, 0, 0.56, 0, { r: 0.02 });
  for (let i = 0; i < Math.round((W - 0.5) / 0.13); i++) H.box(A, M.wood([1, 1]), 0.05, 0.6, 0.025, -W / 2 + 0.3 + i * 0.13, 0.52, fz + 0.012, { r: 0.01 });
  for (const y of [0.18, 0.86]) H.box(A, M.brass, W - 0.2, 0.025, 0.012, 0, y, fz + 0.02, { r: 0.004 });
  for (const s of [-1, 1]) {
    H.cyl(A, M.woodDark([1, 1]), 0.075, 0.075, 0.92, s * (W / 2 - 0.02), 0.56, fz - 0.02, { segments: 18 });
    H.cyl(A, M.brass, 0.085, 0.085, 0.03, s * (W / 2 - 0.02), 1.02, fz - 0.02, { segments: 18 });
    H.cyl(A, M.brass, 0.085, 0.09, 0.04, s * (W / 2 - 0.02), 0.12, fz - 0.02, { segments: 18 });
  }
  // placa con el emblema (rombo de latón)
  H.box(A, M.brass, 0.7, 0.16, 0.012, 0, 0.66, fz + 0.03, { r: 0.006 });
  H.box(A, M.black, 0.64, 0.11, 0.004, 0, 0.66, fz + 0.038, { r: 0.002 });
  H.box(A, M.gold, 0.07, 0.07, 0.006, 0, 0.66, fz + 0.042, { r: 0.002, rz: Math.PI / 4 });
  // encimera de trabajo y repisa elevada de mármol para el cliente
  H.box(A, M.marbleLight, W + 0.08, 0.04, D + 0.06, 0, 1.04, -0.02, { r: 0.012 });
  H.box(A, M.woodDark([1, 1]), W - 0.1, 0.16, 0.08, 0, 1.13, fz - 0.06, { r: 0.01 });
  H.box(A, M.marbleLight, W + 0.12, 0.035, 0.36, 0, 1.225, fz + 0.04, { r: 0.012 });
  H.box(A, M.gold, W + 0.14, 0.015, 0.37, 0, 1.2, fz + 0.04, { r: 0.004 });
  // campanilla
  H.cyl(A, M.black, 0.06, 0.065, 0.015, -1.3, 1.25, fz + 0.06, { segments: 16 });
  H.lathe(A, M.brass, [[0, 0], [0.055, 0], [0.05, 0.03], [0.03, 0.05], [0.006, 0.058], [0.006, 0.075], [0, 0.078]], -1.3, 1.257, fz + 0.06, { segments: 18 });
  // libro de registro abierto
  const cover = kit.make({ color: 0x4a1220, rough: 0.6 });
  for (const s of [-1, 1]) {
    H.box(A, cover, 0.22, 0.012, 0.3, 0.35 + s * 0.112, 1.249, fz + 0.04, { r: 0.004, rz: s * -0.06 });
    H.box(A, M.paper, 0.2, 0.01, 0.28, 0.35 + s * 0.104, 1.259, fz + 0.04, { r: 0.003, rz: s * -0.06 });
  }
  H.cyl(A, M.black, 0.005, 0.005, 0.16, 0.6, 1.252, fz + 0.1, { segments: 6, rz: Math.PI / 2, ry: 0.4 });
  // lámpara de banquero (pantalla de vidrio verde) sobre la encimera de trabajo
  const greenGlass = kit.make({ color: 0x0f4a2a, emissive: 0x2a8a50, emissiveIntensity: 0.35, rough: 0.15, envIntensity: 1 });
  H.lathe(A, M.brass, [[0, 0], [0.09, 0], [0.085, 0.02], [0.03, 0.035], [0, 0.04]], 1.4, 1.06, -0.05, { segments: 18 });
  H.cyl(A, M.brass, 0.008, 0.008, 0.3, 1.4, 1.25, -0.05, { segments: 8 });
  H.cyl(A, greenGlass, 0.07, 0.07, 0.34, 1.4, 1.4, -0.0, { segments: 18, rz: Math.PI / 2 });
  H.cyl(A, M.brass, 0.072, 0.072, 0.01, 1.23, 1.4, 0, { segments: 18, rz: Math.PI / 2 });
  H.cyl(A, M.brass, 0.072, 0.072, 0.01, 1.57, 1.4, 0, { segments: 18, rz: Math.PI / 2 });
  // pared trasera: casillero de llaves (derecha) y perchero (izquierda)
  const backZ = -(HALL.maxZ - 0.05 - r.z); // contra la pared: entre el mueble y la pared trabaja el recepcionista
  H.box(A, M.woodDark([1, 1]), 1.7, 1.05, 0.08, 1.05, 1.75, backZ, { r: 0.012 });
  H.box(A, M.gold, 1.74, 0.03, 0.1, 1.05, 2.29, backZ, { r: 0.004 });
  const keyTag = kit.make({ color: 0x8a1a2a, rough: 0.5 });
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const x = 0.4 + col * 0.215;
      const y = 1.42 + row * 0.22;
      H.box(A, M.wood([1, 1]), 0.19, 0.19, 0.012, x, y, backZ + 0.045, { r: 0.004 });
      H.cyl(A, M.brass, 0.006, 0.006, 0.05, x, y + 0.05, backZ + 0.07, { segments: 6, rx: Math.PI / 2 });
      if ((row * 7 + col) % 3 !== 1) {
        H.box(A, M.brass, 0.012, 0.07, 0.006, x, y, backZ + 0.09, { r: 0.002 });
        H.box(A, keyTag, 0.03, 0.045, 0.008, x, y - 0.06, backZ + 0.09, { r: 0.004 });
      }
    }
  }
  // perchero: barra de latón con abrigos de verdad (hombros, caída y percha), apartado del puesto del recepcionista
  H.box(A, M.woodDark([1, 1]), 1.3, 0.07, 0.09, -1.35, 2.2, backZ + 0.02, { r: 0.01 });
  for (const s of [-1, 1]) H.cyl(A, M.brass, 0.012, 0.012, 0.3, -1.35 + s * 0.6, 2.05, backZ + 0.15, { segments: 6, rx: Math.PI / 2 });
  H.cyl(A, M.brass, 0.013, 0.013, 1.25, -1.35, 2.05, backZ + 0.3, { segments: 8, rz: Math.PI / 2 });
  const coats = [kit.make({ color: 0x1b1b22, rough: 0.92, dirt: 'hall' }), kit.make({ color: 0x4a3324, rough: 0.92, dirt: 'hall' }), kit.make({ color: 0x4a1a22, rough: 0.92, dirt: 'hall' })];
  const coat = [[0, 0], [0.22, 0], [0.21, 0.35], [0.19, 0.72], [0.215, 0.82], [0.2, 0.88], [0.09, 0.93], [0.03, 0.95], [0, 0.95]];
  [-1.85, -1.42, -0.98].forEach((x, i) => {
    H.lathe(A, coats[i % 3], coat, x, 1.08 + (i % 2) * 0.04, backZ + 0.3, { segments: 14, sz: 0.36 });
    H.torus(A, M.wood([1, 1]), 0.035, 0.005, x, 2.07, backZ + 0.3, { rx: 0, segments: 10 });
  });
  anchors.push({ type: 'reception-clerk', x: r.x, z: r.z + 0.8, yaw: Math.PI });
}

/** Marco de puerta dorado (se pega a la cara interior del muro). */
export function doorFrame(ctx, A, width, { glow = null } = {}) {
  const { H, M } = ctx;
  H.box(A, M.gold, 0.14, DOOR_H + 0.12, 0.2, -width / 2 - 0.07, (DOOR_H + 0.12) / 2, 0.05, { r: 0.015 });
  H.box(A, M.gold, 0.14, DOOR_H + 0.12, 0.2, width / 2 + 0.07, (DOOR_H + 0.12) / 2, 0.05, { r: 0.015 });
  H.box(A, M.gold, width + 0.28, 0.16, 0.22, 0, DOOR_H + 0.08, 0.05, { r: 0.02 });
  if (glow) {
    H.box(A, glow, 0.035, DOOR_H - 0.1, 0.02, -width / 2 + 0.06, DOOR_H / 2, 0.13, { r: 0 });
    H.box(A, glow, 0.035, DOOR_H - 0.1, 0.02, width / 2 - 0.06, DOOR_H / 2, 0.13, { r: 0 });
    H.box(A, glow, width - 0.12, 0.035, 0.02, 0, DOOR_H - 0.06, 0.13, { r: 0 });
  }
}

export { DOOR_H };
