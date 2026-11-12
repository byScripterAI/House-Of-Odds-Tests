/**
 * Iconos de la interfaz (SVG de trazo, 24×24, dibujados para el juego). `icon('lock')` devuelve un
 * elemento <svg class="ui-icon">; heredan el color del texto.
 */
const P = {
  play: 'M7 4.5v15l12-7.5z',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.6a7.6 7.6 0 0 1-1.7 1l-.4 2h-3.6l-.4-2a7.6 7.6 0 0 1-1.7-1l-1.9.6-1.8-3.1 1.6-1.2a7.4 7.4 0 0 1 0-2l-1.6-1.3 1.8-3.1 1.9.7a7.6 7.6 0 0 1 1.7-1l.4-2h3.6l.4 2a7.6 7.6 0 0 1 1.7 1l1.9-.7 1.8 3.1-1.6 1.3a7.4 7.4 0 0 1 0 2z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  scroll: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8M7 4a2 2 0 0 0-2 2v2h4M7 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1M12 9h4M12 13h4',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  resume: 'M8 5v14l11-7z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13zM12 14.5v2.5',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5.5 11h13v9h-13z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 5l7 7-7 7',
  coin: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 7.5v9M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5',
  crown: 'M4 17l1.5-9 4.5 4 2-6 2 6 4.5-4L20 17zM4 20h16',
  gem: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  warn: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 20h8M9.5 17h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  door: 'M6 20V4h9l3 2v14M3 20h18M12.5 12v.5',
  map: 'M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14',
  volume: 'M4 9.5h4l5-4v13l-5-4H4zM16.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  monitor: 'M3.5 5h17v11h-17zM9 20h6M12 16v4',
  mouse: 'M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 7v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9s1.2-6.4 3.7-9z',
  cards: 'M8 5h9a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 17 20H8a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 8 5zM4 8l2.5-.5M12.5 10l1.5 2.5-1.5 2.5-1.5-2.5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  wrench: 'M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2zM6 18l.01.01',
  broom: 'M14 4l6 6M12 8l4 4M4 20c3-1 7-4 9-7l-2-2c-3 2-6 6-7 9z',
  bulb: 'M9 17h6M10 20h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  bankrupt: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM6.5 6.5l11 11',
  quest: 'M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7zM12 8v5M12 16v.5',
};

export function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ui-icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', P[name] ?? P.info);
  svg.append(p);
  return svg;
}

/** Tecla dibujada (glifo): `key('E')`, `key('ESC')`. */
export function keycap(label, gold = false) {
  const k = document.createElement('span');
  k.className = `ui-key${gold ? ' ui-key--gold' : ''}`;
  k.textContent = label;
  return k;
}
