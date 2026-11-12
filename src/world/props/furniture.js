/**
 * Mobiliario del casino. Cada función recibe (ctx, B, opts): `B` es un Batch o
 * un adaptador `batch.at({x,z,yaw})`; las piezas se describen en coordenadas
 * locales con el frente hacia +Z y el origen en el suelo.
 */
import { batchModel, hasModel, paletteRemap } from './models.js';

/** Butaca de terciopelo capitoné con patas doradas. */
export function armchair({ H, M }, B, { velvet = M.velvet } = {}) {
  H.box(B, velvet, 0.74, 0.2, 0.7, 0, 0.4, 0.02, { r: 0.07 });             // cojín del asiento
  H.box(B, velvet, 0.8, 0.62, 0.2, 0, 0.74, -0.31, { r: 0.08, rx: -0.12 }); // respaldo inclinado
  for (const s of [-1, 1]) {
    H.box(B, velvet, 0.16, 0.3, 0.74, s * 0.41, 0.52, 0, { r: 0.06 });      // reposabrazos
    H.cyl(B, M.gold, 0.035, 0.03, 0.28, s * 0.35, 0.14, 0.28, { segments: 8 });
    H.cyl(B, M.gold, 0.035, 0.03, 0.28, s * 0.35, 0.14, -0.28, { segments: 8 });
  }
  H.box(B, M.woodDark(), 0.82, 0.12, 0.78, 0, 0.27, 0, { r: 0.03 });       // zócalo de madera
  // botones del capitoné
  for (const [x, y] of [[-0.22, 0.86], [0, 0.88], [0.22, 0.86], [-0.22, 0.66], [0, 0.68], [0.22, 0.66]]) H.sphere(B, M.gold, 0.016, x, y, -0.2, { segments: 6 });
}

/** Sofá de tres plazas. */
export function sofa({ H, M }, B, { velvet = M.velvet } = {}) {
  H.box(B, M.woodDark(), 2.3, 0.12, 0.9, 0, 0.22, 0, { r: 0.03 });
  for (const x of [-0.72, 0, 0.72]) H.box(B, velvet, 0.72, 0.2, 0.74, x, 0.38, 0.05, { r: 0.07 });
  H.box(B, velvet, 2.3, 0.62, 0.22, 0, 0.78, -0.36, { r: 0.09, rx: -0.1 });
  for (const s of [-1, 1]) H.box(B, velvet, 0.2, 0.46, 0.92, s * 1.1, 0.5, 0, { r: 0.07 });
  for (const s of [-1, 1]) for (const z of [-1, 1]) H.cyl(B, M.gold, 0.035, 0.028, 0.14, s * 1.0, 0.07, z * 0.36, { segments: 8 });
  for (const x of [-0.8, -0.27, 0.27, 0.8]) H.sphere(B, M.gold, 0.016, x, 0.9, -0.24, { segments: 6 });
}

