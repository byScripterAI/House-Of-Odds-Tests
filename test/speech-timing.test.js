import assert from 'node:assert/strict';
import test from 'node:test';
import { speechTimeline, syllables, visibleCount } from '../src/ui/speech-timing.js';

test('sílabas aproximadas', () => {
  assert.equal(syllables('sí'), 1);
  assert.equal(syllables('casino'), 3);
  assert.ok(syllables('extraordinariamente') >= 6);
  assert.equal(syllables('你好'), 2);
});

test('el texto termina de aparecer con la grabación (menos el silencio final)', () => {
  const tl = speechTimeline('Bienvenido a House of Odds, el casino más antiguo de la ciudad.', { duration: 4 });
  assert.ok(Math.abs(tl.end - (4 - 0.3)) < 1e-6);
  assert.equal(visibleCount(tl, 0), 0);
  assert.equal(visibleCount(tl, 10), tl.chars.length);
});

test('las palabras largas tardan más que las cortas y la puntuación hace pausa', () => {
  const tl = speechTimeline('sí extraordinariamente, no', { duration: 3 });
  const t = (i) => tl.times[i];
  const shortDur = t(3) - t(0); // «sí »
  const longStart = 3;
  const longEnd = 'sí extraordinariamente'.length;
  assert.ok(t(longEnd) - t(longStart) > shortDur * 4);
  // la coma retrasa la palabra siguiente
  const comma = 'sí extraordinariamente'.length;
  assert.ok(t(comma + 1) - t(comma) > (t(longEnd) - t(longStart)) / 20);
});

test('sin grabación usa un ritmo de lectura proporcional', () => {
  const a = speechTimeline('Hola.', { perSyllable: 0.1 });
  const b = speechTimeline('Hola, ¿qué tal estás hoy por aquí?', { perSyllable: 0.1 });
  assert.ok(b.end > a.end * 3);
});
