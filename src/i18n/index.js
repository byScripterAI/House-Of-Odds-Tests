/**
 * Instancia global de i18n enlazada al navegador (localStorage + navigator).
 * El resto del juego solo importa `t` (y `i18n` para cambiar de idioma).
 */
import { STORAGE } from '../config.js';
import { createI18n } from './i18n.js';
import en from './lang/en.js';
import es from './lang/es.js';
import de from './lang/de.js';
import fr from './lang/fr.js';
import pt from './lang/pt.js';
import zh from './lang/zh.js';
import storyEn from './story/en.js';
import storyEs from './story/es.js';
import storyDe from './story/de.js';
import storyFr from './story/fr.js';
import storyPt from './story/pt.js';
import storyZh from './story/zh.js';
import uiEn from './ui2/en.js';
import uiEs from './ui2/es.js';
import uiDe from './ui2/de.js';
import uiFr from './ui2/fr.js';
import uiPt from './ui2/pt.js';
import uiZh from './ui2/zh.js';

// Interfaz + historia (personajes, misiones, diálogos) en un único diccionario por idioma.
export const DICTIONARIES = Object.freeze({
  en: { ...en, ...storyEn, ...uiEn },
  es: { ...es, ...storyEs, ...uiEs },
  de: { ...de, ...storyDe, ...uiDe },
  fr: { ...fr, ...storyFr, ...uiFr },
  pt: { ...pt, ...storyPt, ...uiPt },
  zh: { ...zh, ...storyZh, ...uiZh },
});

const storage = (() => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // acceso denegado (cookies bloqueadas)
  }
})();

const getTags = () => {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (!nav) return [];
  return Array.isArray(nav.languages) && nav.languages.length ? [...nav.languages] : nav.language ? [nav.language] : [];
};

export const i18n = createI18n({ dictionaries: DICTIONARIES, storage, storageKey: STORAGE.languageKey, getTags });
export const t = (key, params) => i18n.t(key, params);
export { LANGUAGES } from './i18n.js';
