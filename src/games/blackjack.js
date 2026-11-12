import { cardPoints } from './cards.js';

/**
 * ROYAL BLACKJACK — lógica pura de una mano (sin Three.js ni DOM).
 *
 * Reglas (las de una mesa europea clásica, sencillas de explicar):
 *  - 6 barajas; se rebaraja al quedar menos del 25 %.
 *  - Blackjack (21 con dos cartas) paga 3 a 2. Ganar paga 1 a 1. Empate: se devuelve la apuesta.
 *  - La banca pide hasta 16 y se planta con cualquier 17 (también 17 «blando»).
 *  - La banca revisa su carta oculta si muestra As o 10: con blackjack, la mano termina al momento.
 *  - Puedes DOBLAR con tus dos primeras cartas (una carta más y la apuesta ×2), también tras dividir.
 *  - Puedes DIVIDIR una pareja (dos cartas del mismo valor) una vez. Los Ases divididos reciben una carta cada uno.
 *  - 21 tras dividir no es blackjack. Con 21 te plantas solo.
 *
 * Toda acción devuelve una lista de EVENTOS para la animación:
 *   {type:'card', to:'player'|'dealer', hand, index, card, hidden?} · {type:'reveal', card} ·
 *   {type:'split', hand} · {type:'turn', hand} · {type:'bust', hand} · {type:'double', hand} ·
 *   {type:'blackjack', who} · {type:'end'}
 */

export const BJ_RULES = Object.freeze({ decks: 6, blackjackPays: 1.5, dealerStandsSoft17: true, maxHands: 2 });

/** Valor de una mano: el As vale 11 si no te pasas. */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c);
    if (c.r === 'A') aces += 1;
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft, bust: total > 21 };
}

export const isNatural = (cards) => cards.length === 2 && handValue(cards).total === 21;

export class BlackjackRound {
  /**
   * @param {{shoe: import('./cards.js').Shoe, bet: number, rules?: typeof BJ_RULES}} o
   *  `bet` puede ser 0 (mano de práctica: ni cuesta ni paga).
   */
  constructor({ shoe, bet, rules = BJ_RULES }) {
    if (!(bet >= 0)) throw new Error('Apuesta inválida');
    this.shoe = shoe;
    this.rules = rules;
    this.baseBet = Math.floor(bet);
    this.hands = [];
    this.dealer = { cards: [], hidden: true };
    this.active = 0;
    this.phase = 'ready'; // ready → player → done
    this.results = null;
  }

  /** MARKS comprometidos en la mesa ahora mismo. */
  get staked() {
    return this.hands.reduce((s, h) => s + h.bet, 0);
  }

  get hand() {
    return this.hands[this.active] ?? null;
  }

