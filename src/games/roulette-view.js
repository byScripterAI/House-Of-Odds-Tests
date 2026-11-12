import * as THREE from 'three';
import { ROULETTE_GEOM, toWorld } from '../world/props/tables.js';
import { CELLS, cellCenter, cellOf, hitCell } from './roulette-layout.js';
import { WHEEL, colorOf, covers } from './roulette.js';
import { CHIP_H, makeChipStack, makePracticeChip } from './table-assets.js';
import { Tweens, ease } from './tween.js';

/**
 * ROYAL ROULETTE en 3D: rueda europea real (37 casillas en su orden, trastes, cono y torreta)
 * que gira siempre; bola que corre por la pista en sentido contrario, pierde velocidad, rebota
 * entre los trastes y cae EXACTAMENTE en el número que ha decidido la lógica (games/roulette.js).
 * Paño interactivo: casillas resaltadas al pasar el ratón, fichas 3D donde apuestas y «dolly»
 * sobre el número ganador.
 *
 * Convención de ángulos (coordenadas locales de la rueda): posición(α) = (r·cos α, −r·sin α).
 */

const TAU = Math.PI * 2;
const POCKET = TAU / 37;
const R_DISC = 0.355; // radio de la cara del rotor (números + casillas)
const R_POCKET = 0.243; // radio donde reposa la bola
const R_TRACK = 0.445; // pista de la bola
const BALL_R = 0.0105;
const H_DISC = 0.062;
const IDLE_SPEED = 0.35; // rad/s: la rueda nunca está del todo quieta
const SPIN_SPEED = 1.7;

/** Ángulo de la casilla i en el rotor (las casillas van en sentido horario visto desde arriba). */
const pocketAngle = (i) => -i * POCKET;

/** Altura de la superficie del cuenco (para la bola) según el radio. */
function bowlHeight(r) {
  if (r <= R_DISC) return r < 0.287 ? 0.052 : H_DISC;
  if (r >= R_TRACK) return 0.115;
  const k = (r - R_DISC) / (R_TRACK - R_DISC);
  return H_DISC + (0.115 - H_DISC) * k * k;
}

function rotorTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const scale = (S / 2) / R_DISC;
  const rad = (r) => r * scale;
  ctx.fillStyle = '#1a0f0a';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 37; i++) {
    const n = WHEEL[i];
    const theta = pocketAngle(i);
    const phi = -theta; // ángulo de canvas (y hacia abajo)
    const col = n === 0 ? '#0d7a3e' : colorOf(n) === 'red' ? '#a3162c' : '#0e0d10';
    // anillo de números
    ctx.beginPath();
    ctx.arc(cx, cx, rad(R_DISC), phi - POCKET / 2, phi + POCKET / 2);
    ctx.arc(cx, cx, rad(0.29), phi + POCKET / 2, phi - POCKET / 2, true);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // fondo de la casilla (más oscuro: está hundido)
    ctx.beginPath();
    ctx.arc(cx, cx, rad(0.284), phi - POCKET / 2, phi + POCKET / 2);
    ctx.arc(cx, cx, rad(0.2), phi + POCKET / 2, phi - POCKET / 2, true);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cx, rad(0.2), cx, cx, rad(0.284));
    g.addColorStop(0, n === 0 ? '#06401f' : colorOf(n) === 'red' ? '#4e0814' : '#050506');
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    // número, de pie hacia fuera
    const mid = rad(0.3225);
    ctx.save();
    ctx.translate(cx + Math.cos(phi) * mid, cx + Math.sin(phi) * mid);
    ctx.rotate(phi + Math.PI / 2);
    ctx.fillStyle = '#f6efdc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px Cinzel, Georgia, serif';
    ctx.fillText(String(n), 0, 2);
    ctx.restore();
  }
  // filetes dorados
  ctx.strokeStyle = '#d4af37';
  for (const [r, w] of [[R_DISC - 0.002, 5], [0.288, 4], [0.2, 3]]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cx, rad(r), 0, TAU);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class RouletteView {
  /** @param {{scene: THREE.Scene, table: {x:number, z:number, yaw:number}}} o */
  constructor({ scene, table }) {
    this.table = table;
    this.group = new THREE.Group();
    this.group.name = 'roulette-view';
    this.group.position.set(table.x, 0, table.z);
    this.group.rotation.y = table.yaw;
    scene.add(this.group);
    this.tw = new Tweens();
    this.owned = [];
    this.chips = new Map(); // clave → pila
    this.highlights = [];
    this.time = 0;
    this.rotorSpeed = IDLE_SPEED;
    this.spin = null;
    this.ballLock = 0; // casilla donde reposa la bola
    this.skin = 'classic';
    this.#buildWheel();
    this.#buildLayout();
  }

  #own(x) {
    this.owned.push(x);
    return x;
  }

  #mat(o) {
    return this.#own(new THREE.MeshStandardMaterial(o));
  }

  #buildWheel() {
    const G = ROULETTE_GEOM;
    const wheel = new THREE.Group();
    wheel.position.set(G.wheelX, G.topY, 0);
    this.group.add(wheel);
    this.wheel = wheel;
    const wood = this.#mat({ color: 0x3a1c0e, roughness: 0.32, metalness: 0.05 });
    this.goldMat = this.#mat({ color: 0xd4af37, roughness: 0.25, metalness: 1 });
    const brass = this.#mat({ color: 0xb8892a, roughness: 0.3, metalness: 0.9 });
    // cuenco (fijo): pared interior inclinada por donde corre la bola, labio y canto exterior
    const profile = [[0.352, 0.035], [0.36, H_DISC], [0.39, 0.075], [0.445, 0.112], [0.49, 0.126], [0.52, 0.132], [0.538, 0.122], [0.545, 0.07], [0.54, 0.0]].map(([r, h]) => new THREE.Vector2(r, h));
    const bowl = new THREE.Mesh(this.#own(new THREE.LatheGeometry(profile, 72)), this.#mat({ color: 0x4a2412, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide }));
    bowl.receiveShadow = bowl.castShadow = true;
    wheel.add(bowl);
    const lip = new THREE.Mesh(this.#own(new THREE.TorusGeometry(0.527, 0.011, 8, 72)), this.goldMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.132;
    wheel.add(lip);
    const floor = new THREE.Mesh(this.#own(new THREE.CircleGeometry(0.36, 48)), this.#mat({ color: 0x0c0806, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.004;
    wheel.add(floor);
    // marcadores de diamante en la pared (desvían la bola)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      const d = new THREE.Mesh(this.#own(new THREE.OctahedronGeometry(0.012)), this.goldMat);
      d.scale.set(1, 0.5, 1.8);
      d.position.set(Math.cos(a) * 0.405, bowlHeight(0.405) + 0.006, -Math.sin(a) * 0.405);
      d.rotation.y = a;
      wheel.add(d);
    }

    // rotor (gira)
    const rotor = new THREE.Group();
    wheel.add(rotor);
    this.rotor = rotor;
    const body = new THREE.Mesh(this.#own(new THREE.CylinderGeometry(R_DISC, 0.33, 0.055, 64)), wood);
    body.position.y = H_DISC - 0.0285;
    rotor.add(body);
    this.discTex = this.#own(rotorTexture());
    const disc = new THREE.Mesh(this.#own(new THREE.CircleGeometry(R_DISC, 111)), this.#mat({ map: this.discTex, roughness: 0.35, metalness: 0.05 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = H_DISC + 0.0005;
    disc.receiveShadow = true;
    rotor.add(disc);
    // trastes entre casillas
    const fretGeo = this.#own(new THREE.BoxGeometry(0.084, 0.012, 0.0035));
    for (let i = 0; i < 37; i++) {
      const a = pocketAngle(i) - POCKET / 2;
      const f = new THREE.Mesh(fretGeo, brass);
      f.position.set(Math.cos(a) * 0.243, H_DISC + 0.006, -Math.sin(a) * 0.243);
      f.rotation.y = a;
      f.castShadow = true;
      rotor.add(f);
    }
    // cono y torreta
    const cone = new THREE.Mesh(this.#own(new THREE.CylinderGeometry(0.05, 0.2, 0.07, 48)), wood);
    cone.position.y = H_DISC + 0.035;
    rotor.add(cone);
    const coneRing = new THREE.Mesh(this.#own(new THREE.TorusGeometry(0.2, 0.006, 6, 48)), this.goldMat);
    coneRing.rotation.x = Math.PI / 2;
    coneRing.position.y = H_DISC + 0.002;
    rotor.add(coneRing);
    const post = new THREE.Mesh(this.#own(new THREE.CylinderGeometry(0.016, 0.026, 0.07, 16)), this.goldMat);
    post.position.y = H_DISC + 0.1;
    rotor.add(post);
    const armGeo = this.#own(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8));
    const knobGeo = this.#own(new THREE.SphereGeometry(0.012, 12, 8));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      const arm = new THREE.Mesh(armGeo, this.goldMat);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = a;
      arm.position.set(Math.cos(a) * 0.1, H_DISC + 0.125, -Math.sin(a) * 0.1);
      rotor.add(arm);
      const knob = new THREE.Mesh(knobGeo, this.goldMat);
      knob.position.set(Math.cos(a) * 0.2, H_DISC + 0.125, -Math.sin(a) * 0.2);
      rotor.add(knob);
    }
    const top = new THREE.Mesh(this.#own(new THREE.SphereGeometry(0.022, 16, 12)), this.goldMat);
    top.position.y = H_DISC + 0.145;
    rotor.add(top);
    // bola
    this.ball = new THREE.Mesh(this.#own(new THREE.SphereGeometry(BALL_R, 20, 14)), this.#mat({ color: 0xf8f6f0, roughness: 0.12, metalness: 0.0 }));
    this.ball.castShadow = true;
    wheel.add(this.ball);
    this.ballAngle = 0;
    this.ballR = R_POCKET;
    this.#placeBall();
  }

  #buildLayout() {
    const L = ROULETTE_GEOM.layout;
    // plano invisible para detectar clics sobre el paño
    this.pick = new THREE.Mesh(this.#own(new THREE.PlaneGeometry(L.w, L.d)), new THREE.MeshBasicMaterial({ visible: false }));
    this.pick.rotation.x = -Math.PI / 2;
    this.pick.position.set(L.x, L.y + 0.002, L.z);
    this.group.add(this.pick);
    // resaltes (una pieza por casilla, reutilizables)
    this.hlGeo = this.#own(new THREE.PlaneGeometry(1, 1));
    this.hlMat = this.#own(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.winMat = this.#own(new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.hlPool = [];
    // «dolly» sobre el número ganador
    const dolly = new THREE.Group();
    const glass = new THREE.Mesh(this.#own(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 20)), this.#mat({ color: 0xe8f4ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55 }));
    glass.position.y = 0.025;
    const cap = new THREE.Mesh(this.#own(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 20)), this.goldMat);
    cap.position.y = 0.052;
    dolly.add(glass, cap);
    dolly.visible = false;
    this.group.add(dolly);
    this.dolly = dolly;
  }

  /** Coordenadas locales (mesa) del centro de una casilla del paño. */
  #cellLocal(key, y = 0) {
    const L = ROULETTE_GEOM.layout;
    const c = cellCenter(key);
    return new THREE.Vector3(L.x + (c.u - 0.5) * L.w, L.y + y, L.z + (c.t - 0.5) * L.d);
  }

  /** Casilla del paño bajo el rayo (o null). */
  pickCell(raycaster) {
    const hit = raycaster.intersectObject(this.pick, false)[0];
    if (!hit) return null;
    const local = this.group.worldToLocal(hit.point.clone());
    const L = ROULETTE_GEOM.layout;
    const u = (local.x - L.x) / L.w + 0.5;
    const t = (local.z - L.z) / L.d + 0.5;
    return hitCell(u, t);
  }

  #setHighlights(keys, mat) {
    const L = ROULETTE_GEOM.layout;
    while (this.hlPool.length < keys.length) {
      const m = new THREE.Mesh(this.hlGeo, this.hlMat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.group.add(m);
      this.hlPool.push(m);
    }
    this.hlPool.forEach((m, i) => {
      const key = keys[i];
      m.visible = !!key;
      if (!key) return;
      const c = cellOf(key);
      m.material = mat;
      m.scale.set(c.w * L.w * 0.96, c.h * L.d * 0.94, 1);
      m.position.copy(this.#cellLocal(key, 0.0025));
    });
  }

  /** Resalta una casilla y los números que cubre (null = nada). */
  hover(key) {
    if (this.winShow > 0) return;
    if (!key) return this.#setHighlights([], this.hlMat);
    const nums = key.startsWith('n:') ? [] : CELLS.filter((c) => c.key.startsWith('n:') && covers(key, Number(c.key.slice(2)))).map((c) => c.key);
    this.#setHighlights([key, ...nums], this.hlMat);
  }

  /** Muestra las fichas de las apuestas actuales (clave → MARKS o número de fichas de práctica). */
  showBets(bets, { practice = false } = {}) {
    for (const [key, stack] of this.chips) {
      if (!(key in bets)) {
        this.group.remove(stack);
        this.chips.delete(key);
      }
    }
    for (const [key, amount] of Object.entries(bets)) {
      const cur = this.chips.get(key);
      if (cur && cur.userData.amount === amount && cur.userData.practice === practice) continue;
      if (cur) this.group.remove(cur);
      let stack;
      if (practice) {
        stack = new THREE.Group();
        for (let i = 0; i < Math.min(8, amount); i++) {
          const c = makePracticeChip();
          c.position.y = i * CHIP_H;
          stack.add(c);
        }
      } else stack = makeChipStack(amount);
      stack.userData.amount = amount;
      stack.userData.practice = practice;
      stack.position.copy(this.#cellLocal(key, 0.001));
      // pequeño desplazamiento para que no tapen el número
      stack.position.x += 0.012;
      stack.position.z += 0.012;
      this.group.add(stack);
      this.chips.set(key, stack);
      const base = stack.position.y;
      stack.position.y = base + 0.05;
      this.tw.add(0.18, (k) => (stack.position.y = base + 0.05 * (1 - k)), { curve: ease.out });
    }
  }

  /** Recoge las fichas: las perdidas hacia la rueda (la banca), las ganadas hacia el jugador. */
  collect(winKeys) {
    for (const [key, stack] of this.chips) {
      const won = winKeys.includes(key);
      const from = stack.position.clone();
      const to = won ? from.clone().add(new THREE.Vector3(0, 0.02, 0.7)) : new THREE.Vector3(0.6, ROULETTE_GEOM.topY + 0.01, -0.55);
      this.tw.add(0.55, (k) => {
        stack.position.lerpVectors(from, to, k);
        stack.position.y += Math.sin(k * Math.PI) * 0.06;
      }, { delay: won ? 0.25 : 0, curve: ease.inOut, done: () => this.group.remove(stack) });
    }
    this.chips.clear();
    return 0.85;
  }

  /** Quita fichas sin animación (salir de la mesa, borrar apuestas). */
  clearChips() {
    for (const s of this.chips.values()) this.group.remove(s);
    this.chips.clear();
  }

  setSkin(skin) {
    this.skin = skin === 'gold' ? 'gold' : 'classic';
    this.goldMat.color.set(this.skin === 'gold' ? 0xffd25a : 0xd4af37);
    this.goldMat.emissive?.set(this.skin === 'gold' ? 0x3a2600 : 0x000000);
  }

  // ------------------------------------------------------------------ giro

  #placeBall() {
    const r = this.ballR;
    const h = bowlHeight(r) + BALL_R + (this.ballHop ?? 0);
    this.ball.position.set(Math.cos(this.ballAngle) * r, h, -Math.sin(this.ballAngle) * r);
  }

  /**
   * Lanza la bola. `number` es el resultado ya decidido. Llama a `onLand` al caer.
   * Duración total ≈ 6,4 s. `onBounce` suena en cada rebote.
   */
  launch(number, { onLand, onBounce } = {}) {
    const i = WHEEL.indexOf(number);
    this.hover(null);
    this.dolly.visible = false;
    this.winShow = 0;
    this.#setHighlights([], this.hlMat);
    const T = 5.6; // hasta que la bola queda quieta respecto al rotor
    const phi0 = this.ballLock; // el crupier la recoge de su casilla y la lanza desde ahí
    const target = pocketAngle(i);
    let d = (target - phi0) % TAU;
    if (d > 0) d -= TAU;
    const total = d - TAU * 5; // ~5 vueltas relativas, en sentido contrario al rotor
    this.spin = { t: 0, T, phi0, total, onLand, onBounce, landed: false, bounces: 0, seg: -1, lift: 0.3, r0: this.ballR };
  }

  get spinning() {
    return !!this.spin;
  }

  /** Muestra el número ganador: «dolly» y casillas premiadas brillando. */
  showWin(number) {
    this.dolly.position.copy(this.#cellLocal(`n:${number}`, 0.0));
    this.dolly.visible = true;
    const keys = CELLS.filter((c) => covers(c.key, number)).map((c) => c.key);
    this.#setHighlights(keys, this.winMat);
    this.winShow = 3.2;
  }

  #updateSpin(dt) {
    const s = this.spin;
    s.t += dt;
    const x = Math.min(1, s.t / s.T);
    // fase 0: el crupier recoge la bola y la lleva a la pista (0,25 s)
    // fase 1: corre por la pista · fase 2: cae rebotando · fase 3: asentada
    const f = 1 - (1 - x) ** 2.4;
    const phi = s.phi0 + s.total * f;
    this.ballAngle = this.rotor.rotation.y + phi;
    let r;
    let hop = 0;
    if (x < 0.5) r = R_TRACK;
    else if (x < 0.78) {
      const k = (x - 0.5) / 0.28;
      r = R_TRACK - (R_TRACK - 0.3) * ease.inOut(k);
      hop = Math.abs(Math.sin(k * Math.PI * 4)) * (1 - k) * 0.02;
      const seg = Math.floor(k * 4);
      if (seg !== s.seg) {
        s.seg = seg;
        s.onBounce?.(s.bounces++);
      }
    } else {
      const k = Math.min(1, (x - 0.78) / 0.22);
      r = 0.3 - (0.3 - R_POCKET) * ease.out(k);
      hop = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 0.008;
    }
    if (s.lift > 0) {
      // recogida: la bola sube desde la casilla anterior hasta la pista
      const k = ease.inOut(1 - s.lift / 0.3);
      r = s.r0 + (r - s.r0) * k;
      hop += Math.sin(k * Math.PI) * 0.05;
      s.lift = Math.max(0, s.lift - dt);
    }
    this.ballR = r;
    this.ballHop = hop;
    this.#placeBall();
    if (x >= 1 && !s.landed) {
      s.landed = true;
      this.ballLock = s.phi0 + s.total;
      this.spin = null;
      this.ballHop = 0;
      s.onLand?.();
    }
  }

  update(dt) {
    this.time += dt;
    this.tw.update(dt);
    // el rotor acelera al lanzar y vuelve despacio a su giro de reposo
    const want = this.spin ? SPIN_SPEED * (1 - Math.min(1, this.spin.t / this.spin.T) * 0.6) : IDLE_SPEED;
    this.rotorSpeed += (want - this.rotorSpeed) * Math.min(1, dt * (this.spin ? 2.5 : 0.6));
    this.rotor.rotation.y = (this.rotor.rotation.y + this.rotorSpeed * dt) % TAU;
    if (this.spin) this.#updateSpin(dt);
    else {
      // la bola viaja en su casilla con el rotor
      this.ballAngle = this.rotor.rotation.y + this.ballLock;
      this.ballR = R_POCKET;
      this.#placeBall();
    }
    if (this.winShow > 0) {
      this.winShow -= dt;
      this.winMat.opacity = this.winShow > 0 ? 0.25 + Math.abs(Math.sin(this.time * 5)) * 0.35 : 0;
      if (this.winShow <= 0) this.#setHighlights([], this.hlMat);
    }
  }

  /** Centro de la mesa para encuadres. */
  get worldCenter() {
    const p = toWorld(this.table, 0.3, 0);
    return new THREE.Vector3(p.x, ROULETTE_GEOM.topY, p.z);
  }

  /** Punto en el mundo de la rueda (para etiquetas). */
  wheelPoint() {
    return this.wheel.localToWorld(new THREE.Vector3(0, 0.25, 0));
  }

  dispose() {
    this.clearChips();
    this.group.removeFromParent();
    for (const o of this.owned) o.dispose?.();
  }
}
