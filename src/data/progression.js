/** Objetivos, logros y zonas. Solo datos (se evalúan en systems/progress.js). Los textos viven en i18n (`objective.<id>.name|desc`, `achievement.<id>.…`, `zone.<id>`). */

const make = (o) => Object.freeze(o);

/** metric ∈ activations | marksEarned | upgradesBought | symbolsFound | decorBought */
export const OBJECTIVES = Object.freeze([
  make({ id: 'first-steps', metric: 'activations', target: 5, reward: 25 }),
  make({ id: 'warming-up', metric: 'activations', target: 25, reward: 60 }),
  make({ id: 'regular', metric: 'activations', target: 100, reward: 150 }),
  make({ id: 'veteran', metric: 'activations', target: 300, reward: 300 }),
  make({ id: 'saver', metric: 'marksEarned', target: 500, reward: 100 }),
  make({ id: 'big-saver', metric: 'marksEarned', target: 2000, reward: 250 }),
  make({ id: 'investor', metric: 'upgradesBought', target: 3, reward: 80 }),
  make({ id: 'tycoon', metric: 'upgradesBought', target: 8, reward: 200 }),
  make({ id: 'collector', metric: 'symbolsFound', target: 5, reward: 120 }),
  make({ id: 'decorator', metric: 'decorBought', target: 2, reward: 100 }),
]);

/** Condición: { metric, atLeast } | { effect } | { upgrade } */
export const ACHIEVEMENTS = Object.freeze([
  make({ id: 'first-spin', when: { metric: 'activations', atLeast: 1 } }),
  make({ id: 'pairing', when: { effect: 'pair' } }),
  make({ id: 'triple', when: { effect: 'triple' } }),
  make({ id: 'jackpot', when: { effect: 'jackpot' } }),
  make({ id: 'wild', when: { effect: 'wild' } }),
  make({ id: 'royal', when: { effect: 'synergy-royal' } }),
  make({ id: 'gala', when: { upgrade: 'lighting-3' } }),
  make({ id: 'expansion', when: { upgrade: 'expand-hall' } }),
  make({ id: 'all-symbols', when: { metric: 'symbolsFound', atLeast: 6 } }),
  make({ id: 'renowned', when: { metric: 'prestige', atLeast: 100 } }),
]);

/** Zonas del casino. Solo MAIN FLOOR está construida en la v1.0; el resto son puertas bloqueadas. */
export const ZONES = Object.freeze({
  main_floor: make({ id: 'main_floor', built: true, unlock: { prestige: 0, marks: 0 }, color: 0xd4af37 }),
  neon_lounge: make({ id: 'neon_lounge', built: false, unlock: { prestige: 50, marks: 500 }, color: 0x2ad4ff }),
  golden_room: make({ id: 'golden_room', built: false, unlock: { prestige: 150, marks: 1500 }, color: 0xffc13a }),
  underground: make({ id: 'underground', built: false, unlock: { prestige: 300, marks: 3500 }, color: 0x7a2bd1 }),
  vip_hall: make({ id: 'vip_hall', built: false, unlock: { prestige: 600, marks: 8000 }, color: 0xc42240 }),
});
