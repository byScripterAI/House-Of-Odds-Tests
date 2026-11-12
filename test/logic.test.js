import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';
import { EventBus } from '../src/core/event-bus.js';
import { computeLoadout, UPGRADES } from '../src/data/upgrades.js';
import { OBJECTIVES, ACHIEVEMENTS } from '../src/data/progression.js';
import { SYMBOLS } from '../src/data/symbols.js';
import { BETS, MIN_BET, PAYTABLE, betSteps, clampBet, evaluateSpin, maxBet, resolveSpin, stepBet } from '../src/machines/slot-logic.js';
import { PURCHASE_RESERVE, Progress, freshState, normalizeState } from '../src/systems/progress.js';

const L0 = computeLoadout([]);

test('datos: los requisitos de las mejoras apuntan a mejoras que existen y no hay ciclos', () => {
  for (const u of Object.values(UPGRADES)) {
    assert.ok(u.cost > 0, u.id);
    for (const r of u.requires.upgrades ?? []) assert.ok(Object.hasOwn(UPGRADES, r), `${u.id} requiere ${r}`);
  }
  const visiting = new Set();
  const visit = (id) => {
    assert.ok(!visiting.has(id), `ciclo en ${id}`);
    visiting.add(id);
    for (const r of UPGRADES[id].requires.upgrades ?? []) visit(r);
    visiting.delete(id);
  };
  Object.keys(UPGRADES).forEach(visit);
});

test('datos: ids únicos y logros/objetivos coherentes', () => {
  assert.equal(new Set(OBJECTIVES.map((o) => o.id)).size, OBJECTIVES.length);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const o of OBJECTIVES) assert.ok(o.target > 0 && o.reward > 0);
});

test('ECONOMÍA: cada tirada paga 0 (perder), ≤ apuesta (recuperar) o más (ganar); nada negativo', () => {
  const rng = new Rng(2026);
  const loadouts = [L0, computeLoadout(['mod-wild-star', 'syn-royal', 'mod-gilded-reels', 'mod-lucky-bell', 'install-register', 'install-vault'])];
  const seen = new Set();
  for (const loadout of loadouts) {
    for (let i = 0; i < 100000; i++) {
      const bet = BETS[i % 4];
      const r = resolveSpin(rng, loadout, bet);
      assert.equal(r.bet, bet);
      assert.ok(r.payout >= 0 && Number.isInteger(r.payout));
      assert.equal(r.net, r.payout - r.bet);
      assert.equal(r.outcome, r.payout === 0 ? 'lose' : r.payout <= r.bet ? 'push' : 'win');
      assert.ok(r.prestige >= 1);
      seen.add(r.outcome);
    }
  }
  assert.deepEqual([...seen].sort(), ['lose', 'push', 'win'], 'existen los tres desenlaces');
});

test('retorno de THE CLASSIC base: amable pero no una imprenta (≈ 100–108 %)', () => {
  const rng = new Rng(11);
  let paid = 0;
  let staked = 0;
  for (let i = 0; i < 300000; i++) {
    const r = resolveSpin(rng, L0, 10);
    paid += r.payout;
    staked += r.bet;
  }
  const rtp = paid / staked;
  assert.ok(rtp > 0.98 && rtp < 1.09, `RTP ${rtp.toFixed(3)}`);
});

test('la Estrella solo aparece si está desbloqueada', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 20000; i++) assert.ok(!resolveSpin(rng, L0, 5).symbols.includes('star'));
  const withStar = computeLoadout(['mod-wild-star']);
  let seenStar = false;
  for (let i = 0; i < 40000; i++) if (resolveSpin(rng, withStar, 5).symbols.includes('star')) seenStar = true;
  assert.ok(seenStar);
});

