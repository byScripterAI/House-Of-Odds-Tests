import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { HALL, NORTH_WING, SPAWN } from '../world/layout.js';
import { HumanoidAnimator } from './animator.js';
import { createHumanoid } from './humanoid.js';
import { charactersReady, customersReady, instantiateCharacter } from './character-assets.js';
import { ClipAnimator } from './clip-animator.js';
import { NavGrid } from './navgrid.js';
import { NAMED, generateExtra } from './npc-data.js';

/**
 * SISTEMA DE PNJ.
 *
 *  - Personal: crupieres en las mesas abiertas, cajero en el mostrador.
 *  - Personajes con nombre en su puesto (Victoria, Daniel, Isabella…).
 *  - Clientes habituales sentados desde el principio (pocos: el local está casi vacío).
 *  - Clientes que entran, buscan sitio libre (butacas, mesas, bancos), se quedan
 *    un rato y se van, con rutas A* sobre la rejilla de navegación.
 *
 * El nivel de afluencia (`setCrowd`) lo marca la historia (reapertura…).
 * El tope de PNJ simultáneos depende del nivel gráfico (`crowdMax`).
 */

const DETAIL_BY_TIER = [0.35, 0.6, 1, 1.4, 2];
const TEX_BY_TIER = [128, 128, 256, 256, 512];
const CROWD_TARGET = [0, 8, 16, 28];
const ENTRANCE = { x: SPAWN.x, z: HALL.maxZ - 0.7 };
const WALK_SPEED = 1.15;
const TURN_RATE = 5;

const angleDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const forward = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const anchorKey = (a) => `${a.type}|${a.id ?? ''}|${a.seat ?? ''}|${a.x.toFixed(2)}|${a.z.toFixed(2)}`;

export class NpcSystem {
  /**
   * @param {{world: object, graphics: object, seed?: string}} opts
   */
  constructor({ world, graphics, seed = 'npcs' }) {
    this.world = world;
    this.g = graphics;
    this.rng = new Rng(seed);
    this.npcs = [];
    this.crowd = 0;
    this.namedState = {}; // id → { visible, post }
    for (const [id, def] of Object.entries(NAMED)) this.namedState[id] = { visible: !!def.post, post: def.post ? { ...def.post } : null };
    this.occupied = new Set();
    this.reserved = new Set(); // mesas en las que juega el jugador (sin otros clientes)
    this.spawnTimer = 2;
    this.group = new THREE.Group();
    this.group.name = 'npcs';
    world.scene.add(this.group);
    this.talkingWith = null;
    this.#makeMaterial();
    this.#buildNav();
    this.#populate();
  }

  // ------------------------------------------------------------------ configuración

