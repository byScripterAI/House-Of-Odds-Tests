import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NavGrid } from '../src/entities/navgrid.js';
import { HALL, SPAWN, staticColliders, playerBounds, COUNTER, CLASSIC } from '../src/world/layout.js';

const grid = () => new NavGrid({ minX: HALL.minX, maxX: HALL.maxX, minZ: HALL.minZ - 12, maxZ: HALL.maxZ }, 0.4).block(staticColliders());

test('NavGrid: un muro en medio obliga a rodear', () => {
  const g = new NavGrid({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, 0.5).block([{ minX: 4.5, maxX: 5.5, minZ: 0, maxZ: 8 }], 0);
  const path = g.findPath(2, 2, 8, 2);
  assert.ok(path && path.length >= 2, 'debe haber camino con desvío');
  for (const p of path) assert.ok(g.isFree(p.x, p.z));
  for (let i = 1; i < path.length; i++) assert.ok(g.lineOfSight(path[i - 1].x, path[i - 1].z, path[i].x, path[i].z));
  assert.ok(path.some((p) => p.z > 8), 'rodea el muro por el hueco');
});

test('NavGrid: sin salida → null', () => {
  const g = new NavGrid({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, 0.5).block([{ minX: 4.5, maxX: 5.5, minZ: -1, maxZ: 11 }], 0);
  assert.equal(g.findPath(2, 5, 8, 5), null);
});

test('NavGrid del casino: se llega desde la entrada al mostrador y a la máquina', () => {
  const g = grid();
  const toCounter = g.findPath(SPAWN.x, SPAWN.z, COUNTER.x, COUNTER.talkZ);
  assert.ok(toCounter, 'camino entrada → mostrador');
  const toMachine = g.findPath(SPAWN.x, SPAWN.z, CLASSIC.x, CLASSIC.z + 1.6);
  assert.ok(toMachine, 'camino entrada → THE CLASSIC');
});

test('el punto de aparición del jugador está libre y dentro de los límites', () => {
  const g = grid();
  assert.ok(g.isFree(SPAWN.x, SPAWN.z));
  const b = playerBounds(false);
  assert.ok(SPAWN.x > b.minX && SPAWN.x < b.maxX && SPAWN.z > b.minZ && SPAWN.z < b.maxZ);
});
