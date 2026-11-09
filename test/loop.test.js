import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameLoop } from '../src/core/loop.js';

function fakeScheduler() {
  let nextId = 1;
  const pending = new Map();
  return {
    request: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => pending.delete(id),
    tick(now) {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const cb of callbacks) cb(now);
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

function setup(overrides = {}) {
  const scheduler = fakeScheduler();
  const dts = [];
  let renders = 0;
  const loop = new GameLoop({
    update: (dt) => dts.push(dt),
    render: () => renders++,
    scheduler,
    ...overrides,
  });
  return { loop, scheduler, dts, renders: () => renders };
}

test('el primer frame tiene dt = 0 y los siguientes miden el tiempo real', () => {
  const { loop, scheduler, dts } = setup();
  loop.start();
  scheduler.tick(1000);
  scheduler.tick(1016);
  assert.equal(dts[0], 0);
  assert.ok(Math.abs(dts[1] - 0.016) < 1e-9);
});

test('dt se limita a maxDelta (p. ej. al volver de una pestaña en segundo plano)', () => {
  const { loop, scheduler, dts } = setup({ maxDelta: 0.1 });
  loop.start();
  scheduler.tick(1000);
  scheduler.tick(9000); // 8 s después
  assert.equal(dts[1], 0.1);
});

test('update y render se llaman una vez por frame', () => {
  const { loop, scheduler, dts, renders } = setup();
  loop.start();
  scheduler.tick(1000);
  scheduler.tick(1016);
  scheduler.tick(1032);
  assert.equal(dts.length, 3);
  assert.equal(renders(), 3);
});

test('start() repetido no duplica la planificación; stop() cancela', () => {
  const { loop, scheduler } = setup();
  loop.start();
  loop.start();
  assert.equal(scheduler.pendingCount, 1);
  loop.stop();
  assert.equal(scheduler.pendingCount, 0);
  assert.equal(loop.running, false);
});

test('si update lanza, el bucle se detiene y avisa una sola vez', () => {
  const errors = [];
  const scheduler = fakeScheduler();
  const loop = new GameLoop({
    update: () => {
      throw new Error('boom');
    },
    render: () => {},
    onError: (e) => errors.push(e),
    scheduler,
  });
  loop.start();
  scheduler.tick(1000);
  scheduler.tick(1016); // no debería haber nada planificado
  assert.equal(errors.length, 1);
  assert.equal(loop.running, false);
  assert.equal(scheduler.pendingCount, 0);
});

test('los FPS medidos se aproximan a 60 con frames de 16,67 ms', () => {
  const { loop, scheduler } = setup();
  loop.start();
  let t = 1000;
  for (let i = 0; i < 120; i++) {
    scheduler.tick(t);
    t += 1000 / 60;
  }
  assert.ok(Math.abs(loop.fps - 60) < 1, `fps = ${loop.fps}`);
  assert.ok(Math.abs(loop.frameMs - 16.67) < 0.5, `frameMs = ${loop.frameMs}`);
});
