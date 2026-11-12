import { DEFAULT_SETTINGS, QUALITY_ORDER, STORAGE } from '../config.js';
import { hashSeed } from '../core/rng.js';

/**
 * Guardado en LocalStorage (o en memoria si no está disponible).
 *
 * Formato en disco: { v: 1, sum, body } donde `body` es el JSON del payload
 * { schema, savedAt, data } y `sum` su checksum (detecta corrupción/edición).
 * Escritura segura: antes de sobrescribir, la copia válida anterior pasa a `.bak`.
 * Lectura: principal → copia → fallo explícito (nunca se sobrescribe a ciegas).
 */

export const MIGRATIONS = {
  // 1: (payload) => ({ ...payload, schema: 2, data: { ... } }),  ← futuras versiones
};

export function wrap(data, schema = STORAGE.schemaVersion) {
  const body = JSON.stringify({ schema, savedAt: new Date().toISOString(), data });
  return JSON.stringify({ v: 1, sum: hashSeed(body), body });
}

export function unwrap(text) {
  try {
    const outer = JSON.parse(text);
    if (!outer || typeof outer.body !== 'string') return { ok: false, reason: 'format' };
    if (hashSeed(outer.body) !== outer.sum) return { ok: false, reason: 'checksum' };
    const payload = JSON.parse(outer.body);
    if (!payload || typeof payload !== 'object' || !Number.isInteger(payload.schema) || typeof payload.data !== 'object' || payload.data === null) {
      return { ok: false, reason: 'format' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'parse' };
  }
}

export function migrate(payload, target = STORAGE.schemaVersion) {
  let p = payload;
  if (p.schema > target) return { ok: false, reason: 'newer' };
  while (p.schema < target) {
    const fn = MIGRATIONS[p.schema];
    if (!fn) return { ok: false, reason: 'no-migration' };
    p = fn(p);
  }
  return { ok: true, payload: p };
}

const clamp = (v, min, max, d) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

/** Completa y limita ajustes de usuario (entrada no fiable → ajustes válidos). */
export function sanitizeSettings(raw, defaults = DEFAULT_SETTINGS) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const g = r.graphics ?? {};
  const a = r.audio ?? {};
  const c = r.controls ?? {};
  return {
    graphics: {
      quality: QUALITY_ORDER.includes(g.quality) ? g.quality : defaults.graphics.quality,
      renderScale: clamp(g.renderScale, 0.5, 1, defaults.graphics.renderScale),
      shadows: bool(g.shadows, defaults.graphics.shadows),
      effects: bool(g.effects, defaults.graphics.effects),
      antialias: bool(g.antialias, defaults.graphics.antialias),
      postFx: bool(g.postFx, defaults.graphics.postFx),
      screenFx: bool(g.screenFx, defaults.graphics.screenFx),
      auto: bool(g.auto, defaults.graphics.auto),
      detected: QUALITY_ORDER.includes(g.detected) ? g.detected : '',
    },
    audio: {
      master: clamp(a.master, 0, 1, defaults.audio.master),
      music: clamp(a.music, 0, 1, defaults.audio.music),
      sfx: clamp(a.sfx, 0, 1, defaults.audio.sfx),
      voice: clamp(a.voice, 0, 1, defaults.audio.voice),
    },
    controls: {
      mouseSensitivity: clamp(c.mouseSensitivity, 0.2, 3, defaults.controls.mouseSensitivity),
      showControls: bool(c.showControls, defaults.controls.showControls),
    },
  };
}

function detectStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__hoo_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

export class SaveManager {
  /** @param {{getItem:Function,setItem:Function,removeItem:Function}|null|undefined} storage  undefined → localStorage del navegador */
  constructor(storage = undefined) {
    const real = storage === undefined ? detectStorage() : storage;
    this.persistent = !!real;
    this.storage = real ?? memoryStorage();
  }

  #read(key) {
    try {
      const text = this.storage.getItem(key);
      if (text === null || text === undefined) return { ok: false, reason: 'none' };
      const u = unwrap(text);
      if (!u.ok) return u;
      return migrate(u.payload);
    } catch {
      return { ok: false, reason: 'storage' };
    }
  }

  /** @returns {{ok:true,data:object,source:'main'|'backup'}|{ok:false,reason:string}} */
  load() {
    const main = this.#read(STORAGE.saveKey);
    if (main.ok) return { ok: true, data: main.payload.data, source: 'main' };
    const backup = this.#read(STORAGE.backupKey);
    if (backup.ok) return { ok: true, data: backup.payload.data, source: 'backup' };
    const reason = main.reason === 'none' && backup.reason === 'none' ? 'none' : main.reason === 'none' ? backup.reason : main.reason;
    return { ok: false, reason };
  }

  has() {
    return this.load().ok;
  }

  /** @returns {boolean} true si se escribió correctamente */
  save(data) {
    try {
      const text = wrap(data);
      const previous = this.storage.getItem(STORAGE.saveKey);
      if (previous && unwrap(previous).ok) this.storage.setItem(STORAGE.backupKey, previous);
      this.storage.setItem(STORAGE.saveKey, text);
      return true;
    } catch {
      return false; // cuota llena o almacenamiento bloqueado
    }
  }

  clear() {
    try {
      this.storage.removeItem(STORAGE.saveKey);
      this.storage.removeItem(STORAGE.backupKey);
    } catch {
      /* nada que hacer */
    }
  }

  loadSettings() {
    try {
      const text = this.storage.getItem(STORAGE.settingsKey);
      return sanitizeSettings(text ? JSON.parse(text) : null);
    } catch {
      return sanitizeSettings(null);
    }
  }

  saveSettings(settings) {
    try {
      this.storage.setItem(STORAGE.settingsKey, JSON.stringify(sanitizeSettings(settings)));
      return true;
    } catch {
      return false;
    }
  }
}