  /** Reparto inicial: jugador, banca, jugador, banca (oculta). */
  deal() {
    if (this.phase !== 'ready') return [];
    this.hands = [{ cards: [], bet: this.baseBet, done: false, doubled: false, split: false }];
    const ev = [];
    ev.push(this.#give(0), this.#giveDealer(false), this.#give(0), this.#giveDealer(true));
    this.phase = 'player';
    const up = this.dealer.cards[0];
    const dealerBJ = isNatural(this.dealer.cards);
    const playerBJ = isNatural(this.hands[0].cards);
    // la banca revisa la oculta con As o figura/10 a la vista
    if ((up.r === 'A' || cardPoints(up) === 10) && dealerBJ) {
      ev.push(this.#reveal(), { type: 'blackjack', who: 'dealer' });
      return [...ev, ...this.#finish(false)];
    }
    if (playerBJ) {
      ev.push({ type: 'blackjack', who: 'player' }, this.#reveal());
      return [...ev, ...this.#finish(false)];
    }
    ev.push({ type: 'turn', hand: 0 });
    return ev;
  }

  /** Qué se puede hacer ahora (sin contar el saldo: eso lo decide quien llama con `extraCost`). */
  options() {
    const h = this.hand;
    if (this.phase !== 'player' || !h || h.done) return { hit: false, stand: false, double: false, split: false };
    const two = h.cards.length === 2;
    const pair = two && cardPoints(h.cards[0]) === cardPoints(h.cards[1]);
    return { hit: true, stand: true, double: two, split: pair && this.hands.length < this.rules.maxHands };
  }

  /** Coste adicional de doblar o dividir (la apuesta de la mano actual). */
  get extraCost() {
    return this.hand?.bet ?? 0;
  }

  hit() {
    if (!this.options().hit) return [];
    const ev = [this.#give(this.active)];
    const v = handValue(this.hand.cards);
    if (v.bust) {
      ev.push({ type: 'bust', hand: this.active });
      this.hand.done = true;
      return [...ev, ...this.#next()];
    }
    if (v.total === 21) {
      this.hand.done = true;
      return [...ev, ...this.#next()];
    }
    return ev;
  }

  stand() {
    if (!this.options().stand) return [];
    this.hand.done = true;
    return this.#next();
  }

  double() {
    if (!this.options().double) return [];
    const h = this.hand;
    h.bet *= 2;
    h.doubled = true;
    const ev = [{ type: 'double', hand: this.active }, this.#give(this.active)];
    if (handValue(h.cards).bust) ev.push({ type: 'bust', hand: this.active });
    h.done = true;
    return [...ev, ...this.#next()];
  }

  split() {
    if (!this.options().split) return [];
    const h = this.hand;
    const moved = h.cards.pop();
    const nh = { cards: [moved], bet: h.bet, done: false, doubled: false, split: true };
    h.split = true;
    this.hands.splice(this.active + 1, 0, nh);
    const ev = [{ type: 'split', hand: this.active + 1, card: moved }];
    const aces = moved.r === 'A';
    ev.push(this.#give(this.active));
    if (aces) {
      // Ases divididos: una sola carta en cada mano
      h.done = true;
      ev.push(this.#give(this.active + 1));
      nh.done = true;
      return [...ev, ...this.#next()];
    }
    if (handValue(h.cards).total === 21) {
      h.done = true;
      return [...ev, ...this.#next()];
    }
    ev.push({ type: 'turn', hand: this.active });
    return ev;
  }

  // ------------------------------------------------------------------ interno

  #give(handIndex) {
    const h = this.hands[handIndex];
    const card = this.shoe.draw();
    h.cards.push(card);
    return { type: 'card', to: 'player', hand: handIndex, index: h.cards.length - 1, card };
  }

  #giveDealer(hidden) {
    const card = this.shoe.draw();
    this.dealer.cards.push(card);
    return { type: 'card', to: 'dealer', hand: 0, index: this.dealer.cards.length - 1, card, hidden };
  }

  #reveal() {
    this.dealer.hidden = false;
    return { type: 'reveal', card: this.dealer.cards[1] };
  }

  /** Pasa a la siguiente mano pendiente o, si no queda ninguna, juega la banca. */
  #next() {
    const i = this.hands.findIndex((h) => !h.done);
    if (i >= 0) {
      this.active = i;
      // segunda mano tras dividir: recibe su segunda carta al empezar
      const ev = [];
      if (this.hands[i].cards.length < 2) {
        ev.push(this.#give(i));
        if (handValue(this.hands[i].cards).total === 21) {
          this.hands[i].done = true;
          return [...ev, ...this.#next()];
        }
      }
      ev.push({ type: 'turn', hand: i });
      return ev;
    }
    return this.#finish(true);
  }

  #finish(dealerPlays) {
    const ev = [];
    if (this.dealer.hidden) ev.push(this.#reveal());
    const alive = this.hands.some((h) => !handValue(h.cards).bust);
    if (dealerPlays && alive) {
      for (;;) {
        const v = handValue(this.dealer.cards);
        if (v.total > 17 || (v.total === 17 && (!v.soft || this.rules.dealerStandsSoft17))) break;
        ev.push(this.#giveDealer(false));
      }
      if (handValue(this.dealer.cards).bust) ev.push({ type: 'bust', hand: -1 });
    }
    this.phase = 'done';
    this.results = this.#settle();
    ev.push({ type: 'end' });
    return ev;
  }

  #settle() {
    const d = handValue(this.dealer.cards);
    const dealerBJ = isNatural(this.dealer.cards);
    const hands = this.hands.map((h) => {
      const v = handValue(h.cards);
      const natural = !h.split && isNatural(h.cards) && this.hands.length === 1;
      let outcome;
      let payout;
      if (v.bust) [outcome, payout] = ['bust', 0];
      else if (natural && !dealerBJ) [outcome, payout] = ['blackjack', Math.round(h.bet * (1 + this.rules.blackjackPays))];
      else if (natural && dealerBJ) [outcome, payout] = ['push', h.bet];
      else if (dealerBJ) [outcome, payout] = ['lose', 0];
      else if (d.bust || v.total > d.total) [outcome, payout] = ['win', h.bet * 2];
      else if (v.total === d.total) [outcome, payout] = ['push', h.bet];
      else [outcome, payout] = ['lose', 0];
      return { outcome, payout, bet: h.bet, total: v.total };
    });
    const staked = hands.reduce((s, h) => s + h.bet, 0);
    const payout = hands.reduce((s, h) => s + h.payout, 0);
    const rank = { blackjack: 4, win: 3, push: 2, lose: 1, bust: 0 };
    const best = hands.reduce((a, h) => (rank[h.outcome] > rank[a.outcome] ? h : a), hands[0]);
    let outcome;
    if (staked > 0) outcome = payout > staked ? 'win' : payout === staked ? 'push' : 'lose';
    else outcome = best.outcome === 'blackjack' || best.outcome === 'win' ? 'win' : best.outcome === 'push' ? 'push' : 'lose'; // práctica
    return { hands, staked, payout, net: payout - staked, outcome, blackjack: hands.some((h) => h.outcome === 'blackjack'), dealer: d.total, dealerBust: d.bust };
  }
}
