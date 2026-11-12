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

test('calidad MUY BAJA fuerza sombras, efectos y AA apagados aunque el usuario los active', () => {
  const g = resolveGraphics({ quality: 'veryLow', renderScale: 1, shadows: true, effects: true, antialias: true });
  assert.equal(g.shadows, false);
  assert.equal(g.effects, false);
  assert.equal(g.antialias, false);
  assert.ok(g.pixelRatioCap <= 1);
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
  assert.equal(resolveGraphics({ quality: 'extreme' }).quality, 'medium');
  assert.equal(resolveGraphics({ quality: '__proto__' }).quality, 'medium');
});

test('resolveGraphics() sin argumentos usa los valores por defecto', () => {
  assert.equal(resolveGraphics().quality, DEFAULT_SETTINGS.graphics.quality);
});

test('hay cinco niveles de calidad, de muy bajo a ultra', () => {
  assert.deepEqual([...QUALITY_ORDER], ['veryLow', 'low', 'medium', 'high', 'ultra']);
});

test('los niveles escalan de forma monótona (nunca un nivel superior da menos que uno inferior)', () => {
  const keys = ['pixelRatioCap', 'shadowMapSize', 'detail', 'textureSize', 'anisotropy', 'dynamicLights', 'crowdMax', 'npcDetail', 'propDensity', 'particleScale'];
  for (let i = 1; i < QUALITY_ORDER.length; i++) {
    const lo = QUALITY_PROFILES[QUALITY_ORDER[i - 1]];
    const hi = QUALITY_PROFILES[QUALITY_ORDER[i]];
    for (const k of keys) assert.ok(hi[k] >= lo[k], `${QUALITY_ORDER[i]}.${k} < ${QUALITY_ORDER[i - 1]}.${k}`);
  }
});

test('MUY BAJO no tiene sombras ni post-proceso pero SÍ PBR y reflejos (misma luz en todas las calidades); ULTRA lo tiene todo', () => {
  const vl = resolveGraphics({ quality: 'veryLow', shadows: true, effects: true, antialias: true, postFx: true });
  assert.equal(vl.shadows, false);
  assert.equal(vl.shadowMapSize, 0);
  assert.equal(vl.effects, false);
  assert.deepEqual(vl.post, { bloom: false, ao: false, smaa: false });
  assert.equal(vl.material, 'standard');
  assert.equal(vl.reflections, true);
  const ultra = resolveGraphics({ quality: 'ultra', shadows: true, effects: true, antialias: true, postFx: true });
  assert.deepEqual(ultra.post, { bloom: true, ao: true, smaa: true });
  assert.equal(ultra.material, 'standard'); // PBR estándar en todas: el barniz «physical» exageraba los reflejos
  assert.equal(ultra.shadowMapSize, 3072);
});

test('el interruptor de post-proceso apaga bloom/AO/SMAA aunque el nivel los permita', () => {
  const g = resolveGraphics({ quality: 'ultra', postFx: false });
  assert.deepEqual(g.post, { bloom: false, ao: false, smaa: false });
});

test('los perfiles están congelados en profundidad', () => {
  for (const id of QUALITY_ORDER) {
    assert.ok(Object.isFrozen(QUALITY_PROFILES[id]));
    assert.ok(Object.isFrozen(QUALITY_PROFILES[id].post));
  }
});

test('calidad automática: la GPU, la prueba de rendimiento y el equipo deciden la calidad', async () => {
  const { tierFromGpu, tierFromBenchmark, tierFromSignals } = await import('../src/core/hardware.js');
  assert.equal(tierFromGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'), 'veryLow');
  assert.equal(tierFromGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'low');
  assert.equal(tierFromGpu('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'medium');
  assert.equal(tierFromGpu('ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high');
  assert.equal(tierFromGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'ultra');
  assert.equal(tierFromGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11)'), 'high');
  assert.equal(tierFromGpu('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), 'high');
  assert.equal(tierFromGpu('Apple GPU'), 'medium');
  assert.equal(tierFromBenchmark(80), 'veryLow');
  assert.equal(tierFromBenchmark(1), 'ultra');
  // un PC «roñoso» nunca arranca por encima de BAJA aunque el nombre de la GPU engañe
  assert.equal(tierFromSignals({ gpu: 'NVIDIA GeForce RTX 3070', benchMs: 30, cores: 8, memory: 8 }), 'low');
  assert.equal(tierFromSignals({ gpu: 'NVIDIA GeForce RTX 3070', benchMs: 1, cores: 2, memory: 2 }), 'low');
  assert.equal(tierFromSignals({ gpu: 'Adreno (TM) 740', benchMs: 1, mobile: true }), 'medium');
  assert.equal(tierFromSignals({ webgl2: false }), 'veryLow');
  assert.equal(tierFromSignals({ gpu: 'Unknown', benchMs: NaN, cores: 8, memory: 8 }), 'medium');
});
