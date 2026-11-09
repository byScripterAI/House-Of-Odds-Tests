import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  ECONOMY,
  QUALITY_ORDER,
  QUALITY_PROFILES,
  resolveGraphics,
} from '../src/config.js';

test('el vocabulario de la economía es MARKS / PRESTIGE / COLLECTION', () => {
  assert.equal(ECONOMY.currency.label, 'MARKS');
  assert.equal(ECONOMY.prestige.label, 'PRESTIGE');
  assert.equal(ECONOMY.collection.label, 'COLLECTION');
});

test('QUALITY_ORDER coincide con los perfiles definidos', () => {
  assert.deepEqual([...QUALITY_ORDER].sort(), Object.keys(QUALITY_PROFILES).sort());
  assert.ok(Object.hasOwn(QUALITY_PROFILES, DEFAULT_SETTINGS.graphics.quality));
});

test('la configuración está congelada (no se muta por accidente)', () => {
  assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
  assert.ok(Object.isFrozen(DEFAULT_SETTINGS.graphics));
  assert.ok(Object.isFrozen(QUALITY_PROFILES.low));
});

test('structuredClone de DEFAULT_SETTINGS produce una copia mutable', () => {
  const copy = structuredClone(DEFAULT_SETTINGS);
  copy.graphics.quality = 'high';
  assert.equal(DEFAULT_SETTINGS.graphics.quality, 'medium');
});

test('calidad baja fuerza sombras, efectos y AA apagados aunque el usuario los active', () => {
  const g = resolveGraphics({ quality: 'low', renderScale: 1, shadows: true, effects: true, antialias: true });
  assert.equal(g.shadows, false);
  assert.equal(g.effects, false);
  assert.equal(g.antialias, false);
  assert.equal(g.pixelRatioCap, 1);
});

test('los interruptores solo pueden apagar lo que el perfil permite', () => {
  const on = resolveGraphics({ quality: 'high', shadows: true, effects: true, antialias: true });
  assert.equal(on.shadows, true);
  assert.equal(on.shadowMapSize, 2048);
  assert.equal(on.effects, true);

  const off = resolveGraphics({ quality: 'high', shadows: false, effects: false, antialias: false });
  assert.equal(off.shadows, false);
  assert.equal(off.effects, false);
  assert.equal(off.antialias, false);
});

test('renderScale se limita a [0.5, 1] y tolera valores no numéricos', () => {
  assert.equal(resolveGraphics({ quality: 'medium', renderScale: 0.1 }).renderScale, 0.5);
  assert.equal(resolveGraphics({ quality: 'medium', renderScale: 3 }).renderScale, 1);
  assert.equal(resolveGraphics({ quality: 'medium', renderScale: 'x' }).renderScale, 1);
  assert.equal(resolveGraphics({ quality: 'medium', renderScale: 0.75 }).renderScale, 0.75);
});

test('una calidad desconocida cae a «medium»', () => {
  assert.equal(resolveGraphics({ quality: 'ultra' }).quality, 'medium');
  assert.equal(resolveGraphics({ quality: '__proto__' }).quality, 'medium');
});

test('resolveGraphics() sin argumentos usa los valores por defecto', () => {
  assert.equal(resolveGraphics().quality, DEFAULT_SETTINGS.graphics.quality);
});
