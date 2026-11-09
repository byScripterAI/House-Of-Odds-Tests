import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashSeed } from '../src/core/rng.js';

const sample = (rng, n) => Array.from({ length: n }, () => rng.next());

test('misma semilla → misma secuencia; semillas distintas → secuencias distintas', () => {
  assert.deepEqual(sample(new Rng(123), 20), sample(new Rng(123), 20));
  assert.notDeepEqual(sample(new Rng(123), 20), sample(new Rng(124), 20));
});

test('semilla de texto equivale a su hash', () => {
  assert.deepEqual(sample(new Rng('casino'), 10), sample(new Rng(hashSeed('casino')), 10));
});

test('next() siempre está en [0, 1)', () => {
  for (const v of sample(new Rng(7), 5000)) assert.ok(v >= 0 && v < 1);
});

test('int() es inclusivo en ambos extremos y respeta el rango', () => {
  const rng = new Rng(99);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = rng.int(1, 6);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 6);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(rng.int(5, 5), 5);
  assert.throws(() => rng.int(3, 1), RangeError);
  assert.throws(() => rng.int(1.5, 3), RangeError);
});

test('weighted() respeta las proporciones y nunca elige peso 0', () => {
  const rng = new Rng(2024);
  const items = [
    { id: 'raro', weight: 1 },
    { id: 'comun', weight: 3 },
    { id: 'nunca', weight: 0 },
  ];
  const counts = { raro: 0, comun: 0, nunca: 0 };
  const n = 20000;
  for (let i = 0; i < n; i++) counts[rng.weighted(items).id]++;
  assert.equal(counts.nunca, 0);
  const ratio = counts.comun / n;
  assert.ok(Math.abs(ratio - 0.75) < 0.03, `proporción de «comun» fuera de rango: ${ratio}`);
});

test('weighted() valida sus entradas', () => {
  const rng = new Rng(1);
  assert.throws(() => rng.weighted([]), RangeError);
  assert.throws(() => rng.weighted([{ weight: 0 }]), RangeError);
  assert.throws(() => rng.weighted([{ weight: -1 }, { weight: 2 }]), RangeError);
  assert.throws(() => rng.weighted([{ weight: NaN }]), RangeError);
  assert.equal(rng.weighted(['x'], () => 5), 'x');
});

test('pick() y shuffle()', () => {
  const rng = new Rng(5);
  assert.throws(() => rng.pick([]), RangeError);
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = rng.shuffle(original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8], 'no muta el original');
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original, 'conserva los elementos');
});

test('fork() es determinista y depende de la etiqueta', () => {
  const a = new Rng(10).fork('slots');
  const b = new Rng(10).fork('slots');
  const c = new Rng(10).fork('otra');
  assert.deepEqual(sample(a, 10), sample(b, 10));
  assert.notDeepEqual(sample(new Rng(10).fork('slots'), 10), sample(c, 10));
});

test('sin semilla se genera una aleatoria válida', () => {
  const v = new Rng().next();
  assert.ok(v >= 0 && v < 1);
});
