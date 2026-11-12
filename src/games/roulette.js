/**
 * ROYAL ROULETTE — ruleta europea (un solo cero). Lógica pura.
 *
 * Apuestas (clave → cubre → paga):
 *   n:<0-36>  pleno ........................ 35 a 1
 *   red / black  rojo / negro ............... 1 a 1
 *   even / odd   par / impar ................ 1 a 1
 *   low / high   falta (1-18) / pasa (19-36)  1 a 1
 *   dozen:<1-3>  docena ..................... 2 a 1
 *   col:<1-3>    columna .................... 2 a 1
 * El 0 solo lo cubre el pleno al 0: las apuestas sencillas pierden con 0 (ventaja de la casa 2,7 %).
 */

/** Orden real de las casillas en la rueda europea (sentido horario). */
export const WHEEL = Object.freeze([0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]);
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const colorOf = (n) => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');

const SIMPLE = { red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1 };

/** ¿Es una clave de apuesta válida? */
export function isBetKey(key) {
  if (Object.hasOwn(SIMPLE, key)) return true;
  const m = /^(n|dozen|col):(\d{1,2})$/.exec(String(key));
  if (!m) return false;
  const v = Number(m[2]);
  return m[1] === 'n' ? v >= 0 && v <= 36 : v >= 1 && v <= 3;
}

/** Cuánto paga «a 1» (sin contar la apuesta devuelta). */
export function paysOf(key) {
  if (!isBetKey(key)) throw new Error(`Apuesta de ruleta inválida: ${key}`);
  if (Object.hasOwn(SIMPLE, key)) return 1;
  if (key.startsWith('n:')) return 35;
  return 2;
}

/** ¿La apuesta `key` gana con el número `n`? */
export function covers(key, n) {
  if (!isBetKey(key)) return false;
  if (key.startsWith('n:')) return Number(key.slice(2)) === n;
  if (n === 0) return false;
  switch (key) {
    case 'red': return RED_NUMBERS.has(n);
    case 'black': return !RED_NUMBERS.has(n);
    case 'even': return n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    default: {
      const v = Number(key.slice(key.indexOf(':') + 1));
      if (key.startsWith('dozen:')) return Math.ceil(n / 12) === v;
      return ((n - 1) % 3) + 1 === v; // col:1 = 1,4,7… · col:2 = 2,5,8… · col:3 = 3,6,9…
    }
  }
}

/** Número ganador (uniforme sobre las 37 casillas). */
export function spinNumber(rng) {
  return WHEEL[Math.floor(rng.next() * WHEEL.length)];
}

/** Posición de una casilla en la rueda (0-36). */
export const pocketIndex = (n) => WHEEL.indexOf(n);

/**
 * Liquida un conjunto de apuestas.
 * @param {Record<string, number>} bets clave → MARKS
 * @param {number} n número ganador
 */
export function settleRoulette(bets, n) {
  const wins = [];
  let staked = 0;
  let payout = 0;
  for (const [key, amount] of Object.entries(bets)) {
    const a = Math.max(0, Math.floor(amount) || 0);
    if (!a || !isBetKey(key)) continue;
    staked += a;
    if (covers(key, n)) {
      const p = a * (paysOf(key) + 1);
      payout += p;
      wins.push({ key, amount: a, payout: p });
    }
  }
  const outcome = payout > staked ? 'win' : payout === staked && staked > 0 ? 'push' : 'lose';
  return { number: n, color: colorOf(n), staked, payout, net: payout - staked, wins, outcome, straight: wins.some((w) => w.key.startsWith('n:')) };
}

/** Total apostado. */
export const totalBets = (bets) => Object.values(bets).reduce((s, v) => s + (Math.max(0, Math.floor(v) || 0)), 0);
