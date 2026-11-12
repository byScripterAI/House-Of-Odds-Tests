import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARIES } from '../src/i18n/index.js';
import { LANGUAGES, LANGUAGE_CODES, createI18n, detectLanguage, normalizeTag } from '../src/i18n/i18n.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { ACHIEVEMENTS, OBJECTIVES, ZONES } from '../src/data/progression.js';
import { EFFECTS, SYMBOLS } from '../src/data/symbols.js';

test('hay exactamente 6 idiomas y cada uno tiene diccionario', () => {
  assert.deepEqual([...LANGUAGE_CODES], ['en', 'es', 'de', 'fr', 'pt', 'zh']);
  assert.equal(LANGUAGES.length, 6);
  for (const c of LANGUAGE_CODES) assert.ok(DICTIONARIES[c], c);
});

test('los 6 diccionarios tienen EXACTAMENTE las mismas claves', () => {
  const ref = Object.keys(DICTIONARIES.en).sort();
  for (const c of LANGUAGE_CODES) {
    const keys = Object.keys(DICTIONARIES[c]).sort();
    assert.deepEqual(keys.filter((k) => !ref.includes(k)), [], `${c}: claves de más`);
    assert.deepEqual(ref.filter((k) => !keys.includes(k)), [], `${c}: claves que faltan`);
  }
});

test('ninguna traducción está vacía y los marcadores {x} coinciden con el inglés', () => {
  const holes = (v) => (typeof v === 'string' ? [v] : Object.values(v)).flatMap((s) => s.match(/\{[A-Za-z0-9_]+\}/g) ?? []);
  for (const c of LANGUAGE_CODES) {
    for (const [k, v] of Object.entries(DICTIONARIES[c])) {
      const text = typeof v === 'string' ? v : Object.values(v).join('');
      assert.ok(text.trim().length > 0, `${c}.${k} vacío`);
      const want = new Set(holes(DICTIONARIES.en[k]));
      for (const h of new Set(holes(v))) assert.ok(want.has(h), `${c}.${k}: marcador ${h} que no existe en inglés`);
    }
  }
});

test('todo id de datos tiene su texto en los 6 idiomas', () => {
  const need = [];
  for (const u of Object.values(UPGRADES)) need.push(`upgrade.${u.id}.name`, `upgrade.${u.id}.desc`);
  for (const o of OBJECTIVES) need.push(`objective.${o.id}.name`, `objective.${o.id}.desc`);
  for (const a of ACHIEVEMENTS) need.push(`achievement.${a.id}.name`, `achievement.${a.id}.desc`);
  for (const id of Object.keys(SYMBOLS)) need.push(`symbol.${id}`);
  for (const id of Object.keys(EFFECTS)) need.push(`effect.${id}`);
  for (const id of Object.keys(ZONES)) need.push(`zone.${id}`);
  for (const c of LANGUAGE_CODES) for (const k of need) assert.ok(Object.hasOwn(DICTIONARIES[c], k), `${c}: falta ${k}`);
});

test('detección: idioma principal del dispositivo; fuera de los 6 o sin dato → inglés', () => {
  assert.equal(detectLanguage(['es-ES', 'en']), 'es');
  assert.equal(detectLanguage(['de-AT']), 'de');
  assert.equal(detectLanguage(['fr-CA']), 'fr');
  assert.equal(detectLanguage(['pt-BR']), 'pt');
  assert.equal(detectLanguage(['PT_pt']), 'pt');
  assert.equal(detectLanguage(['zh-CN']), 'zh');
  assert.equal(detectLanguage(['zh-Hans-CN']), 'zh');
  assert.equal(detectLanguage(['ja-JP', 'es']), 'en');
  assert.equal(detectLanguage([]), 'en');
  assert.equal(detectLanguage(null), 'en');
  assert.equal(detectLanguage(undefined), 'en');
  assert.equal(detectLanguage(['']), 'en');
  assert.equal(detectLanguage('it'), 'en');
  assert.equal(normalizeTag(42), null);
});

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m };
};

test('primera entrada: detecta y guarda; después NO vuelve a detectar', () => {
  const storage = fakeStorage();
  let tags = ['de-DE'];
  const mk = () => createI18n({ dictionaries: DICTIONARIES, storage, getTags: () => tags });
  const a = mk();
  assert.equal(a.init(), 'de');
  assert.equal(storage.getItem('houseofodds.language'), 'de');
  tags = ['fr-FR']; // el dispositivo «cambia»: da igual, ya hay idioma asignado
  const b = mk();
  assert.equal(b.init(), 'de');
});

test('un valor guardado inválido se ignora y se vuelve a detectar', () => {
  const storage = fakeStorage();
  storage.setItem('houseofodds.language', 'klingon');
  const i = createI18n({ dictionaries: DICTIONARIES, storage, getTags: () => ['pt-PT'] });
  assert.equal(i.init(), 'pt');
});

test('sin almacenamiento (o que lanza) sigue funcionando en memoria', () => {
  const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const i = createI18n({ dictionaries: DICTIONARIES, storage: boom, getTags: () => ['es'] });
  assert.equal(i.init(), 'es');
  assert.equal(i.persistent, false);
  assert.equal(i.set('zh'), true);
  assert.equal(i.lang, 'zh');
});

test('cambio manual: guarda, avisa una sola vez y rechaza códigos inválidos', () => {
  const storage = fakeStorage();
  const i = createI18n({ dictionaries: DICTIONARIES, storage, getTags: () => ['en'] });
  i.init();
  const seen = [];
  i.onChange((c) => seen.push(c));
  assert.equal(i.set('xx'), false);
  i.set('fr');
  i.set('fr');
  assert.deepEqual(seen, ['fr']);
  assert.equal(storage.getItem('houseofodds.language'), 'fr');
  assert.equal(i.t('menu.new'), 'NOUVELLE PARTIE');
});

test('t(): parámetros, globales {MARKS}, plurales y clave ausente', () => {
  const i = createI18n({ dictionaries: DICTIONARIES, storage: fakeStorage(), getTags: () => ['en'] });
  i.init();
  assert.equal(i.t('hud.objectiveCount', { value: 3, target: 5, reward: 25 }), '3 / 5  ·  +25 MARKS');
  assert.equal(i.t('toast.newSymbols', { n: 1, list: 'A' }), 'New symbol: A');
  assert.equal(i.t('toast.newSymbols', { n: 2, list: 'A, B' }), 'New symbols: A, B');
  i.set('zh');
  assert.equal(i.t('toast.newSymbols', { n: 2, list: 'A' }), '新符号：A');
  assert.equal(i.t('no.such.key'), 'no.such.key');
});
