import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER, moveWithCollisions, pickInteractable, wishDirection } from '../src/systems/movement.js';

test('wishDirection: adelante con yaw 0 va hacia -Z y se normaliza en diagonal', () => {
  const f = wishDirection({ forward: true }, 0);
  assert.ok(Math.abs(f.x) < 1e-9 && Math.abs(f.z + 1) < 1e-9);
  const d = wishDirection({ forward: true, right: true }, 0);
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9);
  assert.deepEqual(wishDirection({}, 1), { x: 0, z: 0 });
  const opposite = wishDirection({ forward: true, back: true }, 0);
  assert.deepEqual(opposite, { x: 0, z: 0 });
});

test('colisiones: no atraviesa un AABB y desliza por el eje libre', () => {
  const wall = [{ minX: -10, maxX: 10, minZ: -1, maxZ: 0, enabled: true }];
  const pos = { x: 0.5, z: 1 };
  for (let i = 0; i < 60; i++) moveWithCollisions(pos, 0.05, -0.05, wall);
  assert.ok(pos.z >= 0 + PLAYER.radius - 1e-9, `z=${pos.z}`);
  assert.ok(pos.x > 0.5, 'debe deslizar en X');
});

test('colisiones: un colisionador desactivado se ignora y los límites se respetan', () => {
  const off = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1, enabled: false }];
  const pos = { x: 0, z: 2 };
  moveWithCollisions(pos, 0, -2, off);
  assert.ok(Math.abs(pos.z) < 1e-9);
  moveWithCollisions(pos, 1000, 1000, []);
  assert.equal(pos.x, PLAYER.bounds.maxX);
  assert.equal(pos.z, PLAYER.bounds.maxZ);
});

test('colisiones: un movimiento grande no atraviesa un muro fino', () => {
  const wall = [{ minX: -5, maxX: 5, minZ: -0.2, maxZ: 0.2, enabled: true }];
  const pos = { x: 0, z: 0.8 };
  moveWithCollisions(pos, 0, -0.3, wall);
  assert.ok(pos.z >= 0.2 + PLAYER.radius - 1e-9);
});

test('pickInteractable: respeta radio, cono, enabled y elige el mejor', () => {
  const mk = (id, x, z, radius = 3, extra = {}) => ({ id, pos: { x, z }, radius, ...extra });
  const list = [mk('lejos', 0, -10), mk('detras', 0, 2), mk('frente', 0, -2), mk('off', 0, -1, 3, { enabled: false })];
  assert.equal(pickInteractable(list, { x: 0, z: 0 }, 0).id, 'frente');
  assert.equal(pickInteractable([mk('lejos', 0, -10)], { x: 0, z: 0 }, 0), null);
  assert.equal(pickInteractable([mk('detras', 0, 2)], { x: 0, z: 0 }, 0), null);
  assert.equal(pickInteractable([mk('detras', 0, 2)], { x: 0, z: 0 }, Math.PI).id, 'detras');
});
