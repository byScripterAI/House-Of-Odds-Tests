import { UPGRADES, computeLoadout } from '../data/upgrades.js';
import { OBJECTIVES, ACHIEVEMENTS } from '../data/progression.js';
import { SYMBOLS, EFFECTS } from '../data/symbols.js';
import { QUESTS } from '../story/quests.js';
import { MIN_BET, clampBet } from '../machines/slot-logic.js';
import { Q, freshStory, normalizeStory } from '../story/quest-engine.js';

/**
 * Estado de progreso del jugador: MARKS, PRESTIGE, COLLECTION, mejoras,
 * objetivos y logros. Módulo puro: emite eventos en el bus si se le da uno.
 *
 * Economía: cada tirada cuesta su apuesta (se puede perder, recuperar o ganar).
 * Comprar exige conservar una RESERVA (la apuesta mínima) para no arruinarte comprando.
 */

/** MARKS que siempre deben quedar tras una compra (para poder seguir jugando). */
export const PURCHASE_RESERVE = MIN_BET;

const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const known = (arr, valid) => (Array.isArray(arr) ? [...new Set(arr.filter(valid))] : []);

export function freshState() {
  return normalizeState(null);
}

/** Convierte cualquier entrada (guardado antiguo/corrupto incluido) en un estado válido. */
export function normalizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const m = r.machines?.classic ?? {};
  const bj = r.tables?.blackjack ?? {};
  const ro = r.tables?.roulette ?? {};
  return {
    marks: int(r.marks),
    marksEarned: int(r.marksEarned),
    prestige: int(r.prestige),
    upgrades: known(r.upgrades, (id) => Object.hasOwn(UPGRADES, id)),
    machines: { classic: { activations: int(m.activations), bestScore: int(m.bestScore) } },
    tables: {
      blackjack: { rounds: int(bj.rounds), wins: int(bj.wins), blackjacks: int(bj.blackjacks), best: int(bj.best) },
      roulette: { rounds: int(ro.rounds), wins: int(ro.wins), best: int(ro.best) },
    },
    collection: {
      symbols: known(r.collection?.symbols, (id) => Object.hasOwn(SYMBOLS, id)),
      effects: known(r.collection?.effects, (id) => Object.hasOwn(EFFECTS, id)),
      machines: ['classic'],
    },
    objectives: { completed: known(r.objectives?.completed, (id) => OBJECTIVES.some((o) => o.id === id)) },
    achievements: known(r.achievements, (id) => ACHIEVEMENTS.some((a) => a.id === id)),
    stats: { playTimeSec: int(r.stats?.playTimeSec), totalActivations: int(r.stats?.totalActivations) },
    zones: ['main_floor'],
    bet: Number.isFinite(r.bet) && r.bet > 0 ? Math.floor(r.bet) : MIN_BET,
    tutorials: Array.isArray(r.tutorials) ? [...new Set(r.tutorials.filter((t) => typeof t === 'string' && t.length <= 40))].slice(0, 60) : [],
    story: normalizeStory(r.story ?? migrateStory(r), QUESTS),
    // director de suerte de los desafíos: tiradas hechas con el objetivo actual
    luck: { key: typeof r.luck?.key === 'string' ? r.luck.key.slice(0, 40) : '', spins: int(r.luck?.spins) },
  };
}

/**
 * Partidas anteriores a la historia (v1.0–v1.1): quien ya jugaba conserva su
 * progreso y entra con las dos primeras misiones hechas (THE CLASSIC ya funciona).
 */
