/**
 * MOTOR DE MISIONES (puro: sin Three.js ni DOM; se prueba con node --test).
 *
 * Estado guardable (`story`):
 *   quests:  { [id]: { s: estado, i: objetivo actual, p: progreso, b: base, r: recompensado } }
 *   vars:    decisiones (`victoria_attitude`, `reopening_style`…)
 *   rel:     puntos de relación por PNJ (0–100) → niveles DESCONOCIDO…AMISTAD
 *   flags:   hechos del mundo (`classic_repaired`, `entrance_open`…)
 *   seen:    conversaciones vistas (para variar la charla repetible)
 *   tracked: misión marcada por el jugador
 *
 * El motor no aplica recompensas ni toca el mundo: devuelve NOTAS que el
 * director (story/director.js) convierte en MARKS, cinemáticas, avisos, etc.
 * Así cada regla es comprobable y las recompensas nunca se dan dos veces.
 */

export const Q = Object.freeze({
  LOCKED: 'locked',
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REPEATABLE: 'repeatable',
});

/** Tipos de misión que no pueden solaparse: mientras haya una en curso no se empieza otra. */
const EXCLUSIVE = new Set(['main', 'side']);

/** Umbrales de relación (puntos) → nivel. */
export const RELATION_LEVELS = Object.freeze([
  Object.freeze({ id: 'unknown', min: 0 }),
  Object.freeze({ id: 'known', min: 10 }),
  Object.freeze({ id: 'trust', min: 30 }),
  Object.freeze({ id: 'respect', min: 55 }),
  Object.freeze({ id: 'friendship', min: 80 }),
]);

const TIER_RANK = { none: 0, small: 1, big: 2, jackpot: 3 };
const STATES = new Set(Object.values(Q));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const int = (v) => (Number.isFinite(v) ? Math.floor(v) : 0);
const clampRel = (v) => Math.max(0, Math.min(100, int(v)));
const SAFE_KEY = /^[a-z0-9_:-]{1,48}$/i;

export function freshStory() {
  return { v: 1, quests: {}, vars: {}, rel: {}, flags: [], seen: {}, tracked: null };
}

/** Convierte cualquier entrada (guardado antiguo, corrupto o manipulado) en un estado válido. */
export function normalizeStory(raw, quests) {
  const out = freshStory();
  const r = isObj(raw) ? raw : {};
  if (isObj(r.quests)) {
    for (const [id, q] of Object.entries(r.quests)) {
      if (!Object.hasOwn(quests, id) || !isObj(q) || !STATES.has(q.s)) continue;
      const nObj = quests[id].objectives.length;
      out.quests[id] = {
        s: q.s,
        i: Math.max(0, Math.min(nObj, int(q.i))),
        p: isObj(q.p) ? { n: Math.max(0, int(q.p.n)), seen: Array.isArray(q.p.seen) ? q.p.seen.filter((x) => typeof x === 'string' && SAFE_KEY.test(x)).slice(0, 32) : [] } : { n: 0, seen: [] },
        b: Math.max(0, int(q.b)),
        r: q.r === true,
        at: Math.max(0, int(q.at)),
      };
    }
  }
  if (isObj(r.vars)) {
    for (const [k, v] of Object.entries(r.vars)) {
      if (SAFE_KEY.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && String(v).length <= 48) out.vars[k] = v;
    }
  }
  if (isObj(r.rel)) for (const [k, v] of Object.entries(r.rel)) if (SAFE_KEY.test(k)) out.rel[k] = clampRel(v);
  if (Array.isArray(r.flags)) out.flags = [...new Set(r.flags.filter((f) => typeof f === 'string' && SAFE_KEY.test(f)))].slice(0, 200);
  if (isObj(r.seen)) for (const [k, v] of Object.entries(r.seen)) if (SAFE_KEY.test(k)) out.seen[k] = Math.max(0, Math.min(999, int(v)));
  out.tracked = typeof r.tracked === 'string' && Object.hasOwn(quests, r.tracked) ? r.tracked : null;
  return out;
}

export class QuestEngine {
  /**
   * @param {ReturnType<typeof freshStory>} state (se modifica en sitio: es el que se guarda)
   * @param {Record<string, object>} quests datos de misiones (story/quests.js)
   */
  constructor(state, quests) {
    this.state = state;
    this.quests = quests;
  }

  // ------------------------------------------------------------------ consultas

  status(id) {
    return this.state.quests[id]?.s ?? Q.LOCKED;
  }

