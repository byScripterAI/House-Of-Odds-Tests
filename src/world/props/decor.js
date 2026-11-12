import * as THREE from 'three';
import { batchModel, hasModel, paletteRemap } from './models.js';
import { Batch } from '../../gfx/geometry.js';
import { runnerCarpet, stainDecal, webDecal } from '../../gfx/textures.js';
import { CLASSIC, DECOR_SLOTS, HALL } from '../layout.js';
import { armchair } from './furniture.js';
import { placeProp } from './assets.js';

const paintCache = new Map();
/**
 * Óleo procedural (paisajes nocturnos y bodegones de juego en tonos cálidos): capas de color con
 * cientos de pinceladas orientadas, veladuras y craquelado leve. 512×680, cacheado por semilla.
 */
function oilPainting(seed) {
  if (paintCache.has(seed)) return paintCache.get(seed);
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const W = 512;
  const Hh = 680;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const x = c.getContext('2d', { willReadFrequently: true });
  const palettes = [
    { sky: ['#0d1630', '#3a2a4a', '#b0603a'], land: ['#1a1410', '#3a2a1a'], accent: '#f0c070' }, // atardecer
    { sky: ['#06080f', '#14213a', '#2e3a5a'], land: ['#0a0c10', '#1c2028'], accent: '#e8e0c0' }, // noche de luna
    { sky: ['#2a1810', '#6a3a1a', '#d8a050'], land: ['#20140c', '#4a2c16'], accent: '#ffd890' }, // dorado
  ];
  const P = palettes[Math.floor(rnd() * palettes.length)];
  const g = x.createLinearGradient(0, 0, 0, Hh * 0.62);
  g.addColorStop(0, P.sky[0]);
  g.addColorStop(0.55, P.sky[1]);
  g.addColorStop(1, P.sky[2]);
  x.fillStyle = g;
  x.fillRect(0, 0, W, Hh);
  // astro
  const sx = W * (0.25 + rnd() * 0.5);
  const sy = Hh * (0.18 + rnd() * 0.2);
  const halo = x.createRadialGradient(sx, sy, 4, sx, sy, 160);
  halo.addColorStop(0, P.accent);
  halo.addColorStop(0.15, `${P.accent}aa`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo;
  x.fillRect(0, 0, W, Hh);
  // colinas superpuestas
  for (let layer = 0; layer < 4; layer++) {
    const base = Hh * (0.5 + layer * 0.09);
    x.beginPath();
    x.moveTo(0, Hh);
    let y = base;
    for (let px = 0; px <= W; px += 8) {
      y += (rnd() - 0.5) * 14 - (y - base) * 0.08;
      x.lineTo(px, y);
    }
    x.lineTo(W, Hh);
    x.closePath();
    const t = layer / 3;
    x.fillStyle = layer === 3 ? P.land[0] : P.land[1];
    x.globalAlpha = 0.55 + t * 0.45;
    x.fill();
  }
  x.globalAlpha = 1;
  // pinceladas: siguen la orientación del cielo (horizontales) y del terreno (diagonales)
  for (let i = 0; i < 2600; i++) {
    const px = rnd() * W;
    const py = rnd() * Hh;
    const d = x.getImageData(Math.min(W - 1, px) | 0, Math.min(Hh - 1, py) | 0, 1, 1).data;
    const k = 0.82 + rnd() * 0.36;
    x.strokeStyle = `rgba(${Math.min(255, d[0] * k) | 0},${Math.min(255, d[1] * k) | 0},${Math.min(255, d[2] * k) | 0},0.55)`;
    x.lineWidth = 2 + rnd() * 5;
    x.lineCap = 'round';
    const ang = py < Hh * 0.55 ? (rnd() - 0.5) * 0.4 : -0.5 + (rnd() - 0.5) * 0.8;
    const len = 6 + rnd() * 18;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(ang) * len * 0.5, py + Math.sin(ang) * len * 0.5 + (rnd() - 0.5) * 3, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    x.stroke();
  }
  // reflejos de luz del astro sobre el terreno
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 120; i++) {
    x.fillStyle = `rgba(255,220,160,${0.04 + rnd() * 0.06})`;
    x.fillRect(sx + (rnd() - 0.5) * 120, Hh * 0.62 + rnd() * Hh * 0.3, 2 + rnd() * 14, 1 + rnd() * 2);
  }
  x.globalCompositeOperation = 'source-over';
  // barniz envejecido: viñeta cálida
  const v = x.createRadialGradient(W / 2, Hh / 2, Hh * 0.2, W / 2, Hh / 2, Hh * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(30,14,4,0.55)');
  x.fillStyle = v;
  x.fillRect(0, 0, W, Hh);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  paintCache.set(seed, tex);
  return tex;
}

/**
 * Cuadro: marco dorado de cuatro listones con bocel, paspartú de lino y lienzo REHUNDIDO (sin
 * superficies coplanarias: nada de parpadeos). `crooked` lo deja torcido (casino descuidado).
 */
export function painting(ctx, { x, y, z, yaw, w = 1.5, h = 2.0, seed, crooked = 0 }) {
  const { H, M } = ctx;
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = yaw;
  grp.rotation.z = crooked;
  ctx.root.add(grp);
  const b = new Batch();
  const fw = 0.12; // ancho del listón
  const fd = 0.09; // grosor del marco
  const ow = w + 0.16 + fw * 2;
  const oh = h + 0.16 + fw * 2;
  // listones exteriores (con bisel)
  H.box(b, M.gold, ow, fw, fd, 0, oh / 2 - fw / 2, fd / 2, { r: 0.02 });
  H.box(b, M.gold, ow, fw, fd, 0, -oh / 2 + fw / 2, fd / 2, { r: 0.02 });
  H.box(b, M.gold, fw, oh - fw * 2, fd, -ow / 2 + fw / 2, 0, fd / 2, { r: 0.02 });
  H.box(b, M.gold, fw, oh - fw * 2, fd, ow / 2 - fw / 2, 0, fd / 2, { r: 0.02 });
  // bocel interior
  const iw = w + 0.16;
  const ih = h + 0.16;
  H.box(b, M.brass, iw, 0.022, 0.03, 0, ih / 2, fd - 0.012, { r: 0.008 });
  H.box(b, M.brass, iw, 0.022, 0.03, 0, -ih / 2, fd - 0.012, { r: 0.008 });
  H.box(b, M.brass, 0.022, ih, 0.03, -iw / 2, 0, fd - 0.012, { r: 0.008 });
  H.box(b, M.brass, 0.022, ih, 0.03, iw / 2, 0, fd - 0.012, { r: 0.008 });
  // paspartú (detrás del lienzo)
  H.box(b, M.paper, iw, ih, 0.02, 0, 0, 0.03, { r: 0 });
  b.build(grp, { cast: false, receive: true });
  const tex = oilPainting(seed);
  const art = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(w, h)), ctx.kit.make({ map: tex, rough: 0.42, envIntensity: 0.4, dirt: 'hall' }));
  art.position.z = 0.052; // 1,2 cm por delante del paspartú y 4 cm por detrás del frente del marco
  grp.add(art);
  return grp;
}

