import * as THREE from 'three';
import { RED_SUITS } from './cards.js';

/**
 * Recursos 3D compartidos por las mesas jugables: cartas (caras y reversos dibujados en canvas,
 * con esquinas redondeadas reales por transparencia) y fichas (cantos con franjas, cara con anillo).
 * Todo procedural y cacheado: 52 caras como máximo, creadas solo cuando salen.
 */

export const CARD_W = 0.085;
export const CARD_H = 0.119;
const TEX_W = 200;
const TEX_H = 280;

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvasTexture(draw, w = TEX_W, h = TEX_H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Palo dibujado con trazos (no depende de que la fuente tenga ♠♥♦♣). `s` = alto aproximado. */
export function drawSuit(ctx, suit, x, y, s) {
  const k = s / 2;
  ctx.beginPath();
  if (suit === 'H') {
    ctx.moveTo(x, y + k * 0.95);
    ctx.bezierCurveTo(x - k * 1.5, y + k * 0.05, x - k * 0.95, y - k * 1.15, x, y - k * 0.42);
    ctx.bezierCurveTo(x + k * 0.95, y - k * 1.15, x + k * 1.5, y + k * 0.05, x, y + k * 0.95);
    ctx.fill();
  } else if (suit === 'D') {
    ctx.moveTo(x, y - k);
    ctx.quadraticCurveTo(x + k * 0.35, y - k * 0.3, x + k * 0.78, y);
    ctx.quadraticCurveTo(x + k * 0.35, y + k * 0.3, x, y + k);
    ctx.quadraticCurveTo(x - k * 0.35, y + k * 0.3, x - k * 0.78, y);
    ctx.quadraticCurveTo(x - k * 0.35, y - k * 0.3, x, y - k);
    ctx.fill();
  } else if (suit === 'S') {
    ctx.moveTo(x, y - k * 0.98);
    ctx.bezierCurveTo(x + k * 0.5, y - k * 0.45, x + k * 1.45, y - k * 0.05, x + k * 0.7, y + k * 0.48);
    ctx.bezierCurveTo(x + k * 0.38, y + k * 0.7, x + k * 0.12, y + k * 0.5, x + k * 0.06, y + k * 0.36);
    ctx.lineTo(x + k * 0.32, y + k * 0.98);
    ctx.lineTo(x - k * 0.32, y + k * 0.98);
    ctx.lineTo(x - k * 0.06, y + k * 0.36);
    ctx.bezierCurveTo(x - k * 0.12, y + k * 0.5, x - k * 0.38, y + k * 0.7, x - k * 0.7, y + k * 0.48);
    ctx.bezierCurveTo(x - k * 1.45, y - k * 0.05, x - k * 0.5, y - k * 0.45, x, y - k * 0.98);
    ctx.fill();
  } else {
    const r = k * 0.42;
    ctx.arc(x, y - k * 0.48, r, 0, Math.PI * 2);
    ctx.moveTo(x - k * 0.48 + r, y + k * 0.08);
    ctx.arc(x - k * 0.48, y + k * 0.08, r, 0, Math.PI * 2);
    ctx.moveTo(x + k * 0.48 + r, y + k * 0.08);
    ctx.arc(x + k * 0.48, y + k * 0.08, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - k * 0.08, y);
    ctx.lineTo(x - k * 0.3, y + k * 0.98);
    ctx.lineTo(x + k * 0.3, y + k * 0.98);
    ctx.lineTo(x + k * 0.08, y);
    ctx.fill();
  }
}

/** Posiciones de los símbolos centrales (fracciones del área interior), como en una baraja real. */
const PIPS = {
  2: [[0.5, 0.12], [0.5, 0.88]],
  3: [[0.5, 0.12], [0.5, 0.5], [0.5, 0.88]],
  4: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.88], [0.73, 0.88]],
  5: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.5], [0.27, 0.88], [0.73, 0.88]],
  6: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.5], [0.73, 0.5], [0.27, 0.88], [0.73, 0.88]],
  7: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.31], [0.27, 0.5], [0.73, 0.5], [0.27, 0.88], [0.73, 0.88]],
  8: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.31], [0.27, 0.5], [0.73, 0.5], [0.5, 0.69], [0.27, 0.88], [0.73, 0.88]],
  9: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.37], [0.73, 0.37], [0.5, 0.5], [0.27, 0.63], [0.73, 0.63], [0.27, 0.88], [0.73, 0.88]],
  10: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.25], [0.27, 0.37], [0.73, 0.37], [0.27, 0.63], [0.73, 0.63], [0.5, 0.75], [0.27, 0.88], [0.73, 0.88]],
};

