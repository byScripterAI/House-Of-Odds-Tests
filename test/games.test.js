import test from 'node:test';
import assert from 'node:assert/strict';
import { Shoe, parseCard, cardPoints } from '../src/games/cards.js';
import { BlackjackRound, handValue, isNatural } from '../src/games/blackjack.js';
import { WHEEL, RED_NUMBERS, covers, paysOf, settleRoulette, isBetKey, spinNumber, colorOf, totalBets } from '../src/games/roulette.js';
import { Rng } from '../src/core/rng.js';

const H = (...c) => c.map(parseCard);

// ------------------------------------------------------------------ cartas

test('zapato: 6 barajas completas, barajado reproducible y rebarajado', () => {
  const a = new Shoe(new Rng(1), 6);
  const b = new Shoe(new Rng(1), 6);
  assert.equal(a.remaining, 312);
  assert.deepEqual(a.cards.slice(0, 20), b.cards.slice(0, 20));
  const ids = new Map();
  for (const c of a.cards) ids.set(`${c.r}${c.s}`, (ids.get(`${c.r}${c.s}`) ?? 0) + 1);
  assert.equal(ids.size, 52);
  for (const n of ids.values()) assert.equal(n, 6);
  while (!a.needsShuffle) a.draw();
  assert.ok(a.remaining < 312 * 0.25);
  for (let i = 0; i < 400; i++) a.draw(); // nunca se queda sin cartas
  assert.ok(a.shuffles >= 2);
});

test('valores de mano: ases blandos y duros', () => {
  assert.deepEqual(handValue(H('AS', 'KD')), { total: 21, soft: true, bust: false });
  assert.deepEqual(handValue(H('AS', '6D', '9C')), { total: 16, soft: false, bust: false });
  assert.deepEqual(handValue(H('AS', 'AD')), { total: 12, soft: true, bust: false });
  assert.deepEqual(handValue(H('KS', 'QD', '2C')), { total: 22, soft: false, bust: true });
  assert.equal(cardPoints(parseCard('JH')), 10);
  assert.ok(isNatural(H('AS', '10H')));
  assert.ok(!isNatural(H('5S', '6H', '10D')));
  assert.throws(() => parseCard('1X'));
});

// ------------------------------------------------------------------ blackjack

/** Orden de reparto: J1, B1, J2, B2(oculta), luego lo que se pida. */
const round = (cards, bet = 10) => new BlackjackRound({ shoe: Shoe.stacked(cards), bet });

test('blackjack natural paga 3 a 2 y termina la mano', () => {
  const r = round(['AS', '9D', 'KH', '7C']);
  const ev = r.deal();
  assert.equal(r.phase, 'done');
  assert.ok(ev.some((e) => e.type === 'blackjack' && e.who === 'player'));
  assert.equal(r.results.hands[0].outcome, 'blackjack');
  assert.equal(r.results.payout, 25);
  assert.equal(r.results.net, 15);
});

test('la banca revisa con As a la vista: su blackjack gana al momento', () => {
  const r = round(['9S', 'AD', 'KH', 'QC']);
  r.deal();
  assert.equal(r.phase, 'done');
  assert.equal(r.results.outcome, 'lose');
  assert.equal(r.results.payout, 0);
  // ambos blackjack: empate
  const r2 = round(['AS', 'AD', 'KH', 'QC']);
  r2.deal();
  assert.equal(r2.results.hands[0].outcome, 'push');
  assert.equal(r2.results.payout, 10);
});

test('pedir, pasarse y la banca no roba si todas las manos se pasaron', () => {
  const r = round(['10S', '6D', '5H', '9C', 'KD', '2S']);
  r.deal();
  assert.equal(r.phase, 'player');
  const ev = r.hit(); // 10+5+K = 25
  assert.ok(ev.some((e) => e.type === 'bust'));
  assert.ok(ev.some((e) => e.type === 'reveal'));
  assert.equal(r.phase, 'done');
  assert.equal(r.dealer.cards.length, 2);
  assert.equal(r.results.outcome, 'lose');
});