  isDone(id) {
    return this.status(id) === Q.COMPLETED;
  }

  /** Definición + progreso del objetivo actual de una misión activa. */
  objective(id) {
    const q = this.state.quests[id];
    const def = this.quests[id];
    if (!q || !def || (q.s !== Q.ACTIVE && q.s !== Q.REPEATABLE)) return null;
    const obj = def.objectives[q.i];
    if (!obj) return null;
    return { quest: id, index: q.i, total: def.objectives.length, def: obj, progress: this.#progressOf(obj, q) };
  }

  #progressOf(obj, q, ctx = this.ctx) {
    switch (obj.type) {
      case 'visit':
        return { n: q.p.seen.length, total: obj.points.length, seen: q.p.seen };
      case 'spin':
      case 'win':
      case 'play':
        return { n: Math.min(q.p.n, obj.count ?? 1), total: obj.count ?? 1 };
      case 'wait':
        return { n: Math.min(obj.spins, Math.max(0, (ctx?.spins ?? 0) - q.b)), total: obj.spins };
      default:
        return { n: 0, total: 1 };
    }
  }

  list(filter = () => true) {
    return Object.values(this.quests).filter((d) => filter(d, this.status(d.id))).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  active() {
    return this.list((d, s) => s === Q.ACTIVE || s === Q.REPEATABLE);
  }

  /** Misión que guía el HUD: la marcada por el jugador o la principal activa más antigua. */
  trackedQuest() {
    const t = this.state.tracked;
    if (t && (this.status(t) === Q.ACTIVE || this.status(t) === Q.REPEATABLE)) return t;
    const act = this.active();
    return (act.find((d) => d.type === 'main') ?? act[0])?.id ?? null;
  }

  setTracked(id) {
    this.state.tracked = id && Object.hasOwn(this.quests, id) ? id : null;
  }

  relation(npc) {
    const points = this.state.rel[npc] ?? 0;
    let level = RELATION_LEVELS[0];
    for (const l of RELATION_LEVELS) if (points >= l.min) level = l;
    return { points, level: level.id, index: RELATION_LEVELS.indexOf(level) };
  }

  hasFlag(f) {
    return this.state.flags.includes(f);
  }

  /** Requisitos de desbloqueo de una misión. */
  requirementsMet(def, ctx = this.ctx ?? {}) {
    const r = def.requires ?? {};
    if ((r.quests ?? []).some((id) => !this.isDone(id))) return false;
    if (r.flags && r.flags.some((f) => !this.hasFlag(f))) return false;
    if ((r.prestige ?? 0) > (ctx.prestige ?? 0)) return false;
    if (r.spinsAfter) {
      const base = this.state.quests[r.spinsAfter.quest];
      if (!base || base.s !== Q.COMPLETED) return false;
      if ((ctx.spins ?? 0) - base.at < r.spinsAfter.n) return false;
    }
    return true;
  }

  /** Para la guía: cuánto falta para que una misión bloqueada se desbloquee (tiradas). */
  pendingUnlock(ctx = this.ctx ?? {}) {
    for (const def of this.list((d, s) => s === Q.LOCKED && d.type === 'main')) {
      const r = def.requires ?? {};
      if ((r.quests ?? []).some((id) => !this.isDone(id))) continue;
      if (r.spinsAfter) {
        const base = this.state.quests[r.spinsAfter.quest];
        if (!base) continue;
        const n = Math.max(0, (ctx.spins ?? 0) - base.at);
        if (n < r.spinsAfter.n) return { quest: def.id, giver: def.giver, kind: 'spins', n, total: r.spinsAfter.n };
      }
      if ((r.prestige ?? 0) > (ctx.prestige ?? 0)) return { quest: def.id, giver: def.giver, kind: 'prestige', n: ctx.prestige ?? 0, total: r.prestige };
      if (def.comingSoon) return { quest: def.id, giver: def.giver, kind: 'soon' };
    }
    return null;
  }

  // ------------------------------------------------------------------ cambios

  /**
   * Revisa desbloqueos y arranques automáticos. Devuelve notas.
   * @param {{spins?: number, prestige?: number, owned?: string[]}} ctx
   */
  evaluate(ctx = {}) {
    this.ctx = ctx;
    const notes = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const def of Object.values(this.quests)) {
        if (this.status(def.id) !== Q.LOCKED || def.comingSoon || !this.requirementsMet(def, ctx)) continue;
        this.state.quests[def.id] = { s: Q.AVAILABLE, i: 0, p: { n: 0, seen: [] }, b: ctx.spins ?? 0, r: false, at: 0 };
        notes.push({ kind: 'available', quest: def.id });
        if (def.autoStart && this.canStart(def.id)) notes.push(...this.start(def.id, ctx));
        changed = true;
      }
      // principales automáticas que esperaban a que terminase otra misión
      for (const def of Object.values(this.quests)) {
        if (def.autoStart && this.status(def.id) === Q.AVAILABLE && this.canStart(def.id)) {
          notes.push(...this.start(def.id, ctx));
          changed = true;
        }
      }
      // objetivos que ya estén cumplidos (p. ej. «compra X» cuando ya lo tienes)
      for (const def of this.active()) {
        const n = this.#autoAdvance(def.id, ctx);
        if (n.length) {
          notes.push(...n);
          changed = true;
        }
      }
    }
    return notes;
  }

  /** Misión principal o secundaria en curso que impide empezar `id` (solo una a la vez), o null. */
  blockedBy(id) {
    const def = this.quests[id];
    if (!def || !EXCLUSIVE.has(def.type)) return null;
    return this.active().find((d) => d.id !== id && EXCLUSIVE.has(d.type))?.id ?? null;
  }

  canStart(id) {
    return !this.blockedBy(id);
  }

  start(id, ctx = this.ctx ?? {}) {
    const def = this.quests[id];
    const st = this.status(id);
    if (!def || (st !== Q.AVAILABLE && st !== Q.REPEATABLE)) return [];
    const by = this.blockedBy(id);
    if (by) return [{ kind: 'blocked', quest: id, by }];
    this.state.quests[id] = { s: def.repeatable ? Q.REPEATABLE : Q.ACTIVE, i: 0, p: { n: 0, seen: [] }, b: ctx.spins ?? 0, r: this.state.quests[id]?.r ?? false, at: 0 };
    if (!this.state.tracked || def.type === 'main') this.state.tracked = id;
    return [{ kind: 'started', quest: id }, ...this.#autoAdvance(id, ctx)];
  }

  /**
   * Evento de juego → avance de objetivos.
   * evt: {type:'dialogue', id} | {type:'visit', point} | {type:'interact', target} |
   *      {type:'spin', tier} | {type:'buy', id} | {type:'play', game, tags, practice}
   */
  emit(evt, ctx = this.ctx ?? {}) {
    this.ctx = ctx;
    const notes = [];
    for (const def of this.active()) {
      const q = this.state.quests[def.id];
      const obj = def.objectives[q.i];
      if (!obj) continue;
      let done = false;
      let progressed = false;
      switch (obj.type) {
        case 'talk':
          done = evt.type === 'dialogue' && evt.id === obj.dialogue;
          break;
        case 'visit':
          if (evt.type === 'visit' && obj.points.includes(evt.point) && !q.p.seen.includes(evt.point)) {
            q.p.seen.push(evt.point);
            progressed = true;
            done = q.p.seen.length >= obj.points.length;
          }
          break;
        case 'interact':
          done = evt.type === 'interact' && evt.target === obj.target;
          break;
        case 'spin':
          if (evt.type === 'spin') {
            q.p.n += 1;
            progressed = true;
            done = q.p.n >= (obj.count ?? 1);
          }
          break;
        case 'win':
          if (evt.type === 'spin' && (TIER_RANK[evt.tier] ?? 0) >= (TIER_RANK[obj.tier] ?? 1)) {
            q.p.n += 1;
            progressed = true;
            done = q.p.n >= (obj.count ?? 1);
          }
          break;
        case 'play':
          // ronda en una mesa: {type:'play', game, tags: ['win', '21', 'blackjack', 'category', 'straight'], practice}
          // obj.tag: exige esa etiqueta · obj.practice: true solo práctica, false solo con MARKS
          if (evt.type === 'play' && evt.game === obj.game && (!obj.tag || (evt.tags ?? []).includes(obj.tag))
            && (obj.practice === undefined || !!evt.practice === obj.practice)) {
            q.p.n += 1;
            progressed = true;
            done = q.p.n >= (obj.count ?? 1);
          }
          break;
        case 'buy':
          done = evt.type === 'buy' && evt.id === obj.upgrade;
          break;
        case 'wait':
          progressed = evt.type === 'spin';
          done = (ctx.spins ?? 0) - q.b >= obj.spins;
          break;
        default:
          break;
      }
      if (progressed && !done) notes.push({ kind: 'progress', quest: def.id, objective: obj.id, ...this.#progressOf(obj, q, ctx) });
      if (done) notes.push(...this.#advance(def.id, ctx));
    }
    return notes;
  }

  #autoAdvance(id, ctx) {
    const def = this.quests[id];
    const q = this.state.quests[id];
    const obj = def?.objectives[q?.i];
    if (!obj) return [];
    if (obj.type === 'buy' && (ctx.owned ?? []).includes(obj.upgrade)) return this.#advance(id, ctx);
    if (obj.type === 'wait' && (ctx.spins ?? 0) - q.b >= obj.spins) return this.#advance(id, ctx);
    if (obj.type === 'flag' && this.hasFlag(obj.flag)) return this.#advance(id, ctx);
    return [];
  }

  #advance(id, ctx) {
    const def = this.quests[id];
    const q = this.state.quests[id];
    const finished = def.objectives[q.i];
    q.i += 1;
    q.p = { n: 0, seen: [] };
    q.b = ctx.spins ?? 0;
    for (const f of finished.onDone?.flags ?? []) this.setFlag(f);
    const notes = [{ kind: 'objective', quest: id, objective: finished.id, onDone: finished.onDone ?? null }];
    if (q.i >= def.objectives.length) notes.push(...this.complete(id, ctx));
    else notes.push(...this.#autoAdvance(id, ctx));
    return notes;
  }

  /** Completa una misión y devuelve sus recompensas (solo la primera vez). */
  complete(id, ctx = this.ctx ?? {}) {
    const def = this.quests[id];
    const q = this.state.quests[id];
    if (!def || !q) return [];
    const first = !q.r;
    q.r = true;
    q.at = ctx.spins ?? 0;
    q.i = def.objectives.length;
    q.s = def.repeatable ? Q.REPEATABLE : Q.COMPLETED;
    if (def.repeatable) {
      q.i = 0;
      q.p = { n: 0, seen: [] };
      q.b = ctx.spins ?? 0;
    }
    if (this.state.tracked === id) this.state.tracked = null;
    const notes = [{ kind: 'completed', quest: id, rewards: first ? def.rewards ?? {} : {}, first }];
    if (first && def.rewards?.relations) for (const [npc, n] of Object.entries(def.rewards.relations)) this.addRelation(npc, n);
    if (first && def.rewards?.flags) for (const f of def.rewards.flags) this.setFlag(f);
    notes.push(...this.evaluate(ctx));
    return notes;
  }

  // ------------------------------------------------------------------ variables / relaciones / banderas

  addRelation(npc, n) {
    if (!SAFE_KEY.test(npc)) return;
    this.state.rel[npc] = clampRel((this.state.rel[npc] ?? 0) + n);
  }

  setVar(k, v) {
    if (SAFE_KEY.test(k)) this.state.vars[k] = v;
  }

  getVar(k) {
    return this.state.vars[k];
  }

  setFlag(f) {
    if (SAFE_KEY.test(f) && !this.hasFlag(f)) this.state.flags.push(f);
  }

  markSeen(dialogueId) {
    if (SAFE_KEY.test(dialogueId)) this.state.seen[dialogueId] = Math.min(999, (this.state.seen[dialogueId] ?? 0) + 1);
  }

  seen(dialogueId) {
    return this.state.seen[dialogueId] ?? 0;
  }

  /**
   * Condición de diálogo/misión (datos):
   *  {quest, state?, step?} · {flag} · {notFlag} · {var, eq} · {rel:[npc, nivelMin]} · {all:[…]} · {any:[…]} · {not:…}
   */
  test(cond) {
    if (!cond) return true;
    if (cond.all) return cond.all.every((c) => this.test(c));
    if (cond.any) return cond.any.some((c) => this.test(c));
    if (cond.not) return !this.test(cond.not);
    if (cond.quest) {
      const st = this.status(cond.quest);
      if (cond.state && (Array.isArray(cond.state) ? !cond.state.includes(st) : st !== cond.state)) return false;
      if (cond.step !== undefined) {
        const o = this.objective(cond.quest);
        if (!o || o.def.id !== cond.step) return false;
      }
      return true;
    }
    if (cond.flag) return this.hasFlag(cond.flag);
    if (cond.notFlag) return !this.hasFlag(cond.notFlag);
    if (cond.var) return this.state.vars[cond.var] === cond.eq;
    if (cond.rel) return this.relation(cond.rel[0]).index >= cond.rel[1];
    return true;
  }
}
