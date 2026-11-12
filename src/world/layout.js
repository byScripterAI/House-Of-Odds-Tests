/**
 * PLANO DEL CASINO (datos puros: sin Three.js ni DOM).
 *
 * Unidades en metros. +X = este, +Z = sur. El jugador entra por el sur
 * (la entrada) y mira al norte. El constructor (builder.js), los colisionadores
 * y las pruebas leen TODO de aquí: mover una mesa es cambiar una línea.
 *
 *            z = -11  ┌───────────── NORTE (ala ampliable) ─────────────┐
 *   MOSTRADOR (servicios)     ·  puerta del ala  ·   BLACKJACK ×3       │
 *   OESTE: NEON / UNDERGROUND │      THE CLASSIC (dais)     │ ESTE: GOLDEN / VIP
 *   RULETAS ×2                │   islas de máquinas         │
 *   salón / butacas      z = +11  └──────────── ENTRADA (sur) ──────────┘
 */

export const HALL = Object.freeze({ minX: -14, maxX: 14, minZ: -11, maxZ: 11, height: 5.8, wall: 0.4 });

/** Ala norte (se abre al comprar la ampliación): una sala más grande tras la pared norte. */
export const NORTH_WING = Object.freeze({ minX: -9, maxX: 9, minZ: -23, maxZ: -11, height: 5.8 });

export const SPAWN = Object.freeze({ x: 0, z: 9.4, yaw: 0 });

/** THE CLASSIC (la máquina del jugador) sobre su estrado. */
export const CLASSIC = Object.freeze({ x: 0, y: 0.14, z: -3.2, dais: 2.5 });

/** Mostrador de servicios (antes «tienda»): pegado a la pared norte, en la esquina noroeste. Nada delante. */
export const COUNTER = Object.freeze({ x: -9, z: -9.5, width: 5.2, depth: 1.0, front: -8.35, talkZ: -7.2 });

/**
 * Puertas. `wall`: lado de la pared; `at`: coordenada a lo largo de la pared; `width`: hueco.
 * Las de zona se bloquean según progreso; la de entrada (sur) es decorativa hasta que lleguen clientes.
 */
export const DOORS = Object.freeze([
  Object.freeze({ id: 'neon_lounge', zone: 'neon_lounge', wall: 'west', at: -4, width: 2.2 }),
  Object.freeze({ id: 'underground', zone: 'underground', wall: 'west', at: 4.5, width: 2.2 }),
  Object.freeze({ id: 'golden_room', zone: 'golden_room', wall: 'east', at: -4, width: 2.2 }),
  Object.freeze({ id: 'vip_hall', zone: 'vip_hall', wall: 'east', at: 4.5, width: 2.2 }),
  Object.freeze({ id: 'wing', zone: null, wall: 'north', at: 0, width: 4.0 }),
  Object.freeze({ id: 'entrance', zone: null, wall: 'south', at: 0, width: 4.0 }),
]);

/** Mesas de juego (decorado inicial; después serán jugables según el catálogo). */
export const TABLES = Object.freeze({
  blackjack: Object.freeze([
    Object.freeze({ id: 'royal_blackjack', x: 6.2, z: -8.0, yaw: 0 }),
    Object.freeze({ id: 'double_down', x: 10.4, z: -8.0, yaw: 0 }),
    Object.freeze({ id: 'last_hand', x: 10.4, z: -2.0, yaw: -Math.PI / 2 }),
  ]),
  roulette: Object.freeze([
    Object.freeze({ id: 'royal_roulette', x: -6.4, z: -4.0, yaw: 0 }),
    Object.freeze({ id: 'neon_roulette', x: -10.4, z: -1.0, yaw: Math.PI / 2 }),
  ]),
});

/** Bancos de tragaperras antiguas («islas»): pares espalda con espalda. */
export const SLOT_BANKS = Object.freeze([
  Object.freeze({ x: -6.5, z: 4.6, count: 3, yaw: 0 }),
  Object.freeze({ x: 6.5, z: 4.6, count: 3, yaw: 0 }),
]);

/** Butacas del salón (suroeste) y sofás (sureste); puntos donde se sentarán los PNJ. */
export const LOUNGE = Object.freeze({
  rug: Object.freeze({ x: -10.8, z: 8.2, w: 5, d: 4 }),
  armchairs: Object.freeze([
    Object.freeze({ x: -12.2, z: 7.4, yaw: Math.PI / 2 }),
    Object.freeze({ x: -12.2, z: 9.2, yaw: Math.PI / 2 }),
    Object.freeze({ x: -9.2, z: 7.6, yaw: -Math.PI / 2 }),
    Object.freeze({ x: -9.2, z: 9.0, yaw: -Math.PI / 2 }),
  ]),
  table: Object.freeze({ x: -10.7, z: 8.3 }),
});

