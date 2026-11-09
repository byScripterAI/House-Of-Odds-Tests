import { UPGRADES, computeLoadout } from '../data/upgrades.js';
import { OBJECTIVES, ACHIEVEMENTS } from '../data/progression.js';
import { SYMBOLS, EFFECTS } from '../data/symbols.js';

/**
 * Estado de progreso del jugador: MARKS, PRESTIGE, COLLECTION, mejoras,
 * objetivos y logros. Módulo puro: emite eventos en el bus si se le da uno.
 *
 * Los MARKS solo suben al jugar y solo bajan al comprar una mejora.
 */

const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const known = (arr, valid) => (Array.isArray(arr) ? [...new Set(arr.filter(valid))] : []);

export function freshState() {
  return normalizeState(null);
}

/** Convierte cualquier entrada (guardado antiguo/corrupto incluido) en un estado válido. */
export function normalizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const m = r.machines?.classic ?? {};
  return {
    marks: int(r.marks),
    marksEarned: int(r.marksEarned),
    prestige: int(r.prestige),
    upgrades: known(r.upgrades, (id) => Object.hasOwn(UPGRADES, id)),
    machines: { classic: { activations: int(m.activations), bestScore: int(m.bestScore) } },
    collection: {
      symbols: known(r.collection?.symbols, (id) => Object.hasOwn(SYMBOLS, id)),
      effects: known(r.collection?.effects, (id) => Object.hasOwn(EFFECTS, id)),
      machines: ['classic'],
    },
    objectives: { completed: known(r.objectives?.completed, (id) => OBJECTIVES.some((o) => o.id === id)) },
    achievements: known(r.achievements, (id) => ACHIEVEMENTS.some((a) => a.id === id)),
    stats: { playTimeSec: int(r.stats?.playTimeSec), totalActivations: int(r.stats?.totalActivations) },
    zones: ['main_floor'],
    tutorials: Array.isArray(r.tutorials) ? [...new Set(r.tutorials.filter((t) => typeof t === 'string' && t.length <= 40))].slice(0, 60) : [],
  };
}

export class Progress {
  #bus;
  state;

  constructor(bus = null, raw = null) {
    this.#bus = bus;
    this.state = normalizeState(raw);
  }

  get marks() { return this.state.marks; }
  get prestige() { return this.state.prestige; }
  hasTutorial(id) { return this.state.tutorials.includes(id); }
  markTutorial(id) { if (!this.hasTutorial(id)) this.state.tutorials.push(id); }
  has(upgradeId) { return this.state.upgrades.includes(upgradeId); }
  loadout() { return computeLoadout(this.state.upgrades); }

  metrics() {
    const s = this.state;
    return {
      activations: s.stats.totalActivations,
      marksEarned: s.marksEarned,
      upgradesBought: s.upgrades.length,
      symbolsFound: s.collection.symbols.length,
      decorBought: s.upgrades.filter((id) => UPGRADES[id].group === 'decor').length,
      prestige: s.prestige,
    };
  }

  /** @returns {{ok: boolean, reason?: string, need?: number|string}} */
  canBuy(id) {
    if (!Object.hasOwn(UPGRADES, id)) return { ok: false, reason: 'unknown' };
    const u = UPGRADES[id];
    if (this.has(id)) return { ok: false, reason: 'owned' };
    if ((u.requires.prestige ?? 0) > this.prestige) return { ok: false, reason: 'prestige', need: u.requires.prestige };
    const missing = (u.requires.upgrades ?? []).find((r) => !this.has(r));
    if (missing) return { ok: false, reason: 'requires', need: missing };
    if (this.marks < u.cost) return { ok: false, reason: 'marks', need: u.cost };
    return { ok: true };
  }

  buy(id) {
    const check = this.canBuy(id);
    if (!check.ok) return check;
    const u = UPGRADES[id];
    this.state.marks -= u.cost;
    this.state.upgrades.push(id);
    this.#emit('marks:changed', { marks: this.state.marks, delta: -u.cost });
    this.#addPrestige(Math.max(1, Math.floor(u.cost / 10)));
    this.#emit('upgrade:bought', { id });
    this.#evaluate();
    this.#emit('progress:changed');
    return { ok: true };
  }

  /** Registra el resultado de una activación (ver machines/slot-logic.js). */
  recordActivation(result) {
    if (!result || !(result.base > 0) || !(result.bonus >= 0) || result.reward !== result.base + result.bonus) {
      throw new Error('Resultado de activación inválido (se exige reward = base + bonus, base > 0, bonus ≥ 0)');
    }
    const s = this.state;
    s.marks += result.reward;
    s.marksEarned += result.reward;
    s.stats.totalActivations += 1;
    s.machines.classic.activations += 1;
    s.machines.classic.bestScore = Math.max(s.machines.classic.bestScore, result.reward);
    this.#emit('marks:changed', { marks: s.marks, delta: result.reward });
    this.#addPrestige(1);

    for (const id of result.symbols) this.#discover('symbols', id, SYMBOLS);
    for (const id of result.effects) this.#discover('effects', id, EFFECTS);

    this.#evaluate();
    this.#emit('progress:changed');
  }

  addPlayTime(seconds) {
    if (seconds > 0) this.state.stats.playTimeSec += seconds;
  }

  toJSON() {
    return structuredClone(this.state);
  }

  // ---- internos ----

  #emit(event, payload) {
    this.#bus?.emit(event, payload);
  }

  #addPrestige(n) {
    this.state.prestige += n;
    this.#emit('prestige:changed', { prestige: this.state.prestige, delta: n });
  }

  #discover(kind, id, table) {
    const list = this.state.collection[kind];
    if (!Object.hasOwn(table, id) || list.includes(id)) return;
    list.push(id);
    this.#emit('collection:discovered', { kind, id });
  }

  #achieved(a, metrics) {
    const w = a.when;
    if (w.metric) return metrics[w.metric] >= w.atLeast;
    if (w.effect) return this.state.collection.effects.includes(w.effect);
    if (w.upgrade) return this.has(w.upgrade);
    return false;
  }

  /** Completa objetivos/logros hasta que no cambie nada (las recompensas pueden encadenar). */
  #evaluate() {
    const s = this.state;
    let changed = true;
    while (changed) {
      changed = false;
      const metrics = this.metrics();
      for (const o of OBJECTIVES) {
        if (s.objectives.completed.includes(o.id) || metrics[o.metric] < o.target) continue;
        s.objectives.completed.push(o.id);
        s.marks += o.reward;
        this.#emit('marks:changed', { marks: s.marks, delta: o.reward });
        this.#addPrestige(5);
        this.#emit('objective:completed', { id: o.id, reward: o.reward });
        changed = true;
      }
      for (const a of ACHIEVEMENTS) {
        if (s.achievements.includes(a.id) || !this.#achieved(a, metrics)) continue;
        s.achievements.push(a.id);
        this.#addPrestige(10);
        this.#emit('achievement:unlocked', { id: a.id });
        changed = true;
      }
    }
  }
}
