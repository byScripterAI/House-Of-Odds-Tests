import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, STORAGE } from '../src/config.js';
import { MIGRATIONS, SaveManager, migrate, sanitizeSettings, unwrap, wrap } from '../src/save/save-manager.js';

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

test('guardar y cargar: ida y vuelta', () => {
  const sm = new SaveManager(fakeStorage());
  assert.equal(sm.has(), false);
  assert.deepEqual(sm.load(), { ok: false, reason: 'none' });
  assert.equal(sm.save({ marks: 42, upgrades: ['a'] }), true);
  const r = sm.load();
  assert.equal(r.ok, true);
  assert.equal(r.source, 'main');
  assert.deepEqual(r.data, { marks: 42, upgrades: ['a'] });
});

test('el segundo guardado deja la copia anterior en .bak', () => {
  const st = fakeStorage();
  const sm = new SaveManager(st);
  sm.save({ n: 1 });
  sm.save({ n: 2 });
  assert.deepEqual(unwrap(st.getItem(STORAGE.backupKey)).payload.data, { n: 1 });
  assert.deepEqual(sm.load().data, { n: 2 });
});

test('principal corrupto → se recupera la copia; ambos corruptos → fallo explícito', () => {
  const st = fakeStorage();
  const sm = new SaveManager(st);
  sm.save({ n: 1 });
  sm.save({ n: 2 });
  st.setItem(STORAGE.saveKey, '{"v":1,"sum":1,"body":"{}"}'); // checksum incorrecto
  const r = sm.load();
  assert.equal(r.ok, true);
  assert.equal(r.source, 'backup');
  assert.deepEqual(r.data, { n: 1 });
  st.setItem(STORAGE.backupKey, 'basura');
  const bad = sm.load();
  assert.equal(bad.ok, false);
  assert.notEqual(bad.reason, 'none');
});

test('un guardado manipulado a mano (checksum) se rechaza', () => {
  const text = wrap({ marks: 1 });
  const tampered = text.replace('\\"marks\\":1', '\\"marks\\":999999');
  assert.notEqual(tampered, text);
  assert.equal(unwrap(tampered).ok, false);
});

test('no sobrescribe el .bak con un principal corrupto', () => {
  const st = fakeStorage();
  const sm = new SaveManager(st);
  sm.save({ n: 1 });
  sm.save({ n: 2 });
  st.setItem(STORAGE.saveKey, 'corrupto');
  sm.save({ n: 3 });
  assert.deepEqual(unwrap(st.getItem(STORAGE.backupKey)).payload.data, { n: 1 });
});

test('migraciones: versiones antiguas se migran, futuras se rechazan', () => {
  assert.equal(migrate({ schema: 5, data: {} }, 1).reason, 'newer');
  assert.equal(migrate({ schema: 1, data: {} }, 3).reason, 'no-migration');
  MIGRATIONS[1] = (p) => ({ ...p, schema: 2, data: { ...p.data, extra: true } });
  try {
    const r = migrate({ schema: 1, data: { a: 1 } }, 2);
    assert.deepEqual([r.ok, r.payload.schema, r.payload.data.extra], [true, 2, true]);
  } finally {
    delete MIGRATIONS[1];
  }
});

test('clear borra progreso y copia pero no los ajustes', () => {
  const st = fakeStorage();
  const sm = new SaveManager(st);
  sm.save({ n: 1 });
  sm.save({ n: 2 });
  sm.saveSettings({ audio: { master: 0.3 } });
  sm.clear();
  assert.equal(sm.has(), false);
  assert.equal(sm.loadSettings().audio.master, 0.3);
});

test('almacenamiento que lanza (cuota/bloqueado): save devuelve false, load no revienta', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const sm = new SaveManager(broken);
  assert.equal(sm.save({ a: 1 }), false);
  assert.equal(sm.load().ok, false);
  assert.doesNotThrow(() => sm.clear());
  assert.equal(sm.loadSettings().graphics.quality, DEFAULT_SETTINGS.graphics.quality);
});

test('sin LocalStorage (null) funciona en memoria', () => {
  const sm = new SaveManager(null);
  assert.equal(sm.persistent, false);
  sm.save({ a: 1 });
  assert.deepEqual(sm.load().data, { a: 1 });
});

test('sanitizeSettings limita rangos, tipos y calidades desconocidas', () => {
  const s = sanitizeSettings({ graphics: { quality: 'extreme', renderScale: 9, shadows: 'sí' }, audio: { master: -3, music: 'x', sfx: 0.5 }, controls: { mouseSensitivity: 100 } });
  assert.equal(s.graphics.quality, 'medium');
  assert.equal(s.graphics.renderScale, 1);
  assert.equal(s.graphics.shadows, true);
  assert.equal(sanitizeSettings({ graphics: { quality: 'ultra' } }).graphics.quality, 'ultra');
  assert.equal(sanitizeSettings({ graphics: { quality: 'veryLow' } }).graphics.quality, 'veryLow');
  assert.equal(s.audio.master, 0);
  assert.equal(s.audio.music, DEFAULT_SETTINGS.audio.music);
  assert.equal(s.audio.sfx, 0.5);
  assert.equal(s.controls.mouseSensitivity, 3);
  assert.deepEqual(sanitizeSettings(null), JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
});

test('ajustes corruptos en disco → valores por defecto', () => {
  const sm = new SaveManager(fakeStorage({ [STORAGE.settingsKey]: '{no es json' }));
  assert.deepEqual(sm.loadSettings(), JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
});
