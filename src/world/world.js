import { t } from '../i18n/index.js';
import * as THREE from 'three';
import { FEATURES, PALETTE } from '../config.js';
import { ZONES } from '../data/progression.js';
import { Batch, seg, tiledBox, tiledPlane } from '../gfx/geometry.js';
import { buildEnvironment } from '../gfx/environment.js';
import { clearBakedMaterials } from '../gfx/shader-textures.js';
import { placeProp } from './props/assets.js';
import { RouletteView } from '../games/roulette-view.js';
import { createMaterialKit } from '../gfx/materials.js';
import { createClassicMachine } from '../machines/classic.js';
import { CLASSIC, COUNTER, DECOR_SLOTS, DOORS, HALL, LOUNGE, NORTH_WING, RECEPTION, SLOT_BANKS, SPAWN, TABLES, doorPlacement, playerBounds, staticColliders } from './layout.js';
import { createPalette } from './palette.js';
import { glowTexture, neonTexture } from './procedural-textures.js';
import { setSlotsLit, slotBank } from './props/cabinets.js';
import { createNeonSign, neonCanDraw } from './neon.js';
import { buildCarpet, buildChandelier, buildClutter, buildGrimeDecals, buildLoungeRug, buildStatue, painting } from './props/decor.js';
import { buildDamage } from './props/damage.js';
import { buildDecorSets } from './props/decor-sets.js';
import { armchair, bench, coffeeTable, floorLamp, plant, sofa, workbench, workbenchWall } from './props/furniture.js';
import { createHelpers } from './props/helpers.js';
import { batchModel, hasModel, matKey, paletteRemap } from './props/models.js';
import { DOOR_H, buildCounter, buildPilasters, buildReception, buildShell, doorFrame } from './props/structure.js';
import { blackjackTable, rouletteTable } from './props/tables.js';
import { buildStoryItems } from './props/story-items.js';
import { waterReflection } from './props/water.js';
import { STORY_SPOTS } from './layout.js';

/**
 * EL CASINO (MAIN FLOOR + ala norte ampliable).
 *
 * Construye escenario, luces, colisiones, interactuables y anclas para PNJ a
 * partir del plano (layout.js) y expone un «controlador de escena» para Game.
 *
 * Calidad: los materiales, la finura de los modelos, las texturas, la
 * decoración menor y el número de luces dependen del nivel gráfico. Si cambia
 * algo que exige regenerar geometría, el mundo se RECONSTRUYE en caliente
 * (conservando el estado: compras, limpieza, máquina).
 *
 * Estado del local: `dirt` (1 = abandonado, 0 = impecable) alimenta la capa de
 * suciedad de todos los materiales, las manchas, los trastos, el neón roto y
 * el parpadeo de las luces. Cambia de forma animada al limpiar.
 */

// iluminación comprada: el local empieza algo apagado (sin llegar a oscuro) y cada mejora se nota
// nivel de la instalación eléctrica: 0 = casino abandonado (penumbra cálida, se ve bien), 1+ = reparada.
// La reparación SUSTITUYE la luz vieja (no se suma): nivel 1 = la penumbra cálida de antes, bien equilibrada.
const LIGHT_LEVELS = [0.3, 0.56, 0.62, 0.68];
/** Brillo de las luminarias (emisivos) por nivel: con la instalación vieja apenas lucen. */
const GLOW_LEVELS = [0.24, 0.42, 0.48, 0.54];
const BUILD_KEYS = ['material', 'detail', 'textureSize', 'propDensity', 'reflections', 'dynamicLights', 'particleScale'];
const buildSignature = (g) => BUILD_KEYS.map((k) => g[k]).join('|');
/** Nº aproximado de pasos de la construcción (para la barra de carga). */
const BUILD_STEPS = 40;
/** Cede el hilo al navegador (pinta la barra y atiende la página). En pestaña oculta no espera al fotograma. */
export const breathe = () => new Promise((resolve) => {
  let done = false;
  const go = () => {
    if (!done) {
      done = true;
      resolve();
    }
  };
  requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 60);
});

