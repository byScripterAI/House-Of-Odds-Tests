import * as THREE from 'three';
import { BLACKJACK_GEOM, toWorld } from '../world/props/tables.js';
import { CARD_H, makeCard, makeChipStack, makePracticeChip } from './table-assets.js';
import { Tweens, ease } from './tween.js';

/**
 * ROYAL BLACKJACK en 3D: cartas que salen del zapato en arco y se voltean, carta oculta de la
 * banca, fichas en el círculo de apuesta, pagos que llegan desde la bandeja y recogida final.
 * Vive fuera del escenario reconstruible (sobrevive a cambiar la calidad gráfica).
 * Coordenadas locales de la mesa: crupier en −Z, jugador en +Z.
 */

const FELT = BLACKJACK_GEOM.feltY;
const SHOE = new THREE.Vector3(BLACKJACK_GEOM.shoe.x, BLACKJACK_GEOM.shoe.y + 0.02, BLACKJACK_GEOM.shoe.z);
const TRAY = new THREE.Vector3(BLACKJACK_GEOM.tray.x, BLACKJACK_GEOM.tray.y, BLACKJACK_GEOM.tray.z);
const DISCARD = new THREE.Vector3(-0.92, FELT + 0.02, -0.46);
const DEALER_Z = -0.32;
const PLAYER_Z = 0.4;
const BET_Z = 0.66;
const DEALER_STEP = 0.094;
const PLAYER_STEP = 0.034;

export class BlackjackView {
  /** @param {{scene: THREE.Scene, table: {x:number, z:number, yaw:number}}} o */
  constructor({ scene, table }) {
    this.table = table;
    this.group = new THREE.Group();
    this.group.name = 'blackjack-view';
    this.group.position.set(table.x, 0, table.z);
    this.group.rotation.y = table.yaw;
    scene.add(this.group);
    this.tw = new Tweens();
    this.skin = 'classic';
    this.dealer = [];
    this.hands = [[]];
    this.bets = [];
    this.wins = [];
    this.handCount = 1;
    // anillo que marca la mano activa
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.105, 0.118, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.set(0, FELT + 0.0015, PLAYER_Z);
    this.marker.renderOrder = 2;
    this.group.add(this.marker);
    this.activeHand = -1;
    this.time = 0;
  }

  setSkin(skin) {
    this.skin = skin === 'royal' ? 'royal' : 'classic';
  }

  get busy() {
    return this.tw.busy;
  }

  // ------------------------------------------------------------------ posiciones