/** Estatua «Lady Luck»: pedestal de mármol, figura dorada y orbe luminoso. */
export function buildStatue(ctx) {
  const { H, M } = ctx;
  const grp = new THREE.Group();
  grp.position.set(DECOR_SLOTS.statue.x, 0, DECOR_SLOTS.statue.z);
  ctx.root.add(grp);
  const b = new Batch();
  const modeled = hasModel('statue') && batchModel(b.at({}), 'statue', paletteRemap(ctx, { marble: ctx.kit.make({ color: 0x241f20, rough: 0.22, metal: 0, envIntensity: 1, clearcoat: 0.6, dirt: 'hall' }) }));
  if (modeled) {
    // esfera armilar dorada (scripts/models/furniture.py) con el orbe de la fortuna en el centro
    b.build(grp, { cast: ctx.g.shadows });
    const orbMat = ctx.kit.make({ color: 0xffe9a8, emissive: 0xffc23a, emissiveIntensity: 1.6, rough: 0.2 });
    const orb = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(0.15, ctx.seg(22), ctx.seg(16))), orbMat);
    orb.position.set(0, 2.12, 0);
    grp.add(orb);
    grp.visible = false;
    return { group: grp, orb, collider: ctx.addCollider(DECOR_SLOTS.statue.x, DECOR_SLOTS.statue.z, 1.1, 1.1, false) };
  }
  H.box(b, M.marble, 1.0, 0.18, 1.0, 0, 0.09, 0, { r: 0.02 });
  H.box(b, M.marble, 0.78, 0.9, 0.78, 0, 0.63, 0, { r: 0.03 });
  H.box(b, M.gold, 0.88, 0.07, 0.88, 0, 1.12, 0, { r: 0.015 });
  // vestido (torno), torso, cabeza, peinado y brazos
  H.lathe(b, M.gold, [[0, 0], [0.34, 0], [0.37, 0.06], [0.3, 0.4], [0.22, 0.85], [0.14, 1.1], [0.12, 1.25], [0.14, 1.34], [0.07, 1.42], [0, 1.44]], 0, 1.16, 0, { segments: 28 });
  H.sphere(b, M.gold, 0.1, 0, 2.7, 0, { segments: 14 });
  H.torus(b, M.gold, 0.11, 0.035, 0, 2.78, -0.04, { rx: 0.3, segments: 16 });
  H.cyl(b, M.gold, 0.035, 0.05, 0.62, 0.2, 2.34, 0, { segments: 10, rz: -0.95 });
  H.cyl(b, M.gold, 0.035, 0.045, 0.55, -0.17, 2.28, 0.04, { segments: 10, rz: 0.7 });
  b.build(grp);
  const orbMat = ctx.kit.make({ color: 0xffe9a8, emissive: 0xffc23a, emissiveIntensity: 1.6, rough: 0.2 });
  const orb = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(0.13, ctx.seg(18), ctx.seg(14))), orbMat);
  orb.position.set(0.5, 2.78, 0);
  grp.add(orb);
  grp.visible = false;
  return { group: grp, orb, collider: ctx.addCollider(DECOR_SLOTS.statue.x, DECOR_SLOTS.statue.z, 1.1, 1.1, false) };
}