/** Recepción / guardarropa junto a la entrada (sureste). */
export const RECEPTION = Object.freeze({ x: 10.6, z: 9.3, width: 4.2, depth: 0.9 }); // detrás queda pasillo para el personal

/** Pilastras pegadas a las paredes (no hay columnas libres que estorben el paso). */
export const PILASTERS = Object.freeze([
  ...[-8, -2.5, 2.5, 8].flatMap((z) => [
    Object.freeze({ x: -HALL.maxX + 0.35, z, side: 'west' }),
    Object.freeze({ x: HALL.maxX - 0.35, z, side: 'east' }),
  ]),
]);

/** Puntos de aparición/decoración desbloqueable (compras de decoración). */
export const DECOR_SLOTS = Object.freeze({
  carpet: Object.freeze({ x: 0, z: 4.8, w: 4, d: 10.5 }),
  statue: Object.freeze({ x: 4.6, z: 7.0 }),
  chandelier: Object.freeze({ x: CLASSIC.x, y: 4.45, z: CLASSIC.z }),
});

/**
 * Segmentos de una pared con huecos de puerta. Devuelve rangos [a,b] a lo largo
 * del eje de la pared que SÍ son muro.
 * @param {number} from @param {number} to @param {{at:number,width:number}[]} gaps
 */
export function wallRuns(from, to, gaps) {
  const sorted = [...gaps].map((g) => [g.at - g.width / 2, g.at + g.width / 2]).sort((p, q) => p[0] - q[0]);
  const runs = [];
  let cursor = from;
  for (const [a, b] of sorted) {
    if (a > cursor + 1e-6) runs.push([cursor, Math.min(a, to)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < to - 1e-6) runs.push([cursor, to]);
  return runs;
}

/** Puertas de una pared concreta. */
export const doorsOn = (wall) => DOORS.filter((d) => d.wall === wall);

/** Posición de mundo y orientación (yaw del panel) de una puerta. */
export function doorPlacement(door) {
  const o = HALL.wall / 2 - 0.02; // cara interior del muro
  switch (door.wall) {
    case 'west': return { x: HALL.minX + o, z: door.at, yaw: Math.PI / 2, inward: { x: 1, z: 0 } };
    case 'east': return { x: HALL.maxX - o, z: door.at, yaw: -Math.PI / 2, inward: { x: -1, z: 0 } };
    case 'north': return { x: door.at, z: HALL.minZ + o, yaw: 0, inward: { x: 0, z: 1 } };
    default: return { x: door.at, z: HALL.maxZ - o, yaw: Math.PI, inward: { x: 0, z: -1 } };
  }
}

/** Colisionadores estáticos derivados del plano (AABB en mundo). */
export function staticColliders() {
  const c = [];
  const box = (cx, cz, w, d, extra = {}) => c.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, enabled: true, ...extra });
  const t = HALL.wall;
  const wx = HALL.maxX - HALL.minX + t * 2;
  const wz = HALL.maxZ - HALL.minZ + t * 2;
  // Muros (con huecos de puertas; las puertas bloqueadas añaden su propio colisionador en el builder)
  for (const [a, b] of wallRuns(HALL.minX - t, HALL.maxX + t, doorsOn('north'))) box((a + b) / 2, HALL.minZ - t / 2, b - a, t);
  for (const [a, b] of wallRuns(HALL.minX - t, HALL.maxX + t, doorsOn('south'))) box((a + b) / 2, HALL.maxZ + t / 2, b - a, t);
  for (const [a, b] of wallRuns(HALL.minZ, HALL.maxZ, doorsOn('west'))) box(HALL.minX - t / 2, (a + b) / 2, t, b - a);
  for (const [a, b] of wallRuns(HALL.minZ, HALL.maxZ, doorsOn('east'))) box(HALL.maxX + t / 2, (a + b) / 2, t, b - a);
  void wx; void wz;
  // Mostrador
  box(COUNTER.x, COUNTER.z + 0.2, COUNTER.width + 0.2, COUNTER.depth + 0.9, { id: 'counter' });
  // Estrado de THE CLASSIC (solo el cuerpo de la máquina; el estrado se pisa)
  box(CLASSIC.x, CLASSIC.z + 0.2, 1.95, 1.5, { id: 'classic' });
  // Mesas
  for (const tb of TABLES.blackjack) {
    const alongX = Math.abs(Math.sin(tb.yaw)) < 0.5;
    box(tb.x, tb.z, alongX ? 3.1 : 1.6, alongX ? 1.6 : 3.1, { id: tb.id });
  }
  for (const tb of TABLES.roulette) {
    const alongX = Math.abs(Math.sin(tb.yaw)) < 0.5;
    box(tb.x, tb.z, alongX ? 3.4 : 1.7, alongX ? 1.7 : 3.4, { id: tb.id });
  }
  // Bancos de máquinas antiguas (islas)
  for (const b of SLOT_BANKS) box(b.x, b.z, b.count * 1.0 + 0.2, 1.7, { id: 'bank' });
  // Butacas y mesa del salón
  for (const a of LOUNGE.armchairs) box(a.x, a.z, 0.95, 0.95, { id: 'armchair' });
  box(LOUNGE.table.x, LOUNGE.table.z, 1.3, 1.3, { id: 'lounge-table' });
  // Recepción
  box(RECEPTION.x, RECEPTION.z, RECEPTION.width, RECEPTION.depth, { id: 'reception' });
  // Pilastras
  for (const p of PILASTERS) box(p.x, p.z, 0.7, 0.7, { id: 'pilaster' });
  return c;
}

