import * as THREE from 'three';
import { Batch } from '../../gfx/geometry.js';
import { bareWallDecal, ceilingStainDecal, crackDecal, waterStainDecal } from '../../gfx/textures.js';
import { HALL } from '../layout.js';
import { placeProp } from './assets.js';

/**
 * DESPERFECTOS del edificio (lo que arregla Daniel antes de abrir al público):
 * goteras que caen del techo con su charco, manchas de humedad en techo y paredes, grietas en
 * suelo y paredes con baldosas levantadas, papel pintado despegado, un parche de contrachapado y
 * un cable colgando de un casetón.
 *
 * Es independiente de la SUCIEDAD (eso lo quita el equipo de limpieza): `setRepaired(true)` lo
 * retira todo de golpe (la app lo hace bajo la pantalla negra de «REPARANDO…»).
 */

/** Goteras: bajo el centro desplazado de un casetón (nunca sobre una viga). */
export const LEAKS = Object.freeze([
  Object.freeze({ x: -3.0, z: 1.0, puddle: 1.0, sign: true, period: 1.55 }),
  Object.freeze({ x: 7.1, z: -5.3, puddle: 0.75, bucket: true, period: 1.9 }),
  Object.freeze({ x: -9.1, z: 3.5, puddle: 0.85, period: 2.3 }),
]);