function migrateStory(r) {
  const spins = int(r.stats?.totalActivations);
  if (!spins) return freshStory();
  const done = (id) => ({ s: Q.COMPLETED, i: QUESTS[id].objectives.length, p: { n: 0, seen: [] }, b: 0, r: true, at: spins });
  return { ...freshStory(), quests: { m01: done('m01'), m02: done('m02') }, flags: ['tour_done', 'classic_repaired'], rel: { victoria: 10, daniel: 10 } };
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
    if (this.marks - u.cost < PURCHASE_RESERVE) return { ok: false, reason: 'reserve', need: u.cost + PURCHASE_RESERVE };
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

  /** Apuesta actual de THE CLASSIC (se recuerda entre tiradas y partidas). */
  get bet() {
    return clampBet(this.state.bet, this.loadout());
  }

  setBet(bet) {
    this.state.bet = clampBet(bet, this.loadout());
    return this.state.bet;
  }

  /** ¿Puede pagar la apuesta indicada? */
  canAfford(bet) {
    return this.state.marks >= bet;
  }

  /**
   * Registra una tirada con apuesta (ver machines/slot-logic.js): se descuenta la apuesta y se
   * abona el pago. `free`: tirada invitada (no cuesta nada; el pago sí se cobra).
   */
  recordSpin(result, { free = false } = {}) {
    if (!result || !(result.bet >= MIN_BET) || !(result.payout >= 0) || result.net !== result.payout - result.bet) {
      throw new Error('Resultado de tirada inválido (se exige bet ≥ mínimo, payout ≥ 0 y net = payout − bet)');
    }
    const s = this.state;
    const cost = free ? 0 : result.bet;
    if (s.marks < cost) throw new Error('Saldo insuficiente para la apuesta');
    s.marks += result.payout - cost;
    const gain = result.payout - cost;
    if (gain > 0) s.marksEarned += gain;
    s.stats.totalActivations += 1;
    s.machines.classic.activations += 1;
    s.machines.classic.bestScore = Math.max(s.machines.classic.bestScore, result.payout);
    this.#emit('marks:changed', { marks: s.marks, delta: gain });
    this.#addPrestige(result.prestige ?? 1);

    for (const id of result.symbols) this.#discover('symbols', id, SYMBOLS);
    for (const id of result.effects) this.#discover('effects', id, EFFECTS);

    this.#evaluate();
    this.#emit('progress:changed');
  }

  /**
   * Apuesta en una mesa (blackjack, ruleta): se descuenta YA, como en un casino real
   * (si cierras el juego a mitad de mano, lo apostado está en la mesa).
   */
  wager(amount) {
    const a = int(amount);
    if (!a) return true;
    if (this.state.marks < a) return false;
    this.state.marks -= a;
    this.#emit('marks:changed', { marks: this.state.marks, delta: -a });
    this.#emit('progress:changed');
    return true;
  }

  /**
   * Cierra una ronda de mesa: abona el pago y registra estadísticas y PRESTIGE.
   * @param {'blackjack'|'roulette'} game
   * @param {{staked:number, payout:number, outcome:string, blackjack?:boolean, straight?:boolean, practice?:boolean}} r
   */
  settleTable(game, r) {
    const t = this.state.tables[game];
    if (!t) throw new Error(`Mesa desconocida: ${game}`);
    const staked = int(r.staked);
    const payout = r.practice ? 0 : int(r.payout);
    this.state.marks += payout;
    if (payout > staked) this.state.marksEarned += payout - staked;
    if (payout) this.#emit('marks:changed', { marks: this.state.marks, delta: payout });
    this.state.stats.totalActivations += 1;
    t.rounds += 1;
    const won = r.outcome === 'win';
    if (won) t.wins += 1;
    if (game === 'blackjack' && r.blackjack) t.blackjacks += 1;
    t.best = Math.max(t.best, payout);
    const prestige = r.practice ? 1 : r.straight && won ? 6 : r.blackjack ? 4 : won ? 2 : 1;
    this.#addPrestige(prestige);
    this.#evaluate();
    this.#emit('progress:changed');
    return { prestige, payout };
  }

  /** Mejora concedida por la historia (sin coste y aunque no se cumplan sus requisitos). */
  grant(id) {
    if (!Object.hasOwn(UPGRADES, id) || this.has(id)) return false;
    this.state.upgrades.push(id);
    this.#emit('upgrade:bought', { id, granted: true });
    this.#evaluate();
    this.#emit('progress:changed');
    return true;
  }

  /** Recompensa de misión (MARKS y PRESTIGE). */
  reward({ marks = 0, prestige = 0 } = {}) {
    const m = int(marks);
    const p = int(prestige);
    if (m) {
      this.state.marks += m;
      this.state.marksEarned += m;
      this.#emit('marks:changed', { marks: this.state.marks, delta: m });
    }
    if (p) this.#addPrestige(p);
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