test('tabla de pagos determinista: pareja baja/alta, trío, bote, comodín y sinergia', () => {
  const s = (sym, l = L0, bet = 10) => evaluateSpin(sym, l, bet);
  assert.deepEqual([s(['cherry', 'bell', 'diamond']).payout, s(['cherry', 'bell', 'diamond']).outcome], [0, 'lose']);
  assert.deepEqual([s(['cherry', 'cherry', 'bell']).payout, s(['cherry', 'cherry', 'bell']).outcome], [10, 'push']);
  assert.deepEqual([s(['crown', 'crown', 'bell']).payout, s(['crown', 'crown', 'bell']).outcome], [20, 'win']);
  assert.equal(s(['bell', 'bell', 'bell']).payout, 10 * PAYTABLE.bell);
  const jackpot = s(['seven', 'seven', 'seven'], L0, 100);
  assert.deepEqual([jackpot.payout, jackpot.tier], [100 * PAYTABLE.seven, 'jackpot']);
  const wild = computeLoadout(['mod-wild-star']);
  assert.deepEqual(s(['star', 'crown', 'crown'], wild).effects, ['wild', 'triple']);
  assert.equal(s(['star', 'star', 'star'], wild).payout, 10 * PAYTABLE.star);
  const royal = computeLoadout(['mod-wild-star', 'syn-royal']);
  assert.ok(s(['crown', 'diamond', 'cherry'], royal).effects.includes('synergy-royal'));
  assert.equal(s(['crown', 'diamond', 'cherry'], L0, 100).payout, 0, 'sin la mejora no hay sinergia');
  assert.equal(s(['crown', 'diamond', 'cherry'], royal, 100).payout, 25);
  // los multiplicadores suben el PRESTIGE, no el pago
  const mult = computeLoadout(['mod-gilded-reels', 'mod-lucky-bell']);
  assert.equal(s(['crown', 'crown', 'bell'], mult).payout, s(['crown', 'crown', 'bell']).payout);
  assert.ok(s(['crown', 'crown', 'bell'], mult).prestige > s(['crown', 'crown', 'bell']).prestige);
});

test('apuestas: escalones, máximo según instalaciones, ajuste al saldo', () => {
  assert.equal(maxBet(L0), 100);
  assert.equal(maxBet(computeLoadout(['install-register'])), 250);
  assert.equal(maxBet(computeLoadout(['install-register', 'install-vault'])), 500);
  assert.deepEqual(betSteps(L0), [5, 10, 25, 50, 100]);
  assert.equal(clampBet(1000, L0), 100);
  assert.equal(clampBet(30, L0), 25);
  assert.equal(clampBet(100, L0, 60), 50, 'no se puede apostar más de lo que tienes');
  assert.equal(clampBet(100, L0, 2), MIN_BET);
  assert.equal(stepBet(25, +1, L0), 50);
  assert.equal(stepBet(100, +1, L0), 100);
  assert.equal(stepBet(5, -1, L0), 5);
});

// ---------- Progress ----------

test('comprar: fondos, reserva, requisitos, dobles compras y prestigio', () => {
  const p = new Progress();
  assert.equal(p.canBuy('lighting-1').reason, 'marks');
  p.state.marks = 252;
  assert.equal(p.canBuy('lighting-1').reason, 'reserve', 'no puedes quedarte sin poder apostar');
  p.state.marks = 1000;
  assert.equal(p.canBuy('lighting-2').reason, 'prestige');
  assert.equal(p.canBuy('nope').reason, 'unknown');
  assert.equal(p.canBuy('__proto__').reason, 'unknown');
  assert.ok(p.buy('lighting-1').ok);
  assert.equal(p.marks, 750);
  assert.ok(p.marks >= PURCHASE_RESERVE);
  assert.equal(p.prestige > 0, true);
  assert.equal(p.canBuy('lighting-1').reason, 'owned');
  assert.equal(p.buy('lighting-1').ok, false);
  assert.equal(p.marks, 750, 'una compra fallida no cobra');
});

test('recordSpin cobra la apuesta, paga el premio, descubre colección y rechaza resultados inválidos', () => {
  const bus = new EventBus();
  const events = [];
  for (const e of ['marks:changed', 'collection:discovered', 'objective:completed', 'achievement:unlocked']) bus.on(e, (x) => events.push([e, x]));
  const p = new Progress(bus);
  p.state.marks = 100;
  p.recordSpin(evaluateSpin(['cherry', 'bell', 'diamond'], L0, 25));
  assert.equal(p.marks, 75, 'perder cuesta la apuesta');
  p.recordSpin(evaluateSpin(['cherry', 'cherry', 'bell'], L0, 25));
  assert.equal(p.marks, 75, 'pareja baja: recuperas la apuesta');
  p.recordSpin(evaluateSpin(['crown', 'crown', 'bell'], L0, 25));
  assert.equal(p.marks, 100, 'pareja alta: ×2');
  p.recordSpin(evaluateSpin(['cherry', 'bell', 'diamond'], L0, 25), { free: true });
  assert.equal(p.marks, 100, 'tirada invitada: no cuesta');
  assert.equal(p.state.stats.totalActivations, 4);
  assert.ok(p.state.collection.effects.includes('pair'));
  assert.ok(p.state.achievements.includes('first-spin'));
  assert.ok(events.some(([e]) => e === 'achievement:unlocked'));
  assert.throws(() => p.recordSpin({ bet: 10, payout: -1, net: -11, symbols: [], effects: [] }));
  assert.throws(() => p.recordSpin({ bet: 0, payout: 0, net: 0, symbols: [], effects: [] }));
  assert.throws(() => p.recordSpin(null));
  p.state.marks = 3;
  assert.throws(() => p.recordSpin(evaluateSpin(['cherry', 'bell', 'diamond'], L0, 5)), /insuficiente/);
});

