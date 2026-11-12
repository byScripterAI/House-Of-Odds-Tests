/**
 * HOUSE OF ODDS — configuración global.
 *
 * Este módulo es PURO: no importa Three.js ni toca el DOM, de modo que puede
 * probarse con Node y usarse desde cualquier capa del juego.
 */

export const GAME = Object.freeze({
  id: 'house-of-odds',
  name: 'HOUSE OF ODDS',
  version: '0.6.2',
  /** Fase de desarrollo: se muestra junto al logo y en el aviso al empezar partida. */
  stage: 'beta',
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
/**
 * Interruptores de contenido. `cardsChapter`: capítulos 4-5 (ROYAL BLACKJACK y ROYAL ROULETTE jugables,
 * con sus misiones y desafíos). La lógica, las mesas 3D y las pruebas están hechas; se activará cuando
 * su interfaz esté rehecha con el nuevo sistema de diseño y sus textos traducidos a los 6 idiomas.
 */
export const FEATURES = Object.freeze({ cardsChapter: false });

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
  languageKey: 'houseofodds.language', // idioma elegido: persiste siempre (ni NUEVA PARTIDA ni la pérdida de partida lo borran)
  schemaVersion: 1,
});

/**
 * Perfiles de calidad: CINCO niveles reales, de MUY BAJO a ULTRA.
 * Cada tier fija el TECHO de lo que se permite; los interruptores de ajustes
 * solo pueden desactivar lo que el perfil permite.
 *
 *  - pixelRatioCap     tope de la densidad de píxeles (pantallas retina).
 *  - antialias         MSAA del contexto (no cambia en caliente).
 *  - shadows/size      sombras en tiempo real y resolución del mapa.
 *  - effects           partículas, polvo y brillos decorativos.
 *  - post              post-proceso: bloom, oclusión ambiental (AO), SMAA.
 *  - material          'lambert' (barato, sin PBR) | 'standard' | 'physical' (barniz, brillo).
 *  - detail            multiplicador de segmentos de la geometría (modelos más o menos finos).
 *  - textureSize       resolución de las texturas procedurales (px).
 *  - anisotropy        filtrado anisotrópico.
 *  - reflections       mapa de entorno reflejado en metales y cristal.
 *  - dynamicLights     tope de luces puntuales (si hay más, se agrupan: misma energía, menos coste).
 *  - crowdMax          tope de NPCs ambientales simultáneos.
 *  - npcDetail         0 cápsulas · 1 baja · 2 media · 3 alta · 4 máxima (pelo, cara, ropa).
 *  - propDensity       fracción de la decoración menor que se instancia.
 *  - particleScale     multiplicador de partículas.
 */
export const QUALITY_PROFILES = Object.freeze({
  veryLow: Object.freeze({
    pixelRatioCap: 0.85,
    antialias: false,
    shadows: false,
    shadowMapSize: 0,
    effects: false,
    post: Object.freeze({ bloom: false, ao: false, smaa: false }),
    material: 'standard',
    detail: 0.35,
    textureSize: 128,
    anisotropy: 1,
    reflections: true,
    dynamicLights: 8,
    crowdMax: 6,
    npcDetail: 0,
    propDensity: 0.35,
    particleScale: 0.3,
  }),
  low: Object.freeze({
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 0,
    effects: true,
    post: Object.freeze({ bloom: false, ao: false, smaa: false }),
    material: 'standard',
    detail: 0.6,
    textureSize: 256,
    anisotropy: 2,
    reflections: true,
    dynamicLights: 10,
    crowdMax: 12,
    npcDetail: 1,
    propDensity: 0.6,
    particleScale: 0.55,
  }),
  medium: Object.freeze({
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    effects: true,
    post: Object.freeze({ bloom: false, ao: false, smaa: false }),
    material: 'standard',
    detail: 1,
    textureSize: 512,
    anisotropy: 4,
    reflections: true,
    dynamicLights: 14,
    crowdMax: 24,
    npcDetail: 2,
    propDensity: 0.85,
    particleScale: 0.8,
  }),
  high: Object.freeze({
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    effects: true,
    post: Object.freeze({ bloom: true, ao: false, smaa: true }),
    material: 'standard',
    detail: 1.4,
    textureSize: 1024,
    anisotropy: 8,
    reflections: true,
    dynamicLights: 20,
    crowdMax: 40,
    npcDetail: 3,
    propDensity: 1,
    particleScale: 1,
  }),
  ultra: Object.freeze({
    pixelRatioCap: 2.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 3072,
    effects: true,
    post: Object.freeze({ bloom: true, ao: true, smaa: true }),
    material: 'standard',
    detail: 2,
    textureSize: 2048,
    anisotropy: 16,
    reflections: true,
    dynamicLights: 26,
    crowdMax: 64,
    npcDetail: 4,
    propDensity: 1,
    particleScale: 1.5,
  }),
});

export const QUALITY_ORDER = Object.freeze(['veryLow', 'low', 'medium', 'high', 'ultra']);

export const DEFAULT_SETTINGS = Object.freeze({
  graphics: Object.freeze({
    quality: 'medium',
    renderScale: 1, // 0.5 – 1.0 (resolución de renderizado)
    shadows: true,
    effects: true,
    antialias: true,
    postFx: true, // bloom / oclusión ambiental / SMAA (solo si el nivel de calidad los permite)
    screenFx: true, // sacudidas y destellos de pantalla (las partículas siempre se muestran)
    auto: true, // calidad automática según el equipo (se desactiva al elegir una a mano)
    detected: '', // última calidad detectada ('' = aún sin detectar)
  }),
  audio: Object.freeze({
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    voice: 1, // voces de los diálogos
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
  const shadows = profile.shadows && graphics.shadows !== false;
  const postOn = graphics.postFx !== false;

  return {
    quality: tier,
    pixelRatioCap: profile.pixelRatioCap,
    renderScale,
    antialias: profile.antialias && graphics.antialias !== false,
    shadows,
    shadowMapSize: shadows ? profile.shadowMapSize : 0,
    effects: profile.effects && graphics.effects !== false,
    post: {
      bloom: postOn && profile.post.bloom,
      ao: postOn && profile.post.ao,
      smaa: postOn && profile.post.smaa,
    },
    material: profile.material,
    detail: profile.detail,
    textureSize: profile.textureSize,
    anisotropy: profile.anisotropy,
    reflections: profile.reflections,
    dynamicLights: profile.dynamicLights,
    crowdMax: profile.crowdMax,
    npcDetail: profile.npcDetail,
    propDensity: profile.propDensity,
    particleScale: profile.particleScale,
  };
}