  #handX(h) {
    return this.handCount === 2 ? (h === 0 ? -0.21 : 0.21) : 0;
  }

  #playerSlot(h, i, n) {
    const x = this.#handX(h) + (i - (n - 1) / 2) * PLAYER_STEP;
    return new THREE.Vector3(x, FELT + 0.0012 + i * 0.0011, PLAYER_Z - i * 0.012);
  }

  #dealerSlot(i, n) {
    return new THREE.Vector3((i - (n - 1) / 2) * DEALER_STEP, FELT + 0.0012 + i * 0.0011, DEALER_Z);
  }

  /** Punto del mundo para las etiquetas de total (bajo la mano del jugador / sobre la banca). */
  labelPoint(kind, h = 0) {
    const local = kind === 'dealer'
      ? new THREE.Vector3(0, FELT, DEALER_Z - CARD_H * 0.5 - 0.05)
      : new THREE.Vector3(this.#handX(h), FELT, PLAYER_Z + CARD_H * 0.5 + 0.05);
    return this.group.localToWorld(local);
  }

  /** Centro de la mesa (para encuadrar la cámara). */
  get worldCenter() {
    const p = toWorld(this.table, 0, 0.1);
    return new THREE.Vector3(p.x, FELT, p.z);
  }

  // ------------------------------------------------------------------ animación de cartas

  #flyCard(mesh, to, { faceUp, dur = 0.36, delay = 0 }) {
    const from = mesh.position.clone();
    const r0 = mesh.rotation.z;
    const r1 = faceUp ? 0 : Math.PI;
    const ry0 = mesh.rotation.y;
    const ry1 = (Math.random() - 0.5) * 0.06;
    this.tw.add(dur, (k) => {
      mesh.position.lerpVectors(from, to, k);
      mesh.position.y += Math.sin(k * Math.PI) * 0.07;
      mesh.rotation.z = r0 + (r1 - r0) * k;
      mesh.rotation.y = ry0 + (ry1 - ry0) * k;
    }, { delay, curve: ease.out });
  }

  #slide(mesh, to, dur = 0.28) {
    const from = mesh.position.clone();
    this.tw.add(dur, (k) => mesh.position.lerpVectors(from, to, k), { curve: ease.inOut });
  }

  #relayout() {
    this.dealer.forEach((c, i) => this.#slide(c, this.#dealerSlot(i, this.dealer.length)));
    this.hands.forEach((hand, h) => hand.forEach((c, i) => this.#slide(c, this.#playerSlot(h, i, hand.length))));
  }

  /**
   * Aplica un evento de la lógica (games/blackjack.js). Devuelve cuánto esperar antes del siguiente.
   */
  apply(ev) {
    switch (ev.type) {
      case 'card': {
        const mesh = makeCard(ev.card, this.skin);
        mesh.position.copy(SHOE);
        mesh.rotation.z = Math.PI;
        mesh.rotation.y = 0.3;
        this.group.add(mesh);
        if (ev.to === 'dealer') {
          this.dealer.push(mesh);
          mesh.userData.hidden = !!ev.hidden;
          this.dealer.forEach((c, i) => {
            const slot = this.#dealerSlot(i, this.dealer.length);
            if (c === mesh) this.#flyCard(mesh, slot, { faceUp: !ev.hidden });
            else this.#slide(c, slot);
          });
        } else {
          const hand = this.hands[ev.hand];
          hand.push(mesh);
          hand.forEach((c, i) => {
            const slot = this.#playerSlot(ev.hand, i, hand.length);
            if (c === mesh) this.#flyCard(mesh, slot, { faceUp: true });
            else this.#slide(c, slot);
          });
        }
        return 0.42;
      }
      case 'reveal': {
        const hole = this.dealer[1];
        if (hole) {
          const r0 = hole.rotation.z;
          const base = hole.position.y;
          this.tw.add(0.42, (k) => {
            hole.rotation.z = r0 * (1 - k);
            hole.position.y = base + Math.sin(k * Math.PI) * 0.04;
          }, { curve: ease.inOut });
          hole.userData.hidden = false;
        }
        return 0.55;
      }
      case 'split': {
        this.handCount = 2;
        const moved = this.hands[0].pop();
        this.hands.splice(ev.hand, 0, [moved]);
        // la apuesta se duplica en el segundo círculo
        const amount = this.bets[0]?.userData.amount ?? 0;
        const practice = !!this.bets[0]?.userData.practice;
        const stack = practice ? makePracticeChip() : makeChipStack(amount);
        stack.userData.amount = amount;
        stack.userData.practice = practice;
        stack.position.copy(TRAY);
        this.group.add(stack);
        this.bets.splice(ev.hand, 0, stack);
        this.#relayout();
        this.bets.forEach((b, h) => this.#slide(b, new THREE.Vector3(this.#handX(h), FELT + 0.001, BET_Z), 0.32));
        this.#moveMarker(this.activeHand);
        return 0.45;
      }
      case 'double': {
        const bet = this.bets[ev.hand];
        if (bet) {
          const amount = bet.userData.amount ?? 0;
          const extra = bet.userData.practice ? makePracticeChip() : makeChipStack(amount);
          extra.position.copy(TRAY);
          this.group.add(extra);
          const to = bet.position.clone();
          to.x += 0.047;
          this.#flyChips(extra, to);
          bet.userData.extra = extra;
        }
        return 0.32;
      }
      case 'turn':
        this.#moveMarker(ev.hand);
        return 0.05;
      case 'bust':
      case 'blackjack':
        return 0.25;
      case 'end':
        this.#moveMarker(-1);
        return 0.1;
      default:
        return 0;
    }
  }

  #moveMarker(h) {
    this.activeHand = h;
    if (h >= 0) {
      const to = new THREE.Vector3(this.#handX(h), FELT + 0.0015, PLAYER_Z);
      this.#slide(this.marker, to, 0.2);
    }
  }

  #flyChips(stack, to, dur = 0.38) {
    const from = stack.position.clone();
    this.tw.add(dur, (k) => {
      stack.position.lerpVectors(from, to, k);
      stack.position.y += Math.sin(k * Math.PI) * 0.05;
    }, { curve: ease.out });
  }

  /** Fichas de la apuesta inicial en el círculo (o ficha dorada de práctica). */
  placeBet(amount, { practice = false } = {}) {
    const stack = practice ? makePracticeChip() : makeChipStack(amount);
    stack.userData.amount = amount;
    stack.userData.practice = practice;
    stack.position.set(0, FELT + 0.12, BET_Z + 0.25);
    this.group.add(stack);
    this.bets = [stack];
    this.#flyChips(stack, new THREE.Vector3(0, FELT + 0.001, BET_Z), 0.3);
  }

  /** Liquidación: las apuestas perdidas van a la bandeja; las ganadas reciben su pago. */
  settle(results) {
    results.hands.forEach((r, h) => {
      const bet = this.bets[h];
      if (!bet) return;
      const stacks = [bet, bet.userData.extra].filter(Boolean);
      if (r.outcome === 'lose' || r.outcome === 'bust') {
        stacks.forEach((s, i) => this.#flyChips(s, TRAY.clone().add(new THREE.Vector3(-0.1 + i * 0.05, 0, 0)), 0.5));
      } else if (r.outcome === 'win' || r.outcome === 'blackjack') {
        const winAmount = r.payout - r.bet;
        const pay = bet.userData.practice ? makePracticeChip() : makeChipStack(winAmount);
        pay.position.copy(TRAY);
        this.group.add(pay);
        this.wins.push(pay);
        const to = bet.position.clone();
        to.x -= 0.05;
        this.#flyChips(pay, to, 0.5);
      }
    });
    return 0.9;
  }

  /** Recoge cartas y fichas: la mesa queda limpia para la siguiente mano. */
  clearRound() {
    const cards = [...this.dealer, ...this.hands.flat()];
    cards.forEach((c, i) => {
      const from = c.position.clone();
      const to = DISCARD.clone().add(new THREE.Vector3(0, i * 0.0008, 0));
      const r0 = c.rotation.z;
      this.tw.add(0.4, (k) => {
        c.position.lerpVectors(from, to, k);
        c.rotation.z = r0 + (Math.PI - r0) * k;
      }, { delay: i * 0.03, curve: ease.inOut, done: () => this.#drop(c) });
    });
    const chips = [...this.bets, ...this.bets.map((b) => b.userData.extra), ...this.wins].filter(Boolean);
    chips.forEach((s) => {
      const inTray = s.position.z < 0;
      const from = s.position.clone();
      const to = inTray ? from.clone().setY(FELT - 0.03) : from.clone().add(new THREE.Vector3(0, 0.02, 0.45));
      this.tw.add(0.45, (k) => s.position.lerpVectors(from, to, k), { curve: ease.inOut, done: () => this.#drop(s) });
    });
    this.dealer = [];
    this.hands = [[]];
    this.bets = [];
    this.wins = [];
    this.handCount = 1;
    this.#moveMarker(-1);
    return 0.6;
  }

  #drop(obj) {
    this.group.remove(obj);
  }

  /** Vacía la mesa al instante (salir, cargar partida…). */
  reset() {
    this.tw.clear();
    for (const o of [...this.group.children]) if (o !== this.marker) this.group.remove(o);
    this.dealer = [];
    this.hands = [[]];
    this.bets = [];
    this.wins = [];
    this.handCount = 1;
    this.activeHand = -1;
    this.marker.material.opacity = 0;
  }

  update(dt) {
    this.time += dt;
    this.tw.update(dt);
    const want = this.activeHand >= 0 ? 0.55 + Math.sin(this.time * 4) * 0.25 : 0;
    const m = this.marker.material;
    m.opacity += (want - m.opacity) * Math.min(1, dt * 10);
  }

  dispose() {
    this.reset();
    this.group.removeFromParent();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
  }
}

