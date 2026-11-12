/**
 * RITMO DE HABLA del texto de los diálogos.
 *
 * Calcula en qué instante aparece cada carácter para que el texto «se diga» al ritmo de la voz grabada:
 * las palabras largas (más sílabas) tardan más que las cortas, y las comas, puntos y puntos suspensivos
 * hacen pausa como al hablar. Si hay grabación, el total se ajusta a su duración real; si no, se usa un
 * ritmo de lectura cómodo. Puro y con pruebas (test/speech-timing.test.js).
 */

const VOWELS = /[aeiouyáéíóúàèìòùâêîôûäëïöüãõæœ]+/giu;
const CJK = /[぀-ヿ㐀-鿿豈-﫿]/u;
const PAUSE = { ',': 0.55, ';': 0.75, ':': 0.7, '.': 1.15, '!': 1.15, '?': 1.15, '…': 1.5, '—': 0.6, '–': 0.5, '。': 1.15, '，': 0.55, '！': 1.15, '？': 1.15, '、': 0.4 };

/** Sílabas aproximadas de una palabra (grupos de vocales; un carácter CJK = una sílaba). */
export function syllables(word) {
  let cjk = 0;
  for (const ch of word) if (CJK.test(ch)) cjk++;
  if (cjk) return cjk;
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
  if (!letters) return 0;
  if (/^\p{N}+$/u.test(letters)) return Math.max(1, letters.length * 1.3); // los números se dicen largos
  const groups = letters.match(VOWELS)?.length ?? 0;
  return Math.max(1, groups);
}

/**
 * Tiempo (s) en el que debe estar visible cada carácter: `times[i]` = momento en que aparece text[i].
 * @param {string} text
 * @param {{duration?: number|null, perSyllable?: number, lead?: number, tail?: number}} [o]
 *   duration: duración de la grabación (null → ritmo de lectura); lead/tail: silencio al principio y al final.
 */
export function speechTimeline(text, { duration = null, perSyllable = 0.13, lead = 0.12, tail = 0.3 } = {}) {
  const chars = [...text];
  // 1) peso de cada carácter: las letras se reparten las sílabas de su palabra; la puntuación pesa su pausa
  const weight = new Array(chars.length).fill(0);
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (CJK.test(ch)) {
      weight[i] = 1;
      i++;
      continue;
    }
    if (/[\p{L}\p{N}'’-]/u.test(ch)) {
      let j = i;
      while (j < chars.length && /[\p{L}\p{N}'’-]/u.test(chars[j]) && !CJK.test(chars[j])) j++;
      const word = chars.slice(i, j).join('');
      const syl = syllables(word) + 0.15; // pequeña transición entre palabras
      const n = j - i;
      for (let k = i; k < j; k++) weight[k] = syl / n;
      i = j;
      continue;
    }
    weight[i] = PAUSE[ch] ?? (ch === ' ' ? 0.04 : 0.02);
    // «...» como puntos suspensivos
    if (ch === '.' && chars[i + 1] === '.') weight[i] = 0.5;
    i++;
  }
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  // 2) escala: o la grabación, o el ritmo de lectura
  const span = duration && duration > 0.3 ? Math.max(0.2, duration - lead - tail) : total * perSyllable;
  const start = duration && duration > 0.3 ? lead : 0;
  const k = span / total;
  const times = new Array(chars.length);
  let t = start;
  for (let c = 0; c < chars.length; c++) {
    times[c] = t; // el carácter aparece al empezar su tramo
    t += weight[c] * k;
  }
  return { times, end: t, chars };
}

/** Cuántos caracteres hay que mostrar en el instante `t`. */
export function visibleCount(timeline, t) {
  const { times } = timeline;
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