test('plantarse: la banca pide hasta 17 y se planta en 17 blando', () => {
  const r = round(['10S', '6D', '9H', 'AC', 'KD']); // banca 6+A = 17 blando → se planta
  r.deal();
  r.stand();
  assert.equal(r.dealer.cards.length, 2);
  assert.equal(r.results.dealer, 17);
  assert.equal(r.results.hands[0].outcome, 'win');
  assert.equal(r.results.payout, 20);
  const r2 = round(['10S', '6D', '8H', '9C', '5D', 'KS']); // banca 6+9=15 → 5 → 20
  r2.deal();
  r2.stand();
  assert.equal(r2.results.dealer, 20);
  assert.equal(r2.results.outcome, 'lose');
});

test('banca se pasa: gana cualquier mano viva; empate devuelve la apuesta', () => {
  const r = round(['10S', '6D', '2H', '9C', 'KD']);
  r.deal();
  r.stand();
  assert.ok(r.results.dealerBust);
  assert.equal(r.results.outcome, 'win');
  const p = round(['10S', '10D', '8H', '8C']);
  p.deal();
  p.stand();
  assert.equal(p.results.outcome, 'push');
  assert.equal(p.results.net, 0);
});

test('doblar: una carta, apuesta doble y la mano se cierra', () => {
  const r = round(['6S', '9D', '5H', '7C', 'KD', '10S']);
  r.deal();
  assert.deepEqual(r.options(), { hit: true, stand: true, double: true, split: false });
  assert.equal(r.extraCost, 10);
  r.double();
  assert.equal(r.hands[0].cards.length, 3);
  assert.equal(r.hands[0].bet, 20);
  assert.equal(r.results.staked, 20);
  assert.equal(r.results.hands[0].total, 21);
  assert.equal(r.results.payout, 40);
  // no se puede doblar con tres cartas
  const r2 = round(['2S', '9D', '3H', '7C', '4D', 'KS']);
  r2.deal();
  r2.hit();
  assert.equal(r2.options().double, false);
});

test('dividir: dos manos, la segunda recibe carta en su turno; máximo una división', () => {
  const r = round(['8S', '9D', '8H', '7C', '3D', 'KS', '10C', '2H']);
  r.deal();
  assert.equal(r.options().split, true);
  const ev = r.split();
  assert.equal(r.hands.length, 2);
  assert.ok(ev.some((e) => e.type === 'split'));
  assert.deepEqual(r.hands[0].cards.map((c) => c.r), ['8', '3']);
  assert.equal(r.options().split, false);
  r.stand(); // mano 1: 11 → se planta (raro, pero válido)
  assert.equal(r.active, 1);
  assert.deepEqual(r.hands[1].cards.map((c) => c.r), ['8', 'K']);
  r.stand(); // mano 2: 18 · banca 9+7=16 → 10 → 26
  assert.equal(r.phase, 'done');
  assert.equal(r.results.staked, 20);
  assert.ok(r.results.dealerBust);
  assert.equal(r.results.payout, 40);
});

test('dividir ases: una carta por mano y 21 no es blackjack', () => {
  const r = round(['AS', '9D', 'AH', '7C', 'KD', 'QS', '2H']);
  r.deal();
  r.split();
  assert.equal(r.phase, 'done');
  assert.equal(r.results.hands[0].outcome, 'win'); // 21 normal, no 3 a 2
  assert.equal(r.results.hands[0].payout, 20);
  assert.equal(r.results.payout, 40);
});

test('mano de práctica (apuesta 0): ni cuesta ni paga pero tiene resultado', () => {
  const r = round(['10S', '6D', '9H', 'AC'], 0);
  r.deal();
  r.stand();
  assert.equal(r.results.staked, 0);
  assert.equal(r.results.payout, 0);
  assert.equal(r.results.outcome, 'win');
});

test('acciones fuera de turno no hacen nada', () => {
  const r = round(['AS', '9D', 'KH', '7C']);
  assert.deepEqual(r.hit(), []);
  r.deal();
  assert.deepEqual(r.hit(), []);
  assert.deepEqual(r.split(), []);
  assert.deepEqual(r.deal(), []);
});