/** Lámpara de araña (se compra). */
export function buildChandelier(ctx) {
  const { M } = ctx;
  const grp = new THREE.Group();
  grp.position.set(DECOR_SLOTS.chandelier.x, DECOR_SLOTS.chandelier.y, DECOR_SLOTS.chandelier.z);
  ctx.root.add(grp);
  // lámpara de araña real de cristal (Poly Haven): colgada sobre THE CLASSIC con su vástago
  const real = placeProp(ctx, 'chandelier_03', { scale: 2.0 });
  if (real) {
    const size = real.userData.size.y * 2.0;
    const bottom = 3.35 - DECOR_SLOTS.chandelier.y; // en coordenadas del grupo
    real.removeFromParent();
    real.position.set(0, bottom, 0);
    grp.add(real);
    const top = bottom + size;
    const ceiling = HALL.height - DECOR_SLOTS.chandelier.y;
    const rod = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.018, 0.018, Math.max(0.05, ceiling - top), 8)), M.brass);
    rod.position.y = (top + ceiling) / 2;
    grp.add(rod);
    const glow = [];
    real.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.material = [].concat(o.material).map((m) => {
        const c = m.clone();
        // cristal tallado: brillo propio leve; el metal, latón envejecido
        if (/glass/i.test(m.name)) {
          c.emissive = new THREE.Color(0xfff0d8);
          c.emissiveIntensity = 0.35;
          c.envMapIntensity = 1.4;
        }
        ctx.track(c);
        glow.push(c);
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    grp.visible = false;
    return { group: grp, crystalMat: glow[0], crystals: null };
  }
  const b = new Batch();
  const H = ctx.H;
  H.cyl(b, M.gold, 0.012, 0.012, 1.4, 0, 0.7, 0, { segments: 6 });
  H.torus(b, M.gold, 1.1, 0.045, 0, 0, 0, { segments: 40 });
  H.torus(b, M.gold, 0.65, 0.032, 0, 0.2, 0, { segments: 32 });
  H.torus(b, M.gold, 0.3, 0.025, 0, 0.38, 0, { segments: 24 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    H.cyl(b, M.gold, 0.012, 0.012, 0.4, Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5, { segments: 5, rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9 });
  }
  b.build(grp, { cast: false });
  const crystalMat = ctx.kit.make({ color: 0xdff8ff, emissive: 0x88a8b0, emissiveIntensity: 0.5, metal: 0.4, rough: 0.05 });
  const count = Math.max(16, Math.round(56 * ctx.g.detail));
  const crystals = new THREE.InstancedMesh(ctx.track(new THREE.OctahedronGeometry(0.07, 0)), crystalMat, count);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = i % 2 ? 1.1 : 0.65;
    d.position.set(Math.cos(a) * r, -0.16 - (i % 3) * 0.11, Math.sin(a) * r);
    d.scale.set(0.8, 1.7, 0.8);
    d.updateMatrix();
    crystals.setMatrixAt(i, d.matrix);
  }
  grp.add(crystals);
  const candle = ctx.kit.basic({ color: 0xffe2a0 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(0.06, 10, 8)), candle);
    s.position.set(Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1);
    grp.add(s);
  }
  grp.visible = false;
  return { group: grp, crystalMat, crystals };
}

