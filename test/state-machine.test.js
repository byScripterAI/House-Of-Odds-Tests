import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine } from '../src/core/state-machine.js';
import { InvalidTransitionError } from '../src/core/errors.js';
import { EventBus } from '../src/core/event-bus.js';
import { STATES, TRANSITIONS } from '../src/core/game-states.js';

const T = { a: ['b'], b: ['a', 'c'], c: [] };

test('estado inicial y estado inicial inválido', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  assert.equal(m.current, 'a');
  assert.equal(m.previous, null);
  assert.throws(() => new StateMachine({ transitions: T, initial: 'zzz' }));
});

test('can() refleja la tabla de transiciones', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  assert.equal(m.can('b'), true);
  assert.equal(m.can('c'), false);
});

test('orden de hooks: exit(origen) → enter(destino) → evento state:change', () => {
  const bus = new EventBus();
  const log = [];
  bus.on('state:change', (e) => log.push(`event ${e.from}->${e.to}`));
  const m = new StateMachine({ transitions: T, initial: 'a', bus });
  m.register('a', { exit: (to) => log.push(`exit a (hacia ${to})`) });
  m.register('b', { enter: (payload, from) => log.push(`enter b (desde ${from}, payload ${payload})`) });
  m.transition('b', 7);
  assert.deepEqual(log, ['exit a (hacia b)', 'enter b (desde a, payload 7)', 'event a->b']);
  assert.equal(m.current, 'b');
  assert.equal(m.previous, 'a');
});

test('transición inválida lanza InvalidTransitionError y no cambia el estado', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  assert.throws(() => m.transition('c'), InvalidTransitionError);
  assert.equal(m.current, 'a');
});

test('tryTransition devuelve false en vez de lanzar', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  assert.equal(m.tryTransition('c'), false);
  assert.equal(m.tryTransition('b'), true);
  assert.equal(m.current, 'b');
});

test('una transición pedida desde un hook se encola y se ejecuta después', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  const log = [];
  m.register('a', { exit: () => log.push('exit a') });
  m.register('b', {
    enter: () => {
      log.push('enter b');
      m.transition('c');
      log.push('fin enter b'); // la transición a c aún no ha ocurrido
    },
    exit: () => log.push('exit b'),
  });
  m.register('c', { enter: () => log.push('enter c') });
  m.transition('b');
  assert.deepEqual(log, ['exit a', 'enter b', 'fin enter b', 'exit b', 'enter c']);
  assert.equal(m.current, 'c');
});

test('si un hook lanza, la máquina sigue siendo utilizable', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  m.register('b', {
    enter: () => {
      throw new Error('boom');
    },
  });
  assert.throws(() => m.transition('b'), /boom/);
  assert.equal(m.current, 'b'); // el estado ya había cambiado
  m.transition('a'); // y no quedó bloqueada
  assert.equal(m.current, 'a');
});

test('update() delega en el manejador del estado actual', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  const dts = [];
  m.register('a', { update: (dt) => dts.push(dt) });
  m.update(0.016);
  assert.deepEqual(dts, [0.016]);
  m.update(0.02);
  assert.equal(dts.length, 2);
});

test('register rechaza estados desconocidos', () => {
  const m = new StateMachine({ transitions: T, initial: 'a' });
  assert.throws(() => m.register('nope', {}));
});

test('tabla real del juego: flujos esperados', () => {
  const m = new StateMachine({ transitions: TRANSITIONS, initial: STATES.BOOT });
  assert.equal(m.can(STATES.EXPLORING), false, 'no se puede saltar del arranque al juego');
  m.transition(STATES.MAIN_MENU);
  m.transition(STATES.EXPLORING);
  m.transition(STATES.INTERACTING);
  m.transition(STATES.PAUSED);
  assert.equal(m.previous, STATES.INTERACTING, 'PAUSED recuerda de dónde venía');
  m.transition(STATES.INTERACTING); // reanudar donde se pausó
  m.transition(STATES.EXPLORING);
  m.transition(STATES.PAUSED);
  m.transition(STATES.MAIN_MENU); // «Volver al menú principal»
  assert.equal(m.current, STATES.MAIN_MENU);
});

test('toda transición de la tabla apunta a estados que existen', () => {
  const known = new Set(Object.values(STATES));
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    assert.ok(known.has(from), `origen desconocido: ${from}`);
    for (const to of targets) assert.ok(known.has(to), `${from} → ${to}: destino desconocido`);
  }
  for (const state of known) assert.ok(Object.hasOwn(TRANSITIONS, state), `falta fila para ${state}`);
});
