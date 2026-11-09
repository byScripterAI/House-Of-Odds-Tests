import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/event-bus.js';

test('on/emit entrega el payload y devuelve cuántos manejadores se invocaron', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('x', (p) => seen.push(['a', p]));
  bus.on('x', (p) => seen.push(['b', p]));
  assert.equal(bus.emit('x', 42), 2);
  assert.deepEqual(seen, [['a', 42], ['b', 42]]);
  assert.equal(bus.emit('sin-oyentes'), 0);
});

test('on devuelve una función que desuscribe', () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on('x', () => n++);
  bus.emit('x');
  off();
  bus.emit('x');
  assert.equal(n, 1);
  assert.equal(bus.listenerCount('x'), 0);
});

test('once se ejecuta una sola vez', () => {
  const bus = new EventBus();
  let n = 0;
  bus.once('x', () => n++);
  bus.emit('x');
  bus.emit('x');
  assert.equal(n, 1);
});

test('un manejador que lanza no impide que se ejecuten los demás', () => {
  const bus = new EventBus();
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    let reached = false;
    bus.on('x', () => {
      throw new Error('fallo');
    });
    bus.on('x', () => {
      reached = true;
    });
    assert.equal(bus.emit('x'), 2);
    assert.equal(reached, true);
    assert.equal(logged.length, 1);
  } finally {
    console.error = original;
  }
});

test('desuscribir a otro manejador durante la emisión evita que se ejecute', () => {
  const bus = new EventBus();
  const calls = [];
  const second = () => calls.push('second');
  bus.on('x', () => {
    calls.push('first');
    bus.off('x', second);
  });
  bus.on('x', second);
  bus.emit('x');
  assert.deepEqual(calls, ['first']);
});

test('rechaza manejadores que no son funciones', () => {
  const bus = new EventBus();
  assert.throws(() => bus.on('x', null), TypeError);
  assert.throws(() => bus.once('x', 'no'), TypeError);
});

test('clear elimina todas las suscripciones', () => {
  const bus = new EventBus();
  bus.on('a', () => {});
  bus.on('b', () => {});
  bus.clear();
  assert.equal(bus.listenerCount('a') + bus.listenerCount('b'), 0);
});