test('la apuesta se recuerda y se ajusta al equipamiento', () => {
  const p = new Progress();
  assert.equal(p.bet, MIN_BET);
  assert.equal(p.setBet(50), 50);
  assert.equal(p.setBet(9999), 100);
  const copy = new Progress(null, JSON.parse(JSON.stringify(p.toJSON())));
  assert.equal(copy.bet, 100);
});

test('objetivos: se completan una sola vez y pagan su recompensa', () => {
  const p = new Progress();
  p.state.marks = 1000;
  const lose = evaluateSpin(['cherry', 'bell', 'diamond'], L0, 5);
  for (let i = 0; i < 5; i++) p.recordSpin(lose);
  assert.ok(p.state.objectives.completed.includes('first-steps'));
  const marksAfter = p.marks;
  p.recordSpin(lose);
  assert.equal(p.state.objectives.completed.filter((x) => x === 'first-steps').length, 1);
  assert.equal(p.marks, marksAfter - 5);
});

test('normalizeState sanea basura y ids desconocidos; toJSON → constructor conserva todo', () => {
  const s = normalizeState({ marks: -5, prestige: 'x', upgrades: ['lighting-1', 'fake', 'lighting-1'], achievements: ['nope'], collection: { symbols: ['cherry', 'zz'] } });
  assert.equal(s.marks, 0);
  assert.equal(s.prestige, 0);
  assert.deepEqual(s.upgrades, ['lighting-1']);
  assert.deepEqual(s.collection.symbols, ['cherry']);
  assert.deepEqual(normalizeState(undefined), freshState());

  const p = new Progress();
  const rng = new Rng(5);
  p.state.marks = 5000;
  for (let i = 0; i < 60; i++) p.recordSpin(resolveSpin(rng, p.loadout(), 10));
  p.buy('mod-gilded-reels');
  const copy = new Progress(null, JSON.parse(JSON.stringify(p.toJSON())));
  assert.deepEqual(copy.toJSON(), p.toJSON());
});

test('los 6 símbolos existen y tienen valores positivos', () => {
  assert.equal(Object.keys(SYMBOLS).length, 6);
  for (const s of Object.values(SYMBOLS)) assert.ok(s.value > 0 && s.weight > 0);
});

test('director de suerte: los desafíos ni se regalan ni se eternizan', async () => {
  const { Rng } = await import('../src/core/rng.js');
  const { computeLoadout } = await import('../src/data/upgrades.js');
  const { LUCK_PLAN, TIER_RANK, luckDecision, resolveBalancedSpin, nextLuckState } = await import('../src/systems/luck-director.js');
  const loadout = computeLoadout([]);
  // tope de mala suerte: llegado al tope, el premio sale seguro
  for (const tier of ['small', 'big', 'jackpot']) assert.equal(luckDecision(tier, LUCK_PLAN[tier].pityAt - 1, 0.999), 'help');
  // simulación: tiradas hasta conseguir un trío con y sin director
  const run = (balanced, seed) => {
    const rng = new Rng(seed);
    let luck = { key: '', spins: 0 };
    for (let i = 1; i <= 400; i++) {
      const challenge = balanced ? { tier: 'big', spins: luck.spins } : null;
      const { result } = resolveBalancedSpin(rng, loadout, 10, challenge);
      luck = nextLuckState(luck, 'x01:combo');
      assert.equal(result.net, result.payout - result.bet, 'las tiradas forzadas pagan lo normal');
      if (TIER_RANK[result.tier] >= TIER_RANK.big) return i;
    }
    return 400;
  };
  const tries = Array.from({ length: 300 }, (_, k) => run(true, 1000 + k));
  const natural = Array.from({ length: 300 }, (_, k) => run(false, 1000 + k));
  assert.ok(Math.max(...tries) <= LUCK_PLAN.big.pityAt, 'nunca pasa del tope');
  const early = tries.filter((n) => n <= LUCK_PLAN.big.hinderUntil).length / tries.length;
  const earlyNatural = natural.filter((n) => n <= LUCK_PLAN.big.hinderUntil).length / natural.length;
  assert.ok(early < earlyNatural, 'al principio frena: menos tríos regalados que por puro azar');
  const avg = tries.reduce((a, b) => a + b, 0) / tries.length;
  assert.ok(avg >= 6 && avg <= 14, `media equilibrada (${avg.toFixed(1)} tiradas)`);
  assert.ok(Math.max(...natural) > LUCK_PLAN.big.pityAt, 'sin director habría rachas eternas');
});
