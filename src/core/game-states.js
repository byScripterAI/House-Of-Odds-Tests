/**
 * Estados de alto nivel del juego y transiciones permitidas.
 * Módulo puro: solo datos.
 */

export const STATES = Object.freeze({
  BOOT: 'boot',
  MAIN_MENU: 'main_menu',
  EXPLORING: 'exploring',
  INTERACTING: 'interacting', // usando una máquina (cámara fija en ella)
  PAUSED: 'paused',
  MANAGER: 'manager', // panel del mostrador (mejoras, objetivos, colección)
});

/**
 * Qué estados pueden seguir a cuál.
 * PAUSED puede volver a EXPLORING o INTERACTING; Game decide cuál usando
 * `machine.previous` (se reanuda donde se pausó).
 */
export const TRANSITIONS = Object.freeze({
  [STATES.BOOT]: Object.freeze([STATES.MAIN_MENU]),
  [STATES.MAIN_MENU]: Object.freeze([STATES.EXPLORING]),
  [STATES.EXPLORING]: Object.freeze([STATES.INTERACTING, STATES.PAUSED, STATES.MANAGER]),
  [STATES.MANAGER]: Object.freeze([STATES.EXPLORING]),
  [STATES.INTERACTING]: Object.freeze([STATES.EXPLORING, STATES.PAUSED]),
  [STATES.PAUSED]: Object.freeze([STATES.EXPLORING, STATES.INTERACTING, STATES.MAIN_MENU]),
});
