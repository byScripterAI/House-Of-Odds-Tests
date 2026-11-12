/**
 * Geometría del paño de la ruleta (pura). La usan a la vez el dibujo de la textura
 * (gfx/textures.js) y la detección de clics sobre la mesa 3D: así lo que ves es exactamente
 * donde apuestas.
 *
 * Coordenadas normalizadas de la textura: u (0 izquierda → 1 derecha), t (0 arriba → 1 abajo).
 * La textura mide 2:1 (ancho:alto). Arriba = lado del crupier.
 */

export const LAYOUT = Object.freeze({
  zeroX: 0.015,
  left: 0.075,
  colW: (0.91 - 0.075) / 12,
  top: 0.05,
  rowH: 0.19,
  extraH: 0.17,
  colBetW: 0.075,
});

function build() {
  const L = LAYOUT;
  const cells = [];
  cells.push({ key: 'n:0', x: L.zeroX, y: L.top, w: L.left - L.zeroX, h: L.rowH * 3, label: '0', fill: 'green' });
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const n = col * 3 + (3 - row);
      cells.push({ key: `n:${n}`, x: L.left + col * L.colW, y: L.top + row * L.rowH, w: L.colW, h: L.rowH, label: String(n), fill: 'number' });
    }
  }
  for (let row = 0; row < 3; row++) {
    cells.push({ key: `col:${3 - row}`, x: L.left + 12 * L.colW, y: L.top + row * L.rowH, w: L.colBetW, h: L.rowH, label: '2:1' });
  }
  const y2 = L.top + 3 * L.rowH;
  ['1ST 12', '2ND 12', '3RD 12'].forEach((label, i) => cells.push({ key: `dozen:${i + 1}`, x: L.left + i * 4 * L.colW, y: y2, w: 4 * L.colW, h: L.extraH, label }));
  const y3 = y2 + L.extraH;
  [['low', '1-18'], ['even', 'EVEN'], ['red', 'RED'], ['black', 'BLACK'], ['odd', 'ODD'], ['high', '19-36']].forEach(([key, label], i) => {
    cells.push({ key, x: L.left + i * 2 * L.colW, y: y3, w: 2 * L.colW, h: L.extraH, label, fill: key === 'red' ? 'red' : key === 'black' ? 'black' : null });
  });
  return Object.freeze(cells.map((c) => Object.freeze(c)));
}

export const CELLS = build();
const BY_KEY = new Map(CELLS.map((c) => [c.key, c]));

/** Casilla bajo el punto (u, t) o null. */
export function hitCell(u, t) {
  for (const c of CELLS) if (u >= c.x && u < c.x + c.w && t >= c.y && t < c.y + c.h) return c.key;
  return null;
}

export const cellOf = (key) => BY_KEY.get(key) ?? null;

/** Centro de una casilla (u, t). */
export function cellCenter(key) {
  const c = BY_KEY.get(key);
  return c ? { u: c.x + c.w / 2, t: c.y + c.h / 2 } : null;
}