/** Moqueta central (se compra): pasillo de entrada hasta el estrado. */
export function buildCarpet(ctx) {
  const s = DECOR_SLOTS.carpet;
  const TILE = 1.6; // metros por repetición del medallón
  const tex = runnerCarpet();
  // sin mapa normal: con UV en metros repetía su relieve en franjas brillantes a lo largo de la alfombra
  const mat = ctx.kit.make({ map: tex, rough: 0.96, envIntensity: 0.3 });
  // grosor real (8 mm) con canto, y UV en metros: el dibujo no se estira
  const geo = ctx.track(new THREE.BoxGeometry(s.w, 0.008, s.d));
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / s.w + 0.5, (pos.getZ(i) + s.d / 2) / TILE);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(s.x, 0.006, s.z);
  mesh.receiveShadow = true;
  mesh.visible = false;
  ctx.root.add(mesh);
  // varillas de latón en las cabeceras (sujetan la alfombra al suelo)
  const trim = new THREE.Group();
  const b = new Batch();
  for (const sz of [-1, 1]) ctx.H.cyl(b, ctx.M.brass, 0.012, 0.012, s.w + 0.1, 0, 0.014, sz * (s.d / 2 + 0.01), { segments: 10, rz: Math.PI / 2 });
  b.build(trim, { cast: false });
  trim.position.set(s.x, 0, s.z);
  trim.visible = false;
  ctx.root.add(trim);
  // rollo que se va desenrollando durante la presentación
  const roll = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(1, 1, s.w, 24)), mat);
  roll.rotation.z = Math.PI / 2;
  roll.visible = false;
  ctx.root.add(roll);
  return { mesh, trim, roll };
}

/** Alfombra del salón (permanente, raída). */
export function buildLoungeRug(ctx, rug) {
  const mat = ctx.M.carpet([rug.w / 2.4, rug.d / 2.4], { base: '#1f2b3a', accent: '#a08a4a' });
  const mesh = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(rug.w, rug.d)), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(rug.x, 0.01, rug.z);
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
}

