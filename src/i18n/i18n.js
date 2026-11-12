/**
 * Núcleo de internacionalización. Módulo PURO (sin DOM ni Three.js): recibe
 * el almacenamiento y las etiquetas de idioma del navegador por inyección,
 * de modo que se puede probar con Node.
 *
 * Reglas (especificación del proyecto):
 *  - Idiomas: en, es, de, fr, pt, zh (chino simplificado).
 *  - Primera entrada: se usa el idioma del navegador/dispositivo si es uno de
 *    los 6; si no se puede detectar o no es uno de los 6 → inglés.
 *  - Una vez asignado (o elegido), se guarda y NO se vuelve a detectar:
 *    solo cambia si el jugador lo cambia a mano en Ajustes.
 */
import { ECONOMY } from '../config.js';

export const LANGUAGES = Object.freeze([
  Object.freeze({ code: 'en', native: 'English' }),
  Object.freeze({ code: 'es', native: 'Español' }),
  Object.freeze({ code: 'de', native: 'Deutsch' }),
  Object.freeze({ code: 'fr', native: 'Français' }),
  Object.freeze({ code: 'pt', native: 'Português' }),
  Object.freeze({ code: 'zh', native: '简体中文' }),
]);

export const LANGUAGE_CODES = Object.freeze(LANGUAGES.map((l) => l.code));
export const DEFAULT_LANGUAGE = 'en';

/** Etiqueta BCP-47 → código soportado (o null). Todo «zh-*» se sirve en chino simplificado. */
export function normalizeTag(tag) {
  if (typeof tag !== 'string') return null;
  const base = tag.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return LANGUAGE_CODES.includes(base) ? base : null;
}

/**
 * Elige idioma a partir de las preferencias del navegador. Solo cuenta el
 * idioma PRINCIPAL del dispositivo (el primero): si no es uno de los 6 → inglés.
 * @param {string[]|string|null|undefined} tags
 */
export function detectLanguage(tags) {
  const list = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const first = list.find((t) => typeof t === 'string' && t.trim());
  return normalizeTag(first) ?? DEFAULT_LANGUAGE;
}

/** Variables siempre disponibles en las plantillas: {MARKS}, {PRESTIGE}, {COLLECTION}. */
const GLOBALS = Object.freeze({
  MARKS: ECONOMY.currency.label,
  PRESTIGE: ECONOMY.prestige.label,
  COLLECTION: ECONOMY.collection.label,
});

/**
 * @param {{dictionaries: Record<string, Record<string, string|object>>,
 *          storage?: {getItem:Function,setItem:Function}|null,
 *          storageKey?: string,
 *          getTags?: () => string[]}} opts
 */
export function createI18n({ dictionaries, storage = null, storageKey = 'houseofodds.language', getTags = () => [] }) {
  let lang = DEFAULT_LANGUAGE;
  let persistent = false;
  const listeners = new Set();
  const rules = new Map();

  const read = () => {
    try {
      return storage?.getItem(storageKey) ?? null;
    } catch {
      return null;
    }
  };
  const write = (code) => {
    try {
      storage?.setItem(storageKey, code);
      return true;
    } catch {
      return false;
    }
  };

  const plural = (code, n) => {
    if (!rules.has(code)) rules.set(code, new Intl.PluralRules(code));
    return rules.get(code).select(n);
  };

  const fill = (template, params) =>
    template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name) => {
      if (params && Object.hasOwn(params, name)) return String(params[name]);
      if (Object.hasOwn(GLOBALS, name)) return GLOBALS[name];
      return whole;
    });

  const api = {
    /** Carga el idioma guardado; si no hay, lo detecta y lo guarda. Devuelve el código activo. */
    init() {
      const stored = read();
      if (stored && LANGUAGE_CODES.includes(stored)) {
        lang = stored;
        persistent = true;
      } else {
        lang = detectLanguage(getTags());
        persistent = write(lang);
      }
      return lang;
    },

    get lang() {
      return lang;
    },

    /** true si la elección quedó guardada de verdad (el almacenamiento puede estar bloqueado). */
    get persistent() {
      return persistent;
    },

    /** Cambio manual (Ajustes). Guarda, y avisa a los oyentes solo si cambió. */
    set(code) {
      if (!LANGUAGE_CODES.includes(code)) return false;
      const changed = code !== lang;
      lang = code;
      persistent = write(code);
      if (changed) for (const fn of [...listeners]) fn(code);
      return true;
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    has(key) {
      return Object.hasOwn(dictionaries[lang] ?? {}, key) || Object.hasOwn(dictionaries[DEFAULT_LANGUAGE] ?? {}, key);
    },

    /**
     * Traduce `key`. Las plantillas usan {nombre}. Si el valor es un objeto
     * ({one, other, …}) se elige la forma plural según `params.n`.
     */
    t(key, params) {
      let value = dictionaries[lang]?.[key] ?? dictionaries[DEFAULT_LANGUAGE]?.[key];
      if (value === undefined) return key;
      if (typeof value === 'object') {
        const n = Number(params?.n ?? 0);
        value = value[plural(lang, n)] ?? value.other ?? '';
      }
      return fill(value, params);
    },
  };
  return api;
}
