import { SYMBOLS, SYMBOL_IDS } from '../data/symbols.js';

/**
 * Lógica pura de THE CLASSIC (sin Three.js ni DOM). ECONOMÍA CON APUESTAS:
 * cada tirada cuesta la apuesta y el resultado puede ser
 *   - PERDER    (×0)  sin combinación
 *   - RECUPERAR (×1)  pareja baja (cereza o campana): te devuelven lo apostado
 *   - GANAR     (×2+) pareja alta (diamante, corona, siete), trío o sinergia
 *
 * Tabla de pagos (× apuesta): trío 🍒4 · 🔔5 · 💎8 · 👑12 · 7️⃣25 (bote) · ⭐40 (bote); pareja alta ×2.
 * Retorno teórico de la máquina base ≈ 103 % (máquina veterana «amable»): con suerte y cabeza
 * se gana, pero las rachas malas existen y una apuesta alta puede vaciarte la cartera.
 * Las mejoras de multiplicador NO tocan los pagos: suben el PRESTIGE (progreso).
 */

export const PAYTABLE = Object.freeze({ cherry: 4, bell: 5, diamond: 8, crown: 12, seven: 25, star: 40 });
const HIGH_PAIR = new Set(['diamond', 'crown', 'seven']);
export const BETS = Object.freeze([5, 10, 25, 50, 100, 250, 500]);
export const MIN_BET = BETS[0];
export const BASE_MAX_BET = 100;

/** Apuesta máxima permitida (las instalaciones la amplían). */
export function maxBet(loadout) {
  return Math.min(BETS.at(-1), BASE_MAX_BET + Math.max(0, loadout?.betMaxAdd | 0));
}

/** Escalones de apuesta disponibles con este equipamiento. */
export function betSteps(loadout) {
  const max = maxBet(loadout);
  return BETS.filter((b) => b <= max);
}

/** Ajusta una apuesta a un escalón válido que además se pueda pagar (o el mínimo). */
export function clampBet(bet, loadout, marks = Infinity) {
  const steps = betSteps(loadout);
  const affordable = steps.filter((b) => b <= marks);
  const pool = affordable.length ? affordable : [MIN_BET];
  let best = pool[0];
  for (const b of pool) if (b <= bet) best = b;
  return best;
}

/** Sube (+1) o baja (−1) un escalón. */
export function stepBet(bet, dir, loadout, marks = Infinity) {
  const steps = betSteps(loadout).filter((b) => b <= Math.max(MIN_BET, marks));
  const i = Math.max(0, steps.indexOf(clampBet(bet, loadout, marks)));
  return steps[Math.max(0, Math.min(steps.length - 1, i + dir))] ?? MIN_BET;
}

/**
 * Una tirada.
 * @param {import('../core/rng.js').Rng} rng
 * @param {ReturnType<typeof import('../data/upgrades.js').computeLoadout>} loadout
 * @param {number} bet
 */
export function resolveSpin(rng, loadout, bet) {
  const pool = SYMBOL_IDS.filter((id) => id !== 'star' || loadout.star).map((id) => SYMBOLS[id]);
  const symbols = [0, 1, 2].map(() => rng.weighted(pool).id);
  return evaluateSpin(symbols, loadout, bet);
}

/** Puntúa un resultado concreto (determinista, para pruebas). */
export function evaluateSpin(symbols, loadout, bet) {
  const stake = Math.max(MIN_BET, Math.floor(bet) || MIN_BET);
  const stars = symbols.filter((s) => s === 'star').length;
  const normals = symbols.filter((s) => s !== 'star');
  const effects = [];
  let multiplier = 0;
  let triple = false;
  let jackpot = false;

  if (stars > 0) effects.push('wild');
  if (normals.length === 0) {
    multiplier = PAYTABLE.star;
    triple = jackpot = true;
  } else {
    const counts = new Map();
    for (const s of normals) counts.set(s, (counts.get(s) ?? 0) + 1);
    let best = null; // dominante; en empate, el que más paga
    for (const [id, n] of counts) if (!best || n > best.n || (n === best.n && PAYTABLE[id] > PAYTABLE[best.id])) best = { id, n };
    const total = best.n + stars;
    if (total >= 3) {
      multiplier = PAYTABLE[best.id];
      triple = true;
      jackpot = best.id === 'seven';
    } else if (total === 2) {
      multiplier = HIGH_PAIR.has(best.id) ? 2 : 1;
      effects.push('pair');
    }
  }
  if (triple) effects.push('triple');
  if (jackpot) effects.push('jackpot');
  if (loadout.royal && symbols.includes('crown') && symbols.includes('diamond')) {
    multiplier += 0.25;
    effects.push('synergy-royal');
  }

  const payout = Math.round(stake * multiplier);
  const net = payout - stake;
  const outcome = payout === 0 ? 'lose' : payout <= stake ? 'push' : 'win';
  const tier = jackpot ? 'jackpot' : triple ? 'big' : outcome === 'win' ? 'small' : 'none';
  // progreso: cada tirada suma PRESTIGE; las victorias, más; las mejoras de multiplicador lo amplifican
  const basePrestige = { none: 1, small: 2, big: 4, jackpot: 10 }[tier];
  const prestige = Math.max(1, Math.round(basePrestige * Math.max(1, loadout.bonusMult ?? 1)));
  return { symbols, bet: stake, multiplier, payout, net, outcome, tier, effects, prestige, reward: payout };
}
