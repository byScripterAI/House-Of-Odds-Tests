import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS, SOUND_ALIASES, SOUND_BY_NAME, SOUND_NAMES } from '../src/audio/sound-list.js';
import { ZONE_SOUND } from '../src/audio/audio-engine.js';
import { auditAudio, buildManifest, renderSoundsMarkdown, soundForFile } from '../scripts/audio-manifest.mjs';
import { ZONES } from '../src/data/progression.js';

test('catálogo: nombres únicos, camelCase válido y descripciones', () => {
  assert.equal(new Set(SOUND_NAMES).size, SOUND_NAMES.length);
  assert.ok(SOUND_NAMES.length >= 90, 'se piden «muchísimos» sonidos');
  for (const s of SOUNDS) {
    assert.match(s.name, /^[a-z][A-Za-z0-9]*$/);
    assert.ok(s.desc.length > 10 && s.group);
  }
});

test('catálogo: los «fallback» y los alias apuntan a sonidos que existen', () => {
  for (const s of SOUNDS) if (s.fallback) assert.ok(SOUND_BY_NAME[s.fallback], `${s.name} → ${s.fallback}`);
  for (const target of Object.values(SOUND_ALIASES)) assert.ok(SOUND_BY_NAME[target]);
});

test('catálogo: incluye todo lo que pidió el usuario', () => {
  for (const n of ['step', 'ambience', 'ambienceMenu', 'reelSpin', 'buttonPress', 'applause', 'buy', 'doorOpen', 'musicMenu', 'musicCredits', 'musicEnding', 'musicGame', 'cardShuffle', 'cardDeal', 'rouletteSpin', 'npcBlip', 'dialogText']) {
    assert.ok(SOUND_BY_NAME[n], `falta ${n}`);
  }
});

test('zonas: toda zona del juego tiene música y ambiente del catálogo', () => {
  for (const id of Object.keys(ZONES)) {
    assert.ok(ZONE_SOUND[id], `zona ${id} sin sonido`);
    assert.ok(SOUND_BY_NAME[ZONE_SOUND[id].music]?.loop && SOUND_BY_NAME[ZONE_SOUND[id].ambience]?.loop);
  }
});

test('manifiesto: reconoce nombres, variantes, alias y mayúsculas', () => {
  assert.equal(soundForFile('click.mp3'), 'click');
  assert.equal(soundForFile('step_3.mp3'), 'step');
  assert.equal(soundForFile('Click.MP3'), 'click');
  assert.equal(soundForFile('music.mp3'), 'musicGame');
  assert.equal(soundForFile('door.mp3'), 'doorLocked');
  assert.equal(soundForFile('musicNeon_2.mp3'), 'musicNeon');
  assert.equal(soundForFile('nada.mp3'), null);
  assert.equal(soundForFile('click.wav'), null);
});

test('manifiesto: estructura y avisos', () => {
  const m = buildManifest({ files: ['click.mp3'], voice: ['victoria_m01_001.mp3'] }, new Date('2026-01-01T00:00:00Z'));
  assert.deepEqual(Object.keys(m), ['generated', 'files', 'voice']);
  assert.equal(m.generated, '2026-01-01T00:00:00.000Z');
  const w = auditAudio({ files: ['Click.mp3', 'raro.mp3', 'step_1.mp3'] });
  assert.equal(w.length, 2);
  assert.match(w[0], /mayúsculas/);
  assert.match(w[1], /ningún sonido/);
});

test('SOUNDS.md está al día con el catálogo (ejecuta «npm run audio» si falla)', () => {
  const md = readFileSync(new URL('../assets/audio/SOUNDS.md', import.meta.url), 'utf8');
  assert.equal(md, renderSoundsMarkdown());
});

test('vercel.json es JSON válido y regenera el manifiesto en cada despliegue', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.match(v.buildCommand, /build-audio-manifest/);
  assert.equal(v.outputDirectory, '.');
});
