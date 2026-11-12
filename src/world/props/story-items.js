import * as THREE from 'three';
import { t } from '../../i18n/index.js';
import { Batch } from '../../gfx/geometry.js';
import { HALL, RECEPTION, STORY_SPOTS } from '../layout.js';
import { placeProp } from './assets.js';

/** Coloca un modelo real dentro de un grupo (coordenadas locales del grupo). */
function adoptProp(ctx, parent, name, o = {}) {
  const g = placeProp(ctx, name, o);
  if (!g) return null;
  g.removeFromParent();
  parent.add(g);
  return g;
}

/**
 * Objetos de la historia: piezas que cambian según las misiones.
 *  - toolbox:   caja de herramientas roja de Daniel (en su banco).
 *  - doc_box:   caja de documentos antiguos (esquina noreste) con el manual de THE CLASSIC.
 *  - breaker:   cuadro eléctrico de la pared norte (palanca abajo/arriba).
 *  - entrance:  cartel CERRADO/ABIERTO y resplandor de la calle al abrir.
 *  - reception: kit de decoración embalado y los tres estilos de recepción.
 */
export function buildStoryItems(ctx, sign) {
  const { H, M, kit, root, track } = ctx;
  const group = (x, y, z, yaw = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    root.add(g);
    return g;
  };

  // ---- caja de herramientas (sobre el banco: el banco está en x≈13.25 mirando al oeste)
  const toolbox = group(STORY_SPOTS.toolbox.x, 0.96, STORY_SPOTS.toolbox.z, -Math.PI / 2);
  const chest = adoptProp(ctx, toolbox, 'tool_chest', { scale: 0.62 });
  if (!chest) {
    const b = new Batch();
    const red = kit.make({ color: 0xb8202a, metal: 0.45, rough: 0.4 });
    H.box(b, red, 0.5, 0.2, 0.24, 0, 0.1, 0, { r: 0.015 });
    H.box(b, red, 0.5, 0.06, 0.24, 0, 0.23, 0, { r: 0.012 });
    H.box(b, M.chrome, 0.3, 0.025, 0.025, 0, 0.3, 0, { r: 0.006 });
    for (const s of [-1, 1]) H.box(b, M.chrome, 0.02, 0.06, 0.02, s * 0.14, 0.27, 0, { r: 0.004 });
    H.box(b, M.chrome, 0.06, 0.03, 0.01, 0, 0.15, 0.122, { r: 0.003 });
    b.build(toolbox);
  }

  // ---- caja de documentos con el manual
  const docBox = group(STORY_SPOTS.doc_box.x, 0, STORY_SPOTS.doc_box.z + 0.55, 0.25);
  {
    const b = new Batch();
    const card = kit.make({ color: 0x9a7448, rough: 0.95, dirt: 'hall' });
    H.box(b, card, 0.6, 0.38, 0.45, 0, 0.19, 0, { r: 0.01 });
    H.box(b, card, 0.62, 0.02, 0.24, 0, 0.39, -0.12, { r: 0.004, rx: -0.5 });
    H.box(b, M.paper, 0.5, 0.06, 0.36, 0, 0.36, 0.02, { r: 0.004 });
    const manual = kit.make({ color: 0x5a1820, rough: 0.7 });
    H.box(b, manual, 0.24, 0.035, 0.32, 0.1, 0.405, 0.04, { r: 0.004, ry: 0.3 });
    H.box(b, M.gold, 0.12, 0.002, 0.02, 0.1, 0.424, 0.04, { r: 0, ry: 0.3 });
    b.build(docBox);
  }

  // ---- cuadro eléctrico (pared norte): caja real con la palanca general a un lado y armario de registro
  const breaker = group(STORY_SPOTS.breaker.x, 0, HALL.minZ + 0.02, 0);
  const lever = new THREE.Group();
  const breakerLight = new THREE.Mesh(track(new THREE.CircleGeometry(0.03, 16)), kit.basic({ color: 0xff3040 }));
  const box = adoptProp(ctx, breaker, 'power_box', { y: 1.28, z: 0.22 });
  if (box) {
    adoptProp(ctx, breaker, 'utility_box', { x: 1.0, z: 0.24 });
    const lb = new Batch();
    H.box(lb, M.steel, 0.12, 0.26, 0.08, 0.36, 1.45, 0.06, { r: 0.01 }); // caja de la palanca general
    lb.build(breaker);
    const hb = new Batch();
    H.box(hb, M.chrome, 0.03, 0.22, 0.03, 0, 0.11, 0, { r: 0.006 });
    H.sphere(hb, kit.make({ color: 0xb8202a, rough: 0.35 }), 0.035, 0, 0.23, 0);
    hb.build(lever);
    lever.position.set(0.36, 1.4, 0.13);
    breaker.add(lever);
    breakerLight.position.set(0.36, 1.6, 0.121);
    breaker.add(breakerLight);
  } else {
    const b = new Batch();
    H.box(b, M.steel, 0.7, 0.95, 0.16, 0, 1.55, 0.08, { r: 0.015 });
    H.box(b, M.carbon, 0.6, 0.85, 0.02, 0, 1.55, 0.165, { r: 0.006 });
    for (let i = 0; i < 6; i++) H.box(b, M.black, 0.06, 0.1, 0.03, -0.2 + (i % 3) * 0.2, 1.75 - Math.floor(i / 3) * 0.2, 0.18, { r: 0.004 });
    const warn = kit.make({ color: 0xd8b21c, rough: 0.5 });
    H.box(b, warn, 0.22, 0.12, 0.005, 0, 1.21, 0.177, { r: 0 });
    b.build(breaker);
    const lb = new Batch();
    H.box(lb, M.chrome, 0.04, 0.22, 0.04, 0, 0.11, 0, { r: 0.008 });
    H.sphere(lb, kit.make({ color: 0xb8202a, rough: 0.35 }), 0.04, 0, 0.23, 0);
    lb.build(lever);
    lever.position.set(0.22, 1.36, 0.2);
    breaker.add(lever);
    breakerLight.position.set(0.22, 1.72, 0.177);
    breaker.add(breakerLight);
  }

  // ---- entrada: resplandor de la calle (solo con las puertas abiertas)
  const street = new THREE.Mesh(
    track(new THREE.PlaneGeometry(4.2, 3.0)),
    kit.basic({ color: 0x5a7ab8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  street.position.set(0, 1.5, HALL.maxZ - 0.12);
  street.rotation.y = Math.PI;
  root.add(street);
  const openSign = sign(() => t('sign.open'), 1.5, 0.38, 0, 1.75, HALL.maxZ - 0.33, Math.PI, { color: '#e6ffe9', glow: '#18c26a', font: '700 120px Cinzel, serif' });
  openSign.mesh.visible = false;

  // ---- recepción: kit embalado + tres estilos
  const kitBoxes = group(STORY_SPOTS.reception_decor.x, 0, STORY_SPOTS.reception_decor.z, 0.2);
  if (adoptProp(ctx, kitBoxes, 'cardboard_box', {})) {
    adoptProp(ctx, kitBoxes, 'cardboard_box', { x: 0.5, z: 0.12, yaw: 0.5, scale: 0.85 });
    adoptProp(ctx, kitBoxes, 'cardboard_box', { y: 0.34, z: 0.02, yaw: 1.2, scale: 0.8 });
    const b = new Batch();
    H.box(b, kit.make({ color: 0xc23a3a, rough: 0.6 }), 0.36, 0.012, 0.05, 0, 0.615, 0.02, { r: 0, ry: 1.2 });
    b.build(kitBoxes);
  } else {
    const b = new Batch();
    const card = kit.make({ color: 0xa88458, rough: 0.95 });
    H.box(b, card, 0.7, 0.5, 0.5, 0, 0.25, 0, { r: 0.01 });
    H.box(b, card, 0.5, 0.4, 0.4, 0.6, 0.2, 0.1, { r: 0.01, ry: 0.4 });
    H.box(b, kit.make({ color: 0xc23a3a, rough: 0.6 }), 0.72, 0.04, 0.06, 0, 0.5, 0, { r: 0 });
    b.build(kitBoxes);
  }
  const styles = {};
  const rx = RECEPTION.x;
  const rz = RECEPTION.z - 1.15; // delante del mostrador de recepción (lado sala)
  const styleGroup = (name, fill) => {
    const g = group(0, 0, 0);
    const b = new Batch();
    fill(b);
    b.build(g);
    g.visible = false;
    styles[name] = g;
  };
  styleGroup('elegant', (b) => {
    for (const dx of [-2.3, 2.3]) {
      H.lathe(b, M.woodDark(), [[0, 0], [0.18, 0], [0.22, 0.5], [0.16, 0.9], [0, 0.92]], rx + dx, 0, rz, { segments: 16 });
      H.lathe(b, M.gold, [[0, 0], [0.12, 0], [0.16, 0.12], [0.1, 0.32], [0.14, 0.42], [0, 0.42]], rx + dx, 0.92, rz, { segments: 16 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        H.sphere(b, kit.make({ color: i % 2 ? 0xe8e0f0 : 0xd84a6a, rough: 0.7 }), 0.08, rx + dx + Math.cos(a) * 0.12, 1.44 + (i % 3) * 0.05, rz + Math.sin(a) * 0.12, { segments: 8 });
      }
    }
  });
  styleGroup('modern', (b) => {
    const white = kit.make({ color: 0xe8e6e2, rough: 0.35 });
    for (const dx of [-2.3, 2.3]) {
      H.box(b, white, 0.42, 0.75, 0.42, rx + dx, 0.375, rz, { r: 0.04 });
      for (let i = 0; i < 5; i++) H.box(b, kit.make({ color: 0x2f7a46, rough: 0.7 }), 0.05, 0.5 + i * 0.07, 0.05, rx + dx - 0.1 + (i % 3) * 0.1, 1.0 + i * 0.02, rz - 0.06 + (i % 2) * 0.12, { r: 0.01 });
    }
    H.box(b, kit.basic({ color: 0xbfe8ff }), 4.2, 0.03, 0.03, rx, 1.02, rz + 0.62, { r: 0 });
  });
  styleGroup('classic', (b) => {
    for (const dx of [-2.3, -0.8, 0.8, 2.3]) {
      H.cyl(b, M.brass, 0.16, 0.2, 0.05, rx + dx, 0.025, rz, { segments: 16 });
      H.cyl(b, M.brass, 0.025, 0.025, 0.95, rx + dx, 0.5, rz, { segments: 8 });
      H.sphere(b, M.brass, 0.05, rx + dx, 1.0, rz, { segments: 8 });
    }
    for (const [a, c] of [[-2.3, -0.8], [0.8, 2.3]]) H.cyl(b, M.velvet, 0.03, 0.03, Math.abs(c - a), rx + (a + c) / 2, 0.9, rz, { segments: 8, rz: Math.PI / 2 });
  });

  return {
    toolbox, docBox, breaker, lever, breakerLight, street, openSign, kitBoxes, styles,
    setItem(id, visible) {
      if (id === 'toolbox') toolbox.visible = visible;
      if (id === 'doc_box') docBox.visible = visible;
    },
  };
}
