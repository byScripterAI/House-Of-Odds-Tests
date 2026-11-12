import * as THREE from 'three';
import { Rng } from '../core/rng.js';

/** Texturas generadas con Canvas 2D (sin ficheros de imagen). Todas devuelven THREE.CanvasTexture. */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Ruido de valor teselable con periodo entero. */
function makeNoise(rng, size = 64) {
  const grid = new Float32Array(size * size).map(() => rng.next());
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y, period) => {
    x *= period;
    y *= period;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const a = grid[y0 * size + x0];
    const b = grid[y0 * size + x1];
    const c = grid[y1 * size + x0];
    const d = grid[y1 * size + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Mármol negro con vetas doradas; 2×2 baldosas con junta dorada. Cubre 2,4 m. */
export function marbleTexture(size = 512, repeat = [1, 1]) {
  const [c, ctx] = canvas(size, size);
  const noise = makeNoise(new Rng('marble'));
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px / size;
      const y = py / size;
      let turb = 0;
      let amp = 0.5;
      for (let o = 0, p = 4; o < 5; o++, p *= 2, amp *= 0.5) turb += amp * noise(x, y, p);
      const vein = Math.pow(1 - Math.abs(Math.sin((x * 3 + y * 2) * Math.PI * 2 + turb * 9)), 14);
      const vein2 = Math.pow(1 - Math.abs(Math.sin((x * 2 - y * 3) * Math.PI * 2 + turb * 7 + 2)), 22);
      const alt = (px >= half) !== (py >= half);
      const base = alt ? 30 : 20;
      const mottle = turb * 26;
      const i = (py * size + px) * 4;
      img.data[i] = base + mottle + vein * 120 + vein2 * 90 + (alt ? 8 : 0);
      img.data[i + 1] = base * 0.92 + mottle * 0.9 + vein * 95 + vein2 * 85;
      img.data[i + 2] = base * 0.95 + mottle + vein * 40 + vein2 * 80;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(212,175,55,0.85)';
  const j = 3;
  for (const pos of [0, half - j, size - j]) {
    ctx.fillRect(pos, 0, j * (pos === half - j ? 2 : 1), size);
    ctx.fillRect(0, pos, size, j * (pos === half - j ? 2 : 1));
  }
  return texture(c, { repeat });
}

/** Papel pintado de damasco oscuro con rombos dorados y puntos carmesí. */
export function wallTexture(repeat = [1, 1]) {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#1d1316');
  g.addColorStop(1, '#130c0f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(212,175,55,0.16)';
  ctx.lineWidth = 1.5;
  const h = s / 2;
  for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s], [h, h]]) {
    for (const r of [h * 0.95, h * 0.7]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(158,27,50,0.42)';
  for (const [cx, cy] of [[h, h], [0, 0], [s, 0], [0, s], [s, s], [h, 0], [h, s], [0, h], [s, h]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(212,175,55,0.25)';
  for (const [cx, cy] of [[h, h], [0, 0], [s, s], [s, 0], [0, s]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(c, { repeat });
}

/** Alfombra carmesí con cenefa dorada (se usa sin repetición). */
export function carpetTexture() {
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#5e0d1c';
  ctx.fillRect(0, 0, 256, 512);
  const rng = new Rng('carpet');
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(${rng.int(0, 1) ? '255,80,100' : '20,0,5'},0.05)`;
    ctx.fillRect(rng.int(0, 255), rng.int(0, 511), 2, 2);
  }
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, 212, 468);
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  for (let y = 70; y < 460; y += 58) {
    ctx.beginPath();
    ctx.moveTo(128, y - 22);
    ctx.lineTo(150, y);
    ctx.lineTo(128, y + 22);
    ctx.lineTo(106, y);
    ctx.closePath();
    ctx.stroke();
  }
  return texture(c, { wrap: false });
}

/** Rótulo de neón: texto con halo sobre fondo transparente. */
export function neonTexture(text, { color = '#ffd76a', glow = '#d4af37', w = 1024, h = 256, font = '700 120px Cinzel, serif', sub = null, dead = null, haloOnly = false } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  const y = sub ? h * 0.42 : h / 2;
  // Se dibuja letra a letra para poder apagar algunas («H_USE OF _DDS»: neón roto).
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((p, q) => p + q, 0);
  let cursor = (w - total) / 2;
  const positions = widths.map((cw) => { const x = cursor; cursor += cw; return x; });
  const pass = (blur, fill, skipDead) => {
    ctx.shadowBlur = blur;
    ctx.shadowColor = glow;
    ctx.fillStyle = fill;
    chars.forEach((ch, i) => {
      if (skipDead && dead?.includes(i)) return;
      ctx.fillText(ch, positions[i], y);
    });
  };
  if (haloOnly) {
    // solo el resplandor (para la pared detrás de un neón 3D): se dibuja fuera y se queda la sombra
    const OFF = w * 4;
    // que el texto ocupe ~70 % del lienzo: el resplandor no se corta en los bordes del plano
    const fit = Math.min(1, (w * 0.7) / Math.max(1, total));
    ctx.translate(w / 2, y);
    ctx.scale(fit, fit);
    ctx.translate(-w / 2, -y);
    ctx.shadowOffsetX = OFF;
    ctx.translate(-OFF / fit, 0);
    pass(70, glow, true);
    pass(34, glow, true);
    if (sub) {
      ctx.textAlign = 'center';
      ctx.font = '400 46px "Cormorant Garamond", Georgia, serif';
      ctx.shadowBlur = 24;
      ctx.fillText(sub, w / 2, h * 0.82);
    }
    return texture(c, { wrap: false });
  }
  pass(38, glow, true);
  pass(16, glow, true);
  pass(4, color, true);
  if (dead?.length) {
    // Tubos apagados: gris oscuro sin brillo.
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(70,60,52,0.9)';
    chars.forEach((ch, i) => { if (dead.includes(i)) ctx.fillText(ch, positions[i], y); });
  }
  if (sub) {
    ctx.textAlign = 'center';
    ctx.font = '400 46px "Cormorant Garamond", Georgia, serif';
    ctx.shadowBlur = 10;
    ctx.shadowColor = glow;
    ctx.fillStyle = color;
    ctx.fillText(sub, w / 2, h * 0.82);
  }
  return texture(c, { wrap: false });
}

/** Cuadro abstracto (rojo, oro y negro) determinista por semilla. */
export function paintingTexture(seed, w = 256, h = 340) {
  const [c, ctx] = canvas(w, h);
  const rng = new Rng(seed);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#12090c');
  g.addColorStop(1, rng.chance(0.5) ? '#3a0a16' : '#1c1620');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const r = rng.float(20, 90);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = rng.pick(['196,34,64', '212,175,55', '245,234,215', '120,20,40']);
    rg.addColorStop(0, `rgba(${col},${rng.float(0.35, 0.8)})`);
    rg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = 'rgba(212,175,55,0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(rng.float(0, w), rng.float(0, h));
    ctx.bezierCurveTo(rng.float(0, w), rng.float(0, h), rng.float(0, w), rng.float(0, h), rng.float(0, w), rng.float(0, h));
    ctx.stroke();
  }
  return texture(c, { wrap: false });
}

/** Halo radial (para sprites aditivos y partículas). */
export function glowTexture() {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return texture(c, { wrap: false });
}

/** Placa con texto sobre fondo opaco (letreros pequeños, pantallas). */
export function plateTexture(text, { w = 256, h = 64, bg = '#1a0f12', fg = '#d4af37', font = '700 30px Cinzel, serif' } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  return texture(c, { wrap: false });
}
