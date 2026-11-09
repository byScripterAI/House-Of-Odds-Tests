/** Objetivos, logros y zonas. Solo datos (se evalúan en systems/progress.js). */

const make = (o) => Object.freeze(o);

/** metric ∈ activations | marksEarned | upgradesBought | symbolsFound | decorBought */
export const OBJECTIVES = Object.freeze([
  make({ id: 'first-steps', name: 'Primeros pasos', desc: 'Activa la máquina 5 veces.', metric: 'activations', target: 5, reward: 25 }),
  make({ id: 'warming-up', name: 'Calentando motores', desc: 'Activa la máquina 25 veces.', metric: 'activations', target: 25, reward: 60 }),
  make({ id: 'regular', name: 'Cliente habitual', desc: 'Activa la máquina 100 veces.', metric: 'activations', target: 100, reward: 150 }),
  make({ id: 'veteran', name: 'Veterano de la casa', desc: 'Activa la máquina 300 veces.', metric: 'activations', target: 300, reward: 300 }),
  make({ id: 'saver', name: 'Primeras ganancias', desc: 'Consigue 500 MARKS en total.', metric: 'marksEarned', target: 500, reward: 100 }),
  make({ id: 'big-saver', name: 'Fortuna creciente', desc: 'Consigue 2000 MARKS en total.', metric: 'marksEarned', target: 2000, reward: 250 }),
  make({ id: 'investor', name: 'Inversor', desc: 'Compra 3 mejoras.', metric: 'upgradesBought', target: 3, reward: 80 }),
  make({ id: 'tycoon', name: 'Magnate', desc: 'Compra 8 mejoras.', metric: 'upgradesBought', target: 8, reward: 200 }),
  make({ id: 'collector', name: 'Coleccionista', desc: 'Descubre 5 símbolos.', metric: 'symbolsFound', target: 5, reward: 120 }),
  make({ id: 'decorator', name: 'Interiorista', desc: 'Compra 2 piezas de decoración.', metric: 'decorBought', target: 2, reward: 100 }),
]);

/** Condición: { metric, atLeast } | { effect } | { upgrade } */
export const ACHIEVEMENTS = Object.freeze([
  make({ id: 'first-spin', name: 'Primera activación', desc: 'Activa THE CLASSIC por primera vez.', when: { metric: 'activations', atLeast: 1 } }),
  make({ id: 'pairing', name: 'Pareja de ases', desc: 'Consigue una pareja.', when: { effect: 'pair' } }),
  make({ id: 'triple', name: 'Trío perfecto', desc: 'Consigue tres símbolos iguales.', when: { effect: 'triple' } }),
  make({ id: 'jackpot', name: 'Siete de oro', desc: 'Consigue tres sietes.', when: { effect: 'jackpot' } }),
  make({ id: 'wild', name: 'Estrella fugaz', desc: 'Haz que un comodín complete un resultado.', when: { effect: 'wild' } }),
  make({ id: 'royal', name: 'Sangre azul', desc: 'Activa la sinergia real.', when: { effect: 'synergy-royal' } }),
  make({ id: 'gala', name: 'Luz de gala', desc: 'Instala la iluminación de gala.', when: { upgrade: 'lighting-3' } }),
  make({ id: 'expansion', name: 'Nueva ala', desc: 'Amplía el casino.', when: { upgrade: 'expand-hall' } }),
  make({ id: 'all-symbols', name: 'Colección de símbolos', desc: 'Descubre los 6 símbolos.', when: { metric: 'symbolsFound', atLeast: 6 } }),
  make({ id: 'renowned', name: 'Casino de renombre', desc: 'Alcanza 100 de PRESTIGE.', when: { metric: 'prestige', atLeast: 100 } }),
]);

/** Zonas del casino. Solo MAIN FLOOR está construida en la v1.0; el resto son puertas bloqueadas. */
export const ZONES = Object.freeze({
  main_floor: make({ id: 'main_floor', name: 'MAIN FLOOR', built: true, unlock: { prestige: 0, marks: 0 }, color: 0xd4af37 }),
  neon_lounge: make({ id: 'neon_lounge', name: 'NEON LOUNGE', built: false, unlock: { prestige: 50, marks: 500 }, color: 0x2ad4ff }),
  golden_room: make({ id: 'golden_room', name: 'GOLDEN ROOM', built: false, unlock: { prestige: 150, marks: 1500 }, color: 0xffc13a }),
  underground: make({ id: 'underground', name: 'UNDERGROUND', built: false, unlock: { prestige: 300, marks: 3500 }, color: 0x7a2bd1 }),
  vip_hall: make({ id: 'vip_hall', name: 'VIP HALL', built: false, unlock: { prestige: 600, marks: 8000 }, color: 0xc42240 }),
});
