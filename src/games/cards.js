/**
 * Baraja francesa y zapato de cartas (lógica pura, sin Three.js ni DOM).
 * Carta: {r: 'A'|'2'…'10'|'J'|'Q'|'K', s: 'S'|'H'|'D'|'C'}  (picas, corazones, diamantes, tréboles).
 */

export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
export const RED_SUITS = new Set(['H', 'D']);

/** Puntos de blackjack de una carta (el As cuenta 1; handValue decide si vale 11). */
export function cardPoints(card) {
  if (card.r === 'A') return 1;
  if (card.r === 'J' || card.r === 'Q' || card.r === 'K') return 10;
  return Number(card.r);
}

export const cardId = (c) => `${c.r}${c.s}`;

/** Zapato de N barajas, barajado con el Rng del juego (Fisher-Yates). */
export class Shoe {
  /**
   * @param {{next(): number}} rng
   * @param {number} decks
   * @param {number} reshuffleAt fracción restante por debajo de la cual se rebaraja antes de la mano
   */
  constructor(rng, decks = 6, reshuffleAt = 0.25) {
    this.rng = rng;
    this.decks = Math.max(1, decks | 0);
    this.reshuffleAt = reshuffleAt;
    this.cards = [];
    this.shuffles = 0;
    this.shuffle();
  }

  /** Zapato con un orden fijo (pruebas y demostraciones guionizadas). La primera carta sale primero. */
  static stacked(cards, rng = { next: () => 0 }) {
    const s = Object.create(Shoe.prototype);
    s.rng = rng;
    s.decks = 1;
    s.reshuffleAt = 0;
    s.shuffles = 0;
    s.cards = cards.map((c) => (typeof c === 'string' ? parseCard(c) : { ...c })).reverse();
    s.fixed = true;
    return s;
  }

  get size() {
    return this.decks * 52;
  }

  get remaining() {
    return this.cards.length;
  }

  get needsShuffle() {
    return !this.fixed && this.remaining < this.size * this.reshuffleAt;
  }

  shuffle() {
    const a = [];
    for (let d = 0; d < this.decks; d++) for (const s of SUITS) for (const r of RANKS) a.push({ r, s });
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    this.cards = a;
    this.shuffles += 1;
  }

  draw() {
    if (!this.cards.length) {
      if (this.fixed) throw new Error('Zapato fijo agotado');
      this.shuffle();
    }
    return this.cards.pop();
  }
}

/** 'AS', '10H', 'KD'… → carta. */
export function parseCard(text) {
  const m = /^(A|[2-9]|10|J|Q|K)([SHDC])$/.exec(String(text).trim().toUpperCase());
  if (!m) throw new Error(`Carta inválida: ${text}`);
  return { r: m[1], s: m[2] };
}
