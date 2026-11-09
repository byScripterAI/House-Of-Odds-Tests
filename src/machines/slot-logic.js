import { SYMBOLS, SYMBOL_IDS } from '../data/symbols.js';

/**
 * Lógica pura de THE CLASSIC. Sin Three.js ni DOM.
 *
 * INVARIANTE: reward = base + bonus, con base > 0 y bonus ≥ 0.
 * El azar solo decide símbolos, efectos y bonus; nunca resta nada.
 */

export const BASE_REWARD = 10;

/** @param {import('../core/rng.js').Rng} rng  @param {ReturnType<typeof import('../data/upgrades.js').computeLoadout>} loadout */
export function resolveActivation(rng, loadout) {
  const pool = SYMBOL_IDS.filter((id) => id !== 'star' || loadout.star).map((id) => SYMBOLS[id]);
  const symbols = [0, 1, 2].map(() => rng.weighted(pool).id);
  return evaluate(symbols, loadout);
}

/** Puntúa un resultado concreto (separado para poder probarlo de forma determinista). */
export function evaluate(symbols, loadout) {
  const base = BASE_REWARD + Math.max(0, loadout.baseAdd | 0);
  const stars = symbols.filter((s) => s === 'star').length;
  const normals = symbols.filter((s) => s !== 'star');
  const effects = [];
  let raw = 0;

  if (stars > 0) effects.push('wild');

  if (normals.length === 0) {
    raw = 15 * SYMBOLS.star.value;
    effects.push('triple', 'jackpot');
  } else {
    const counts = new Map();
    for (const s of normals) counts.set(s, (counts.get(s) ?? 0) + 1);
    // Símbolo dominante; en empate, el de mayor valor.
    let best = null;
    for (const [id, n] of counts) {
      if (!best || n > best.n || (n === best.n && SYMBOLS[id].value > SYMBOLS[best.id].value)) best = { id, n };
    }
    const total = best.n + stars;
    if (total >= 3) {
      raw = 15 * SYMBOLS[best.id].value;
      effects.push('triple');
      if (best.id === 'seven') effects.push('jackpot');
    } else if (total === 2) {
      raw = 4 * SYMBOLS[best.id].value;
      effects.push('pair');
    }
  }

  if (loadout.royal && symbols.includes('crown') && symbols.includes('diamond')) {
    raw += 12;
    effects.push('synergy-royal');
  }

  const bonus = Math.round(raw * Math.max(1, loadout.bonusMult ?? 1));
  const tier = bonus === 0 ? 'none' : effects.includes('jackpot') ? 'jackpot' : effects.includes('triple') ? 'big' : 'small';
  return { symbols, base, bonus, reward: base + bonus, effects, tier };
}