test('blackjack: retorno de una estrategia simple en un rango realista', () => {
  const rng = new Rng(2024);
  const shoe = new Shoe(rng, 6);
  let staked = 0;
  let paid = 0;
  for (let i = 0; i < 20000; i++) {
    if (shoe.needsShuffle) shoe.shuffle();
    const r = new BlackjackRound({ shoe, bet: 10 });
    r.deal();
    while (r.phase === 'player') {
      const v = handValue(r.hand.cards);
      const up = handValue([r.dealer.cards[0]]).total;
      if (r.options().double && (v.total === 11 || (v.total === 10 && up < 10))) r.double();
      else if (v.total < 12 || (v.total < 17 && up >= 7) || (v.soft && v.total < 18)) r.hit();
      else r.stand();
    }
    staked += r.results.staked;
    paid += r.results.payout;
  }
  const rtp = paid / staked;
  assert.ok(rtp > 0.95 && rtp < 1.02, `RTP ${rtp}`);
});

// ------------------------------------------------------------------ ruleta

test('ruleta: rueda europea completa y colores correctos', () => {
  assert.equal(WHEEL.length, 37);
  assert.deepEqual([...WHEEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(RED_NUMBERS.size, 18);
  assert.equal(colorOf(0), 'green');
  assert.equal(colorOf(32), 'red');
  assert.equal(colorOf(15), 'black');
  // en la rueda se alternan rojo y negro
  for (let i = 1; i < 36; i++) assert.notEqual(colorOf(WHEEL[i]), colorOf(WHEEL[i + 1]));
});

test('ruleta: cobertura y pagos de cada apuesta', () => {
  assert.ok(isBetKey('n:0') && isBetKey('dozen:3') && isBetKey('col:1') && isBetKey('red'));
  assert.ok(!isBetKey('n:37') && !isBetKey('dozen:4') && !isBetKey('blue'));
  assert.equal(paysOf('n:17'), 35);
  assert.equal(paysOf('dozen:2'), 2);
  assert.equal(paysOf('even'), 1);
  assert.ok(covers('col:1', 34) && covers('col:2', 35) && covers('col:3', 36));
  assert.ok(covers('dozen:1', 12) && covers('dozen:2', 13) && covers('dozen:3', 36));
  assert.ok(covers('low', 18) && covers('high', 19));
  for (const k of ['red', 'black', 'even', 'odd', 'low', 'high', 'dozen:1', 'col:1']) assert.ok(!covers(k, 0), k);
  assert.ok(covers('n:0', 0));
  for (let n = 1; n <= 36; n++) {
    assert.equal(covers('red', n), !covers('black', n));
    assert.equal(covers('even', n), !covers('odd', n));
    assert.equal(['col:1', 'col:2', 'col:3'].filter((k) => covers(k, n)).length, 1);
    assert.equal(['dozen:1', 'dozen:2', 'dozen:3'].filter((k) => covers(k, n)).length, 1);
  }
});

test('ruleta: liquidación con varias apuestas', () => {
  const r = settleRoulette({ 'n:17': 5, black: 10, 'dozen:2': 10, red: 10 }, 17);
  assert.equal(r.staked, 35);
  assert.equal(r.payout, 5 * 36 + 20 + 30);
  assert.equal(r.outcome, 'win');
  assert.ok(r.straight);
  const z = settleRoulette({ red: 10, black: 10 }, 0);
  assert.equal(z.payout, 0);
  assert.equal(z.outcome, 'lose');
  const push = settleRoulette({ red: 10, black: 10 }, 1);
  assert.equal(push.outcome, 'push');
  assert.equal(totalBets({ red: 10, 'n:3': 5, junk: -4 }), 15);
  assert.equal(settleRoulette({ junk: 50 }, 3).staked, 0);
});

test('ruleta: ventaja de la casa del 2,7 % (valor esperado exacto)', () => {
  for (const key of ['n:7', 'red', 'odd', 'high', 'dozen:3', 'col:2']) {
    let ret = 0;
    for (const n of WHEEL) ret += settleRoulette({ [key]: 1 }, n).payout;
    assert.ok(Math.abs(ret / 37 - 36 / 37) < 1e-9, key);
  }
  const rng = new Rng(9);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(spinNumber(rng));
  assert.equal(seen.size, 37);
});