export function createWorld({ renderer, graphics }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.black);
  scene.fog = new THREE.FogExp2(0x0a0607, 0.022);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 120);

  // Estructuras ESTABLES (el jugador, la app y los PNJ guardan su referencia).
  const colliders = [];
  const interactables = [];
  const anchors = [];
  const bounds = playerBounds(false);
  const dirt = { hall: { value: 1 } };

  const envTarget = buildEnvironment(renderer);
  // reflejo plano de los charcos (solo ALTA y ULTRA): uno compartido, se crea una vez
  let waterRefl = null;
  envTarget.texture.isPMREMTexture = true;
  const state = {
    g: graphics,
    signature: buildSignature(graphics),
    loadout: null,
    dirtTarget: 1,
    expanded: false,
    wingOpen: 0,
    shopAlert: false,
    pendingRebuild: false,
    story: { items: { toolbox: true, doc_box: true }, entranceOpen: false, receptionStyle: null, breaker: false, interacts: new Set(), powered: true, machineBlocked: false, repaired: false, serviceDoor: false },
  };

  let B = null; // construcción actual
  const handlers = { onReelStop: null, onTick: null, onDone: null };

  // ======================================================================== construcción
  /** Construcción síncrona (reconstrucción al cambiar la calidad, tras el velo «aplicando calidad…»). */
  function build(g) {
    const it = buildSteps(g);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /**
   * Construcción POR PASOS para la pantalla de carga: cede el hilo al navegador cada pocos milisegundos,
   * así la página nunca se queda «sin responder» en un PC modesto y la barra avanza de verdad.
   */
  async function buildAsync(g, onProgress = () => {}) {
    const it = buildSteps(g);
    let t0 = performance.now();
    let n = 0;
    let r = it.next();
    while (!r.done) {
      n++;
      if (performance.now() - t0 > 24) {
        onProgress(Math.min(0.99, n / BUILD_STEPS));
        await breathe();
        t0 = performance.now();
      }
      r = it.next();
    }
    onProgress(1);
    return r.value;
  }

  function* buildSteps(g) {
    const root = new THREE.Group();
    root.name = 'casino';
    scene.add(root);
    const owned = [];
    const track = (o) => (owned.push(o), o);
    const kit = createMaterialKit(g, { dirt });
    const M = createPalette(kit, g, renderer);
    const H = createHelpers(g.detail);
    const batch = new Batch();
    const chipMats = new Map();
    if (g.textureSize >= 1024) waterRefl ??= waterReflection(renderer, scene);
    const ctx = {
      g, kit, M, H, B: batch, root, anchors, track,
      waterReflection: g.textureSize >= 1024 ? waterRefl : null,
      dynamic: [], decalMats: [], sconces: [],
      seg: (n) => seg(g.detail, n, 6),
      chip(color) {
        if (!chipMats.has(color)) chipMats.set(color, kit.make({ color, rough: 0.45, metal: 0.05 }));
        return chipMats.get(color);
      },
      addCollider(cx, cz, w, d, enabled = true) {
        const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, enabled };
        colliders.push(c);
        return c;
      },
    };
    colliders.length = 0;
    interactables.length = 0;
    anchors.length = 0;
    colliders.push(...staticColliders());

    const signs = [];
    /** `text` y `opts.sub` pueden ser funciones (se reevalúan al cambiar de idioma). */
    const signTex = (text, opts) => neonTexture(typeof text === 'function' ? text() : text, { ...opts, sub: typeof opts.sub === 'function' ? opts.sub() : opts.sub ?? null });
    const sign = (text, w, h, x, y, z, ry, opts = {}, parent = root) => {
      const txt = typeof text === 'function' ? text() : text;
      const sub = typeof opts.sub === 'function' ? opts.sub() : opts.sub ?? null;
      // neón 3D de tubos si la fuente tiene todas las letras (el chino usa el rótulo plano)
      if (neonCanDraw(txt) && (!sub || neonCanDraw(String(sub).toUpperCase()))) {
        const neon = createNeonSign(ctx, txt, { w, h, color: opts.color, glow: opts.glow, sub, dead: opts.dead });
        neon.group.position.set(x, y, z);
        neon.group.rotation.y = ry;
        parent.add(neon.group);
        const entry = { neon, mesh: neon.group, mat: null, phase: signs.length * 1.7, text, opts, dynamic: typeof text === 'function' || typeof opts.sub === 'function', broken: !!opts.dead };
        signs.push(entry);
        return entry;
      }
      const mat = kit.basic({ map: signTex(text, opts), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      parent.add(m);
      const entry = { mat, mesh: m, phase: signs.length * 1.7, text, opts, dynamic: typeof text === 'function' || typeof opts.sub === 'function', broken: !!opts.dead };
      signs.push(entry);
      return entry;
    };

    yield;
    // ---------------- estructura
    buildShell(ctx);
    yield;
    buildPilasters(ctx);
    buildCounter(ctx);
    yield;
    buildReception(ctx);
    yield;

    // ---------------- mesas y máquinas antiguas
    for (const [i, tb] of TABLES.blackjack.entries()) {
      blackjackTable(ctx, tb, { id: tb.id, felt: i === 1 ? 'red' : 'green' });
      yield;
    }
    for (const tb of TABLES.roulette) {
      rouletteTable(ctx, tb, { id: tb.id, wheel: false });
      yield;
    }
    // ruedas reales también en las mesas de ambiente (giran despacio); la jugable la pone TableController
    const wheels = TABLES.roulette.filter((tb) => tb.id !== 'royal_roulette').map((tb) => track(new RouletteView({ scene: root, table: tb })));
    let bankIndex = 0;
    for (const bank of SLOT_BANKS) {
      slotBank(ctx, bank, bankIndex);
      bankIndex += bank.count * 2;
      yield;
    }

    // ---------------- salón (suroeste) y decoración fija
    buildLoungeRug(ctx, LOUNGE.rug);
    for (const a of LOUNGE.armchairs) if (!placeProp(ctx, 'armchair', { x: a.x, z: a.z, yaw: a.yaw })) armchair(ctx, batch.at(a));
    for (const a of LOUNGE.armchairs) anchors.push({ type: 'armchair', x: a.x, z: a.z, yaw: a.yaw, sitY: 0.45 });
    if (!placeProp(ctx, 'coffee_table', { x: LOUNGE.table.x, z: LOUNGE.table.z })) coffeeTable(ctx, batch.at(LOUNGE.table));
    if (placeProp(ctx, 'sofa', { x: -10.7, z: 10.45, yaw: Math.PI })) {
      colliders.push({ minX: -11.7, maxX: -9.7, minZ: 10.0, maxZ: 10.9, enabled: true });
      anchors.push({ type: 'armchair', x: -11.19, z: 10.33, yaw: Math.PI, sitY: 0.53 }, { type: 'armchair', x: -10.21, z: 10.33, yaw: Math.PI, sitY: 0.53 });
    }
    hangChandelier(ctx, 'chandelier_01', { x: LOUNGE.table.x, z: LOUNGE.table.z, scale: 1.25, bottom: 3.2 });
    for (const z of [6.3, 10.2]) floorLamp(ctx, batch.at({ x: -13.1, z }));
    colliders.push({ minX: -13.4, maxX: -12.8, minZ: 6.0, maxZ: 6.6, enabled: true }, { minX: -13.4, maxX: -12.8, minZ: 9.9, maxZ: 10.5, enabled: true });
    const plants = [[-3.4, 10.4], [3.4, 10.4], [-13.3, -10.3], [13.3, -10.3], [13.3, 2.5], [-13.3, 2.5], [-3.4, -10.4], [3.4, -10.4]]; // ninguna tapa el cuadro eléctrico (x −5,2)
    plants.forEach(([x, z], i) => {
      if (i >= 4 && g.propDensity < 0.5) return;
      if (!placeProp(ctx, 'plant', { x, z, yaw: i * 1.3, height: 1.15 + (i % 3) * 0.15 })) plant(ctx, batch.at({ x, z }), { height: 1.2 + (i % 3) * 0.2 });
      colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, enabled: true });
    });
    for (const x of [-6, 6]) {
      bench(ctx, batch.at({ x, z: 10.55, yaw: Math.PI }));
      colliders.push({ minX: x - 0.85, maxX: x + 0.85, minZ: 10.25, maxZ: 10.85, enabled: true });
      anchors.push({ type: 'bench', x, z: 10.55, yaw: Math.PI, sitY: 0.5 });
    }

    yield;
    // ---------------- puesto de mantenimiento (Daniel)
    if (placeProp(ctx, 'work_table', { x: 13.4, z: 0.8, yaw: Math.PI / 2 })) {
      // mesa de taller real (pintada y gastada) y en la pared el tablero de herramientas
      workbenchWall(ctx, batch.at({ x: 13.6, z: 0.8, yaw: -Math.PI / 2 }));
      colliders.push({ minX: 12.82, maxX: 13.98, minZ: -0.42, maxZ: 2.02, enabled: true });
    } else {
      workbench(ctx, batch.at({ x: 13.25, z: 0.8, yaw: -Math.PI / 2 }));
      colliders.push({ minX: 12.85, maxX: 13.7, minZ: -0.1, maxZ: 1.7, enabled: true });
    }
    anchors.push({ type: 'workbench', x: 12.35, z: 0.8, yaw: Math.PI / 2 });

    yield;
    // ---------------- cuadros (uno torcido y otro caído: el local está descuidado)
    const paintingSpecs = [
      { x: HALL.minX + 0.05, y: 2.6, z: 1.0, yaw: Math.PI / 2, seed: 'art-1' },
      { x: HALL.maxX - 0.05, y: 2.6, z: -9.8, yaw: -Math.PI / 2, seed: 'art-2', crooked: 0.09 }, // encima del taller de Daniel va su tablero de herramientas
      { x: -9, y: 2.6, z: HALL.maxZ - 0.05, yaw: Math.PI, seed: 'art-3' },
      { x: 5.6, y: 2.6, z: HALL.maxZ - 0.05, yaw: Math.PI, seed: 'art-4', crooked: -0.06 },
    ];
    const paintings = [];
    for (const spec of paintingSpecs) {
      paintings.push(painting(ctx, spec));
      yield;
    }
    const crooked = [paintings[1], paintings[3]].map((p) => ({ p, rest: p.rotation.z }));
    const fallen = painting(ctx, { x: 12.9, y: 0.75, z: -1.9, yaw: -Math.PI / 2 + 0.2, seed: 'art-5', w: 1.2, h: 1.5 });
    yield;
    fallen.rotation.x = -0.32;

    // ---------------- estrado y THE CLASSIC
    const dais = batch.at({ x: CLASSIC.x, z: CLASSIC.z });
    H.cyl(dais, M.marble, CLASSIC.dais, CLASSIC.dais + 0.08, 0.14, 0, 0.07, 0, { segments: 56 });
    H.torus(dais, M.gold, CLASSIC.dais + 0.02, 0.03, 0, 0.14, 0, { segments: 64 });
    H.cyl(dais, M.marble, CLASSIC.dais + 0.45, CLASSIC.dais + 0.5, 0.06, 0, 0.03, 0, { segments: 56 });
    const machine = createClassicMachine({ g, kit });
    machine.group.position.set(CLASSIC.x, CLASSIC.y, CLASSIC.z);
    root.add(machine.group);
    machine.group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = g.shadows;
    });
    Object.assign(machine, { onReelStop: (i) => handlers.onReelStop?.(i), onTick: (i) => handlers.onTick?.(i), onDone: (r) => handlers.onDone?.(r) });
    const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 6)), kit.basic({ map: glowTexture(), color: 0xd4af37, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(CLASSIC.x, 0.15, CLASSIC.z + 0.4);
    root.add(pool);
    interactables.push({ id: 'machine', pos: new THREE.Vector3(CLASSIC.x, 1.2, CLASSIC.z + 1.0), radius: 3.0, prompt: { key: 'E', textKey: 'prompt.machine', params: { machine: 'THE CLASSIC' } } });

    yield;
    // ---------------- mostrador: rótulo, interacción y señal de «tienes algo que comprar»
    sign(() => t('sign.shop'), 3.6, 0.95, COUNTER.x, 3.9, HALL.minZ + 0.06, 0, { color: '#fff3c4', glow: '#ffb020', font: '700 130px Cinzel, serif', sub: () => t('sign.shopSub') });
    interactables.push({ id: 'counter', pos: new THREE.Vector3(COUNTER.x, 1.2, COUNTER.front + 0.2), radius: 3.3, prompt: { key: 'E', textKey: 'prompt.shop' } });
    // mesas jugables (el resto de mesas son de ambiente, con su crupier y clientes)
    if (FEATURES.cardsChapter) interactables.push({ id: 'table:royal_blackjack', game: 'blackjack', pos: new THREE.Vector3(6.2, 1.0, -6.75), radius: 2.6, prompt: { key: 'E', textKey: 'prompt.table', params: { name: 'ROYAL BLACKJACK' } } });
    if (FEATURES.cardsChapter) interactables.push({ id: 'table:royal_roulette', game: 'roulette', pos: new THREE.Vector3(-5.6, 1.0, -2.9), radius: 2.6, prompt: { key: 'E', textKey: 'prompt.table', params: { name: 'ROYAL ROULETTE' } } });
    const shop = buildShopBeacon(ctx);

    yield;
    // ---------------- puertas
    const doorObjects = buildDoors(ctx, sign);
    yield;

    // ---------------- rótulo principal (neón con letras fundidas mientras el local está sucio)
    const neonOpts = { color: '#fff3c4', glow: '#d4af37', font: '700 118px Cinzel, serif' };
    // 3D: un solo rótulo cuyas letras fundidas se vuelven a encender; plano: dos capas que se funden
    const neonBroken = sign('HOUSE OF ODDS', 6.2, 1.55, 0, 4.4, HALL.minZ + 0.075, 0, { ...neonOpts, dead: [1, 10] });
    const neonClean = neonBroken.neon ? null : sign('HOUSE OF ODDS', 6.2, 1.55, 0, 4.4, HALL.minZ + 0.07, 0, neonOpts);

    yield;
    // ---------------- lámparas colgantes
    const pendants = buildPendants(ctx);
    yield;

    // ---------------- ala norte (oculta hasta ampliar)
    const wing = buildWing(ctx, sign);
    yield;

    // ---------------- objetos de la historia
    const story = buildStoryItems(ctx, sign);
    yield;

    // ---------------- decoración comprable
    const carpet = buildCarpet(ctx);
    yield;
    const decorSets = buildDecorSets(ctx, { addCollider: ctx.addCollider });
    yield;
    const statue = buildStatue(ctx);
    const chandelier = buildChandelier(ctx);
    yield;

    // ---------------- suciedad
    buildGrimeDecals(ctx);
    yield;
    const clutter = buildClutter(ctx);
    yield;
    // el cuadro caído también se retira con la limpieza
    clutter.push({ group: fallen, clearAt: 0.5, collider: null, scale: 1 });
    // desperfectos (goteras, grietas, humedad): los arregla Daniel
    const damage = buildDamage(ctx);
    yield;

    // colisionadores de asientos (taburetes de mesas y máquinas)
    for (const a of anchors) {
      if (a.type === 'machine-seat' || a.type === 'table-seat') colliders.push({ minX: a.x - 0.22, maxX: a.x + 0.22, minZ: a.z - 0.22, maxZ: a.z + 0.22, enabled: true });
    }

    // ---------------- fusionar todo lo estático
    yield;
    batch.build(root, { cast: g.shadows, receive: true });
    H.dispose();
    yield;

    // ---------------- luces
    const lights = buildLights(ctx, { pendants, machine });

    // ---------------- polvo en suspensión
    const dust = buildDust(ctx);

    return {
      root, kit, owned, wheels, machine, signs, signTex, pool, shop, doorObjects, neonClean, neonBroken, pendants, wing, carpet, statue, chandelier, clutter, crooked, lights, dust, ctx, story, damage, decorSets,
      dispose() {
        machine.dispose();
        for (const o of owned) o.dispose?.();
        kit.dispose();
        root.traverse((o) => {
          if (o.userData.sharedAsset) return; // mobiliario cargado: se comparte entre construcciones
          if (o.isMesh || o.isPoints || o.isInstancedMesh) o.geometry?.dispose();
          if (o.isInstancedMesh) o.dispose();
        });
        lights.dispose();
        scene.remove(root);
      },
    };
  }

  // ======================================================================== piezas con estado

  function buildShopBeacon(ctx) {
    const { kit, root, track } = ctx;
    const x = COUNTER.x;
    const z = COUNTER.front + 1.4;
    const gem = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.26, 0)), kit.make({ color: 0xffe9a8, emissive: 0xffb020, emissiveIntensity: 1.4, metal: 0.6, rough: 0.15 }));
    gem.scale.set(1, 1.5, 1);
    gem.position.set(x, 2.7, COUNTER.front - 0.3);
    const halo = new THREE.Mesh(track(new THREE.PlaneGeometry(1.8, 1.8)), kit.basic({ map: glowTexture(), color: 0xffb020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(x, 2.7, COUNTER.front - 0.28);
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(1.15, 1.35, 48)), kit.basic({ color: 0xffb020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.016, z);
    const disc = new THREE.Mesh(track(new THREE.CircleGeometry(1.15, 48)), kit.basic({ map: glowTexture(), color: 0xffb020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.015, z);
    const arrow = new THREE.Mesh(track(new THREE.ConeGeometry(0.2, 0.45, 4)), kit.make({ color: 0xffe9a8, emissive: 0xffb020, emissiveIntensity: 1.2 }));
    arrow.rotation.x = Math.PI;
    arrow.position.set(x, 2.2, COUNTER.front + 0.7);
    arrow.visible = false;
    root.add(gem, halo, ring, disc, arrow);
    return { gem, halo, ring, disc, arrow };
  }

  function buildDoors(ctx, sign) {
    const { H, M, kit, root, track } = ctx;
    const out = { wing: null, wingCollider: null, wingInteract: null };
    for (const door of DOORS) {
      const p = doorPlacement(door);
      const A = ctx.B.at({ x: p.x, z: p.z, yaw: p.yaw });
      const zone = door.zone ? ZONES[door.zone] : null;
      const glow = zone ? kit.make({ color: 0x000000, emissive: zone.color, emissiveIntensity: 1.4 }) : null;
      // marco y hojas modelados (arquitrabe escalonado con remate, cuarterones con moldura, latón); si faltan, los de código
      const tag = door.width > 3 ? '40' : '22';
      const framed = hasModel(`door_frame_${tag}`) && batchModel(A, `door_frame_${tag}`, paletteRemap(ctx, { glow }), { skip: (o) => !glow && matKey(o.material) === 'glow' });
      if (!framed) doorFrame(ctx, A, door.width, { glow });
      const modeledLeaves = hasModel(`door_leaves_${tag}`);
      const along = door.wall === 'north' || door.wall === 'south';
      const leafW = door.width / 2 - 0.02;
      if (door.id === 'wing') {
        // puerta doble dinámica: sube al ampliar
        const grp = new THREE.Group();
        grp.position.set(p.x, 0, p.z);
        grp.rotation.y = p.yaw;
        const b = new Batch();
        if (!(modeledLeaves && batchModel(b, `door_leaves_${tag}`, paletteRemap(ctx)))) {
          for (const s of [-1, 1]) {
            H.box(b, M.woodDark([1, 1]), leafW, DOOR_H - 0.04, 0.08, s * (leafW / 2 + 0.01), (DOOR_H - 0.04) / 2, 0.0, { r: 0.012 });
            H.box(b, M.wood([1, 1]), leafW - 0.3, 1.0, 0.03, s * (leafW / 2 + 0.01), 0.8, 0.05, { r: 0.008 });
            H.box(b, M.wood([1, 1]), leafW - 0.3, 1.2, 0.03, s * (leafW / 2 + 0.01), 2.1, 0.05, { r: 0.008 });
            H.cyl(b, M.gold, 0.02, 0.02, 0.5, s * 0.14, 1.3, 0.09, { segments: 8 });
          }
        }
        b.build(grp);
        root.add(grp);
        out.wing = grp;
        out.wingCollider = ctx.addCollider(p.x, p.z + 0.1, door.width + 0.2, 0.5);
        out.wingInteract = { id: 'wing', pos: new THREE.Vector3(p.x, 1.2, p.z + 0.9), radius: 2.6, prompt: { key: 'E', textKey: 'prompt.wing' } };
        interactables.push(out.wingInteract);
        continue;
      }
      // puertas de zona y entrada: dobles, cerradas
      if (!(modeledLeaves && batchModel(A, `door_leaves_${tag}`, paletteRemap(ctx)))) for (const s of [-1, 1]) {
        H.box(A, M.woodDark([1, 1]), leafW, DOOR_H - 0.04, 0.08, s * (leafW / 2 + 0.01), (DOOR_H - 0.04) / 2, -0.02, { r: 0.012 });
        H.box(A, M.wood([1, 1]), leafW - 0.26, 0.9, 0.03, s * (leafW / 2 + 0.01), 0.75, 0.035, { r: 0.008 });
        H.box(A, M.wood([1, 1]), leafW - 0.26, 1.2, 0.03, s * (leafW / 2 + 0.01), 2.05, 0.035, { r: 0.008 });
        H.cyl(A, M.gold, 0.02, 0.02, 0.42, s * 0.12, 1.25, 0.06, { segments: 8 });
      }
      const gap = along ? { w: door.width + 0.2, d: 0.6 } : { w: 0.6, d: door.width + 0.2 };
      ctx.addCollider(p.x, p.z, gap.w, gap.d);
      if (zone) {
        const hex = `#${zone.color.toString(16).padStart(6, '0')}`;
        const s = sign(() => t(`zone.${zone.id}`), 2.6, 0.65, 0, 3.8, 0.03, 0, { color: '#ffffff', glow: hex, font: '700 96px Cinzel, serif' }, root);
        const holder = new THREE.Group();
        holder.position.set(p.x, 0, p.z);
        holder.rotation.y = p.yaw;
        root.add(holder);
        holder.add(s.mesh);
        // cadena entre los tiradores y candado de latón (sala cerrada): nada de botón rojo de videojuego
        const steel = M.chrome;
        const N = 15;
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          const x = -0.13 + 0.26 * u;
          const y = 1.33 - 0.17 * (1 - (2 * u - 1) ** 2);
          const slope = -0.17 * -2 * (2 * u - 1) * 2 / 0.26;
          H.torus(A, steel, 0.0105, 0.0028, x, y, 0.105, { rx: k % 2 ? Math.PI / 2 : 0, rz: Math.atan(slope), segments: 10 });
        }
        H.torus(A, steel, 0.02, 0.0045, 0, 1.13, 0.112, { rx: 0, arc: Math.PI, segments: 12 });
        H.box(A, M.brass, 0.062, 0.07, 0.026, 0, 1.09, 0.112, { r: 0.008 });
        H.box(A, M.black, 0.008, 0.02, 0.004, 0, 1.085, 0.126, { r: 0 });
        interactables.push({ id: `door:${door.zone}`, zone: door.zone, pos: new THREE.Vector3(p.x + p.inward.x * 0.8, 1.2, p.z + p.inward.z * 0.8), radius: 2.4, prompt: { key: 'E', textKey: 'prompt.door', params: { zone: t(`zone.${door.zone}`) } } });
      } else if (door.id === 'entrance') {
        // cartel colgado de «CERRADO»
        const holder = new THREE.Group();
        holder.position.set(p.x, 0, p.z);
        holder.rotation.y = p.yaw;
        root.add(holder);
        const s = sign(() => t('sign.closed'), 1.5, 0.38, 0, 1.75, 0.045, 0, { color: '#ffdede', glow: '#c42240', font: '700 120px Cinzel, serif' }, holder);
        s.closedSign = true;
        const mat = ctx.B.at({ x: p.x, z: p.z + p.inward.z * 1.0, yaw: p.yaw });
        H.box(mat, kit.make({ color: 0x241612, rough: 1, dirt: 'hall' }), 2.4, 0.015, 1.2, 0, 0.008, 0, { r: 0 });
      }
    }
    return out;
  }

  /** Lámparas colgantes art déco: varilla de latón, florón, globo de cristal opalino y aro dorado. */
  function buildPendants(ctx) {
    const { H, M, kit } = ctx;
    const opal = kit.make({ color: 0xfff4e4, emissive: 0xffd9a8, emissiveIntensity: 1.25, rough: 0.35 });
    const flicker = kit.make({ color: 0xfff4e4, emissive: 0xffd9a8, emissiveIntensity: 1.25, rough: 0.35 });
    const dead = kit.make({ color: 0x8a8278, emissive: 0xffd9a8, emissiveIntensity: 0, rough: 0.4 });
    const xs = [-8, -4, 4, 8];
    const zs = [-8.8, 0, 8.8];
    const list = [];
    let i = 0;
    const modeled = hasModel('pendant');
    for (const z of zs) {
      for (const x of xs) {
        const top = HALL.height;
        const drop = 1.35;
        if (modeled) {
          // lámpara modelada: florón escalonado, varilla con nudos, galería y globo opalino con bandas doradas
          const kind = i === 6 ? 'flicker' : i === 9 ? 'dead' : 'alive';
          batchModel(ctx.B.at({ x, y: top, z }), 'pendant', paletteRemap(ctx, { opal: kind === 'flicker' ? flicker : kind === 'dead' ? dead : opal }));
          list.push({ x, y: top - drop - 0.2, z, kind });
          i++;
          continue;
        }
        const A = ctx.B.at({ x, z });
        H.cyl(A, M.brass, 0.09, 0.07, 0.05, 0, top - 0.03, 0, { segments: 16 });
        H.cyl(A, M.brass, 0.008, 0.008, drop, 0, top - drop / 2, 0, { segments: 6 });
        H.lathe(A, M.brass, [[0.02, 0.1], [0.07, 0.08], [0.1, 0.03], [0.1, 0.0], [0.03, 0.0]], 0, top - drop - 0.06, 0, { segments: 20 });
        const kind = i === 6 ? 'flicker' : i === 9 ? 'dead' : 'alive';
        H.sphere(A, kind === 'flicker' ? flicker : kind === 'dead' ? dead : opal, 0.17, 0, top - drop - 0.2, 0, { segments: 20 });
        H.torus(A, M.gold, 0.172, 0.008, 0, top - drop - 0.2, 0, { segments: 32 });
        list.push({ x, y: top - drop - 0.2, z, kind });
        i++;
      }
    }
    return { list, flicker, opal, dead };
  }

  /** Cuelga una lámpara real del techo con su vástago de latón (y la enciende: sus bombillas brillan). */
  function hangChandelier(ctx, name, { x, z, scale = 1, bottom = 3.2, ceiling = HALL.height, parent = ctx.root }) {
    const lamp = placeProp(ctx, name, { x, z, y: bottom, scale });
    if (!lamp) return null;
    lamp.removeFromParent();
    parent.add(lamp);
    const size = lamp.userData.size?.y ?? 1;
    const top = bottom + size * scale;
    const rod = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.012, 0.012, Math.max(0.05, ceiling - top), 8)), ctx.M.brass);
    rod.position.set(x, (top + ceiling) / 2, z);
    parent.add(rod);
    lamp.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      // bombillas/pantallas: luz propia cálida (la luz real la ponen las luces de la sala)
      o.material = [].concat(o.material).map((m) => {
        if (!/lamp|bulb|shade|glass/i.test(m.name)) return m;
        const c = m.clone();
        c.emissive = new THREE.Color(0xffd29a);
        c.emissiveIntensity = /glass/i.test(m.name) ? 0.25 : 0.9;
        c.emissiveMap = c.map;
        ctx.track(c);
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    return lamp;
  }

  function buildWing(ctx, sign) {
    const { H, M, kit, root, track } = ctx;
    const grp = new THREE.Group();
    grp.visible = false;
    root.add(grp);
    const w = NORTH_WING.maxX - NORTH_WING.minX;
    const d = NORTH_WING.maxZ - NORTH_WING.minZ;
    const cz = (NORTH_WING.minZ + NORTH_WING.maxZ) / 2;
    const b = new Batch();
    b.add(tiledPlane(w, d, 2.4), M.floor([1, 1]), { y: 0.001, z: cz, rx: -Math.PI / 2 });
    b.add(tiledPlane(w, d, 3), M.ceiling, { y: NORTH_WING.height, z: cz, rx: Math.PI / 2 });
    const wall = M.wall([1, 1]);
    b.add(tiledBox(0.4, NORTH_WING.height, d, 2.4), wall, { x: NORTH_WING.minX - 0.2, y: NORTH_WING.height / 2, z: cz });
    b.add(tiledBox(0.4, NORTH_WING.height, d, 2.4), wall, { x: NORTH_WING.maxX + 0.2, y: NORTH_WING.height / 2, z: cz });
    b.add(tiledBox(w + 0.8, NORTH_WING.height, 0.4, 2.4), wall, { x: 0, y: NORTH_WING.height / 2, z: NORTH_WING.minZ - 0.2 });
    // relleno entre el muro norte del salón y los muros del ala
    for (const s of [-1, 1]) b.add(tiledBox(Math.abs(NORTH_WING.maxX) - 2 + 0.2, NORTH_WING.height, 0.4, 2.4), wall, { x: s * ((NORTH_WING.maxX + 2) / 2), y: NORTH_WING.height / 2, z: HALL.minZ - 0.6 });
    const zSofa = NORTH_WING.minZ + 1.6;
    const real = (name, o) => {
      const g = placeProp(ctx, name, o);
      if (g) {
        g.removeFromParent();
        grp.add(g);
      }
      return g;
    };
    const sofaAt = (x, z, yaw) => real('sofa', { x, z, yaw }) || sofa(ctx, b.at({ x, z, yaw }));
    for (const x of [-4.15, -2.1, 2.1, 4.15]) sofaAt(x, zSofa, 0);
    sofaAt(-7.4, cz - 1.05, Math.PI / 2);
    sofaAt(-7.4, cz + 1.05, Math.PI / 2);
    sofaAt(7.4, cz - 1.05, -Math.PI / 2);
    sofaAt(7.4, cz + 1.05, -Math.PI / 2);
    if (!real('coffee_table', { x: 0, z: cz })) coffeeTable(ctx, b.at({ x: 0, z: cz }));
    for (const x of [-5.6, 5.6]) {
      if (real('console', { x, z: NORTH_WING.minZ + 0.32 })) real('brass_vase', { x, y: 0.95, z: NORTH_WING.minZ + 0.32, scale: 0.9 });
    }
    hangChandelier(ctx, 'chandelier_03', { x: 0, z: cz, scale: 1.6, bottom: 3.0, ceiling: NORTH_WING.height, parent: grp });
    for (const x of [-8.2, 8.2]) plant(ctx, b.at({ x, z: NORTH_WING.minZ + 0.7 }), { height: 1.4 });
    b.build(grp, { cast: ctx.g.shadows });
    // colisionadores del ala (no estorban mientras está cerrada: quedan fuera de los límites)
    ctx.addCollider(NORTH_WING.minX - 0.2, cz, 0.4, d);
    ctx.addCollider(NORTH_WING.maxX + 0.2, cz, 0.4, d);
    ctx.addCollider(0, NORTH_WING.minZ - 0.2, w + 0.8, 0.4);
    ctx.addCollider(-3.12, zSofa, 4.1, 1.0);
    ctx.addCollider(3.12, zSofa, 4.1, 1.0);
    ctx.addCollider(-7.4, cz, 1.0, 4.2);
    ctx.addCollider(7.4, cz, 1.0, 4.2);
    ctx.addCollider(0, cz, 1.3, 1.3);
    // dos plazas por sofá
    const seats = [];
    for (const x of [-4.15, -2.1, 2.1, 4.15]) for (const dx of [-0.49, 0.49]) seats.push([x + dx, zSofa + 0.07, 0]);
    for (const [sx, yaw] of [[-1, Math.PI / 2], [1, -Math.PI / 2]]) for (const z of [cz - 1.05, cz + 1.05]) for (const dz of [-0.49, 0.49]) seats.push([sx * 7.33, z + dz, yaw]);
    for (const [x, z, yaw] of seats) anchors.push({ type: 'sofa', x, z, yaw, sitY: 0.53, area: 'wing' });
    const art = painting(ctx, { x: 0, y: 2.6, z: NORTH_WING.minZ + 0.06, yaw: 0, seed: 'wing-a', w: 2.0, h: 2.6 });
    grp.add(art);
    const s = sign(() => t('sign.wing'), 3.8, 0.95, 0, 4.4, NORTH_WING.minZ + 0.08, 0, { color: '#ffe9a8', glow: '#d4af37', font: '700 92px Cinzel, serif', sub: () => t('sign.wingSub') }, grp);
    void s;
    void kit;
    void track;
    return { group: grp };
  }

  /**
   * Iluminación. La MISMA luz en todas las calidades: el casino tiene ~25 luces; las calidades bajas no se
   * las quitan (eso las oscurecía), sino que las AGRUPAN: cada grupo de luces cercanas se sustituye por una
   * sola luz en su centro con la potencia de todas. Menos luces = más rápido, pero la misma energía y casi la
   * misma distribución. Además, la sonda de entorno se captura con las mismas luces que se dibujan (sin
   * variantes de shader extra: menos compilación al cargar o cambiar de calidad).
   */
  function buildLights(ctx, { pendants, machine }) {
    const { g, root } = ctx;
    const budget = Math.max(4, g.dynamicLights);
    const all = [];

    const hemi = new THREE.HemisphereLight(0xffe2c4, 0x2a1810, 0.32);
    root.add(hemi);
    const ambient = new THREE.AmbientLight(0x3a2a22, 0.1);
    root.add(ambient);

    const spot = new THREE.SpotLight(0xfff0d8, 260, 16, 0.42, 0.6, 2);
    spot.position.set(CLASSIC.x, HALL.height - 0.25, CLASSIC.z + 2.6);
    spot.target.position.set(CLASSIC.x, 1.2, CLASSIC.z);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.castShadow = g.shadows;
    if (g.shadows) spot.shadow.mapSize.set(g.shadowMapSize, g.shadowMapSize);
    root.add(spot, spot.target);
    all.push({ light: spot, base: 260, kind: 'key' });

    const make = (color, intensity, dist, x, y, z, kind) => {
      const l = new THREE.PointLight(color, intensity, dist, 2);
      l.position.set(x, y, z);
      root.add(l);
      const e = { light: l, base: intensity, kind };
      all.push(e);
      return e;
    };
    // luces fijas (se encienden/apagan solas o laten): siempre propias
    const counter = make(0xffc890, 70, 11, COUNTER.x, 2.9, COUNTER.front + 0.6, 'counter');
    const wingLight = make(0xffc680, 0, 18, 0, 3.8, -17, 'wing');
    const chandLight = make(0xffe0b0, 0, 12, CLASSIC.x, 4.0, CLASSIC.z, 'chandelier');
    // luces de ambiente: se agrupan si no caben en el presupuesto de la calidad
    const specs = [
      [0xffd8b0, 70, 11, RECEPTION.x - 0.6, 3.0, RECEPTION.z - 1.6, 'area'],
      [0xffe6c8, 95, 14, 6.5, 3.8, -6.5, 'area'],
      [0xffe6c8, 95, 14, -6.5, 3.8, -3.5, 'area'],
      [0xffdcb8, 95, 15, 0, 3.8, 6.5, 'area'],
      [0xffe0c0, 60, 9, 12.2, 3.2, 0.9, 'area'],
      [0xffbf80, 60, 10, -11.6, 2.6, 8.2, 'lounge'],
      [0xffd6a8, 70, 12, 6.5, 3.8, 4.6, 'area'],
      [0xffd6a8, 70, 12, -6.5, 3.8, 4.6, 'area'],
      [0xffd0a0, 55, 12, -11, 3.8, -7, 'area'],
      [0xffd0a0, 55, 12, 11, 3.8, -2, 'area'],
    ];
    for (const p of pendants.list) {
      if (p.kind === 'dead') continue;
      specs.push([0xffd9a8, 22, 7, p.x, p.y - 0.2, p.z, p.kind === 'flicker' ? 'flicker' : 'pendant']);
    }
    const room = budget - 4; // foco, mostrador, ala y lámpara de araña
    if (specs.length <= room) for (const sp of specs) make(...sp);
    else for (const c of clusterLights(specs, room)) make(c.color, c.intensity, c.dist, c.x, c.y, c.z, 'cluster');
    void machine;
    // grupo vacío por compatibilidad (antes había luces «solo sonda»)
    const probeOnly = new THREE.Group();
    hemi.userData.base = 0.32;
    ambient.userData.base = ambient.intensity;
    return {
      all, spot, hemi, ambient, counter, wingLight, chandLight, probeOnly, missing: 0,
      dispose() {
        spot.shadow.map?.dispose();
      },
    };
  }

  /**
   * Agrupa luces puntuales en `k` luces (k-medias ponderado por potencia, determinista): cada grupo da una
   * luz en su centro de potencia, con la potencia total, el color medio y el alcance que cubre a todas.
   */
  function clusterLights(specs, k) {
    const pts = specs.map(([color, intensity, dist, x, y, z]) => ({ color: new THREE.Color(color), intensity, dist, x, y, z }));
    k = Math.max(1, Math.min(k, pts.length));
    // semillas: la más potente y luego la más lejana a las ya elegidas
    const centers = [{ ...pts.reduce((a, b) => (b.intensity > a.intensity ? b : a)) }];
    while (centers.length < k) {
      let best = null;
      let bestD = -1;
      for (const p of pts) {
        const d = Math.min(...centers.map((c) => (p.x - c.x) ** 2 + (p.z - c.z) ** 2));
        if (d * p.intensity > bestD) {
          bestD = d * p.intensity;
          best = p;
        }
      }
      centers.push({ ...best });
    }
    let groups = [];
    for (let it = 0; it < 8; it++) {
      groups = centers.map(() => []);
      for (const p of pts) {
        let bi = 0;
        let bd = Infinity;
        centers.forEach((c, i) => {
          const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        groups[bi].push(p);
      }
      groups.forEach((gr, i) => {
        if (!gr.length) return;
        const w = gr.reduce((a, p) => a + p.intensity, 0);
        centers[i].x = gr.reduce((a, p) => a + p.x * p.intensity, 0) / w;
        centers[i].z = gr.reduce((a, p) => a + p.z * p.intensity, 0) / w;
      });
    }
    return groups.filter((gr) => gr.length).map((gr) => {
      const w = gr.reduce((a, p) => a + p.intensity, 0);
      const x = gr.reduce((a, p) => a + p.x * p.intensity, 0) / w;
      const y = gr.reduce((a, p) => a + p.y * p.intensity, 0) / w;
      const z = gr.reduce((a, p) => a + p.z * p.intensity, 0) / w;
      const color = new THREE.Color(0, 0, 0);
      for (const p of gr) color.add(p.color.clone().multiplyScalar(p.intensity / w));
      const dist = Math.max(...gr.map((p) => p.dist + Math.hypot(p.x - x, p.z - z)));
      return { color, intensity: w, dist, x, y, z };
    });
  }

  // ======================================================================== sonda de entorno
  let probe = null;
  let probeSig = '';
  let probeDirty = 0;
  let pmrem = null;
  /** Captura en curso por caras (una cara por fotograma: sin tirón al limpiar o al dar la luz). */
  let capture = null;
  const probeSize = () => (state.g.textureSize >= 1024 ? 256 : 128);
  /**
   * La sonda (reflejos y luz indirecta del propio casino) es de MEDIA hacia arriba. En BAJA y MUY BAJA se usa
   * el entorno base: capturarla obliga a compilar todos los shaders una segunda vez (texturas lineales) y en un
   * PC modesto eso eran varios segundos más de carga.
   */
  const probeWanted = () => state.g.textureSize >= 512;

  function startCapture() {
    if (!B) return null;
    const size = probeSize();
    if (capture && capture.size !== size) {
      capture.rt.dispose();
      capture = null;
    }
    if (!capture) {
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
      rt.texture.generateMipmaps = false;
      const cam = new THREE.CubeCamera(0.1, 80, rt);
      cam.position.set(0, 2.3, 2.0);
      cam.updateMatrixWorld();
      capture = { rt, cam, size, face: 0 };
    }
    capture.face = 0;
    return capture;
  }

  /**
   * Dibuja la siguiente cara del cubo. Mismas variantes de shader que el juego (niebla y entorno siguen
   * puestos, solo sin densidad / con el entorno base): capturar no obliga a compilar nada nuevo.
   */
  function captureFace() {
    const c = capture;
    if (c.cam.coordinateSystem !== renderer.coordinateSystem) {
      c.cam.coordinateSystem = renderer.coordinateSystem;
      c.cam.updateCoordinateSystem();
    }
    const hidden = [];
    scene.traverse((o) => {
      if ((o.isPoints || o.userData.noProbe) && o.visible) {
        hidden.push(o);
        o.visible = false;
      }
    });
    const prevEnv = scene.environment;
    scene.environment = envTarget.texture;
    const prevDensity = scene.fog.density;
    scene.fog.density = 0;
    const prevRT = renderer.getRenderTarget();
    // la sombra se dibuja solo en la primera cara (no cambia entre caras)
    const prevNeeds = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = c.face === 0;
    renderer.setRenderTarget(c.rt, c.face);
    renderer.render(scene, c.cam.children[c.face]);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.needsUpdate = prevNeeds;
    scene.fog.density = prevDensity;
    scene.environment = prevEnv;
    for (const o of hidden) o.visible = true;
    c.face++;
    return c.face >= 6;
  }

  /** Convierte el cubo capturado (PMREM) en el entorno de la escena. */
  function finishCapture() {
    pmrem ??= new THREE.PMREMGenerator(renderer);
    const next = pmrem.fromCubemap(capture.rt.texture, probe ?? undefined);
    if (next !== probe) {
      probe?.dispose();
      probe = next;
    }
    scene.environment = probe.texture;
    capture.face = 0;
    calibrateExposure();
  }

  /**
   * Captura el casino en un cubemap desde el centro de la sala y lo convierte (PMREM) en el entorno de
   * la escena: reflejos coherentes y luz indirecta. Se repite al cambiar la iluminación o la limpieza.
   * Esta versión es de golpe (reconstrucción); en juego se hace por caras con `stepProbe`.
   */
  function captureProbe() {
    if (!probeWanted()) return;
    if (!startCapture()) return;
    while (!captureFace());
    finishCapture();
  }

  /** Avanza una cara de la captura pendiente (llamado desde update). */
  function stepProbe() {
    if (!B) return;
    if (!probeWanted()) {
      scene.environment = envTarget.texture;
      return true;
    }
    if (!capture || capture.face === 0) startCapture();
    if (captureFace()) {
      finishCapture();
      return true;
    }
    return false;
  }

  // ======================================================================== exposición
  /** Exposición fija: con la luz agrupada todas las calidades reciben la misma energía. */
  const BASE_EXPOSURE = 0.9;
  function calibrateExposure() {
    renderer.toneMappingExposure = BASE_EXPOSURE;
  }

  function buildDust(ctx) {
    const { g, root, kit, track } = ctx;
    const count = Math.round(260 * g.particleScale);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) seed.set([Math.random() * 26 - 13, 0.4 + Math.random() * 4.6, Math.random() * 20 - 10], i * 3);
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = track(new THREE.PointsMaterial({ size: 0.04, map: glowTexture(), color: 0xffe6b0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = g.effects && count > 0;
    root.add(points);
    void kit;
    return { points, pos, seed, count, mat };
  }

  // ======================================================================== estado → escena

  /** `f`: factor momentáneo (parpadeo al dar la luz); no cambia el estado guardado. */
  function applyLighting(f = 1) {
    if (!B) return;
    const level = state.loadout?.lighting ?? 0;
    const d = dirt.hall.value;
    const k = LIGHT_LEVELS[level] * (0.82 + 0.18 * (1 - d));
    state.lightK = k;
    for (const e of B.lights.all) {
      if (e.kind === 'wing' || e.kind === 'chandelier') continue;
      e.light.intensity = e.base * k * f;
    }
    if (B.lights.ambient.userData.base === undefined) B.lights.ambient.userData.base = B.lights.ambient.intensity;
    B.lights.ambient.intensity = B.lights.ambient.userData.base * (0.4 + 0.84 * k);
    B.lights.hemi.intensity = (B.lights.hemi.userData.base ??= B.lights.hemi.intensity) * (0.56 + 0.72 * k);
    // la luz indirecta (sonda) se vuelve a capturar cuando cambia algo que se note
    scene.environmentIntensity = 1;
    const sig = `${level}|${Math.round(d * 3)}|${state.expanded ? 1 : 0}|${state.loadout?.chandelier ? 1 : 0}|${state.story?.powered ? 1 : 0}`;
    if (sig !== probeSig) {
      probeSig = sig;
      probeDirty = 0.35;
    }
    // luminarias: con la instalación vieja apenas lucen; al repararla se encienden todas (las fundidas también)
    const glow = GLOW_LEVELS[level];
    // las máquinas de la sala se encienden cuando vuelve la luz
    setSlotsLit(B.ctx, level > 0 && f > 0.5);
    const em = (m, on = true) => {
      if (!m) return;
      m.userData.eBase ??= m.emissiveIntensity || 1.4;
      m.emissiveIntensity = on ? m.userData.eBase * glow * f : 0;
    };
    const P = B.ctx.M;
    em(P.cove);
    em(P.downlight);
    em(P.bulb);
    em(B.pendants.opal);
    if (!B.pendants.dead.userData.eBase) B.pendants.dead.userData.eBase = 1.25;
    if (!P.sconceDead.userData.eBase) P.sconceDead.userData.eBase = 1.6;
    em(B.pendants.dead, level > 0);
    em(P.sconceDead, level > 0);
    B.pendants.flicker.userData.eBase = 1.25 * glow;
    // luces que solo existen tras una compra: apagadas no cuestan nada (no entran en los shaders)
    if (B.lights.wingLight) {
      // siempre «visible» (a 0 cuando no está): encender/apagar una luz cambia los shaders de TODO el casino
      // y obligaba a recompilarlos en mitad de la partida (tirón al comprar)
      B.lights.wingLight.light.intensity = state.expanded ? 70 * k : 0;
    }
    if (B.lights.chandLight) {
      B.lights.chandLight.light.intensity = state.loadout?.chandelier ? 70 : 0;
    }
    scene.fog.density = 0.014 + d * 0.012;
  }

  /** Refleja en el escenario lo que el jugador ha comprado. `animate` hace las transiciones visibles. */
  function applyProgress(loadout, { animate = false } = {}) {
    state.loadout = loadout;
    const clean = Math.max(0, Math.min(1, loadout.clean ?? 0));
    state.dirtTarget = 1 - clean;
    if (!animate) dirt.hall.value = state.dirtTarget;
    applyToBuild({ animate });
  }

  function applyToBuild({ animate = false } = {}) {
    if (!B || !state.loadout) return;
    const L = state.loadout;
    B.carpet.mesh.visible = B.carpet.trim.visible = !!L.carpet;
    B.statue.group.visible = !!L.statue;
    B.statue.collider.enabled = !!L.statue;
    B.chandelier.group.visible = !!L.chandelier;
    for (const [id, set] of B.decorSets) {
      const on = (L.decorSets ?? []).includes(id);
      set.group.visible = on;
      for (const c of set.colliders) c.enabled = on;
    }
    B.machine.applyLoadout(L);
    const wantOpen = !!L.expanded;
    const d = B.doorObjects;
    if (wantOpen && !state.expanded) {
      state.expanded = true;
      B.wing.group.visible = true;
      d.wingCollider.enabled = false;
      d.wingInteract.enabled = false;
      Object.assign(bounds, playerBounds(true));
      if (animate) state.wingOpen = 0.0001;
      else {
        state.wingOpen = 1;
        d.wing.visible = false;
      }
    } else if (wantOpen) {
      // reconstrucción con el ala ya abierta
      B.wing.group.visible = true;
      d.wingCollider.enabled = false;
      d.wingInteract.enabled = false;
      d.wing.visible = state.wingOpen < 1;
    } else {
      state.expanded = false;
      state.wingOpen = 0;
      B.wing.group.visible = false;
      d.wingCollider.enabled = true;
      d.wingInteract.enabled = true;
      d.wing.visible = true;
      d.wing.position.y = 0;
      Object.assign(bounds, playerBounds(false));
    }
    applyStory();
    applyLighting();
    updateDirtVisuals(0, true);
  }

  /** Suciedad → opacidad de manchas, trastos retirados, neón y cuadros enderezados. */
  function updateDirtVisuals(dt, instant = false) {
    const d = dirt.hall.value;
    const decal = Math.max(0, Math.min(1, (d - 0.3) / 0.6));
    for (const m of B.ctx.decalMats) m.opacity = decal;
    for (const item of B.clutter) {
      const want = d > item.clearAt ? 1 : 0;
      item.scale = instant ? want : item.scale + (want - item.scale) * Math.min(1, dt * 4);
      const s = Math.max(0.0001, item.scale);
      item.group.scale.setScalar(s);
      item.group.visible = item.scale > 0.01;
      if (item.collider) item.collider.enabled = item.group.visible;
    }
    if (B.neonBroken.neon) B.neonBroken.neon.setDeadLevel(1 - Math.min(1, d * 1.6));
    else {
      B.neonBroken.mat.opacity = Math.min(1, d * 1.6);
      B.neonClean.mat.opacity = 1 - Math.min(1, d * 1.6);
    }
    for (const c of B.crooked) c.p.rotation.z = c.rest * Math.min(1, d * 1.5);
  }

  // ======================================================================== presentación de compras

  /**
   * Animación de aparición de lo comprado (la cámara la encuadra desde la app):
   * la alfombra se desenrolla, la estatua emerge, la lámpara desciende girando…
   */
  function updateReveal(dt) {
    const r = state.reveal;
    if (!r) return;
    r.t += dt;
    const k = Math.min(1, Math.max(0, r.t) / r.dur);
    if (r.kind.startsWith('set:')) {
      // conjunto: pieza a pieza, cada una crece con un pequeño rebote
      const set = B.decorSets.get(r.kind.slice(4));
      if (set) {
        const n = set.items.length;
        set.items.forEach((o, i) => {
          const local = Math.min(1, Math.max(0, (r.t - (i / Math.max(1, n)) * r.dur * 0.6) / (r.dur * 0.4)));
          const c1 = 1.70158;
          const sc = local <= 0 ? 0.0001 : 1 + (c1 + 1) * (local - 1) ** 3 + c1 * (local - 1) ** 2;
          o.userData.baseScale ??= o.scale.x;
          o.scale.setScalar(Math.max(0.0001, o.userData.baseScale * sc));
        });
      }
      if (k >= 1) state.reveal = null;
      return;
    }
    const ease = 1 - (1 - k) ** 3;
    const overshoot = (x) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
    };
    switch (r.kind) {
      case 'carpet': {
        const c = B.carpet;
        const sz = Math.max(0.001, ease);
        // se desenrolla desde el estrado hacia la entrada: la parte extendida crece y el rollo avanza y adelgaza
        const s = DECOR_SLOTS.carpet;
        c.mesh.scale.z = sz;
        c.mesh.position.z = s.z - (s.d / 2) * (1 - sz);
        const r = 0.03 + 0.17 * (1 - sz);
        c.roll.visible = sz < 0.999;
        c.roll.scale.set(r, 1, r);
        c.roll.position.set(s.x, r + 0.006, s.z - s.d / 2 + s.d * sz);
        c.roll.rotation.x = -sz * s.d / 0.25;
        c.trim.visible = sz >= 0.999;
        break;
      }
      case 'statue': {
        const g = B.statue.group;
        g.position.y = -3.2 * (1 - ease);
        g.rotation.y = (1 - ease) * Math.PI * 1.5;
        break;
      }
      case 'chandelier': {
        const g = B.chandelier.group;
        g.position.y = DECOR_SLOTS.chandelier.y + 2.5 * (1 - ease);
        g.scale.setScalar(Math.max(0.01, overshoot(Math.min(1, k * 1.15))));
        break;
      }
      case 'machine': {
        const m = B.machine.group;
        m.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.06);
        break;
      }
      default:
    }
    if (k >= 1) {
      if (r.kind === 'machine') B.machine.group.scale.setScalar(1);
      state.reveal = null;
    }
  }

  // ======================================================================== historia

  const storyInteracts = new Map(); // id → interactuable (persisten entre reconstrucciones)
  for (const [id, spot] of Object.entries(STORY_SPOTS)) {
    storyInteracts.set(id, { id: `story:${id}`, target: id, pos: new THREE.Vector3(spot.x, spot.y, spot.z), radius: spot.r, prompt: { key: 'E', textKey: spot.prompt }, enabled: false });
  }

  function applyStory() {
    if (!B) return;
    const st = state.story;
    const S = B.story;
    S.setItem('toolbox', st.items.toolbox !== false);
    S.setItem('doc_box', st.items.doc_box !== false);
    // desperfectos: se ven hasta que Daniel repara (la app puede retenerlos durante su secuencia)
    B.damage.setRepaired(st.repaired && !state.damageHold);
    S.breakerLight.material.color.set(st.breaker ? 0x40ff70 : 0xff3040);
    S.openSign.mesh.visible = st.entranceOpen;
    for (const s of B.signs) if (s.closedSign) s.mesh.visible = !st.entranceOpen;
    S.street.material.opacity = st.entranceOpen ? 0.22 : 0;
    S.kitBoxes.visible = !st.receptionStyle && st.items.reception_kit !== false && st.receptionKit;
    if (S.kitCollider) S.kitCollider.enabled = S.kitBoxes.visible;
    for (const [name, g] of Object.entries(S.styles)) g.visible = st.receptionStyle === name;
    // interactuables: los de historia se añaden a la lista estable solo mientras hagan falta
    for (const [id, it] of storyInteracts) {
      const on = st.interacts.has(id);
      it.enabled = on;
      const i = interactables.indexOf(it);
      if (on && i < 0) interactables.push(it);
      if (!on && i >= 0) interactables.splice(i, 1);
    }
    // un objeto de historia puede sustituir temporalmente a uno normal en el mismo sitio
    const replaced = new Set([...st.interacts].map((id) => STORY_SPOTS[id]?.replaces).filter(Boolean));
    for (const it of interactables) if (it.id === 'counter' || it.id === 'machine' || it.id?.startsWith('table:')) it.enabled = !replaced.has(it.id);
    const machineItem = interactables.find((x) => x.id === 'machine');
    if (machineItem) {
      machineItem.prompt = st.machineBlocked ? { key: 'E', textKey: 'prompt.outOfOrder' } : { key: 'E', textKey: 'prompt.machine', params: { machine: 'THE CLASSIC' } };
    }
    B.machine.setSkin?.(st.machineSkin ?? 'classic');
    if (!st.powered && B.machine.powered) B.machine.setPowered(false);
    if (st.powered && !B.machine.powered && !B.machine.booting) B.machine.setPowered(true);
    // rodillos desajustados mientras esté averiada (la reparación los recoloca con animación)
    if (!st.powered) B.machine.setReelsBroken?.(true);
    B.machine.setServiceDoor?.(!!st.serviceDoor, { instant: !!st.instantDoor });
    B.machine.setResetHint?.(st.interacts?.has('classic_mechanism'));
    st.instantDoor = false;
  }

  // ======================================================================== ciclo de vida

  function rebuild() {
    const wasLoadout = state.loadout;
    if (B) B.dispose();
    clearBakedMaterials();
    B = build(state.g);
    state.signature = buildSignature(state.g);
    if (wasLoadout) applyToBuild();
    applyShadows(state.g);
    // la sonda (y la exposición) se vuelven a capturar con el casino nuevo: si no, el entorno quedaba
    // apuntando a una textura liberada y el casino se veía más oscuro tras cambiar la calidad
    probe?.dispose();
    probe = null;
    applyLighting();
    // la sonda se recaptura por caras (o en el calentamiento si la app lo pide): sin congelar
    scene.environment = envTarget.texture;
    probeDirty = -1;
    world.onRebuild?.();
  }

  function applyShadows(g) {
    const spot = B.lights.spot;
    spot.castShadow = g.shadows;
    if (g.shadows && spot.shadow.mapSize.x !== g.shadowMapSize) {
      spot.shadow.mapSize.set(g.shadowMapSize, g.shadowMapSize);
      spot.shadow.map?.dispose();
      spot.shadow.map = null;
    }
    B.root.traverse((o) => {
      if (o.isMesh) o.castShadow = g.shadows && !o.material?.transparent;
    });
  }

  function applyEnvironment(g) {
    void g;
    scene.environment = probe?.texture ?? envTarget.texture;
    applyLighting();
    if (!probe) probeDirty = -1; // se captura por caras en los próximos fotogramas (sin congelar)
  }

  const world = {
    scene,
    camera,
    colliders,
    interactables,
    anchors,
    bounds,
    spawn: SPAWN,
    focus: new THREE.Vector3(CLASSIC.x, 1.5, CLASSIC.z),
    /** Altura del suelo (estrado de THE CLASSIC) para colocar a los personajes. */
    floorHeight(x, z) {
      const r = Math.hypot(x - CLASSIC.x, z - CLASSIC.z);
      return r < CLASSIC.dais ? 0.14 : r < CLASSIC.dais + 0.45 ? 0.06 : 0;
    },
    /** Suciedad actual (0 limpio … 1 abandonado). */
    get dirt() {
      return dirt.hall.value;
    },
    get machine() {
      return B.machine;
    },
    /** La app enlaza aquí sus callbacks de la máquina; sobreviven a las reconstrucciones. */
    bindMachine({ onReelStop, onTick, onDone }) {
      Object.assign(handlers, { onReelStop, onTick, onDone });
    },
    onRebuild: null,
    applyProgress,

    /** Empieza la animación de aparición de una compra ('carpet' | 'statue' | 'chandelier' | 'machine'). */
    reveal(kind, delay = 0) {
      const dur = kind.startsWith('set:') ? 1.8 : { carpet: 1.6, statue: 1.8, chandelier: 2.0, machine: 0.9 }[kind];
      if (!dur) return;
      state.reveal = { kind, t: -delay, dur };
      updateReveal(0);
    },
    /** Estado de los objetos de la historia (sobrevive a las reconstrucciones). */
    setStory(patch) {
      const st = state.story;
      if (patch.items) Object.assign(st.items, patch.items);
      for (const k of ['entranceOpen', 'receptionStyle', 'breaker', 'powered', 'machineBlocked', 'receptionKit', 'machineSkin', 'repaired', 'serviceDoor', 'instantDoor']) if (k in patch) st[k] = patch[k];
      if (patch.interacts) st.interacts = new Set(patch.interacts);
      applyStory();
    },
    /** Parpadeo de encendido de la instalación (se llama justo después de subir el nivel de luz). */
    lightsFlicker() {
      state.flickerT = 0.8;
      state.flickerF = -1;
    },
    /** Retiene (true) los desperfectos a la vista aunque ya estén reparados: la app los suelta bajo la pantalla negra. */
    holdDamage(on) {
      state.damageHold = !!on;
      applyStory();
    },
    /** Arranque animado de THE CLASSIC (reparación). */
    bootMachine() {
      state.story.powered = true;
      B.machine.setPowered(true, { boot: true });
      B.machine.setReelsBroken?.(false, { animate: true });
    },
    /** THE CLASSIC: tapa de servicio y seta de reinicio (misión de la reparación). */
    openServiceDoor(open = true) {
      state.story.serviceDoor = open;
      B.machine.setServiceDoor?.(open);
    },
    pressResetButton() {
      B.machine.pressReset?.();
    },
    /** Cuadro eléctrico: se abre la puerta, «clac» del general por dentro y se cierra (secuencia de la luz). */
    operateBreaker(duration = 2.6) {
      state.panelT = 0;
      state.panelDur = duration;
    },
    /** Limpieza animada hasta `clean` (0–1) aunque no venga de una compra (misiones). */
    animateClean(clean) {
      state.dirtTarget = 1 - Math.max(0, Math.min(1, clean));
    },

    /** Marca la tienda como «tienes algo que comprar»: flecha saltarina y brillo intenso. */
    setShopAlert(on) {
      state.shopAlert = on;
      if (B) B.shop.arrow.visible = on;
    },

    update(dt, time, { paused = false } = {}) {
      // la sonda no se captura en mitad de un parpadeo de encendido (se quedaría con la luz a medias)
      if (probeDirty > 0 && !(state.flickerT > 0) && (probeDirty -= dt) <= 0) probeDirty = -1; // pendiente: por caras
      if (probeDirty < 0 && stepProbe()) probeDirty = 0;
      if (!paused) for (const w of B.wheels) w.update(dt);
      if (state.pendingRebuild && !B.machine.busy) {
        state.pendingRebuild = false;
        rebuild();
      }
      B.machine.update(paused ? 0 : dt, time);
      const d0 = dirt.hall.value;
      if (Math.abs(d0 - state.dirtTarget) > 1e-4) {
        // limpieza animada (~3 s de punta a punta)
        const step = dt / 3;
        dirt.hall.value = d0 > state.dirtTarget ? Math.max(state.dirtTarget, d0 - step) : Math.min(state.dirtTarget, d0 + step);
        applyLighting();
      }
      const d = dirt.hall.value;
      updateDirtVisuals(dt);

      for (const s of B.signs) {
        const dip = Math.sin(time * 11 + s.phase * 5) > 0.992 ? 0.45 : 1;
        const stutter = s.broken && Math.sin(time * 23 + Math.sin(time * 3.1) * 4) > 0.6 ? 0.55 : 1;
        const hum = (0.92 + 0.08 * Math.sin(time * 2.3 + s.phase)) * dip;
        if (s.neon) {
          s.neon.setLevel(hum, s.broken ? (Math.sin(time * 31 + Math.sin(time * 2.3) * 6) > 0.35 ? 0.15 : 1) : 1);
          continue;
        }
        const base = s === B.neonBroken ? B.neonBroken.mat.opacity : s === B.neonClean ? B.neonClean.mat.opacity : 1;
        s.mat.opacity = base * hum * stutter;
      }

      // tienda
      const sh = B.shop;
      sh.gem.rotation.y = time * 1.4;
      sh.gem.position.y = 2.7 + Math.sin(time * 1.8) * 0.08;
      const pulse = state.shopAlert ? 0.5 + 0.5 * Math.sin(time * 6) : 0.5 + 0.5 * Math.sin(time * 1.6);
      sh.halo.material.opacity = 0.35 + pulse * (state.shopAlert ? 0.6 : 0.25);
      sh.ring.material.opacity = 0.35 + pulse * (state.shopAlert ? 0.6 : 0.3);
      sh.ring.scale.setScalar(1 + pulse * 0.06);
      sh.arrow.position.y = 2.2 + Math.abs(Math.sin(time * 4)) * 0.25;
      sh.arrow.rotation.y = time * 2;
      if (B.lights.counter) B.lights.counter.light.intensity = B.lights.counter.base * (state.lightK ?? 1) * (state.flickerT > 0 ? Math.max(0, state.flickerF) : 1) * (0.85 + pulse * (state.shopAlert ? 0.5 : 0.15));

      // luces que fallan: el foco titila un poco y una lámpara parpadea mientras hay suciedad
      const lvl = state.loadout?.lighting ?? 0;
      const failing = d > 0.4 && lvl === 0;
      const flick = failing && Math.sin(time * 17) * Math.sin(time * 5.3) > 0.82 ? 0.25 : 1;
      B.pendants.flicker.emissiveIntensity = (B.pendants.flicker.userData.eBase ?? 1.25) * flick;
      const kNow = LIGHT_LEVELS[lvl] * (0.82 + 0.18 * (1 - d));
      for (const e of B.lights.all) if (e.kind === 'flicker') e.light.intensity = e.base * kNow * flick;
      const keyFlick = d > 0.6 && Math.sin(time * 31) > 0.985 ? 0.6 : 1;
      B.lights.spot.intensity = B.lights.spot.userData.k = 420 * LIGHT_LEVELS[state.loadout?.lighting ?? 0] * (0.82 + 0.18 * (1 - d)) * keyFlick;
      // encendido general: los contactores entran a trompicones (dos parpadeos) y se queda fijo
      if (state.flickerT > 0) {
        state.flickerT = Math.max(0, state.flickerT - dt);
        const tt = 0.8 - state.flickerT;
        const f = state.flickerT === 0 ? 1 : tt < 0.08 ? 1 : tt < 0.2 ? 0.22 : tt < 0.28 ? 0.9 : tt < 0.44 ? 0.35 : 1;
        if (f !== state.flickerF) {
          state.flickerF = f;
          applyLighting(f);
        }
        B.lights.spot.intensity *= f;
      }

      // compras
      if (B.chandelier.group.visible && B.chandelier.crystals) B.chandelier.group.rotation.y += dt * 0.12; // la procedural gira; la real cuelga quieta
      B.statue.orb.userData.y0 ??= B.statue.orb.position.y;
      B.statue.orb.position.y = B.statue.orb.userData.y0 + Math.sin(time * 1.4) * (B.statue.orb.userData.y0 < 2.5 ? 0.025 : 0.07);
      if (state.wingOpen > 0 && state.wingOpen < 1) {
        state.wingOpen = Math.min(1, state.wingOpen + dt / 1.6);
        B.doorObjects.wing.position.y = (1 - (1 - state.wingOpen) ** 3) * (DOOR_H + 0.1);
        if (state.wingOpen >= 1) B.doorObjects.wing.visible = false;
      }
      for (const u of B.ctx.dynamic) u.update(dt, time, d);
      B.damage.update(dt, time);
      if (!paused) B.damage.reflect(camera);
      // puerta del cuadro eléctrico: abre (0,6 s), espera y cierra
      if (state.panelT !== undefined && state.panelT !== null) {
        state.panelT += dt;
        const T = state.panelT;
        const D = state.panelDur ?? 2.6;
        const ease = (x) => x * x * (3 - 2 * x);
        const k = T < 0.6 ? ease(T / 0.6) : T < D - 0.6 ? 1 : ease(Math.max(0, (D - T) / 0.6));
        B.story.setPanel?.(k);
        if (T >= D) {
          B.story.setPanel?.(0);
          state.panelT = null;
        }
      }
      updateReveal(dt);

      // polvo (más visible cuanto más sucio)
      const dust = B.dust;
      if (dust.points.visible) {
        dust.mat.opacity = 0.2 + 0.35 * d;
        for (let i = 0; i < dust.count; i++) {
          const j = i * 3;
          dust.pos[j] = dust.seed[j] + Math.sin(time * 0.15 + i) * 0.5;
          dust.pos[j + 1] = 0.4 + ((dust.seed[j + 1] + time * 0.05 * (1 + (i % 5) * 0.2)) % 4.8);
          dust.pos[j + 2] = dust.seed[j + 2] + Math.cos(time * 0.12 + i * 1.3) * 0.5;
        }
        dust.points.geometry.attributes.position.needsUpdate = true;
      }
    },

    onResize({ aspect }) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },

    /** ¿Este cambio de ajustes obliga a reconstruir el casino? (la app muestra «aplicando calidad…») */
    needsRebuild(g) {
      return buildSignature(g) !== state.signature;
    },

    /** Compila en paralelo (sin congelar) los shaders de todo lo que hay en escena. */
    async precompile() {
      // con tope de tiempo: si el navegador no informa de que los shaders están listos, se sigue igual
      const limit = new Promise((resolve) => setTimeout(resolve, 6000));
      try {
        const job = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera));
        await Promise.race([job.catch((err) => console.warn('[world] precompilación de shaders:', err)), limit]);
      } catch (err) {
        console.warn('[world] precompilación de shaders:', err);
      }
    },

    onGraphicsChanged(g) {
      state.g = g;
      if (buildSignature(g) !== state.signature) {
        // cambia la geometría/materiales: reconstruir (si la máquina gira, al terminar)
        if (B.machine.busy) state.pendingRebuild = true;
        else rebuild();
        return;
      }
      applyEnvironment(g);
      B.dust.points.visible = g.effects && B.dust.count > 0;
      B.pool.visible = g.effects;
      B.machine.setEffects(g.effects);
      applyShadows(g);
    },

    /** Cambio de idioma: repinta los carteles y el texto de la máquina. */
    refreshTexts() {
      for (const s of B.signs) {
        if (!s.dynamic) continue;
        if (s.neon) {
          const txt = typeof s.text === 'function' ? s.text() : s.text;
          const sub = typeof s.opts.sub === 'function' ? s.opts.sub() : s.opts.sub ?? null;
          if (neonCanDraw(txt) && (!sub || neonCanDraw(String(sub).toUpperCase()))) s.neon.setText(txt, sub);
          continue;
        }
        s.mat.map?.dispose();
        s.mat.map = B.signTex(s.text, s.opts);
        s.mat.needsUpdate = true;
      }
      for (const d of interactables) {
        if (d.zone) d.prompt = { ...d.prompt, params: { zone: t(`zone.${d.zone}`) } };
      }
      B.machine.refreshTexts?.();
    },

    dispose() {
      B?.dispose();
      envTarget.dispose();
      waterRefl?.dispose();
    },
  };

  /** Construcción por pasos (pantalla de carga). */
  world.load = async (onProgress) => {
    B = await buildAsync(graphics, onProgress);
    applyShadows(graphics);
    scene.environment = envTarget.texture;
    applyLighting();
  };
  /** Construcción de golpe (pruebas y herramientas). */
  world.loadSync = () => {
    B = build(graphics);
    applyEnvironment(graphics);
    applyShadows(graphics);
  };

  /**
   * Calentamiento antes de enseñar nada: compila los shaders (en paralelo si la GPU lo permite, si no por
   * trozos), sube las texturas a la GPU por tandas y captura la sonda de entorno cara a cara. Todo cediendo
   * el hilo: la barra avanza y el primer fotograma del menú ya no se congela.
   */
  world.warmup = async (onProgress = () => {}) => {
    const t0 = performance.now();
    let tick = performance.now();
    const maybeBreathe = async () => {
      if (performance.now() - tick > 24) {
        await breathe();
        tick = performance.now();
      }
    };
    // 1) shaders de TODO (también lo oculto: ala, compras, personajes que aún no han llegado). Dos variantes:
    //    la de pantalla y la de la sonda de entorno (se dibuja a una textura lineal). El enlazado se fuerza
    //    programa a programa cediendo el hilo entre medias: nada de un único bloqueo de varios segundos.
    try {
      pmrem ??= new THREE.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
      const extra = world.warmExtras?.() ?? [];
      const parallel = renderer.extensions.has('KHR_parallel_shader_compile') && !!renderer.compileAsync;
      const useProbe = probeWanted();
      const cube = useProbe ? startCapture().rt : null;
      const linked = new Set(renderer.info.programs ?? []);
      const passes = [null, ...(cube ? [cube] : [])];
      for (let pi = 0; pi < passes.length; pi++) {
        const rt = passes[pi];
        const jobs = [];
        for (const obj of [scene, ...extra]) {
          renderer.setRenderTarget(rt, 0);
          if (parallel) jobs.push(renderer.compileAsync(obj, camera, scene));
          else renderer.compile(obj, camera, scene);
          renderer.setRenderTarget(null);
        }
        if (parallel) {
          await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 15000))]);
        } else {
          const fresh = (renderer.info.programs ?? []).filter((p) => !linked.has(p));
          for (let i = 0; i < fresh.length; i++) {
            linked.add(fresh[i]);
            fresh[i].getUniforms();
            onProgress(0.5 * ((pi + i / fresh.length) / passes.length));
            await maybeBreathe();
          }
        }
      }
    } catch (err) {
      console.warn('[world] precompilación de shaders:', err);
    }
    console.info(`[world] shaders ${Math.round(performance.now() - t0)} ms · ${renderer.info.programs?.length} programas`);
    globalThis.__warmProgs = new Set(renderer.info.programs);
    onProgress(0.5);
    // 2) texturas a la GPU por tandas (antes se subían todas en el primer fotograma del menú)
    const textures = new Set();
    scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) {
        for (const v of Object.values(m)) if (v?.isTexture && !v.isRenderTargetTexture) textures.add(v);
        for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures.add(u.value);
      }
    });
    let k = 0;
    for (const tex of textures) {
      try {
        renderer.initTexture(tex);
      } catch {
        /* textura aún sin imagen: se sube al usarla */
      }
      onProgress(0.5 + 0.3 * (++k / textures.size));
      await maybeBreathe();
    }
    console.info(`[world] texturas ${Math.round(performance.now() - t0)} ms`);
    // 3) sonda de entorno, una cara cada vez
    if (probeWanted()) {
      startCapture();
      while (!captureFace()) {
        onProgress(0.8 + 0.18 * (capture.face / 6));
        await breathe();
      }
      finishCapture();
    } else scene.environment = envTarget.texture;
    probeDirty = 0;
    onProgress(1);
    console.info(`[world] calentamiento ${Math.round(performance.now() - t0)} ms · ${textures.size} texturas`);
  };
  /** Compila en segundo plano (por trozos) los shaders de objetos que aún no están en escena (clientes). */
  world.warmObjects = async (objects) => {
    try {
      const linked = new Set(renderer.info.programs ?? []);
      for (const obj of objects) {
        renderer.compile(obj, camera, scene);
        for (const prog of (renderer.info.programs ?? []).filter((x) => !linked.has(x))) {
          linked.add(prog);
          prog.getUniforms();
          await breathe();
        }
        await breathe();
      }
    } catch (err) {
      console.warn('[world] compilación en segundo plano:', err);
    }
  };
  return world;
}
