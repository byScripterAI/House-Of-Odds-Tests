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
  MANAGER: 'manager', // panel de servicios (mejoras, objetivos, colección)
  DIALOGUE: 'dialogue', // conversación con un personaje
  CINEMATIC: 'cinematic', // secuencia de cámara (compras, reapertura…)
  TABLE: 'table', // sentado en una mesa (blackjack, ruleta): ratón libre para el paño y los botones
});

/**
 * Qué estados pueden seguir a cuál.
 * PAUSED puede volver a EXPLORING o INTERACTING; Game decide cuál usando
 * `machine.previous` (se reanuda donde se pausó).
 */
export const TRANSITIONS = Object.freeze({
  [STATES.BOOT]: Object.freeze([STATES.MAIN_MENU]),
  [STATES.MAIN_MENU]: Object.freeze([STATES.EXPLORING]),
  [STATES.EXPLORING]: Object.freeze([STATES.INTERACTING, STATES.PAUSED, STATES.MANAGER, STATES.DIALOGUE, STATES.CINEMATIC, STATES.TABLE]),
  [STATES.TABLE]: Object.freeze([STATES.EXPLORING, STATES.PAUSED]),
  [STATES.MANAGER]: Object.freeze([STATES.EXPLORING, STATES.CINEMATIC]),
  [STATES.INTERACTING]: Object.freeze([STATES.EXPLORING, STATES.PAUSED, STATES.DIALOGUE]),
  [STATES.DIALOGUE]: Object.freeze([STATES.EXPLORING, STATES.PAUSED, STATES.CINEMATIC, STATES.MANAGER, STATES.INTERACTING]),
  [STATES.CINEMATIC]: Object.freeze([STATES.EXPLORING, STATES.DIALOGUE, STATES.PAUSED]),
  [STATES.PAUSED]: Object.freeze([STATES.EXPLORING, STATES.INTERACTING, STATES.DIALOGUE, STATES.CINEMATIC, STATES.MAIN_MENU, STATES.TABLE]),
});