// ------------------------------------------------------------------ suciedad y abandono
// (los DESPERFECTOS — goteras, grietas, humedad, papel despegado — están en damage.js: los arregla Daniel)

/** Decals de suciedad: manchas en el suelo y telarañas. Su opacidad sigue la suciedad. */
export function buildGrimeDecals(ctx) {
  const { root } = ctx;
  const mats = { stain: [], web: null };
  const mk = (map, opacity = 1) => {
    const m = ctx.kit.basic({ map, transparent: true, depthWrite: false, opacity, color: 0xffffff });
    m.toneMapped = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -3;
    m.polygonOffsetUnits = -3;
    ctx.decalMats.push(m);
    return m;
  };
  const decals = new Batch();
  const unitQuad = new THREE.PlaneGeometry(1, 1);
  const floorQuad = (mat, x, z, size, rot) => decals.add(unitQuad, mat, { x, y: 0.006, z, rx: -Math.PI / 2, rz: rot, sx: size, sy: size });
  for (let i = 0; i < 3; i++) mats.stain.push(mk(stainDecal(i)));
  mats.web = mk(webDecal());
  const rngf = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const r = rngf(1234);
  // manchas y marcas de suciedad por el suelo (evitando el estrado)
  const stains = [
    [-3.4, 3.1, 2.4], [5.2, 1.4, 1.7], [-8.2, 5.8, 1.9], [8.8, -5.2, 2.2], [1.8, 8.6, 1.6], [-1.5, -7.2, 2.0],
    [-11.5, 0.8, 1.5], [3.2, -9.0, 1.4], [11.8, 6.4, 1.8], [-4.8, 9.6, 1.3], [7.4, 3.4, 1.2], [-9.5, -6, 1.6],
    [0.6, 6.4, 1.5], [-6.0, -1.0, 1.4], [12.0, -6.5, 1.5], [-12.5, -9.6, 1.4], [9.6, 9.0, 1.2], [-2.2, -10.0, 1.3],
  ];
  stains.forEach(([x, z, s], i) => floorQuad(mats.stain[i % 3], x, z, s * 1.6, r() * 6.28));
  // telarañas en las esquinas del techo
  const corners = [
    [HALL.minX + 0.05, HALL.height - 0.05, HALL.minZ + 0.05, 0],
    [HALL.maxX - 0.05, HALL.height - 0.05, HALL.minZ + 0.05, Math.PI / 2],
    [HALL.minX + 0.05, HALL.height - 0.05, HALL.maxZ - 0.05, -Math.PI / 2],
    [HALL.maxX - 0.05, HALL.height - 0.05, HALL.maxZ - 0.05, Math.PI],
  ];
  for (const [x, y, z, rot] of corners) {
    decals.add(unitQuad, mats.web, { x: x + (x < 0 ? 0.02 : -0.02), y: y - 0.75, z, ry: rot + Math.PI / 4, sx: 1.5, sy: 1.5 });
    decals.add(unitQuad, mats.web, { x, y, z, rx: Math.PI / 2, rz: rot, sx: 1.5, sy: 1.5 });
  }
  for (const m of decals.build(root, { cast: false, receive: false })) m.renderOrder = 2;
  unitQuad.dispose();
}

/**
 * Trastos tirados por el suelo. TODOS se retiran con la primera limpieza (umbral `clearAt` ≥ 0,5:
 * la limpieza deja la suciedad en 0,45). Devuelve la lista para que el mundo la anime.
 */
