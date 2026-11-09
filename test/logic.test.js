import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';
import { EventBus } from '../src/core/event-bus.js';
import { computeLoadout, UPGRADES } from '../src/data/upgrades.js';
import { OBJECTIVES, ACHIEVEMENTS } from '../src/data/progression.js';
import { SYMBOLS } from '../src/data/symbols.js';
import { BASE_REWARD, evaluate, resolveActivation } from '../src/machines/slot-logic.js';
import { Progress, freshState, normalizeState } from '../src/systems/progress.js';

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

test('INVARIANTE: 300.000 activaciones nunca restan y siempre dan reward = base + bonus con base > 0', () => {
  const rng = new Rng(2026);
  const loadouts = [
    L0,
    computeLoadout(['mod-wild-star', 'syn-royal', 'mod-gilded-reels', 'mod-lucky-bell', 'install-register', 'install-vault']),
  ];
  for (const loadout of loadouts) {
    for (let i = 0; i < 150000; i++) {
      const r = resolveActivation(rng, loadout);
      assert.ok(r.base > 0 && r.bonus >= 0 && r.reward === r.base + r.bonus && r.reward >= r.base);
      assert.equal(r.symbols.length, 3);
    }
  }
});

test('la Estrella solo aparece si está desbloqueada', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 20000; i++) assert.ok(!resolveActivation(rng, L0).symbols.includes('star'));
  const withStar = computeLoadout(['mod-wild-star']);
  let seen = false;
  for (let i = 0; i < 20000; i++) if (resolveActivation(rng, withStar).symbols.includes('star')) seen = true;
  assert.ok(seen);
});

test('puntuación determinista: pareja, trío, jackpot, comodín y sinergia', () => {
  assert.equal(evaluate(['cherry', 'bell', 'diamond'], L0).bonus, 0);
  assert.equal(evaluate(['cherry', 'cherry', 'bell'], L0).bonus, 4);
  assert.equal(evaluate(['bell', 'bell', 'bell'], L0).bonus, 30);
  const jackpot = evaluate(['seven', 'seven', 'seven'], L0);
  assert.deepEqual([jackpot.bonus, jackpot.tier], [120, 'jackpot']);
  const wild = computeLoadout(['mod-wild-star']);
  assert.deepEqual(evaluate(['star', 'crown', 'crown'], wild).effects, ['wild', 'triple']);
  assert.equal(evaluate(['star', 'star', 'star'], wild).bonus, 150);
  const royal = computeLoadout(['mod-wild-star', 'syn-royal']);
  assert.equal(evaluate(['crown', 'diamond', 'cherry'], royal).bonus, 12);
  assert.equal(evaluate(['crown', 'diamond', 'cherry'], L0).bonus, 0, 'sin la mejora no hay sinergia');
  const mult = computeLoadout(['mod-gilded-reels']);
  assert.equal(evaluate(['cherry', 'cherry', 'bell'], mult).bonus, 5); // 4 × 1,25
  assert.equal(evaluate(['cherry', 'bell', 'diamond'], L0).base, BASE_REWARD);
});

test('las mejoras de base se suman al pago', () => {
  assert.equal(evaluate(['cherry', 'bell', 'diamond'], computeLoadout(['install-register'])).base, BASE_REWARD + 2);
});

// ---------- Progress ----------

test('comprar: fondos, requisitos, dobles compras y prestigio', () => {
  const p = new Progress();
  assert.equal(p.canBuy('lighting-1').reason, 'marks');
  p.state.marks = 1000;
  assert.equal(p.canBuy('lighting-2').reason, 'prestige');
  assert.equal(p.canBuy('nope').reason, 'unknown');
  assert.equal(p.canBuy('__proto__').reason, 'unknown');
  assert.ok(p.buy('lighting-1').ok);
  assert.equal(p.marks, 940);
  assert.equal(p.prestige > 0, true);
  assert.equal(p.canBuy('lighting-1').reason, 'owned');
  assert.equal(p.buy('lighting-1').ok, false);
  assert.equal(p.marks, 940, 'una compra fallida no cobra');
});

test('recordActivation suma MARKS/estadísticas, descubre colección y rechaza resultados inválidos', () => {
  const bus = new EventBus();
  const events = [];
  for (const e of ['marks:changed', 'collection:discovered', 'objective:completed', 'achievement:unlocked']) bus.on(e, (x) => events.push([e, x]));
  const p = new Progress(bus);
  p.recordActivation(evaluate(['cherry', 'cherry', 'bell'], L0));
  assert.ok(p.marks >= 10 + 4, 'al menos base + pareja');
  assert.equal(p.state.stats.totalActivations, 1);
  assert.deepEqual(p.state.collection.symbols.sort(), ['bell', 'cherry']);
  assert.ok(p.state.collection.effects.includes('pair'));
  assert.ok(p.state.achievements.includes('first-spin'));
  assert.ok(events.some(([e]) => e === 'achievement:unlocked'));
  assert.throws(() => p.recordActivation({ base: 10, bonus: -1, reward: 9, symbols: [], effects: [] }));
  assert.throws(() => p.recordActivation({ base: 0, bonus: 0, reward: 0, symbols: [], effects: [] }));
  assert.throws(() => p.recordActivation(null));
});

test('los MARKS nunca bajan por jugar (simulación con semilla)', () => {
  const p = new Progress();
  const rng = new Rng(99);
  let last = 0;
  for (let i = 0; i < 5000; i++) {
    p.recordActivation(resolveActivation(rng, p.loadout()));
    assert.ok(p.marks >= last);
    last = p.marks;
  }
});

test('objetivos: se completan una sola vez y pagan su recompensa', () => {
  const p = new Progress();
  const base = evaluate(['cherry', 'bell', 'diamond'], L0);
  for (let i = 0; i < 5; i++) p.recordActivation(base);
  assert.ok(p.state.objectives.completed.includes('first-steps'));
  const marksAfter = p.marks;
  p.recordActivation(base);
  assert.equal(p.state.objectives.completed.filter((x) => x === 'first-steps').length, 1);
  assert.equal(p.marks, marksAfter + base.reward);
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
  for (let i = 0; i < 60; i++) p.recordActivation(resolveActivation(rng, p.loadout()));
  p.state.marks += 500;
  p.buy('mod-gilded-reels');
  const copy = new Progress(null, JSON.parse(JSON.stringify(p.toJSON())));
  assert.deepEqual(copy.toJSON(), p.toJSON());
});

test('los 6 símbolos existen y tienen valores positivos', () => {
  assert.equal(Object.keys(SYMBOLS).length, 6);
  for (const s of Object.values(SYMBOLS)) assert.ok(s.value > 0 && s.weight > 0);
});