function cardFace(card, skin) {
  return memo(`face|${card.r}${card.s}|${skin}`, () => canvasTexture((ctx, w, h) => {
    const red = RED_SUITS.has(card.s);
    const ink = red ? '#b3122a' : '#16131a';
    roundRect(ctx, 2, 2, w - 4, h - 4, 16);
    ctx.fillStyle = '#fbf8f1';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = skin === 'royal' ? '#c9a23a' : '#d8d2c4';
    ctx.stroke();
    // índices de esquina (arriba-izquierda y, girado, abajo-derecha)
    const corner = () => {
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${card.r === '10' ? 30 : 36}px Cinzel, Georgia, serif`;
      ctx.fillText(card.r, 25, 42);
      drawSuit(ctx, card.s, 25, 62, 24);
    };
    corner();
    ctx.save();
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    corner();
    ctx.restore();
    ctx.fillStyle = ink;
    const ix = 46;
    const iy = 34;
    const iw = w - 92;
    const ih = h - 68;
    if (card.r === 'A') {
      drawSuit(ctx, card.s, w / 2, h / 2, card.s === 'S' ? 92 : 74);
      if (skin === 'royal') {
        ctx.strokeStyle = '#c9a23a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 62, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (PIPS[card.r]) {
      for (const [px, py] of PIPS[card.r]) {
        const x = ix + px * iw;
        const y = iy + py * ih;
        if (py > 0.5) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI);
          drawSuit(ctx, card.s, 0, 0, 30);
          ctx.restore();
        } else drawSuit(ctx, card.s, x, y, 30);
      }
    } else {
      // figuras: marco dorado, letra grande, corona y palo
      const fx = 42;
      const fy = 30;
      const fw = w - 84;
      const fh = h - 60;
      const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
      g.addColorStop(0, red ? '#fbe3e0' : '#e4e6f2');
      g.addColorStop(1, red ? '#f3c9c4' : '#c9cde4');
      ctx.fillStyle = g;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = '#b8901f';
      ctx.lineWidth = 3;
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 5, fy + 5, fw - 10, fh - 10);
      // corona
      ctx.fillStyle = '#c9a23a';
      const cx = w / 2;
      const cy = fy + 44;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 12);
      ctx.lineTo(cx - 34, cy - 14);
      ctx.lineTo(cx - 16, cy);
      ctx.lineTo(cx, cy - 20);
      ctx.lineTo(cx + 16, cy);
      ctx.lineTo(cx + 34, cy - 14);
      ctx.lineTo(cx + 30, cy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 84px Cinzel, Georgia, serif';
      ctx.fillText(card.r, cx, h / 2 + 8);
      drawSuit(ctx, card.s, cx, fy + fh - 34, 30);
    }
  }));
}

function cardBack(skin) {
  return memo(`back|${skin}`, () => canvasTexture((ctx, w, h) => {
    const royal = skin === 'royal';
    roundRect(ctx, 2, 2, w - 4, h - 4, 16);
    ctx.fillStyle = '#fbf8f1';
    ctx.fill();
    roundRect(ctx, 12, 12, w - 24, h - 24, 10);
    ctx.fillStyle = royal ? '#0f0c10' : '#6a0f22';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // celosía
    ctx.strokeStyle = royal ? 'rgba(212,175,55,0.55)' : 'rgba(255,214,150,0.32)';
    ctx.lineWidth = 2;
    for (let i = -h; i < w + h; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.moveTo(i, h);
      ctx.lineTo(i + h, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = royal ? '#d4af37' : '#e8c46a';
    ctx.lineWidth = 3;
    roundRect(ctx, 20, 20, w - 40, h - 40, 8);
    ctx.stroke();
    // medallón con monograma
    ctx.fillStyle = royal ? '#0f0c10' : '#4a0816';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 46, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = royal ? '#f3d27a' : '#f0d79a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 40px Cinzel, Georgia, serif';
    ctx.fillText('HO', w / 2, h / 2 + 2);
  }));
}

const cardGeo = memo('geo|card', () => new THREE.PlaneGeometry(CARD_W, CARD_H));
const matCache = new Map();
function cardMaterial(tex) {
  if (!matCache.has(tex.uuid)) {
    matCache.set(tex.uuid, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.55, metalness: 0, side: THREE.FrontSide }));
  }
  return matCache.get(tex.uuid);
}

/**
 * Carta 3D: grupo cuyo +Y es la normal de la cara. Boca arriba: rotation.z = 0; boca abajo: π.
 * El borde superior del dibujo apunta a −Z local (hacia el crupier).
 */
export function makeCard(card, skin = 'classic') {
  const g = new THREE.Group();
  const front = new THREE.Mesh(cardGeo, cardMaterial(cardFace(card, skin)));
  front.rotation.x = -Math.PI / 2;
  front.position.y = 0.0004;
  const back = new THREE.Mesh(cardGeo, cardMaterial(cardBack(skin)));
  back.rotation.x = Math.PI / 2;
  back.position.y = -0.0004;
  front.castShadow = back.castShadow = true;
  front.receiveShadow = back.receiveShadow = true;
  g.add(front, back);
  g.userData.card = card;
  return g;
}

// ------------------------------------------------------------------ fichas

export const CHIP_R = 0.021;
export const CHIP_H = 0.0078;
const DENOMS = [
  { v: 500, color: '#5b2a8f', edge: '#f3e9ff' },
  { v: 100, color: '#16141a', edge: '#e8d79a' },
  { v: 25, color: '#1f7a46', edge: '#ffffff' },
  { v: 5, color: '#b81b30', edge: '#ffffff' },
];

function chipFace(d) {
  return memo(`chipface|${d.v}`, () => canvasTexture((ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.edge;
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillRect(-7, -c + 2, 14, 20);
      ctx.restore();
    }
    ctx.strokeStyle = d.edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = d.edge;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${d.v >= 100 ? 30 : 36}px Cinzel, Georgia, serif`;
    ctx.fillText(String(d.v), c, c + 2);
  }, 128, 128));
}

function chipEdge(d) {
  return memo(`chipedge|${d.v}`, () => canvasTexture((ctx, w, h) => {
    ctx.fillStyle = d.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = d.edge;
    for (let i = 0; i < 8; i++) ctx.fillRect((i / 8) * w + 2, 0, w / 16 - 2, h);
  }, 128, 8));
}

const chipGeo = memo('geo|chip', () => new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 28));
const chipMats = new Map();
function chipMaterial(d) {
  if (!chipMats.has(d.v)) {
    const face = new THREE.MeshStandardMaterial({ map: chipFace(d), roughness: 0.42, metalness: 0.02 });
    const edge = new THREE.MeshStandardMaterial({ map: chipEdge(d), roughness: 0.5 });
    chipMats.set(d.v, [edge, face, face]);
  }
  return chipMats.get(d.v);
}

