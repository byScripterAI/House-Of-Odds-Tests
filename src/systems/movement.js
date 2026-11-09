/**
 * Lógica pura de movimiento e interacción (sin THREE ni DOM; se prueba con node --test).
 * El jugador es un círculo de radio `radius` sobre el plano XZ; los obstáculos son AABB.
 */

export const PLAYER = Object.freeze({
  radius: 0.32,
  eyeHeight: 1.65,
  walkSpeed: 2.7,
  sprintSpeed: 4.6,
  bounds: Object.freeze({ minX: -8.7, maxX: 8.7, minZ: -16.2, maxZ: 7.7 }),
});

/** Expulsa (x,z) de un AABB expandido por `radius`, por el eje de menor penetración. */
function pushOut(p, c, r) {
  const minX = c.minX - r;
  const maxX = c.maxX + r;
  const minZ = c.minZ - r;
  const maxZ = c.maxZ + r;
  if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) return;
  const dl = p.x - minX;
  const dr = maxX - p.x;
  const dt = p.z - minZ;
  const db = maxZ - p.z;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) p.x = minX;
  else if (m === dr) p.x = maxX;
  else if (m === dt) p.z = minZ;
  else p.z = maxZ;
}

/**
 * Mueve `pos` por (dx,dz) resolviendo colisiones eje a eje (permite deslizar por paredes).
 * Modifica y devuelve `pos`.
 */
export function moveWithCollisions(pos, dx, dz, colliders, bounds = PLAYER.bounds, radius = PLAYER.radius) {
  const resolve = () => {
    for (const c of colliders) if (c.enabled !== false) pushOut(pos, c, radius);
    pos.x = Math.min(bounds.maxX, Math.max(bounds.minX, pos.x));
    pos.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, pos.z));
  };
  pos.x += dx;
  resolve();
  pos.z += dz;
  resolve();
  return pos;
}

/** Vector de deseo en mundo a partir de teclas (fwd/back/left/right) y yaw. Normalizado. */
export function wishDirection(input, yaw) {
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (f === 0 && s === 0) return { x: 0, z: 0 };
  const len = Math.hypot(f, s);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { x: ((fx * f + rx * s) / len), z: ((fz * f + rz * s) / len) };
}

/**
 * Interactuable más adecuado: dentro de su radio y (si hay mirada) dentro del cono de visión.
 * Devuelve el de menor puntuación (distancia penalizada por el ángulo) o null.
 */
export function pickInteractable(list, pos, yaw, { cone = 1.05 } = {}) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let best = null;
  let bestScore = Infinity;
  for (const it of list) {
    if (it.enabled === false) continue;
    const dx = it.pos.x - pos.x;
    const dz = it.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > it.radius) continue;
    const angle = dist < 0.001 ? 0 : Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / dist)));
    if (angle > cone) continue;
    const score = dist / it.radius + angle * 0.5;
    if (score < bestScore) { bestScore = score; best = it; }
  }
  return best;
}
