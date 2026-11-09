/** Símbolos y efectos descubribles de las máquinas. Solo datos. */

const freezeAll = (list) =>
  Object.freeze(Object.fromEntries(list.map((item) => [item.id, Object.freeze(item)])));

export const SYMBOLS = freezeAll([
  { id: 'cherry', name: 'Cerezas', weight: 30, value: 1 },
  { id: 'bell', name: 'Campana', weight: 22, value: 2 },
  { id: 'diamond', name: 'Diamante', weight: 16, value: 3 },
  { id: 'crown', name: 'Corona', weight: 10, value: 5 },
  { id: 'seven', name: 'Siete', weight: 6, value: 8 },
  { id: 'star', name: 'Estrella (comodín)', weight: 5, value: 10, special: true },
]);

export const SYMBOL_IDS = Object.freeze(Object.keys(SYMBOLS));

export const EFFECTS = freezeAll([
  { id: 'pair', name: 'Pareja' },
  { id: 'triple', name: 'Trío' },
  { id: 'jackpot', name: 'Siete triple' },
  { id: 'wild', name: 'Comodín estelar' },
  { id: 'synergy-royal', name: 'Sinergia real' },
]);