/** Mesita de centro art déco: tablero de mármol con canto moldurado, tambor estriado de nogal y peana de latón. */
export function coffeeTable({ H, M }, B) {
  H.lathe(B, M.marbleLight, [[0, 0], [0.44, 0], [0.468, 0.012], [0.475, 0.028], [0.462, 0.044], [0, 0.044]], 0, 0.48, 0, { segments: 40 });
  H.torus(B, M.gold, 0.462, 0.007, 0, 0.481, 0, { segments: 40 });
  H.lathe(B, M.brass, [[0, 0], [0.26, 0], [0.272, 0.014], [0.25, 0.03], [0.2, 0.042], [0, 0.042]], 0, 0, 0, { segments: 32 });
  H.cyl(B, M.woodDark(), 0.13, 0.15, 0.4, 0, 0.24, 0, { segments: 24 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    H.box(B, M.wood(), 0.02, 0.36, 0.014, Math.cos(a) * 0.142, 0.24, Math.sin(a) * 0.142, { r: 0.004, ry: Math.PI / 2 - a });
  }
  H.cyl(B, M.brass, 0.16, 0.16, 0.022, 0, 0.452, 0, { segments: 28 });
  H.cyl(B, M.brass, 0.17, 0.17, 0.022, 0, 0.05, 0, { segments: 28 });
  // libros de mesa y un cenicero de cristal tallado
  H.box(B, M.tint(0x3a1620, { rough: 0.55 }), 0.26, 0.032, 0.19, 0.13, 0.54, 0.08, { r: 0.004, ry: 0.35 });
  H.box(B, M.tint(0x17283a, { rough: 0.55 }), 0.23, 0.026, 0.17, 0.14, 0.569, 0.08, { r: 0.004, ry: 0.18 });
  H.box(B, M.paper, 0.218, 0.02, 0.16, 0.14, 0.569, 0.083, { r: 0.002, ry: 0.18 });
  H.lathe(B, M.glass, [[0, 0], [0.075, 0], [0.08, 0.03], [0.06, 0.032], [0.055, 0.012], [0, 0.012]], -0.16, 0.524, -0.1, { segments: 8 });
}

/** Taburete alto (modelo propio scripts/models/furniture.py; con o sin respaldo). */
export function stool(ctx, B, { leather = ctx.M.leather, back = false } = {}) {
  if (hasModel('stool') && ctx.kit) {
    batchModel(B, 'stool', paletteRemap(ctx, { seat: leather }), { skip: back ? null : (o) => o.name.startsWith('Back') });
    return;
  }
  const { H, M } = ctx;
  // base de laca negra con canto de latón
  H.lathe(B, M.lacquer, [[0, 0], [0.205, 0], [0.215, 0.01], [0.2, 0.028], [0.07, 0.045], [0, 0.046]], 0, 0, 0, { segments: 28 });
  H.torus(B, M.brass, 0.208, 0.006, 0, 0.011, 0, { segments: 28 });
  // columna de latón y aro reposapiés con tres radios
  H.cyl(B, M.brass, 0.026, 0.034, 0.42, 0, 0.255, 0, { segments: 14 });
  H.torus(B, M.brass, 0.165, 0.01, 0, 0.25, 0, { segments: 28 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    H.box(B, M.brass, 0.14, 0.012, 0.012, Math.cos(a) * 0.095, 0.25, -Math.sin(a) * 0.095, { r: 0, ry: a });
  }
  // asiento: bandeja negra, cojín capitoné de cuero con ribete de latón
  H.cyl(B, M.black, 0.15, 0.12, 0.035, 0, 0.465, 0, { segments: 20 });
  H.lathe(B, leather, [[0, 0], [0.175, 0], [0.198, 0.018], [0.205, 0.05], [0.192, 0.078], [0.13, 0.094], [0, 0.098]], 0, 0.48, 0, { segments: 28 });
  H.torus(B, M.brass, 0.199, 0.006, 0, 0.5, 0, { segments: 28 });
  if (back) {
    H.box(B, M.brass, 0.022, 0.32, 0.022, -0.13, 0.72, -0.17, { r: 0.006 });
    H.box(B, M.brass, 0.022, 0.32, 0.022, 0.13, 0.72, -0.17, { r: 0.006 });
    H.box(B, leather, 0.38, 0.26, 0.07, 0, 0.84, -0.19, { r: 0.03, rx: -0.12 });
  }
}

/** Maceta alta con planta de interior. */
export function plant({ H, M }, B, { height = 1.3 } = {}) {
  H.lathe(B, M.marble, [[0.0, 0], [0.22, 0], [0.26, 0.06], [0.3, 0.42], [0.27, 0.46], [0.0, 0.46]], 0, 0, 0, { segments: 18 });
  H.torus(B, M.gold, 0.3, 0.012, 0, 0.44, 0, { segments: 20 });
  const leaf = M.tint(0x1d5a34, { rough: 0.7 });
  const n = Math.max(5, Math.round(9 * H.detail));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tall = height * (0.55 + 0.45 * ((i * 37) % 7) / 7);
    H.sphere(B, leaf, 0.13, Math.cos(a) * 0.14, 0.5 + tall * 0.55, Math.sin(a) * 0.14, { segments: 8, sx: 0.8, sy: tall * 1.5, sz: 0.8 });
  }
}

/** Lámpara de pie art déco con pantalla ámbar escalonada (la luz real la pone el mundo). */
export function floorLamp(ctx, B) {
  if (hasModel('floor_lamp') && ctx.kit) {
    batchModel(B, 'floor_lamp', paletteRemap(ctx, { shade: ctx.M.amber }));
    return;
  }
  const { H, M } = ctx;
  H.cyl(B, M.brass, 0.18, 0.2, 0.04, 0, 0.02, 0, { segments: 16 });
  H.cyl(B, M.brass, 0.018, 0.018, 1.35, 0, 0.7, 0, { segments: 8 });
  H.cyl(B, M.amber, 0.17, 0.26, 0.3, 0, 1.52, 0, { segments: 16, open: true });
  H.cyl(B, M.brass, 0.035, 0.035, 0.05, 0, 1.4, 0, { segments: 8 });
}

/** Lo que va en la pared del puesto de Daniel (con la mesa de taller real): tablero de herramientas y flexo. */
export function workbenchWall(ctx, B) {
  if (hasModel('pegboard') && ctx.kit) {
    // tablero perforado con llaves, destornilladores, martillo, alicates, sierra, rollos y flexo (modelo propio)
    batchModel(B, 'pegboard', paletteRemap(ctx, { shade: ctx.M.amber }));
    return;
  }
  const { H, M } = ctx;
  H.box(B, M.woodDark(), 1.9, 0.95, 0.04, 0, 1.8, -0.36, { r: 0.006 });
  for (let i = 0; i < 9; i++) H.box(B, i % 2 ? M.steel : M.chrome, 0.03, 0.22 + (i % 3) * 0.06, 0.02, -0.8 + i * 0.2, 1.8, -0.33, { r: 0.004 });
  for (let i = 0; i < 5; i++) H.torus(B, M.steel, 0.05 + (i % 2) * 0.02, 0.006, -0.7 + i * 0.35, 2.12, -0.32, { rx: 0, segments: 14 });
  // flexo sobre la mesa
  H.cyl(B, M.steel, 0.06, 0.07, 0.02, 0.55, 0.97, -0.2, { segments: 12 });
  H.cyl(B, M.steel, 0.01, 0.01, 0.4, 0.55, 1.16, -0.15, { segments: 6, rx: 0.3 });
  H.cyl(B, M.amber, 0.04, 0.08, 0.1, 0.55, 1.35, -0.05, { segments: 12, open: true, rx: 0.9 });
}

/** Banco tapizado capitoné (recepción / pasillos). */
export function bench(ctx, B) {
  if (hasModel('bench') && ctx.kit) {
    batchModel(B, 'bench', paletteRemap(ctx, { seat: ctx.M.velvet }));
    return;
  }
  const { H, M } = ctx;
  H.box(B, M.woodDark(), 1.6, 0.08, 0.5, 0, 0.44, 0, { r: 0.02 });
  H.box(B, M.velvet, 1.5, 0.1, 0.44, 0, 0.5, 0, { r: 0.04 });
  for (const s of [-1, 1]) for (const z of [-1, 1]) H.cyl(B, M.gold, 0.025, 0.02, 0.4, s * 0.7, 0.2, z * 0.18, { segments: 6 });
}

/** Banco de trabajo de mantenimiento (Daniel): tablero, caja de herramientas, tornillo, lámpara y un panel desmontado. */
export function workbench({ H, M, kit }, B) {
  H.box(B, M.wood(), 1.7, 0.06, 0.72, 0, 0.92, 0, { r: 0.01 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) H.box(B, M.steel, 0.05, 0.9, 0.05, sx * 0.78, 0.45, sz * 0.3, { r: 0.006 });
  H.box(B, M.steel, 1.6, 0.03, 0.62, 0, 0.25, 0, { r: 0.006 });
  const red = kit.make({ color: 0xa8202a, metal: 0.4, rough: 0.45, dirt: 'hall' });
  H.box(B, red, 0.5, 0.22, 0.24, -0.45, 1.06, -0.1, { r: 0.012 });
  H.box(B, M.steel, 0.36, 0.03, 0.03, -0.45, 1.19, -0.1, { r: 0.006 });
  H.box(B, M.steel, 0.12, 0.1, 0.16, 0.62, 1.0, 0.2, { r: 0.008 });
  H.cyl(B, M.steel, 0.012, 0.012, 0.24, 0.62, 1.0, 0.3, { segments: 6, rx: Math.PI / 2 });
  // tablero de herramientas en la pared
  H.box(B, M.woodDark(), 1.7, 0.9, 0.04, 0, 1.75, -0.36, { r: 0.006 });
  for (let i = 0; i < 7; i++) H.box(B, i % 2 ? M.steel : M.chrome, 0.03, 0.22 + (i % 3) * 0.06, 0.02, -0.6 + i * 0.2, 1.75, -0.33, { r: 0.004 });
  // panel de máquina desmontado apoyado en el suelo
  H.box(B, kit.make({ color: 0x5a1222, rough: 0.5, metal: 0.35, dirt: 'hall' }), 0.7, 1.0, 0.05, 0.3, 0.5, 0.45, { r: 0.02, rx: -0.2 });
  // flexo
  H.cyl(B, M.steel, 0.06, 0.07, 0.02, 0.15, 0.96, -0.25, { segments: 10 });
  H.cyl(B, M.steel, 0.01, 0.01, 0.4, 0.15, 1.15, -0.2, { segments: 5, rx: 0.3 });
  H.cyl(B, M.amber, 0.04, 0.08, 0.1, 0.15, 1.34, -0.1, { segments: 10, open: true, rx: 0.9 });
}
