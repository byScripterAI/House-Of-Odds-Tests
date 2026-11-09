/**
 * HOUSE OF ODDS — configuración global.
 *
 * Este módulo es PURO: no importa Three.js ni toca el DOM, de modo que puede
 * probarse con Node y usarse desde cualquier capa del juego.
 */

export const GAME = Object.freeze({
  id: 'house-of-odds',
  name: 'HOUSE OF ODDS',
  version: '1.1.0',
});

/** Paleta oficial (hex numérico para Three.js; el CSS replica estos valores en main.css). */
export const PALETTE = Object.freeze({
  black: 0x050304,
  carbon: 0x1b1a1c,
  crimson: 0x9e1b32,
  gold: 0xd4af37,
  warmWhite: 0xf5ead7,
});

/**
 * Vocabulario de la economía. Ningún texto de UI debe hardcodear estos nombres.
 *
 *  - MARKS:      moneda principal. Se gana jugando; se gasta SOLO en desbloqueos/mejoras.
 *                Nunca se apuesta, nunca se pierde por jugar.
 *  - PRESTIGE:   progreso general del casino. Acumulativo, no gastable; condiciona zonas.
 *  - COLLECTION: registro de máquinas, símbolos y efectos descubiertos.
 */
export const ECONOMY = Object.freeze({
  currency: Object.freeze({ id: 'marks', label: 'MARKS' }),
  prestige: Object.freeze({ id: 'prestige', label: 'PRESTIGE' }),
  collection: Object.freeze({ id: 'collection', label: 'COLLECTION' }),
});

/** Claves de LocalStorage. Los ajustes viven aparte para que NUEVA PARTIDA no los borre. */
export const STORAGE = Object.freeze({
  saveKey: 'houseofodds.save',
  backupKey: 'houseofodds.save.bak',
  settingsKey: 'houseofodds.settings',
  schemaVersion: 1,
});

/**
 * Perfiles de calidad. Cada tier fija el TECHO de lo que se permite; los
 * interruptores de ajustes solo pueden desactivar lo que el perfil permite.
 */
export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 0,
    effects: false,
  }),
  medium: Object.freeze({
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    effects: false,
  }),
  high: Object.freeze({
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    effects: true,
  }),
});

export const QUALITY_ORDER = Object.freeze(['low', 'medium', 'high']);

export const DEFAULT_SETTINGS = Object.freeze({
  graphics: Object.freeze({
    quality: 'medium',
    renderScale: 1, // 0.5 – 1.0 (resolución de renderizado)
    shadows: true,
    effects: true,
    antialias: true,
    screenFx: true, // sacudidas y destellos de pantalla (las partículas siempre se muestran)
  }),
  audio: Object.freeze({
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
  }),
  controls: Object.freeze({
    mouseSensitivity: 1,
    showControls: true,
  }),
});

/**
 * Combina el perfil de calidad con los interruptores del usuario.
 * Función pura: devuelve los valores EFECTIVOS que usará el renderizador.
 *
 * @param {{quality?: string, renderScale?: number, shadows?: boolean,
 *          effects?: boolean, antialias?: boolean}} graphics
 */
export function resolveGraphics(graphics = DEFAULT_SETTINGS.graphics) {
  const tier = Object.hasOwn(QUALITY_PROFILES, graphics.quality) ? graphics.quality : 'medium';
  const profile = QUALITY_PROFILES[tier];
  const renderScale = Math.min(1, Math.max(0.5, Number.isFinite(graphics.renderScale) ? graphics.renderScale : 1));

  return {
    quality: tier,
    pixelRatioCap: profile.pixelRatioCap,
    renderScale,
    antialias: profile.antialias && graphics.antialias !== false,
    shadows: profile.shadows && graphics.shadows !== false,
    shadowMapSize: profile.shadowMapSize,
    effects: profile.effects && graphics.effects !== false,
  };
}