  #tier() {
    return Math.max(0, Math.min(4, this.g.npcDetail ?? 2));
  }

  #makeMaterial() {
    this.material?.dispose();
    this.material = this.g.material === 'lambert'
      ? new THREE.MeshLambertMaterial({ vertexColors: true })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  }

  #buildNav() {
    this.nav = new NavGrid({ minX: HALL.minX, maxX: HALL.maxX, minZ: NORTH_WING.minZ, maxZ: HALL.maxZ }, 0.4);
    this.nav.block(this.world.colliders.filter((c) => !c.npc));
  }

  /** Recalcula la navegación (p. ej. al abrir el ala norte). */
  refreshNav() {
    this.#buildNav();
  }

  /** Cambia la calidad: si cambia el detalle de los modelos, se regeneran todos. */
  configure(graphics) {
    const before = `${this.#tier()}|${this.g.material}|${this.g.crowdMax}`;
    this.g = graphics;
    const after = `${this.#tier()}|${this.g.material}|${this.g.crowdMax}`;
    if (before !== after) this.reset();
  }

  /** Regenera la población (tras reconstruir el mundo o cambiar la calidad). */
  reset() {
    for (const n of [...this.npcs]) this.#remove(n);
    this.occupied.clear();
    this.#makeMaterial();
    this.#buildNav();
    this.#populate();
  }

  /** Afluencia de clientes: 0 (cerrado, solo habituales) … 3 (lleno). */
  setCrowd(level) {
    const prev = this.crowd;
    this.crowd = Math.max(0, Math.min(3, level | 0));
    if (prev !== this.crowd) this.#syncStaff();
    if (prev < 1 && this.crowd >= 1) this.#spawnRegulars();
    if (this.crowd < 1) for (const n of [...this.npcs]) if (n.kind === 'regular' || n.kind === 'customer') this.#remove(n);
  }

  /** Los clientes terminaron de cargar en segundo plano: ya pueden sentarse los habituales. */
  onCustomersLoaded() {
    this.#spawnRegulars();
  }

  /** Muestra/oculta un personaje con nombre o lo cambia de puesto. */
  setNamed(id, { visible, post } = {}) {
    const st = this.namedState[id];
    if (!st) return;
    if (post !== undefined) st.post = post ? { ...post } : null;
    if (visible !== undefined) st.visible = visible;
    const npc = this.get(id);
    if (npc && (!st.visible || !st.post)) this.#remove(npc);
    else if (!npc && st.visible && st.post) this.#spawnNamed(id);
    else if (npc && post) {
      npc.post = { ...post };
      this.#goTo(npc, { x: post.x, z: post.z, yaw: post.yaw, onArrive: () => this.#atPost(npc) });
    }
  }

  get(id) {
    return this.npcs.find((n) => n.id === id) ?? null;
  }

  // ------------------------------------------------------------------ población

  #populate() {
    this.#syncStaff();
    for (const id of Object.keys(NAMED)) if (this.namedState[id].visible && this.namedState[id].post) this.#spawnNamed(id);
    this.#spawnRegulars();
  }

  /** Clientes habituales: solo con el casino abierto al público (antes no hay nadie jugando). */
  #spawnRegulars() {
    if (this.crowd < 1 || !customersReady()) return;
    const anchors = this.world.anchors;
    const regulars = [
      anchors.filter((a) => a.type === 'armchair')[0],
      anchors.filter((a) => a.type === 'armchair')[2],
      anchors.find((a) => a.type === 'table-seat' && a.id === 'royal_blackjack' && a.seat === 1),
      anchors.find((a) => a.type === 'table-seat' && a.id === 'royal_roulette' && a.seat === 0),
    ].filter((a) => a && !(a.type === 'table-seat' && this.reserved.has(a.id)));
    const limit = Math.max(0, Math.min(regulars.length, (this.g.crowdMax ?? 24) - this.npcs.length));
    regulars.slice(0, limit).forEach((a, i) => {
      if (this.get(`regular-${i}`) || this.occupied.has(anchorKey(a))) return;
      const n = this.#create(`regular-${i}`, generateExtra(new Rng(`regular-${i}`), 'customer'), { kind: 'regular' });
      this.#seat(n, a, true);
    });
  }

  #syncStaff() {
    const anchors = this.world.anchors;
    // antes de la reapertura las mesas están cerradas: sin crupieres ni jugadores
    const openTables = [];
    if (this.crowd >= 1) openTables.push('royal_blackjack', 'royal_roulette', 'double_down', 'neon_roulette');
    if (this.crowd >= 2) openTables.push('last_hand');
    for (const a of anchors.filter((x) => x.type === 'dealer')) {
      const id = `dealer-${a.id}`;
      const want = openTables.includes(a.id);
      const have = this.get(id);
      if (want && !have) {
        const n = this.#create(id, generateExtra(new Rng(id), 'dealer'), { kind: 'staff' });
        this.#place(n, a.x, a.z, a.yaw);
        n.anim.set('dealer');
        n.state = 'post';
        n.post = { x: a.x, z: a.z, yaw: a.yaw, activity: 'dealer' };
        this.#addCollider(n);
      } else if (!want && have) this.#remove(have);
    }
    if (!this.get('cashier')) {
      const a = anchors.find((x) => x.type === 'counter-clerk');
      if (a) {
        const n = this.#create('cashier', generateExtra(new Rng('cashier-7'), 'cashier'), { kind: 'staff' });
        this.#place(n, a.x, a.z, a.yaw);
        n.anim.set('clerk');
        n.state = 'post';
        n.post = { x: a.x, z: a.z, yaw: a.yaw, activity: 'clerk' };
      }
    }
  }

  #spawnNamed(id) {
    const def = NAMED[id];
    const st = this.namedState[id];
    if (!def || !st.post || this.get(id)) return;
    const n = this.#create(id, def.appearance, { kind: 'named', posture: def.appearance.age > 60 ? 0.35 : 0 });
    n.named = def;
    n.post = { ...st.post };
    this.#place(n, n.post.x, n.post.z, n.post.yaw);
    this.#atPost(n);
    this.#addCollider(n);
    n.interact = {
      id: `npc:${id}`,
      npc: id,
      pos: new THREE.Vector3(n.pos.x, 1.2, n.pos.z),
      radius: 2.4,
      prompt: { key: 'E', textKey: 'prompt.talk', params: { name: def.name } },
    };
    this.world.interactables.push(n.interact);
  }

  #atPost(n) {
    const p = n.post;
    if (!p) return;
    n.state = 'post';
    n.targetYaw = p.yaw;
    n.anim.set(p.activity ?? 'idle', p.params ?? {});
  }

  #create(id, appearance, { kind, posture = 0 } = {}) {
    const tier = this.#tier();
    let rig = null;
    let anim = null;
    // personajes reales (Rocketbox + captura de movimiento); si no se pudieron cargar, el modelo procedural
    if (charactersReady() && appearance.model) {
      rig = instantiateCharacter(appearance.model, { shadows: !!this.g.shadows && tier >= 2 });
      if (rig) anim = new ClipAnimator(rig, { seed: this.rng.next() * 100 });
    }
    if (!rig) {
      rig = createHumanoid(appearance, { detail: DETAIL_BY_TIER[tier], material: this.material, textureSize: TEX_BY_TIER[tier], lowDetail: tier === 0 || !this.g.shadows });
      anim = new HumanoidAnimator(rig, { seed: this.rng.next() * 100, posture });
    }
    this.group.add(rig.group);
    const n = { id, kind, rig, anim, pos: { x: 0, z: 0 }, yaw: 0, targetYaw: 0, state: 'idle', path: null, timer: 0, anchor: null, collider: null, interact: null, stuck: 0 };
    this.npcs.push(n);
    return n;
  }

  #place(n, x, z, yaw) {
    n.pos.x = x;
    n.pos.z = z;
    n.yaw = n.targetYaw = yaw;
    n.rig.group.position.set(x, 0, z);
    n.rig.group.rotation.y = yaw;
  }

  #addCollider(n) {
    n.collider = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, enabled: true, npc: true };
    this.world.colliders.push(n.collider);
    this.#syncCollider(n);
  }

  #syncCollider(n) {
    if (!n.collider) return;
    const r = 0.24;
    n.collider.minX = n.pos.x - r;
    n.collider.maxX = n.pos.x + r;
    n.collider.minZ = n.pos.z - r;
    n.collider.maxZ = n.pos.z + r;
  }

  #remove(n) {
    if (n.anchor) this.occupied.delete(anchorKey(n.anchor));
    if (n.collider) {
      const i = this.world.colliders.indexOf(n.collider);
      if (i >= 0) this.world.colliders.splice(i, 1);
    }
    if (n.interact) {
      const i = this.world.interactables.indexOf(n.interact);
      if (i >= 0) this.world.interactables.splice(i, 1);
    }
    this.group.remove(n.rig.group);
    n.anim.dispose?.();
    n.rig.dispose();
    this.npcs.splice(this.npcs.indexOf(n), 1);
  }

  // ------------------------------------------------------------------ comportamiento

  /** Sienta a un PNJ en un ancla (instantáneo si `instant`). */
  #seat(n, anchor, instant = false) {
    n.anchor = anchor;
    this.occupied.add(anchorKey(anchor));
    const act = anchor.type === 'table-seat' ? 'sitTable' : anchor.type === 'machine-seat' ? 'sitPlay' : 'sit';
    const params = { seatY: anchor.sitY ?? 0.46, crossLegs: act === 'sit' && this.rng.next() < 0.4 };
    if (instant) {
      this.#place(n, anchor.x, anchor.z, anchor.yaw);
      n.anim.set(act, params);
      if (n.anim.snap) n.anim.snap();
      else n.anim.cur.hipY = (params.seatY + 0.1) - n.anim.hipBase; // ya sentado
      n.state = 'seated';
      n.timer = n.kind === 'regular' ? Infinity : 40 + this.rng.next() * 100;
      return;
    }
    n.state = 'settling';
    n.settle = { from: { ...n.pos }, to: { x: anchor.x, z: anchor.z }, yaw: anchor.yaw, t: 0, act, params };
  }

  #approachPoint(anchor) {
    const f = forward(anchor.yaw);
    const k = anchor.type === 'table-seat' || anchor.type === 'machine-seat' ? -0.55 : 0.65;
    return this.nav.nearestFree(anchor.x + f.x * k, anchor.z + f.z * k) ?? { x: anchor.x, z: anchor.z };
  }

  #goTo(n, target) {
    const path = this.nav.findPath(n.pos.x, n.pos.z, target.x, target.z);
    if (!path) return false;
    n.path = path;
    n.state = 'walking';
    n.goal = target;
    n.anim.set('walk');
    if (n.collider) n.collider.enabled = true;
    return true;
  }

  #freeSeats() {
    const open = new Set(this.npcs.filter((n) => n.id.startsWith('dealer-')).map((n) => n.id.slice(7)));
    return this.world.anchors.filter((a) => {
      if (this.occupied.has(anchorKey(a))) return false;
      if (a.type === 'armchair' || a.type === 'bench') return true;
      if (a.type === 'sofa') return a.area !== 'wing' || this.world.bounds.minZ < HALL.minZ;
      if (a.type === 'table-seat') return open.has(a.id) && !this.reserved.has(a.id);
      return false;
    });
  }

  #spawnCustomer() {
    if (!customersReady()) return; // los clientes aún se están descargando
    const seats = this.#freeSeats();
    if (!seats.length) return;
    const anchor = seats[Math.floor(this.rng.next() * seats.length)];
    const id = `guest-${Math.floor(this.rng.next() * 1e9)}`;
    const n = this.#create(id, generateExtra(new Rng(id), 'customer'), { kind: 'customer' });
    this.#place(n, ENTRANCE.x + (this.rng.next() - 0.5) * 1.6, ENTRANCE.z, Math.PI);
    this.#addCollider(n);
    n.anchor = anchor;
    this.occupied.add(anchorKey(anchor));
    const ap = this.#approachPoint(anchor);
    if (!this.#goTo(n, { x: ap.x, z: ap.z, onArrive: () => this.#seat(n, anchor) })) this.#remove(n);
  }

  #leave(n) {
    if (n.anchor) this.occupied.delete(anchorKey(n.anchor));
    n.anchor = null;
    n.anim.set('idle');
    const go = () => this.#goTo(n, { x: ENTRANCE.x, z: ENTRANCE.z, exit: true, onArrive: () => (n.state = 'exiting') });
    // levantarse antes de andar
    n.state = 'standing';
    n.timer = 0.8;
    n.after = go;
  }

  /**
   * El jugador se sienta a jugar en una mesa: quien estuviera sentado (o de camino) se levanta
   * y busca otro sitio, y nadie más se sienta hasta que el jugador se va.
   */
  reserveTable(id, on) {
    if (!on) {
      this.reserved.delete(id);
      return;
    }
    this.reserved.add(id);
    for (const n of [...this.npcs]) {
      if (n.anchor?.type !== 'table-seat' || n.anchor.id !== id) continue;
      if (n.collider) n.collider.enabled = true;
      if (n.kind === 'regular') {
        // el habitual se cambia de sitio: a la butaca o banco libre más cercano
        this.occupied.delete(anchorKey(n.anchor));
        const free = this.#freeSeats().filter((a) => a.type !== 'table-seat');
        free.sort((a, b) => Math.hypot(a.x - n.pos.x, a.z - n.pos.z) - Math.hypot(b.x - n.pos.x, b.z - n.pos.z));
        const to = free[0];
        n.anchor = null;
        if (!to) {
          this.#leave(n);
          continue;
        }
        if (!n.collider) this.#addCollider(n);
        n.anchor = to;
        this.occupied.add(anchorKey(to));
        n.anim.set('idle');
        n.state = 'standing';
        n.timer = 0.8;
        n.after = () => {
          const ap = this.#approachPoint(to);
          if (!this.#goTo(n, { x: ap.x, z: ap.z, onArrive: () => this.#seat(n, to) })) this.#seat(n, to, true);
        };
      } else this.#leave(n);
    }
  }

  /** Crupier de una mesa: reparte al ritmo del juego (manual) o en bucle (ambiente). */
  dealerManual(tableId, on) {
    const n = this.get(`dealer-${tableId}`);
    if (!n || n.state !== 'post') return;
    n.anim.set('dealer', on ? { manual: true } : {});
  }

  /** Gesto puntual del crupier (repartir una carta, lanzar la bola, recoger fichas). */
  dealerGesture(tableId) {
    this.get(`dealer-${tableId}`)?.anim.gesture?.();
  }

  /** El jugador habla con un PNJ: se gira hacia él y gesticula. */
  talkStart(id, playerPos) {
    const n = this.get(id);
    if (!n) return null;
    this.talkingWith = n;
    n.talkPrev = { state: n.state, activity: n.anim.activity, params: n.anim.params };
    n.state = 'talking';
    n.targetYaw = Math.atan2(playerPos.x - n.pos.x, playerPos.z - n.pos.z);
    const act = n.anim.activity;
    if (act === 'work' || act === 'dealer' || act === 'walk') n.anim.set('idle');
    return n;
  }

  /** Activa/desactiva los gestos de habla (mientras «suena» la línea). */
  setTalking(id, on) {
    const n = this.get(id);
    if (n) n.anim.talking = on;
  }

  talkEnd() {
    const n = this.talkingWith;
    this.talkingWith = null;
    if (!n) return;
    n.anim.talking = false;
    if (n.post) this.#atPost(n);
    else if (n.talkPrev) {
      n.state = n.talkPrev.state;
      n.anim.set(n.talkPrev.activity, n.talkPrev.params);
    }
  }

  /** Posición de la cabeza de un PNJ en mundo (encuadres de diálogo). */
  headPosition(id, out = new THREE.Vector3()) {
    const n = this.get(id);
    if (!n) return null;
    n.rig.head.getWorldPosition(out);
    return out;
  }

  // ------------------------------------------------------------------ ciclo

  update(dt, { player = null, camera = null } = {}) {
    // afluencia: aparecer clientes poco a poco
    const customers = this.npcs.filter((n) => n.kind === 'customer').length;
    const cap = Math.max(0, (this.g.crowdMax ?? 24) - this.npcs.filter((n) => n.kind !== 'customer').length);
    const target = Math.min(CROWD_TARGET[this.crowd], cap);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3 + this.rng.next() * 4;
      if (customers < target && this.#entranceHidden(camera)) this.#spawnCustomer();
    }

    for (const n of [...this.npcs]) {
      switch (n.state) {
        case 'walking':
          this.#walk(n, dt, player);
          break;
        case 'settling': {
          const s = n.settle;
          s.t = Math.min(1, s.t + dt / 0.7);
          const k = s.t * s.t * (3 - 2 * s.t);
          n.pos.x = s.from.x + (s.to.x - s.from.x) * k;
          n.pos.z = s.from.z + (s.to.z - s.from.z) * k;
          n.targetYaw = s.yaw;
          if (s.t > 0.25 && n.anim.activity !== s.act) n.anim.set(s.act, s.params);
          if (s.t >= 1) {
            n.state = 'seated';
            n.timer = 40 + this.rng.next() * 100;
            if (n.collider) n.collider.enabled = false;
          }
          break;
        }
        case 'seated':
          n.timer -= dt;
          if (n.timer <= 0 && n.kind === 'customer') {
            if (n.collider) n.collider.enabled = true;
            this.#leave(n);
          }
          break;
        case 'standing':
          n.timer -= dt;
          if (n.timer <= 0) n.after?.();
          break;
        case 'exiting':
          if (this.#entranceHidden(camera)) this.#remove(n);
          break;
        default:
          break;
      }
      if (!this.npcs.includes(n)) continue;

      // girar hacia el rumbo deseado
      const d = angleDiff(n.yaw, n.targetYaw);
      n.yaw += d * Math.min(1, TURN_RATE * dt);
      n.rig.group.position.set(n.pos.x, this.world.floorHeight?.(n.pos.x, n.pos.z) ?? 0, n.pos.z);
      n.rig.group.rotation.y = n.yaw;

      // mirar al jugador cuando está cerca (o al hablar)
      if (player) {
        const dx = player.x - n.pos.x;
        const dz = player.z - n.pos.z;
        const dist = Math.hypot(dx, dz);
        const rel = angleDiff(n.yaw, Math.atan2(dx, dz));
        if (n.state === 'talking' || (dist < 3.2 && Math.abs(rel) < 1.6 && n.state !== 'walking')) {
          const eye = n.rig.eyeHeight;
          n.anim.look = { yaw: rel, pitch: Math.atan2((player.y ?? 1.65) - eye, Math.max(0.5, dist)) };
        } else n.anim.look = null;
      }
      // animación: lejos y fuera de cámara, a medio ritmo
      n.skip = !n.skip;
      const far = player && Math.hypot(player.x - n.pos.x, player.z - n.pos.z) > 14;
      if (!far || n.skip) n.anim.update(far ? dt * 2 : dt);
      this.#syncCollider(n);
      if (n.interact) n.interact.pos.set(n.pos.x, 1.2, n.pos.z);
    }
  }

  #walk(n, dt, player) {
    const p = n.path?.[0];
    if (!p) {
      n.path = null;
      const g = n.goal;
      n.goal = null;
      n.anim.speed = 0;
      n.anim.set('idle');
      n.state = 'idle';
      if (g?.yaw !== undefined) n.targetYaw = g.yaw;
      g?.onArrive?.();
      return;
    }
    const dx = p.x - n.pos.x;
    const dz = p.z - n.pos.z;
    const dist = Math.hypot(dx, dz);
    // cortesía: si el jugador está justo delante, esperar
    if (player) {
      const px = player.x - n.pos.x;
      const pz = player.z - n.pos.z;
      const pd = Math.hypot(px, pz);
      if (pd < 0.85 && (px * dx + pz * dz) > 0) {
        n.anim.speed = 0;
        n.stuck += dt;
        if (n.stuck > 2.5) {
          n.stuck = 0;
          const goal = n.goal;
          const last = n.path[n.path.length - 1];
          if (!this.#goTo(n, { ...goal, x: last.x, z: last.z })) n.stuck = -2;
        }
        return;
      }
    }
    n.stuck = 0;
    const step = Math.min(dist, WALK_SPEED * dt);
    if (dist < 0.05) {
      n.path.shift();
      return;
    }
    n.pos.x += (dx / dist) * step;
    n.pos.z += (dz / dist) * step;
    n.targetYaw = Math.atan2(dx, dz);
    n.anim.speed = WALK_SPEED;
    if (dist - step < 0.05) n.path.shift();
  }

  /** ¿La entrada está fuera de la vista? (para aparecer/desaparecer sin que se note) */
  #entranceHidden(camera) {
    if (!camera) return true;
    const dx = ENTRANCE.x - camera.position.x;
    const dz = ENTRANCE.z - camera.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 16) return true;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return (dir.x * dx + dir.z * dz) / dist < 0.35;
  }

  dispose() {
    for (const n of [...this.npcs]) this.#remove(n);
    this.world.scene.remove(this.group);
    this.material?.dispose();
  }
}
