import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { ZONES } from '../data/progression.js';
import { createClassicMachine } from '../machines/classic.js';
import { carpetTexture, glowTexture, marbleTexture, neonTexture, paintingTexture, plateTexture, wallTexture } from './procedural-textures.js';

/**
 * MAIN FLOOR: el casino. Construye escenario, luces, colisiones e interactuables
 * y expone un "controlador de escena" para Game (ver core/game.js).
 *
 * Mapa (metros): sala x∈[-9,9], z∈[-8,8], altura 4,6. El jugador aparece en el
 * sur mirando al norte; la máquina está en el centro, el mostrador junto a la
 * pared norte, la puerta del Ala norte en el centro de la pared norte y las
 * cuatro puertas bloqueadas en las paredes oeste y este.
 */

const H = 4.6;
const MACHINE_POS = new THREE.Vector3(0, 0.12, -1.5);
const LIGHT_LEVELS = {
  spot: [320, 400, 480, 560],
  fill: [40, 55, 70, 90],
  red: [28, 36, 46, 60],
  cove: [0.9, 1.3, 1.8, 2.4],
};

function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0a0608);
  const panel = (w, h, color, k, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  panel(8, 1.2, 0xfff0d0, 6, 0, 9, 0, Math.PI / 2);
  panel(10, 1, 0xffc070, 3, 0, 8, 6, Math.PI / 2);
  panel(8, 4, 0xc42240, 2.5, -9, 3, 0, 0, Math.PI / 2);
  panel(8, 4, 0xc42240, 2.5, 9, 3, 0, 0, Math.PI / 2);
  panel(6, 3, 0xd4af37, 1.5, 0, 2, -9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return target;
}

export function createWorld({ renderer, graphics }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.black);
  scene.fog = new THREE.FogExp2(PALETTE.black, 0.02);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);

  const owned = [];
  const track = (o) => (owned.push(o), o);
  const colliders = [];
  const interactables = [];
  const signs = [];
  const shadowers = [];

  const envTarget = buildEnvironment(renderer);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;

  // ---------- materiales ----------
  const floorTex = track(marbleTexture(512, [18.4 / 2.4, 16.4 / 2.4]));
  const M = {
    floor: track(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.2, metalness: 0.2, envMapIntensity: 1.1 })),
    gold: track(new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.3 })),
    carbon: track(new THREE.MeshStandardMaterial({ color: 0x161416, metalness: 0.5, roughness: 0.4 })),
    wood: track(new THREE.MeshStandardMaterial({ color: 0x1d100c, metalness: 0.15, roughness: 0.45 })),
    velvet: track(new THREE.MeshStandardMaterial({ color: 0x7a1226, roughness: 0.95 })),
    marble: track(new THREE.MeshStandardMaterial({ color: 0x2a2528, metalness: 0.25, roughness: 0.2 })),
    ceiling: track(new THREE.MeshStandardMaterial({ color: 0x0f0a0b, roughness: 0.9 })),
    mirror: track(new THREE.MeshStandardMaterial({ color: 0xcfc6bb, metalness: 1, roughness: 0.06 })),
    cove: track(new THREE.MeshStandardMaterial({ color: 0x200308, emissive: 0xc42240, emissiveIntensity: 1 })),
    candle: track(new THREE.MeshBasicMaterial({ color: 0xffe2a0 })),
    amber: track(new THREE.MeshStandardMaterial({ color: 0x3b1d05, emissive: 0xffa43a, emissiveIntensity: 0.7, roughness: 0.3 })),
    screen: track(new THREE.MeshBasicMaterial({ color: 0x66ffcc })),
  };
  const wallMat = (ux, uy) => {
    const t = track(wallTexture([ux, uy]));
    return track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.05 }));
  };

  // ---------- helpers ----------
  const add = (geo, mat, x, y, z, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; shadowers.push(m); }
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const collide = (cx, cz, w, d, enabled = true) => {
    const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, enabled };
    colliders.push(c);
    return c;
  };
  const sign = (text, w, h, x, y, z, ry, opts = {}) => {
    const mat = track(new THREE.MeshBasicMaterial({ map: track(neonTexture(text, opts)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    signs.push({ mat, phase: signs.length * 1.7 });
    return m;
  };
  const interact = (def) => (interactables.push(def), def);

  // ---------- estructura ----------
  add(new THREE.PlaneGeometry(18.4, 16.4), M.floor, 0, 0, 0, scene, false).rotation.x = -Math.PI / 2;
  scene.children.at(-1).receiveShadow = true;
  add(new THREE.PlaneGeometry(18.4, 16.4), M.ceiling, 0, H, 0, scene, false).rotation.x = Math.PI / 2;

  const wallS = box(18.8, H, 0.4, wallMat(8, 2), 0, H / 2, 8.2);
  const wallW = box(0.4, H, 16.4, wallMat(7, 2), -9.2, H / 2, 0);
  const wallE = box(0.4, H, 16.4, wallMat(7, 2), 9.2, H / 2, 0);
  box(7.8, H, 0.4, wallMat(3.3, 2), -5.5, H / 2, -8.2);
  box(7.8, H, 0.4, wallMat(3.3, 2), 5.5, H / 2, -8.2);
  box(3.2, 1.8, 0.4, wallMat(1.4, 1), 0, H - 0.9, -8.2);
  collide(0, 8.2, 18.8, 0.4);
  collide(-9.2, 0, 0.4, 16.4);
  collide(9.2, 0, 0.4, 16.4);
  collide(-5.5, -8.2, 7.8, 0.4);
  collide(5.5, -8.2, 7.8, 0.4);
  void wallS; void wallW; void wallE;

  // zócalo de madera con moldura dorada (salta los huecos de las puertas)
  const wainscot = (x, z, len, alongX) => {
    const [w, d] = alongX ? [len, 0.08] : [0.08, len];
    box(w, 1.1, d, M.wood, x, 0.55, z);
    box(alongX ? len : 0.12, 0.05, alongX ? 0.12 : len, M.gold, x, 1.12, z);
  };
  wainscot(0, 7.96, 17.8, true);
  wainscot(-5.5, -7.96, 7.6, true);
  wainscot(5.5, -7.96, 7.6, true);
  for (const s of [-1, 1]) for (const [a, b] of [[-8, -4], [-2, 2], [4, 8]]) wainscot(s * 8.96, (a + b) / 2, b - a, false);

  // vigas doradas y luces de cornisa
  for (const z of [-4, 3]) box(18, 0.14, 0.34, M.gold, 0, H - 0.07, z);
  const coveStrips = [
    box(17.6, 0.07, 0.14, M.cove, 0, H - 0.3, 7.85), box(0.14, 0.07, 15.6, M.cove, -8.85, H - 0.3, 0), box(0.14, 0.07, 15.6, M.cove, 8.85, H - 0.3, 0),
    box(7.4, 0.07, 0.14, M.cove, -5.5, H - 0.3, -7.85), box(7.4, 0.07, 0.14, M.cove, 5.5, H - 0.3, -7.85),
  ];
  coveStrips.forEach((c) => (c.castShadow = false));

  // columnas
  for (const sx of [-1, 1]) for (const z of [-5.5, 0, 5.5]) {
    const x = sx * 6.6;
    add(new THREE.CylinderGeometry(0.3, 0.3, H, 20), M.marble, x, H / 2, z);
    add(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 20), M.gold, x, 0.15, z);
    add(new THREE.CylinderGeometry(0.4, 0.3, 0.3, 20), M.gold, x, H - 0.15, z);
    add(new THREE.TorusGeometry(0.31, 0.03, 8, 20), M.gold, x, 1.5, z).rotation.x = Math.PI / 2;
    collide(x, z, 0.8, 0.8);
  }

  // ---------- pedestal central y máquina ----------
  const machine = createClassicMachine();
  machine.group.position.copy(MACHINE_POS);
  scene.add(machine.group);
  machine.group.traverse((o) => { if (o.isMesh) shadowers.push(o); });
  add(new THREE.CylinderGeometry(2.15, 2.25, 0.12, 48), M.marble, MACHINE_POS.x, 0.06, MACHINE_POS.z);
  add(new THREE.TorusGeometry(2.15, 0.035, 8, 64), M.gold, MACHINE_POS.x, 0.125, MACHINE_POS.z, scene, false).rotation.x = Math.PI / 2;
  const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 6)), track(new THREE.MeshBasicMaterial({ map: track(glowTexture()), color: 0xd4af37, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(MACHINE_POS.x, 0.13, MACHINE_POS.z + 0.3);
  scene.add(pool);
  const mc = machine.colliderLocal;
  colliders.push({ minX: MACHINE_POS.x + mc.minX, maxX: MACHINE_POS.x + mc.maxX, minZ: MACHINE_POS.z + mc.minZ, maxZ: MACHINE_POS.z + mc.maxZ, enabled: true });
  interact({ id: 'machine', pos: new THREE.Vector3(MACHINE_POS.x, 1.2, MACHINE_POS.z + 0.7), radius: 2.9, prompt: { key: 'E', text: 'Usar THE CLASSIC' } });

  // ---------- mostrador ----------
  const CX = -5.5;
  box(4.2, 1.1, 0.9, M.wood, CX, 0.55, -6.75);
  box(4.35, 0.07, 1.05, M.gold, CX, 1.12, -6.75);
  box(3.8, 0.7, 0.03, M.velvet, CX, 0.55, -6.28);
  box(4.2, 0.1, 0.5, M.carbon, CX, 1.18, -6.55, scene);
  box(0.5, 0.35, 0.3, M.carbon, CX - 1.2, 1.4, -6.8);
  add(new THREE.PlaneGeometry(0.42, 0.22), M.screen, CX - 1.2, 1.44, -6.64, scene, false).rotation.x = -0.25;
  box(3.9, 0.05, 0.4, M.wood, CX, 1.6, -7.8);
  box(3.9, 0.05, 0.4, M.wood, CX, 2.2, -7.8);
  add(new THREE.PlaneGeometry(3.4, 1.6), M.mirror, CX, 2.9, -7.97, scene, false);
  for (let i = 0; i < 9; i++) {
    const row = i < 5 ? 1.63 : 2.23;
    add(new THREE.CylinderGeometry(0.05, 0.065, 0.3, 10), M.amber, CX - 1.6 + (i % 5) * 0.8 + (i < 5 ? 0 : 0.4), row + 0.17, -7.8, scene, false);
  }
  collide(CX, -7.15, 4.4, 1.7);
  sign('TIENDA', 3.6, 0.95, CX, 3.75, -7.97, 0, { color: '#fff3c4', glow: '#ffb020', font: '700 130px Cinzel, serif', sub: 'MEJORAS' });
  interact({ id: 'counter', pos: new THREE.Vector3(CX, 1.2, -6.4), radius: 3.3, prompt: { key: 'E', text: 'Abrir la tienda' } });

  // ---------- señalización de la tienda ----------
  const shopGem = add(new THREE.OctahedronGeometry(0.28, 0), track(new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb020, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.15 })), CX, 2.9, -6.3, scene, false);
  shopGem.scale.set(1, 1.5, 1);
  const shopHalo = new THREE.Mesh(track(new THREE.PlaneGeometry(1.8, 1.8)), track(new THREE.MeshBasicMaterial({ map: track(glowTexture()), color: 0xffb020, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  shopHalo.position.set(CX, 2.9, -6.28);
  scene.add(shopHalo);
  const shopRing = new THREE.Mesh(track(new THREE.RingGeometry(1.25, 1.45, 48)), track(new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  shopRing.rotation.x = -Math.PI / 2;
  shopRing.position.set(CX, 0.015, -4.9);
  scene.add(shopRing);
  const shopDisc = new THREE.Mesh(track(new THREE.CircleGeometry(1.25, 48)), track(new THREE.MeshBasicMaterial({ map: track(glowTexture()), color: 0xffb020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
  shopDisc.rotation.x = -Math.PI / 2;
  shopDisc.position.set(CX, 0.014, -4.9);
  scene.add(shopDisc);
  const shopArrow = new THREE.Mesh(track(new THREE.ConeGeometry(0.2, 0.45, 4)), track(new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb020, emissiveIntensity: 1.2 })));
  shopArrow.rotation.x = Math.PI;
  shopArrow.position.set(CX, 2.45, -5.6);
  shopArrow.visible = false;
  scene.add(shopArrow);
  const shopLight = new THREE.PointLight(0xffb020, 18, 7, 2);
  shopLight.position.set(CX, 2.4, -5.4);
  scene.add(shopLight);
  let shopAlert = false;

  // ---------- puertas ----------
  const doors = [
    { zone: 'neon_lounge', x: -8.98, z: -3, ry: Math.PI / 2 },
    { zone: 'underground', x: -8.98, z: 3, ry: Math.PI / 2 },
    { zone: 'golden_room', x: 8.98, z: -3, ry: -Math.PI / 2 },
    { zone: 'vip_hall', x: 8.98, z: 3, ry: -Math.PI / 2 },
  ];
  for (const d of doors) {
    const zone = ZONES[d.zone];
    const hex = `#${zone.color.toString(16).padStart(6, '0')}`;
    const g = new THREE.Group();
    g.position.set(d.x, 0, d.z);
    g.rotation.y = d.ry;
    scene.add(g);
    box(1.5, 2.5, 0.08, M.carbon, 0, 1.25, 0.04, g);
    box(1.1, 1.0, 0.03, M.wood, 0, 0.8, 0.1, g);
    box(1.1, 0.9, 0.03, M.wood, 0, 1.95, 0.1, g);
    box(0.14, 2.7, 0.16, M.gold, -0.82, 1.35, 0.08, g);
    box(0.14, 2.7, 0.16, M.gold, 0.82, 1.35, 0.08, g);
    box(1.78, 0.14, 0.16, M.gold, 0, 2.62, 0.08, g);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), M.gold, 0.55, 1.15, 0.16, g).rotation.x = Math.PI / 2;
    box(0.2, 0.17, 0.06, M.gold, 0.55, 0.95, 0.15, g);
    add(new THREE.TorusGeometry(0.06, 0.016, 8, 12, Math.PI), M.gold, 0.55, 1.03, 0.15, g);
    const glowMat = track(new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.55 }));
    add(new THREE.BoxGeometry(1.5, 0.03, 0.02), glowMat, 0, 0.02, 0.1, g, false);
    add(new THREE.BoxGeometry(0.03, 2.5, 0.02), glowMat, -0.74, 1.25, 0.1, g, false);
    add(new THREE.BoxGeometry(0.03, 2.5, 0.02), glowMat, 0.74, 1.25, 0.1, g, false);
    const s = sign(zone.name, 2.4, 0.6, 0, 3.3, 0.12, 0, { color: '#ffffff', glow: hex, font: '700 96px Cinzel, serif' });
    g.add(s);
    interact({ id: `door:${d.zone}`, zone: d.zone, pos: new THREE.Vector3(d.x + (d.x < 0 ? 0.6 : -0.6), 1.2, d.z), radius: 2.3, prompt: { key: 'E', text: `Inspeccionar puerta · ${zone.name}` } });
  }

  // ---------- puerta del Ala norte ----------
  const wingDoor = new THREE.Group();
  wingDoor.position.set(0, 0, -7.98);
  scene.add(wingDoor);
  box(3.0, 2.8, 0.1, M.carbon, 0, 1.4, 0, wingDoor);
  for (const s of [-1, 1]) {
    box(1.2, 2.2, 0.03, M.wood, s * 0.72, 1.4, 0.07, wingDoor);
    box(0.06, 2.6, 0.04, M.gold, s * 0.06, 1.4, 0.09, wingDoor);
    add(new THREE.SphereGeometry(0.06, 12, 8), M.gold, s * 0.22, 1.3, 0.12, wingDoor);
  }
  box(3.2, 0.12, 0.2, M.gold, 0, 2.86, 0.02, wingDoor);
  box(0.12, 2.86, 0.2, M.gold, -1.6, 1.43, 0.02, wingDoor);
  box(0.12, 2.86, 0.2, M.gold, 1.6, 1.43, 0.02, wingDoor);
  const wingCollider = collide(0, -8.1, 3.2, 0.6);
  sign('HOUSE OF ODDS', 5.8, 1.45, 0, 3.7, -7.96, 0, { color: '#fff3c4', glow: '#d4af37', font: '700 118px Cinzel, serif' });
  const wingInteract = interact({ id: 'wing', pos: new THREE.Vector3(0, 1.2, -7.2), radius: 2.4, prompt: { key: 'E', text: 'Inspeccionar puerta · ALA NORTE' } });

  // ---------- Ala norte (visible tras ampliar) ----------
  const wing = new THREE.Group();
  wing.visible = false;
  scene.add(wing);
  const wf = add(new THREE.PlaneGeometry(10.4, 8.4), M.floor, 0, 0.002, -12.2, wing, false);
  wf.rotation.x = -Math.PI / 2;
  wf.material = track(new THREE.MeshStandardMaterial({ map: track(marbleTexture(512, [10.4 / 2.4, 8.4 / 2.4])), roughness: 0.2, metalness: 0.2, envMapIntensity: 1.1 }));
  add(new THREE.PlaneGeometry(10.4, 8.4), M.ceiling, 0, H, -12.2, wing, false).rotation.x = Math.PI / 2;
  box(0.4, H, 8.4, wallMat(3.5, 2), -5.2, H / 2, -12.2, wing);
  box(0.4, H, 8.4, wallMat(3.5, 2), 5.2, H / 2, -12.2, wing);
  box(10.8, H, 0.4, wallMat(4.5, 2), 0, H / 2, -16.6, wing);
  collide(-5.2, -12.2, 0.4, 8.4);
  collide(5.2, -12.2, 0.4, 8.4);
  collide(0, -16.6, 10.8, 0.4);
  const sofa = (x, z, ry, parent) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    parent.add(g);
    box(2.2, 0.4, 0.9, M.velvet, 0, 0.35, 0, g);
    box(2.2, 0.55, 0.22, M.velvet, 0, 0.8, -0.36, g);
    box(0.2, 0.55, 0.9, M.velvet, -1.1, 0.55, 0, g);
    box(0.2, 0.55, 0.9, M.velvet, 1.1, 0.55, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.06, 0.14, 0.06, M.gold, sx * 1.0, 0.07, sz * 0.38, g);
  };
  sofa(-2.6, -15.4, 0, wing);
  sofa(2.6, -15.4, 0, wing);
  sofa(-4.0, -12.2, Math.PI / 2, wing);
  sofa(4.0, -12.2, -Math.PI / 2, wing);
  collide(-2.6, -15.4, 2.3, 1.0);
  collide(2.6, -15.4, 2.3, 1.0);
  collide(-4.0, -12.2, 1.0, 2.3);
  collide(4.0, -12.2, 1.0, 2.3);
  add(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 28), M.marble, 0, 0.25, -12.8, wing);
  add(new THREE.TorusGeometry(0.8, 0.03, 8, 28), M.gold, 0, 0.5, -12.8, wing).rotation.x = Math.PI / 2;
  collide(0, -12.8, 1.7, 1.7);
  const wingArt = new THREE.Mesh(track(new THREE.PlaneGeometry(2.0, 2.6)), track(new THREE.MeshStandardMaterial({ map: track(paintingTexture('wing-a')), emissiveMap: track(paintingTexture('wing-a')), emissive: 0x888888, roughness: 0.6 })));
  wingArt.position.set(0, 2.0, -16.38);
  wing.add(wingArt);
  const wingSign = sign('SALÓN DE ESPERA', 3.8, 0.95, 0, 3.9, -16.38, 0, { color: '#ffe9a8', glow: '#d4af37', font: '700 92px Cinzel, serif', sub: 'ALA NORTE' });
  wing.add(wingSign);
  const wingLight = new THREE.PointLight(0xffc680, 0, 16, 2);
  wingLight.position.set(0, 3.4, -12.5);
  scene.add(wingLight);

  // ---------- cuadros, sofás y lámparas de la sala ----------
  const frame = (x, z, ry, seed) => {
    const g = new THREE.Group();
    g.position.set(x, 2.25, z);
    g.rotation.y = ry;
    scene.add(g);
    box(1.7, 2.2, 0.08, M.gold, 0, 0, 0, g);
    const t = track(paintingTexture(seed));
    const art = new THREE.Mesh(track(new THREE.PlaneGeometry(1.5, 2.0)), track(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0x777777, roughness: 0.6 })));
    art.position.z = 0.05;
    g.add(art);
  };
  frame(-8.95, 0, Math.PI / 2, 'art-1');
  frame(8.95, 0, -Math.PI / 2, 'art-2');
  frame(-4.5, 7.95, Math.PI, 'art-3');
  frame(4.5, 7.95, Math.PI, 'art-4');
  for (const x of [-2.2, 2.2]) {
    sofa(x, 7.2, Math.PI, scene);
    collide(x, 7.2, 2.3, 1.0);
  }
  for (const x of [-5.4, 5.4]) {
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 20), M.marble, x, 0.35, 7.2);
    add(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), M.gold, x, 0.9, 7.2);
    add(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 14, 1, true), M.amber, x, 1.2, 7.2, scene, false);
    collide(x, 7.2, 0.7, 0.7);
  }

  // ---------- extras desbloqueables ----------
  const carpet = new THREE.Mesh(track(new THREE.PlaneGeometry(3, 9)), track(new THREE.MeshStandardMaterial({ map: track(carpetTexture()), roughness: 1 })));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.012, 3.1);
  carpet.receiveShadow = true;
  carpet.visible = false;
  scene.add(carpet);

  const statue = new THREE.Group();
  statue.position.set(5.2, 0, 5.4);
  statue.visible = false;
  scene.add(statue);
  box(0.9, 0.9, 0.9, M.marble, 0, 0.45, 0, statue);
  box(1.0, 0.08, 1.0, M.gold, 0, 0.94, 0, statue);
  const profile = [[0.0, 0], [0.3, 0], [0.34, 0.25], [0.22, 0.8], [0.17, 1.1], [0.1, 1.25], [0.0, 1.3]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(profile, 20), M.gold, 0, 0.98, 0, statue);
  add(new THREE.SphereGeometry(0.11, 16, 12), M.gold, 0, 2.38, 0, statue);
  add(new THREE.TorusGeometry(0.2, 0.012, 8, 28), M.gold, 0, 2.4, -0.1, statue, false);
  const arm = add(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), M.gold, 0.22, 2.15, 0, statue);
  arm.rotation.z = -0.9;
  const orb = add(new THREE.SphereGeometry(0.13, 18, 14), track(new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc23a, emissiveIntensity: 1.6 })), 0.45, 2.7, 0, statue, false);
  collide(5.2, 5.4, 1.1, 1.1);

  const chandelier = new THREE.Group();
  chandelier.position.set(0, 3.55, -1.5);
  chandelier.visible = false;
  scene.add(chandelier);
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), M.gold, 0, 0.55, 0, chandelier, false);
  add(new THREE.TorusGeometry(1.0, 0.04, 10, 40), M.gold, 0, 0, 0, chandelier, false).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.55, 0.03, 8, 32), M.gold, 0, 0.18, 0, chandelier, false).rotation.x = Math.PI / 2;
  const crystalMat = track(new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: 0x88a8b0, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.05 }));
  const crystals = new THREE.InstancedMesh(track(new THREE.OctahedronGeometry(0.07, 0)), crystalMat, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 1.0, -0.18 - (i % 3) * 0.1, Math.sin(a) * 1.0);
    dummy.scale.set(0.8, 1.6, 0.8);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
  }
  chandelier.add(crystals);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.SphereGeometry(0.06, 10, 8), M.candle, Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0, chandelier, false);
  }
  const chandLight = new THREE.PointLight(0xffe0b0, 0, 12, 2);
  chandLight.position.set(0, 3.4, -1.5);
  scene.add(chandLight);

  // ---------- iluminación ----------
  const hemi = new THREE.HemisphereLight(0x3a2a2a, 0x050304, 0.35);
  const spot = new THREE.SpotLight(0xfff0d8, 320, 14, 0.55, 0.7, 2);
  spot.position.set(0, 4.3, 0.5);
  spot.target.position.set(0, 1.2, -1.5);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  const fill = new THREE.PointLight(0xffd7a0, 40, 18, 2);
  fill.position.set(0, 4.0, 3.5);
  const redL = new THREE.PointLight(0xc42240, 28, 12, 2);
  redL.position.set(-7.2, 2.6, 2.5);
  const redR = redL.clone();
  redR.position.set(7.2, 2.6, 2.5);
  const goldL = new THREE.PointLight(0xd4af37, 25, 10, 2);
  goldL.position.set(CX, 2.8, -5.5);
  scene.add(hemi, spot, spot.target, fill, redL, redR, goldL);

  // ---------- polvo ambiental ----------
  const DUST = 140;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustSeed.set([Math.random() * 16 - 8, 0.4 + Math.random() * 3.8, Math.random() * 14 - 7], i * 3);
  }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ size: 0.035, map: track(glowTexture()), color: 0xffe6b0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- estado ----------
  const state = { lighting: 0, expanded: false, wingOpen: 0, effects: true };

  function setLighting(level) {
    state.lighting = level;
    spot.intensity = LIGHT_LEVELS.spot[level];
    fill.intensity = LIGHT_LEVELS.fill[level];
    redL.intensity = redR.intensity = LIGHT_LEVELS.red[level];
    goldL.intensity = LIGHT_LEVELS.red[level] * 0.9;
    M.cove.emissiveIntensity = LIGHT_LEVELS.cove[level];
    hemi.intensity = 0.3 + level * 0.1;
  }

  /** Refleja en el escenario lo que el jugador ha comprado. `silent=false` anima la apertura del ala. */
  function applyProgress(loadout, { animate = false } = {}) {
    setLighting(loadout.lighting);
    carpet.visible = loadout.carpet;
    statue.visible = loadout.statue;
    chandelier.visible = loadout.chandelier;
    chandLight.intensity = loadout.chandelier ? 60 : 0;
    machine.applyLoadout(loadout);
    if (loadout.expanded && !state.expanded) {
      state.expanded = true;
      wing.visible = true;
      wingLight.intensity = 55;
      wingCollider.enabled = false;
      wingInteract.enabled = false;
      if (animate) state.wingOpen = 0.0001;
      else { state.wingOpen = 1; wingDoor.visible = false; }
    } else if (!loadout.expanded) {
      state.expanded = false;
      wing.visible = false;
      wingLight.intensity = 0;
      wingCollider.enabled = true;
      wingInteract.enabled = true;
      state.wingOpen = 0;
      wingDoor.visible = true;
      wingDoor.position.y = 0;
    }
  }

  function applyShadows(g) {
    spot.castShadow = g.shadows;
    if (g.shadows && spot.shadow.mapSize.x !== g.shadowMapSize) {
      spot.shadow.mapSize.set(g.shadowMapSize, g.shadowMapSize);
      spot.shadow.map?.dispose();
      spot.shadow.map = null;
    }
    scene.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
  }

  const world = {
    scene,
    camera,
    colliders,
    interactables,
    machine,
    spawn: { x: 0, z: 6.4, yaw: 0 },
    applyProgress,
    /** Marca la tienda como «tienes algo que comprar»: flecha saltarina y brillo intenso. */
    setShopAlert(on) {
      shopAlert = on;
      shopArrow.visible = on;
    },

    update(dt, time, { paused = false } = {}) {
      machine.update(paused ? 0 : dt, time);
      for (const s of signs) {
        const dip = Math.sin(time * 11 + s.phase * 5) > 0.992 ? 0.45 : 1;
        s.mat.opacity = (0.88 + 0.12 * Math.sin(time * 2.3 + s.phase)) * dip;
      }
      shopGem.rotation.y = time * 1.4;
      shopGem.position.y = 2.9 + Math.sin(time * 1.8) * 0.08;
      const pulse = shopAlert ? 0.5 + 0.5 * Math.sin(time * 6) : 0.5 + 0.5 * Math.sin(time * 1.6);
      shopHalo.material.opacity = 0.35 + pulse * (shopAlert ? 0.6 : 0.25);
      shopRing.material.opacity = 0.35 + pulse * (shopAlert ? 0.6 : 0.3);
      shopRing.scale.setScalar(1 + pulse * 0.06);
      shopLight.intensity = 14 + pulse * (shopAlert ? 30 : 8);
      shopArrow.position.y = 2.45 + Math.abs(Math.sin(time * 4)) * 0.25;
      shopArrow.rotation.y = time * 2;
      chandelier.rotation.y += dt * 0.12;
      crystalMat.emissiveIntensity = 0.4 + 0.25 * Math.sin(time * 1.7);
      orb.position.y = 2.7 + Math.sin(time * 1.4) * 0.07;
      orb.rotation.y = time;
      if (state.wingOpen > 0 && state.wingOpen < 1) {
        state.wingOpen = Math.min(1, state.wingOpen + dt / 1.6);
        wingDoor.position.y = (1 - (1 - state.wingOpen) ** 3) * 2.9;
        if (state.wingOpen >= 1) wingDoor.visible = false;
      }
      if (state.effects) {
        for (let i = 0; i < DUST; i++) {
          const j = i * 3;
          dustPos[j] = dustSeed[j] + Math.sin(time * 0.15 + i) * 0.5;
          dustPos[j + 1] = 0.4 + ((dustSeed[j + 1] + time * 0.06 * (1 + (i % 5) * 0.2)) % 3.9);
          dustPos[j + 2] = dustSeed[j + 2] + Math.cos(time * 0.12 + i * 1.3) * 0.5;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
    },

    onResize({ aspect }) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },

    onGraphicsChanged(g) {
      state.effects = g.effects;
      dust.visible = g.effects;
      pool.visible = g.effects;
      machine.setEffects(g.effects);
      applyShadows(g);
    },

    dispose() {
      machine.dispose();
      for (const o of owned) o.dispose?.();
      envTarget.dispose();
      spot.shadow.map?.dispose();
      crystals.dispose();
    },
  };
  return world;
}
