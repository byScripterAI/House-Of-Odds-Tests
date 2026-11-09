/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 *
 * Por qué no Math.random directamente: con semilla, los resultados de las
 * máquinas son reproducibles en pruebas y en reportes de errores.
 * No tiene uso criptográfico ni de seguridad; solo es el azar visual del juego.
 */

/** Hash de cadena → entero sin signo de 32 bits (FNV-1a). */
export function hashSeed(text) {
  let h = 0x811c9dc5;
  const str = String(text);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function randomSeed() {
  const buf = globalThis.crypto?.getRandomValues?.(new Uint32Array(1));
  if (buf) return buf[0];
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export class Rng {
  /** @param {number|string} [seed] omitido → semilla aleatoria */
  constructor(seed) {
    const s = seed === undefined ? randomSeed() : typeof seed === 'string' ? hashSeed(seed) : seed;
    this.state = s >>> 0;
  }

  /** Float en [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float en [min, max). */
  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  /** Entero en [min, max], ambos incluidos. */
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int: rango inválido [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true con probabilidad p (0–1). */
  chance(p) {
    return this.next() < p;
  }

  pick(array) {
    if (!array.length) throw new RangeError('Rng.pick: array vacío');
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Elección ponderada.
   * @param {Array<T>} items
   * @param {(item: T) => number} [weightOf] por defecto, `item.weight`
   * @template T
   */
  weighted(items, weightOf = (item) => item.weight) {
    if (!items.length) throw new RangeError('Rng.weighted: lista vacía');
    const weights = items.map((item) => {
      const w = weightOf(item);
      if (!Number.isFinite(w) || w < 0) throw new RangeError(`Rng.weighted: peso inválido (${w})`);
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new RangeError('Rng.weighted: la suma de pesos debe ser > 0');

    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1]; // salvaguarda por redondeo en coma flotante
  }

  /** Copia barajada (Fisher–Yates); no modifica el original. */
  shuffle(array) {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Genera un Rng independiente derivado de este y de una etiqueta. */
  fork(label) {
    return new Rng((this.state ^ hashSeed(label)) >>> 0);
  }
}