const rngf = (seed) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export function buildDamage(ctx) {
  const { H, M, kit, track, root } = ctx;
  const group = new THREE.Group();
  group.name = 'damage';
  root.add(group);
  const decals = [];
  const dynamic = [];
  const r = rngf(4242);

  const decalMat = (map, opacity = 1) => {
    const m = kit.basic({ map, transparent: true, depthWrite: false, opacity, color: 0xffffff });
    m.toneMapped = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -3;
    m.polygonOffsetUnits = -3;
    m.userData.baseOpacity = opacity;
    decals.push(m);
    return m;
  };
  // todos los decals se fusionan por material (pocas llamadas de dibujo)
  const decalBatch = new Batch();
  const unitQuad = new THREE.PlaneGeometry(1, 1);
  const quad = (mat, w, h, x, y, z, rot) => {
    decalBatch.add(unitQuad, mat, { x, y, z, rx: rot[0], ry: rot[1], rz: rot[2], sx: w, sy: h });
  };

  // ---------------------------------------------------------------- grietas (suelo y paredes)
  const crackMats = [0, 1, 2].map((i) => decalMat(crackDecal(i)));
  const floorCracks = [[-2.6, 6.2, 2.6], [4.1, -0.4, 2.2], [-7.6, -2.0, 2.4], [9.6, 1.6, 2.4], [1.2, -7.0, 2.0], [-12, 5, 1.8], [3.0, 8.4, 1.9], [-4.6, -8.6, 1.7]];
  const chips = new Batch();
  floorCracks.forEach(([x, z, s], i) => {
    quad(crackMats[i % 3], s, s, x, 0.007, z, [-Math.PI / 2, 0, r() * 6.28]);
    // baldosas sueltas y esquirlas en el centro de la grieta
    for (let k = 0; k < 3; k++) {
      const a = r() * 6.28;
      const d = r() * 0.25;
      H.box(chips, M.marble, 0.12 + r() * 0.12, 0.018, 0.08 + r() * 0.1, x + Math.cos(a) * d, 0.012, z + Math.sin(a) * d, { r: 0.003, ry: r() * 3, rx: (r() - 0.5) * 0.25, rz: (r() - 0.5) * 0.25 });
    }
  });
  chips.build(group, { cast: false });
  // grietas de pared: (x, y, z, yaw, tamaño) — lejos de puertas, cuadros y pilastras
  const wallCracks = [
    [HALL.minX + 0.012, 3.9, -6.4, Math.PI / 2, 1.8],
    [HALL.maxX - 0.012, 1.4, 6.3, -Math.PI / 2, 1.5],
    [-5.6, 4.0, HALL.maxZ - 0.012, Math.PI, 1.9],
    [11.6, 3.6, HALL.minZ + 0.012, 0, 1.6],
    [HALL.minX + 0.012, 1.2, 9.6, Math.PI / 2, 1.3],
  ];
  wallCracks.forEach(([x, y, z, yaw, s], i) => quad(crackMats[(i + 1) % 3], s, s, x, y, z, [0, yaw, r() * 6.28]));

  // ---------------------------------------------------------------- humedad (techo y paredes)
  const ceil = [0, 1, 2].map((i) => decalMat(ceilingStainDecal(i)));
  LEAKS.forEach((L, i) => quad(ceil[i % 3], 2.0 + i * 0.3, 2.0 + i * 0.3, L.x, HALL.height - 0.004, L.z, [Math.PI / 2, 0, r() * 6.28]));
  const wallWet = [0, 1, 2].map((i) => decalMat(waterStainDecal(i)));
  const wallStain = (x, y, z, yaw, w, h, i) => quad(wallWet[i % 3], w, h * 1.4, x, y, z, [0, yaw, 0]);
  wallStain(HALL.minX + 0.014, 3.2, -0.6, Math.PI / 2, 1.6, 2.2, 0);
  wallStain(HALL.maxX - 0.014, 3.1, 8.6, -Math.PI / 2, 1.4, 2.0, 1);
  wallStain(8.5, 3.2, HALL.minZ + 0.014, 0, 1.7, 2.1, 2);
  wallStain(-4, 3.1, HALL.maxZ - 0.014, Math.PI, 1.5, 2.0, 0);
  wallStain(-12.4, 3.4, HALL.minZ + 0.014, 0, 1.3, 1.8, 1);

  // ---------------------------------------------------------------- goteras
  const water = kit.make({ color: 0xa8c8dc, rough: 0.05, metal: 0, transparent: true, opacity: 0.85, envIntensity: 1.5 });
  // agua: oscurece el suelo y refleja (dieléctrico: brillo solo de reflejo, como el agua de verdad)
  const puddleMat = kit.make({ color: 0x030303, rough: 0.06, metal: 0, transparent: true, opacity: 0.5, depthWrite: false, envIntensity: 1 });
  puddleMat.polygonOffset = true;
  puddleMat.polygonOffsetFactor = -4;
  puddleMat.polygonOffsetUnits = -4;
  const rippleMat = kit.basic({ color: 0xd8ecf6, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const dropGeo = track(new THREE.SphereGeometry(0.022, 8, 6));
  const splashGeo = track(new THREE.SphereGeometry(0.01, 5, 4));
  const ringGeo = track(new THREE.RingGeometry(0.05, 0.065, 28));
  const yellow = kit.make({ color: 0xd8b21c, rough: 0.45 });
  const tin = kit.make({ color: 0x8c9196, metal: 0.85, rough: 0.38, envIntensity: 1 });
  const leaks = LEAKS.map((L, li) => {
    const g = new THREE.Group();
    g.position.set(L.x, 0, L.z);
    group.add(g);
    // charco de contorno irregular
    const shape = new THREE.Shape();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = L.puddle * (0.78 + 0.22 * Math.sin(a * 3 + li) + (r() - 0.5) * 0.12);
      const px = Math.cos(a) * k * 1.15;
      const pz = Math.sin(a) * k * 0.8;
      if (i === 0) shape.moveTo(px, pz);
      else shape.lineTo(px, pz);
    }
    const puddle = new THREE.Mesh(track(new THREE.ShapeGeometry(shape)), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.009;
    puddle.receiveShadow = true;
    g.add(puddle);
    // cubo recogiendo el agua
    let landY = 0.012;
    if (L.bucket) {
      const b = new Batch();
      H.cyl(b, tin, 0.2, 0.16, 0.3, 0, 0.15, 0, { segments: 20, open: true });
      H.cyl(b, tin, 0.16, 0.16, 0.01, 0, 0.005, 0, { segments: 20 });
      H.torus(b, tin, 0.2, 0.008, 0, 0.3, 0, { segments: 24 });
      H.torus(b, tin, 0.19, 0.005, 0, 0.3, 0, { rx: 0, ry: 0.3, arc: Math.PI, segments: 16 });
      b.build(g, { cast: true });
      const inner = new THREE.Mesh(track(new THREE.CircleGeometry(0.185, 20)), puddleMat);
      inner.rotation.x = -Math.PI / 2;
      inner.position.y = 0.22;
      g.add(inner);
      landY = 0.222;
    }
    // cartel de «suelo mojado» (caballete amarillo)
    if (L.sign) {
      const b = new Batch();
      // caballete en A: los dos paneles se juntan arriba, con asa y franja negra
      for (const s of [-1, 1]) H.box(b, yellow, 0.32, 0.62, 0.018, 0, 0.3, s * 0.1, { r: 0.006, rx: -s * 0.3 });
      H.box(b, yellow, 0.12, 0.04, 0.04, 0, 0.6, 0, { r: 0.01 });
      for (const s of [-1, 1]) H.box(b, M.black, 0.24, 0.05, 0.004, 0, 0.415, s * 0.0755, { r: 0.002, rx: -s * 0.3 });
      for (const s of [-1, 1]) H.box(b, M.black, 0.1, 0.1, 0.004, 0, 0.262, s * 0.1228, { r: 0.002, rx: -s * 0.3, rz: Math.PI / 4 });
      const sg = new THREE.Group();
      sg.position.set(1.3, 0, 0.35);
      sg.rotation.y = 0.5;
      b.build(sg, { cast: true });
      g.add(sg);
    }
    const drops = [0, 1].map(() => {
      const d = new THREE.Mesh(dropGeo, water);
      d.scale.set(1, 1.7, 1);
      g.add(d);
      return d;
    });
    const ripples = [0, 1].map(() => {
      const m = new THREE.Mesh(ringGeo, rippleMat.clone());
      track(m.material);
      m.rotation.x = -Math.PI / 2;
      m.position.y = landY + 0.004;
      g.add(m);
      return m;
    });
    const splash = [0, 1, 2, 3, 4].map((i) => {
      const m = new THREE.Mesh(splashGeo, water);
      m.userData.a = (i / 5) * Math.PI * 2 + r();
      g.add(m);
      return m;
    });
    return { L, g, drops, ripples, splash, landY, offset: r() * 3 };
  });

  // ---------------------------------------------------------------- papel pintado despegado
  const plasterMats = [0, 1].map((k) => {
    const m = kit.make({ map: bareWallDecal(k), transparent: true, depthWrite: false, rough: 0.95, dirt: 'hall' });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -3;
    m.polygonOffsetUnits = -3;
    m.userData.baseOpacity = 1;
    decals.push(m);
    return m;
  });
  const peelMat = ctx.M.wall([0.6, 0.6]);
  peelMat.side = THREE.DoubleSide;
  const peel = [
    [HALL.minX + 0.04, -6.5, Math.PI / 2], [HALL.maxX - 0.04, -6.4, -Math.PI / 2],
    [-6.0, HALL.maxZ - 0.04, Math.PI], [6.5, HALL.minZ + 0.04, 0], [HALL.maxX - 0.04, 3.0, -Math.PI / 2],
  ];
  peel.forEach(([x, z, yaw], i) => {
    const geo = track(new THREE.PlaneGeometry(0.55, 1.5, 1, 8));
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      const curl = Math.max(0, 0.75 - y) * 0.5;
      p.setZ(k, curl * curl * 0.7 + 0.01);
      p.setX(k, p.getX(k) + curl * 0.08 * (i % 2 ? 1 : -1));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, peelMat);
    // la tira cuelga desplazada: deja a la vista el yeso de donde se ha despegado
    m.position.set(x + Math.cos(yaw) * 0.24, 2.1 + (i % 2) * 0.5 + 0.12, z - Math.sin(yaw) * 0.24);
    m.rotation.y = yaw;
    group.add(m);
    // el yeso desnudo que queda detrás (pegado al muro, bajo la tira): material con luz, contorno rasgado
    quad(plasterMats[i % 2], 0.62, 1.7, x - Math.sin(yaw) * 0.028, 2.1 + (i % 2) * 0.5, z - Math.cos(yaw) * 0.028, [0, yaw, 0]);
  });

  // ---------------------------------------------------------------- parche de contrachapado y cable suelto
  {
    const b = new Batch();
    const ply = kit.make({ color: 0xb08a5a, rough: 0.85 });
    H.box(b, ply, 1.1, 0.75, 0.018, 0, 0, 0, { r: 0.004 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) H.cyl(b, M.steel, 0.008, 0.008, 0.006, sx * 0.48, sy * 0.3, 0.012, { segments: 6, rx: Math.PI / 2 });
    const pg = new THREE.Group();
    pg.position.set(HALL.maxX - 0.03, 0.62, 6.4);
    pg.rotation.set(0, -Math.PI / 2, 0.04);
    b.build(pg, { cast: false });
    group.add(pg);
  }
  {
    // cable que cuelga de un casetón con el portalámparas pelado
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      pts.push(new THREE.Vector3(Math.sin(k * 2.2) * 0.12, HALL.height - k * 1.5, Math.cos(k * 1.7) * 0.05));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cable = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 24, 0.008, 5)), M.black);
    cable.position.set(4.6, 0, 3.6);
    group.add(cable);
    const socket = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.03, 0.07, 10)), M.brass);
    socket.position.set(4.6 + pts.at(-1).x, pts.at(-1).y - 0.03, 3.6 + pts.at(-1).z);
    group.add(socket);
    dynamic.push((dt, time) => {
      cable.rotation.y = Math.sin(time * 0.6) * 0.06;
    });
  }

  for (const m of decalBatch.build(group, { cast: false, receive: false })) m.renderOrder = 2;
  unitQuad.dispose();

  // ---------------------------------------------------------------- escalera apoyada en la pared (reparaciones pendientes)
  {
    const ladder = placeProp(ctx, 'ladder', { yaw: Math.PI / 2 });
    if (ladder) {
      ladder.removeFromParent();
      const pivot = new THREE.Group();
      pivot.position.set(13.33, 0, 6.95);
      pivot.rotation.z = -0.25; // la parte de arriba descansa en la pared
      pivot.add(ladder);
      group.add(pivot);
    }
  }

  // ---------------------------------------------------------------- animación de las goteras
  const G = 9.81;
  const fall = Math.sqrt((2 * (HALL.height - 0.1)) / G);
  function update(dt, time) {
    if (!group.visible) return;
    for (const lk of leaks) {
      const P = lk.L.period;
      lk.drops.forEach((d, i) => {
        const t = (time + lk.offset + i * P * 0.5) % P;
        if (t < fall) {
          d.visible = true;
          const y = HALL.height - 0.08 - 0.5 * G * t * t;
          d.position.set(0, Math.max(lk.landY, y), 0);
          d.scale.set(1, 1.4 + Math.min(1.6, t * 2.2), 1);
        } else d.visible = false;
        // ondas y salpicadura tras el impacto
        const after = t - fall;
        const rp = lk.ripples[i];
        if (after >= 0 && after < 0.9) {
          const k = after / 0.9;
          rp.scale.setScalar(1 + k * (lk.L.bucket ? 2.4 : 6));
          rp.material.opacity = (1 - k) * 0.5;
        } else rp.material.opacity = 0;
        if (i === 0) {
          for (const s of lk.splash) {
            if (after >= 0 && after < 0.28) {
              const k = after / 0.28;
              const a = s.userData.a;
              s.visible = true;
              s.position.set(Math.cos(a) * k * 0.09, lk.landY + Math.sin(k * Math.PI) * 0.07, Math.sin(a) * k * 0.09);
            } else s.visible = false;
          }
        }
      });
    }
    for (const f of dynamic) f(dt, time);
  }

  return {
    group,
    leaks,
    /** true = reparado: todo fuera. */
    setRepaired(on) {
      group.visible = !on;
      for (const m of decals) m.opacity = on ? 0 : m.userData.baseOpacity;
    },
    update,
  };
}
