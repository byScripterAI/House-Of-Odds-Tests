import { SYMBOLS, SYMBOL_IDS } from '../data/symbols.js';
import { evaluateSpin, resolveSpin } from '../machines/slot-logic.js';

/**
 * DIRECTOR DE SUERTE (invisible para el jugador).
 *
 * Mientras un DESAFÍO pide un premio concreto («consigue un trío»…), las tiradas siguen pareciendo puro azar,
 * pero este sistema equilibra la probabilidad para que el desafío dure lo que debe:
 *   - al principio puede FRENAR: si el premio sale demasiado pronto, se vuelve a tirar (no es tan fácil);
 *   - pasado cierto número de tiradas AYUDA cada vez más (la probabilidad de forzar el premio sube poco a poco);
 *   - y existe un tope de «mala suerte»: llegado a él, el premio sale seguro.
 * Las tiradas forzadas usan combinaciones reales con sus pagos normales (nada se nota en la máquina).
 *
 * Probabilidades naturales por tirada (sin comodín): premio ≈ 1/5 · trío ≈ 1/14 · bote (tres sietes) ≈ 1/2700.
 */

export const TIER_RANK = Object.freeze({ none: 0, small: 1, big: 2, jackpot: 3 });

/** Plan por premio: hasta cuándo puede frenar, desde cuándo ayuda, ayuda máxima y tope (tiradas). */
export const LUCK_PLAN = Object.freeze({
  small: Object.freeze({ hinderUntil: 1, hinderChance: 0.5, helpFrom: 4, maxHelp: 0.45, pityAt: 10 }),
  big: Object.freeze({ hinderUntil: 3, hinderChance: 0.55, helpFrom: 7, maxHelp: 0.4, pityAt: 18 }),
  jackpot: Object.freeze({ hinderUntil: 0, hinderChance: 0, helpFrom: 10, maxHelp: 0.18, pityAt: 32 }),
});

/**
 * Decide qué hace el director en esta tirada.
 * @param {'small'|'big'|'jackpot'} tier premio que pide el desafío
 * @param {number} spins tiradas ya hechas con este objetivo activo
 * @param {number} roll número aleatorio en [0, 1)
 * @returns {'help'|'hinder'|null}
 */
export function luckDecision(tier, spins, roll) {
  const plan = LUCK_PLAN[tier];
  if (!plan) return null;
  if (spins >= plan.pityAt - 1) return 'help';
  if (spins < plan.hinderUntil) return roll < plan.hinderChance ? 'hinder' : null;
  if (spins >= plan.helpFrom) {
    const ramp = (spins - plan.helpFrom + 1) / Math.max(1, plan.pityAt - 1 - plan.helpFrom);
    return roll < plan.maxHelp * Math.min(1, ramp) ? 'help' : null;
  }
  return null;
}

const pickWeighted = (rng, ids) => rng.weighted(ids.map((id) => SYMBOLS[id])).id;

/** Una combinación real que da (al menos) el premio pedido. */
export function forcedSymbols(rng, tier, loadout) {
  if (tier === 'jackpot') return ['seven', 'seven', 'seven'];
  if (tier === 'big') {
    const s = pickWeighted(rng, ['cherry', 'bell', 'diamond', 'crown']);
    return [s, s, s];
  }
  // premio pequeño: pareja alta y un tercer símbolo distinto, en posiciones al azar
  const pair = pickWeighted(rng, ['diamond', 'crown', 'seven']);
  const others = SYMBOL_IDS.filter((id) => id !== pair && id !== 'star');
  void loadout;
  const odd = pickWeighted(rng, others);
  const out = [pair, pair, pair];
  out[Math.floor(rng.next() * 3)] = odd;
  return out;
}

/**
 * Tirada con el director aplicado.
 * @param {{tier:string, spins:number}|null} challenge premio pedido y tiradas ya hechas (null = tirada normal)
 */
export function resolveBalancedSpin(rng, loadout, bet, challenge) {
  let result = resolveSpin(rng, loadout, bet);
  if (!challenge || !LUCK_PLAN[challenge.tier]) return { result, decision: null };
  const decision = luckDecision(challenge.tier, challenge.spins, rng.next());
  const qualifies = (r) => TIER_RANK[r.tier] >= TIER_RANK[challenge.tier];
  if (decision === 'hinder' && qualifies(result)) {
    for (let i = 0; i < 6 && qualifies(result); i++) result = resolveSpin(rng, loadout, bet);
  } else if (decision === 'help' && !qualifies(result)) {
    result = evaluateSpin(forcedSymbols(rng, challenge.tier, loadout), loadout, bet);
  }
  return { result, decision };
}

/** Contador persistente de tiradas por objetivo de desafío (se guarda con la partida). */
export function nextLuckState(prev, key) {
  if (!key) return { key: '', spins: 0 };
  return prev?.key === key ? { key, spins: (prev.spins | 0) + 1 } : { key, spins: 1 };
}