export function buildClutter(ctx) {
  const items = [];
  const { H, M, root, kit } = ctx;
  const add = (group, clearAt = 0.5, collider = null) => {
    root.add(group);
    items.push({ group, clearAt, collider, scale: 1 });
    return group;
  };
  const at = (x, z, yaw = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return g;
  };
  const rngf = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const r = rngf(77);
  const card = kit.make({ color: 0x8a6a45, rough: 0.95, dirt: 'hall' });
  const cardDark = kit.make({ color: 0x6e5236, rough: 0.95, dirt: 'hall' });
  const tape = kit.make({ color: 0xb59a6a, rough: 0.6 });
  const plasterMat = kit.make({ color: 0xbab2a4, rough: 1, dirt: 'hall' });
  const dustMat = kit.make({ color: 0x8f877a, rough: 1 });
  const soil = kit.make({ color: 0x2a1c12, rough: 1 });
  const terracotta = kit.make({ color: 0x9a4a2c, rough: 0.8, dirt: 'hall' });
  const bottle = kit.make({ color: 0x1b3d27, rough: 0.12, metal: 0.05, envIntensity: 1.2 });
  const bottleBrown = kit.make({ color: 0x3a1e0c, rough: 0.12, metal: 0.05, envIntensity: 1.2 });
  const can = kit.make({ color: 0xa4202a, rough: 0.35, metal: 0.7 });
  const canSilver = kit.make({ color: 0xb8bcc0, rough: 0.3, metal: 0.85 });
  const cardFace = kit.make({ color: 0xf1ece0, rough: 0.7 });
  const cardBack = kit.make({ color: 0x7a1424, rough: 0.7 });
  const shard = kit.make({ color: 0xcfe0e4, rough: 0.05, metal: 0, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, envIntensity: 1.4 });

  // butaca volcada
  {
    const g = at(-5.4, 7.9, 0.6);
    const b = new Batch();
    armchair(ctx, b.at({ y: 0.42, x: 0.25, z: 0, yaw: 0 }), {});
    b.build(g);
    g.rotation.z = Math.PI / 2.05;
    g.rotation.order = 'YXZ';
    add(g, 0.55);
  }
  // cajas de cartón apiladas (dos rincones)
  const boxes = (x, z, yaw, list, collider, real = null) => {
    const g = at(x, z, yaw);
    if (real) {
      // cajas de cartón y cajones de madera reales (Poly Haven)
      let ok = true;
      for (const [name, o] of real) {
        const p = placeProp(ctx, name, o);
        if (!p) {
          ok = false;
          break;
        }
        p.removeFromParent();
        g.add(p);
      }
      if (ok) {
        add(g, 0.5, collider);
        return;
      }
      g.clear();
    }
    const b = new Batch();
    for (const [bx, by, bz, w, h, d, ry, dark] of list) {
      H.box(b, dark ? cardDark : card, w, h, d, bx, by + h / 2, bz, { r: 0.01, ry });
      H.box(b, tape, Math.min(w, d) * 0.22, 0.004, d + 0.004, bx, by + h + 0.002, bz, { r: 0, ry });
    }
    b.build(g);
    add(g, 0.5, collider);
  };
  boxes(11.2, -9.6, 0, [[0, 0, 0, 0.8, 0.5, 0.6, 0], [0.1, 0.5, 0, 0.7, 0.45, 0.55, 0.2, 1], [-1.0, 0, 0.2, 0.55, 0.4, 0.5, -0.3]], ctx.addCollider(11.0, -9.5, 2.4, 1.2, true), [
    ['crate', { x: 0.2, yaw: Math.PI / 2 + 0.05 }],
    ['cardboard_box', { x: 0.1, y: 0.46, yaw: 0.3 }],
    ['cardboard_box', { x: -0.95, z: 0.15, yaw: -0.4 }],
    ['cardboard_box', { x: -0.9, y: 0.34, z: 0.1, yaw: 0.9, scale: 0.85 }],
  ]);
  boxes(-12.9, -5.9, Math.PI / 2, [[0, 0, 0, 0.7, 0.45, 0.6, 0.1, 1], [0.75, 0, 0.1, 0.5, 0.35, 0.45, -0.2], [0.05, 0.45, 0.05, 0.5, 0.32, 0.42, 0.35]], ctx.addCollider(-12.9, -5.6, 1.0, 1.6, true), [
    ['cardboard_box', { yaw: 0.1 }],
    ['cardboard_box', { x: 0.55, z: 0.1, yaw: -0.25, scale: 0.9 }],
    ['cardboard_box', { x: 0.1, y: 0.34, yaw: 0.6, scale: 0.85 }],
    ['crate_01', { x: -0.7, z: 0.2, yaw: 1.4 }],
  ]);
  // cubo y fregona abandonados
  {
    const g = at(-12.6, 10.2);
    const b = new Batch();
    H.cyl(b, kit.make({ color: 0x2e5aa0, rough: 0.5 }), 0.22, 0.17, 0.32, 0, 0.16, 0, { segments: 14 });
    H.cyl(b, M.wood(), 0.012, 0.012, 1.3, 0.1, 0.8, 0.0, { segments: 5, rz: -0.18 });
    H.box(b, M.cloth, 0.22, 0.14, 0.1, 0.0, 0.3, 0.0, { r: 0.04 });
    b.build(g);
    add(g, 0.5);
  }
  // taburetes volcados
  for (const [x, z, yaw] of [[8.7, -5.9, 0.7], [-4.3, -6.1, -1.1], [4.2, 2.6, 2.2]]) {
    const g = at(x, z, yaw);
    const inner = new THREE.Group();
    inner.rotation.z = Math.PI / 2;
    inner.position.y = 0.19;
    const b = new Batch();
    // taburete simple (asiento, columna, aro y base)
    H.cyl(b, M.lacquer, 0.2, 0.22, 0.03, 0, 0.015, 0, { segments: 18 });
    H.cyl(b, M.brass, 0.025, 0.025, 0.62, 0, 0.33, 0, { segments: 10 });
    H.torus(b, M.brass, 0.17, 0.01, 0, 0.3, 0, { segments: 20 });
    H.cyl(b, M.leather, 0.19, 0.17, 0.08, 0, 0.68, 0, { segments: 18 });
    b.build(inner);
    g.add(inner);
    add(g, 0.5);
  }
  // macetero volcado con tierra derramada
  {
    const g = at(-4.7, 9.5, 0.4);
    const b = new Batch();
    const pot = new THREE.Group();
    pot.rotation.z = Math.PI / 2 - 0.12;
    pot.position.set(0, 0.2, 0);
    const pb = new Batch();
    H.lathe(pb, terracotta, [[0.0, 0.0], [0.15, 0.0], [0.2, 0.36], [0.23, 0.38], [0.2, 0.4]], 0, -0.2, 0, { segments: 18 });
    pb.build(pot);
    g.add(pot);
    H.sphere(b, soil, 0.42, 0.45, 0.0, 0.05, { segments: 12, sx: 1.3, sy: 0.07, sz: 0.8 });
    for (let i = 0; i < 6; i++) H.sphere(b, soil, 0.04 + r() * 0.05, 0.3 + r() * 0.8, 0.02, (r() - 0.5) * 0.7, { segments: 5, sy: 0.6 });
    H.sphere(b, kit.make({ color: 0x3f4a26, rough: 0.9 }), 0.16, 0.75, 0.05, 0.1, { segments: 7, sx: 1.4, sy: 0.4 });
    b.build(g);
    add(g, 0.5);
  }
  // cascotes del techo y polvo de yeso (bajo una grieta)
  {
    const g = at(1.7, -6.5);
    const b = new Batch();
    H.sphere(b, dustMat, 0.55, 0, 0, 0, { segments: 14, sx: 1.2, sy: 0.08, sz: 0.9 });
    const chunk = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 14; i++) {
      const s = 0.04 + r() * 0.09;
      const a = r() * 6.28;
      const d = r() * 0.6;
      b.add(chunk, plasterMat, { x: Math.cos(a) * d, y: s * 0.5, z: Math.sin(a) * d, rx: r() * 3, ry: r() * 3, rz: r() * 3, sx: s, sy: s * 0.6, sz: s * (0.8 + r() * 0.5) });
    }
    b.build(g);
    chunk.dispose();
    add(g, 0.5);
  }
  // alfombra vieja enrollada contra la pared oeste
  {
    const g = at(-12.85, 1.0);
    const b = new Batch();
    H.cyl(b, ctx.M.carpet([0.6, 0.6]), 0.17, 0.17, 2.0, 0, 0.17, 0, { segments: 16, rx: Math.PI / 2 });
    H.cyl(b, cardDark, 0.06, 0.06, 2.02, 0, 0.17, 0, { segments: 10, rx: Math.PI / 2 });
    b.build(g);
    add(g, 0.5, ctx.addCollider(-12.85, 1.0, 0.4, 2.0, true));
  }
  // papeles, botellas, latas, naipes y fichas por el suelo
  {
    const g = new THREE.Group();
    const b = new Batch();
    const clear = (x, z) => Math.hypot(x - CLASSIC.x, z - CLASSIC.z) > 3.2 && !(x < -6 && z < -7.6) && Math.abs(x) < 13.3 && z > -10.6 && z < 10.6;
    let placed = 0;
    for (let i = 0; i < 160 && placed < 70; i++) {
      const x = (r() - 0.5) * 27;
      const z = (r() - 0.5) * 21;
      if (!clear(x, z)) continue;
      placed++;
      const kind = placed % 7;
      const yaw = r() * 6.28;
      if (kind === 0) H.cyl(b, r() > 0.5 ? bottle : bottleBrown, 0.032, 0.036, 0.24, x, 0.036, z, { segments: 10, rz: Math.PI / 2, ry: yaw });
      else if (kind === 1) H.cyl(b, r() > 0.5 ? can : canSilver, 0.033, 0.033, 0.12, x, 0.033, z, { segments: 10, rz: Math.PI / 2, ry: yaw });
      else if (kind === 2) {
        // naipes desperdigados
        for (let k = 0; k < 3; k++) H.box(b, k % 2 ? cardBack : cardFace, 0.063, 0.002, 0.088, x + (r() - 0.5) * 0.4, 0.004 + k * 0.001, z + (r() - 0.5) * 0.4, { r: 0, ry: r() * 6.28 });
      } else if (kind === 3) {
        // fichas de casino
        for (let k = 0; k < 4; k++) H.cyl(b, ctx.chip([0xb0162b, 0x1f5fa8, 0x1a7a45, 0x111111][k]), 0.02, 0.02, 0.004, x + (r() - 0.5) * 0.3, 0.003, z + (r() - 0.5) * 0.3, { segments: 12 });
      } else if (kind === 4) {
        // hoja de papel (plana y algo doblada)
        H.box(b, M.paper, 0.21, 0.002, 0.297, x, 0.004, z, { r: 0, ry: yaw, rx: (r() - 0.5) * 0.12 });
      } else H.sphere(b, M.paper, 0.05 + r() * 0.04, x, 0.045, z, { segments: 6, sx: 1.25, sy: 0.75, sz: 1.05 });
    }
    // cristales rotos junto a una botella
    for (let k = 0; k < 9; k++) {
      const tri = new THREE.CircleGeometry(0.03 + r() * 0.04, 3);
      b.add(tri, shard, { x: 2.4 + (r() - 0.5) * 0.6, y: 0.005, z: 2.6 + (r() - 0.5) * 0.6, rx: -Math.PI / 2, rz: r() * 6.28 });
      tri.dispose();
    }
    H.cyl(b, bottle, 0.032, 0.036, 0.13, 2.25, 0.036, 2.55, { segments: 10, rz: Math.PI / 2, ry: 0.8 });
    b.build(g, { cast: false });
    add(g, 0.5);
  }
  return items;
}