/** Límites jugables según si el ala norte está abierta. */
export function playerBounds(wingOpen) {
  return {
    minX: HALL.minX + 0.35,
    maxX: HALL.maxX - 0.35,
    minZ: (wingOpen ? NORTH_WING.minZ : HALL.minZ) + 0.35,
    maxZ: HALL.maxZ - 0.35,
  };
}

/**
 * Puntos de interés de la historia (visitas de misiones y guía en pantalla).
 * `r` = radio en el que se considera «visitado».
 */
export const POIS = Object.freeze({
  classic: Object.freeze({ x: CLASSIC.x, z: CLASSIC.z + 1.9, r: 2.4 }),
  counter: Object.freeze({ x: COUNTER.x, z: COUNTER.talkZ, r: 2.4 }),
  cards: Object.freeze({ x: 7.8, z: -5.6, r: 2.8 }),
  roulette: Object.freeze({ x: -6.2, z: -1.9, r: 2.8 }),
  reception: Object.freeze({ x: 9.6, z: 8.4, r: 2.4 }),
  entrance: Object.freeze({ x: 0, z: 9.6, r: 2.2 }),
});

/**
 * Objetos interactuables de la historia: solo aparecen cuando una misión los pide.
 * `prompt` es la clave i18n del aviso de interacción.
 */
export const STORY_SPOTS = Object.freeze({
  classic_panel: Object.freeze({ x: CLASSIC.x + 0.95, y: 0.7, z: CLASSIC.z - 0.08, r: 1.9, prompt: 'prompt.inspectPanel' }),
  toolbox: Object.freeze({ x: 12.95, y: 1.05, z: 0.35, r: 2.2, prompt: 'prompt.toolbox' }),
  classic_mechanism: Object.freeze({ x: CLASSIC.x + 0.75, y: 0.7, z: CLASSIC.z - 0.08, r: 1.9, prompt: 'prompt.mechanism' }), // la seta RESET de la tapa abierta
  cleaning_crew: Object.freeze({ x: COUNTER.x, y: 1.2, z: COUNTER.front + 0.2, r: 4.6, prompt: 'prompt.cleaningCrew', replaces: 'counter' }),
  breaker: Object.freeze({ x: -5.2, y: 1.5, z: HALL.minZ + 0.12, r: 3.0, prompt: 'prompt.breaker' }),
  welcome_sign: Object.freeze({ x: 0, y: 1.75, z: HALL.maxZ - 0.35, r: 2.4, prompt: 'prompt.welcomeSign' }),
  doc_box: Object.freeze({ x: 11.0, y: 0.6, z: -9.2, r: 2.2, prompt: 'prompt.docBox' }),
  reception_decor: Object.freeze({ x: 9.2, y: 1.0, z: 8.3, r: 2.2, prompt: 'prompt.receptionDecor' }),
  royal_table: Object.freeze({ x: 6.2, y: 1.0, z: -6.75, r: 2.6, prompt: 'prompt.inspectTable', replaces: 'table:royal_blackjack' }),
  royal_wheel: Object.freeze({ x: -5.6, y: 1.0, z: -2.9, r: 2.6, prompt: 'prompt.inspectWheel', replaces: 'table:royal_roulette' }),
});
