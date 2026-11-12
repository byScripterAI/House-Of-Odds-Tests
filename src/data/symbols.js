/** Símbolos y efectos descubribles de las máquinas. Solo datos; los textos viven en i18n (`symbol.<id>`, `effect.<id>`). */

const freezeAll = (list) =>
  Object.freeze(Object.fromEntries(list.map((item) => [item.id, Object.freeze(item)])));

export const SYMBOLS = freezeAll([
  { id: 'cherry', weight: 30, value: 1 },
  { id: 'bell', weight: 22, value: 2 },
  { id: 'diamond', weight: 16, value: 3 },
  { id: 'crown', weight: 10, value: 5 },
  { id: 'seven', weight: 6, value: 8 },
  { id: 'star', weight: 1, value: 10, special: true }, // comodín: raro a propósito (sube mucho el retorno)
]);

export const SYMBOL_IDS = Object.freeze(Object.keys(SYMBOLS));

export const EFFECTS = freezeAll([
  { id: 'pair' },
  { id: 'triple' },
  { id: 'jackpot' },
  { id: 'wild' },
  { id: 'synergy-royal' },
]);