/** Descompone una cantidad en fichas (como lo haría un crupier), máximo `cap` fichas visibles. */
export function chipBreakdown(amount, cap = 14) {
  const out = [];
  let left = Math.max(0, Math.floor(amount));
  for (const d of DENOMS) {
    while (left >= d.v && out.length < cap) {
      out.push(d);
      left -= d.v;
    }
  }
  if (!out.length && amount > 0) out.push(DENOMS.at(-1));
  return out;
}

/** Pila de fichas centrada en el origen (la base en y=0). */
export function makeChipStack(amount) {
  const g = new THREE.Group();
  const chips = chipBreakdown(amount);
  chips.forEach((d, i) => {
    const m = new THREE.Mesh(chipGeo, chipMaterial(d));
    m.position.y = CHIP_H / 2 + i * CHIP_H;
    m.rotation.y = (i * 1.3) % (Math.PI * 2);
    m.position.x = Math.sin(i * 2.1) * 0.0012;
    m.position.z = Math.cos(i * 1.7) * 0.0012;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  g.userData.amount = amount;
  return g;
}

/** Ficha de práctica (apuesta sin coste): dorada y translúcida. */
let practiceMat = null;
export function makePracticeChip() {
  practiceMat ??= new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0x6a4a00, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.85 });
  const m = new THREE.Mesh(chipGeo, practiceMat);
  m.position.y = CHIP_H / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}
