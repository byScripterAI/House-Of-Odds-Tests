import { CELLS as ROULETTE_CELLS } from '../games/roulette-layout.js';
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

/**
 * Biblioteca de texturas procedurales (Canvas 2D, sin ficheros).
 * Todas se generan al tamaño que pide el nivel de calidad y se cachean por
 * clave, de modo que reconstruir el mundo (p. ej. al cambiar la calidad) no
 * vuelve a pagar el coste.
 */

const cache = new Map();

function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function clearTextureCache() {
  for (const t of cache.values()) t.dispose?.();
  cache.clear();
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = [1, 1], srgb = true, aniso = 4, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Ruido de valor teselable (periodo entero) con fbm. */
function noiseField(seed, grid = 64) {
  const rng = new Rng(seed);
  const data = new Float32Array(grid * grid).map(() => rng.next());
  const smooth = (t) => t * t * (3 - 2 * t);
  const base = (x, y, period) => {
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
    const a = data[y0 * grid + x0];
    const b = data[y0 * grid + x1];
    const c = data[y1 * grid + x0];
    const d = data[y1 * grid + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, octaves = 5, p0 = 4) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0, p = p0; o < octaves; o++, p *= 2, amp *= 0.5) {
      sum += amp * base(x, y, p);
      norm += amp;
    }
    return sum / norm;
  };
}

/** Máscara de mugre en escala de grises (teselable): manchas, vetas verticales y motas. */
export function grimeMask(size = 512) {
  return memo(`grime-${size}`, () => {
    const n = Math.min(size, 512);
    const [c, ctx] = canvas(n);
    const f = noiseField('grime');
    const f2 = noiseField('grime-streak');
    const img = ctx.createImageData(n, n);
    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        const x = px / n;
        const y = py / n;
        const blot = f(x, y, 5, 3);
        const streak = f2(x, y * 0.18, 3, 8); // manchas alargadas (goteras)
        const speck = f(x * 3 % 1, y * 3 % 1, 2, 16);
        const v = Math.min(1, blot * 0.9 + (streak - 0.45) * 0.55 + (speck - 0.5) * 0.25);
        const k = (py * n + px) * 4;
        const g = Math.max(0, Math.min(255, v * 255));
        img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { srgb: false, aniso: 2 });
  });
}

/** Mármol negro con vetas doradas, baldosas 2×2 con junta dorada. */
export function marbleFloor(requested = 512) {
  const size = Math.min(1024, requested); // más allá de 1024 px no se aprecia en el suelo y tarda segundos en generarse
  return memo(`marble-${size}`, () => {
    const [c, ctx] = canvas(size);
    const noise = noiseField('marble');
    const img = ctx.createImageData(size, size);
    const half = size / 2;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = px / size;
        const y = py / size;
        const turb = noise(x, y, 5, 4);
        const vein = Math.pow(1 - Math.abs(Math.sin((x * 3 + y * 2) * Math.PI * 2 + turb * 9)), 14);
        const vein2 = Math.pow(1 - Math.abs(Math.sin((x * 2 - y * 3) * Math.PI * 2 + turb * 7 + 2)), 22);
        const alt = (px >= half) !== (py >= half);
        const base = alt ? 34 : 22;
        const mottle = turb * 30;
        const k = (py * size + px) * 4;
        img.data[k] = base + mottle + vein * 62 + vein2 * 38 + (alt ? 8 : 0);
        img.data[k + 1] = base * 0.92 + mottle * 0.9 + vein * 50 + vein2 * 36;
        img.data[k + 2] = base * 0.95 + mottle + vein * 24 + vein2 * 34;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const j = Math.max(2, Math.round(size / 170));
    ctx.fillStyle = 'rgba(212,175,55,0.85)';
    for (const pos of [0, half - j, size - j]) {
      const wd = j * (pos === half - j ? 2 : 1);
      ctx.fillRect(pos, 0, wd, size);
      ctx.fillRect(0, pos, size, wd);
    }
    return toTexture(c);
  });
}

/** Moqueta de casino: fondo burdeos oscuro con motivos dorados repetidos (teselable). */
export function carpetPattern(size = 512, { base = '#3c0a16', accent = '#b8902c' } = {}) {
  return memo(`carpet-${size}-${base}-${accent}`, () => {
    const [c, ctx] = canvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rng = new Rng('carpet-fibre');
    for (let i = 0; i < size * 5; i++) {
      ctx.fillStyle = `rgba(${rng.next() > 0.5 ? '255,90,110' : '10,0,4'},0.06)`;
      ctx.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), 2, 2);
    }
    const s = size / 2;
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = Math.max(1.5, size / 170);
    for (const [cx, cy] of [[s / 2, s / 2], [s * 1.5, s * 1.5], [s * 1.5, s / 2], [s / 2, s * 1.5]]) {
      const alt = (cx > s) === (cy > s);
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.34);
      ctx.lineTo(cx + s * 0.34, cy);
      ctx.lineTo(cx, cy + s * 0.34);
      ctx.lineTo(cx - s * 0.34, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * (alt ? 0.1 : 0.06), 0, Math.PI * 2);
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeRect(2, 2, size - 4, size - 4);
    return toTexture(c);
  });
}

/** Tablones de madera oscura con vetas. */
export function woodPlanks(requested = 512, { dark = false } = {}) {
  const size = Math.min(1024, requested);
  return memo(`wood-${size}-${dark}`, () => {
    const [c, ctx] = canvas(size);
    const f = noiseField(`wood-${dark}`);
    const img = ctx.createImageData(size, size);
    const planks = 4;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = px / size;
        const y = py / size;
        const plank = Math.floor(x * planks);
        const lx = x * planks - plank;
        const grain = f(plank * 0.21 + lx * 0.05, y * 0.12, 4, 12);
        const rings = 0.5 + 0.5 * Math.sin((grain * 24 + lx * 3) * Math.PI);
        const seam = lx < 0.02 || lx > 0.98 ? 0.35 : 1;
        const tone = (0.55 + rings * 0.45) * seam * (0.85 + 0.3 * f(x, y, 3, 6));
        const k = (py * size + px) * 4;
        const [r, g, b] = dark ? [38, 22, 16] : [74, 44, 28];
        img.data[k] = r * tone;
        img.data[k + 1] = g * tone;
        img.data[k + 2] = b * tone;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

/** Fieltro de mesa de juego (teselable). */
export function felt(requested = 256, color = [14, 74, 52]) {
  const size = Math.min(512, requested);
  return memo(`felt-${size}-${color}`, () => {
    const [c, ctx] = canvas(size);
    const f = noiseField('felt');
    const img = ctx.createImageData(size, size);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const t = 0.8 + 0.35 * f(px / size, py / size, 3, 24) + (((px * 7 + py * 13) % 5) - 2) * 0.012;
        const k = (py * size + px) * 4;
        img.data[k] = color[0] * t;
        img.data[k + 1] = color[1] * t;
        img.data[k + 2] = color[2] * t;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

/** Papel pintado de damasco (teselable). */
export function damask(size = 512, { base = ['#241519', '#170d10'], line = 'rgba(212,175,55,0.2)', dot = 'rgba(158,27,50,0.5)' } = {}) {
  return memo(`damask-${size}-${base}-${line}`, () => {
    const [c, ctx] = canvas(size);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, base[0]);
    g.addColorStop(1, base[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1, size / 170);
    const h = size / 2;
    for (const [cx, cy] of [[0, 0], [size, 0], [0, size], [size, size], [h, h]]) {
      for (const r of [h * 0.95, h * 0.7, h * 0.45]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.fillStyle = dot;
    for (const [cx, cy] of [[h, h], [0, 0], [size, 0], [0, size], [size, size], [h, 0], [h, size], [0, h], [size, h]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 38, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(c);
  });
}

/** Mapa de relieve (normal) a partir de ruido: tela, cuero, yeso. */
export function bumpNormal(size = 256, { scale = 18, strength = 2.2, seed = 'bump' } = {}) {
  return memo(`bump-${size}-${scale}-${strength}-${seed}`, () => {
    const n = Math.min(size, 512);
    const f = noiseField(seed);
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = f(x / n, y / n, 3, scale);
    const [c, ctx] = canvas(n);
    const img = ctx.createImageData(n, n);
    const at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const len = Math.hypot(dx, dy, 1);
        const k = (y * n + x) * 4;
        img.data[k] = (-dx / len * 0.5 + 0.5) * 255;
        img.data[k + 1] = (dy / len * 0.5 + 0.5) * 255;
        img.data[k + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { srgb: false, aniso: 2 });
  });
}

// ---------------------------------------------------------------- decals (alfa)

/** Mancha oscura irregular (café, humedad, quemadura). */
export function stainDecal(seed = 0) {
  return memo(`stain-${seed}`, () => {
    const [c, ctx] = canvas(256);
    const rng = new Rng(`stain-${seed}`);
    ctx.translate(128, 128);
    for (let i = 0; i < 26; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = rng.next() * 52;
      const r = 18 + rng.next() * 44;
      const g = ctx.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, r);
      g.addColorStop(0, 'rgba(18,10,6,0.2)');
      g.addColorStop(0.7, 'rgba(24,14,8,0.09)');
      g.addColorStop(1, 'rgba(24,14,8,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(c, { wrap: false });
  });
}

/**
 * Mancha de humedad en pared (gotera): cerco irregular con borde oscuro («línea de marea»),
 * interior amarillento y regueros que caen. 256×512, transparente.
 */
export function waterStainDecal(seed = 0) {
  return memo(`wstain-${seed}`, () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');
    const rng = new Rng(`wstain-${seed}`);
    const blob = (cx, cy, rx, ry, jag) => {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const k = 1 + (rng.next() - 0.5) * jag;
        const x = cx + Math.cos(a) * rx * k;
        const y = cy + Math.sin(a) * ry * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // cercos concéntricos (cada secado deja un borde)
    for (let ring = 0; ring < 3; ring++) {
      const rx = 100 - ring * 22;
      const ry = 120 - ring * 26;
      blob(128, 140, rx, ry, 0.22);
      ctx.fillStyle = `rgba(92,70,40,${0.12 + ring * 0.05})`;
      ctx.fill();
      ctx.lineWidth = 3 + rng.next() * 3;
      ctx.strokeStyle = `rgba(48,32,16,${0.35 + ring * 0.1})`;
      ctx.stroke();
    }
    // regueros
    for (let i = 0; i < 9; i++) {
      const x0 = 70 + rng.next() * 116;
      const len = 140 + rng.next() * 300;
      const w = 3 + rng.next() * 7;
      const g = ctx.createLinearGradient(0, 200, 0, 200 + len);
      g.addColorStop(0, 'rgba(70,50,26,0.45)');
      g.addColorStop(1, 'rgba(70,50,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - w, 200);
      let x = x0;
      for (let y = 200; y < 200 + len; y += 20) {
        x += (rng.next() - 0.5) * 3;
        ctx.lineTo(x - w * (1 - (y - 200) / len), y);
      }
      for (let y = 200 + len; y > 200; y -= 20) ctx.lineTo(x + w * (1 - (y - 200) / len), y);
      ctx.closePath();
      ctx.fill();
    }
    return toTexture(c, { wrap: false });
  });
}

/**
 * Alfombra carmesí de pasillo (la de la compra): campo carmesí con lana y trama, cenefa negra y dorada en los
 * bordes largos y un medallón art déco que se repite a lo largo. Una tesela = 4 m de ancho × 1,6 m de largo
 * (se repite en V). 512×208 px aprox. (2,5 px/cm de alto).
 */
export function runnerCarpet() {
  return memo('runner', () => {
    const W = 640;
    const H = 256;
    const [c, x] = canvas(W, H);
    const rng = new Rng('runner');
    // campo carmesí con variación de lana
    x.fillStyle = '#7a0f22';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const v = rng.next();
      x.fillStyle = v < 0.5 ? `rgba(40,0,8,${0.05 + v * 0.1})` : `rgba(190,40,60,${(v - 0.5) * 0.12})`;
      x.fillRect(rng.next() * W, rng.next() * H, 1 + rng.next() * 2, 1);
    }
    // trama (líneas finas a lo largo)
    x.globalAlpha = 0.07;
    x.fillStyle = '#000';
    for (let px = 0; px < W; px += 3) x.fillRect(px, 0, 1, H);
    x.globalAlpha = 1;
    // cenefas laterales: negro, oro, carmesí oscuro, oro fino
    const band = (from, w, color) => {
      x.fillStyle = color;
      x.fillRect(from, 0, w, H);
      x.fillRect(W - from - w, 0, w, H);
    };
    band(0, 14, '#120709');
    band(14, 10, '#b8892c');
    band(24, 26, '#3a0610');
    band(50, 4, '#d4af37');
    // greca en la cenefa: rombos dorados
    x.fillStyle = '#c99a3a';
    for (let y = 8; y < H; y += 32) {
      for (const cx of [37, W - 37]) {
        x.beginPath();
        x.moveTo(cx, y);
        x.lineTo(cx + 8, y + 8);
        x.lineTo(cx, y + 16);
        x.lineTo(cx - 8, y + 8);
        x.closePath();
        x.fill();
      }
    }
    // medallón central art déco (abanico escalonado)
    const cx = W / 2;
    const cy = H / 2;
    x.strokeStyle = 'rgba(212,175,55,0.75)';
    x.lineWidth = 3;
    for (let r = 26; r <= 86; r += 20) {
      x.beginPath();
      x.moveTo(cx - r * 1.4, cy);
      x.lineTo(cx, cy - r * 0.9);
      x.lineTo(cx + r * 1.4, cy);
      x.lineTo(cx, cy + r * 0.9);
      x.closePath();
      x.stroke();
    }
    x.fillStyle = 'rgba(212,175,55,0.85)';
    x.beginPath();
    x.arc(cx, cy, 9, 0, Math.PI * 2);
    x.fill();
    // desgaste suave por el centro (por donde se pisa)
    const g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.3, 'rgba(255,220,220,0)');
    g.addColorStop(0.5, 'rgba(255,200,200,0.05)');
    g.addColorStop(0.7, 'rgba(255,220,220,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    const t = toTexture(c, { aniso: 8 });
    t.wrapS = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Mancha de gotera en el techo: cercos concéntricos irregulares (marrón amarillento), sin regueros. */
export function ceilingStainDecal(seed = 0) {
  return memo(`cstain-${seed}`, () => {
    const [c, ctx] = canvas(256);
    const rng = new Rng(`cstain-${seed}`);
    const blob = (rx, ry, jag) => {
      ctx.beginPath();
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * Math.PI * 2;
        const k = 1 + Math.sin(a * 3 + seed) * jag * 0.5 + (rng.next() - 0.5) * jag;
        const x = 128 + Math.cos(a) * rx * k;
        const y = 128 + Math.sin(a) * ry * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    for (let ring = 0; ring < 4; ring++) {
      const r = 112 - ring * 24;
      blob(r, r * (0.8 + rng.next() * 0.2), 0.18);
      ctx.fillStyle = `rgba(110,82,44,${0.1 + ring * 0.06})`;
      ctx.fill();
      ctx.lineWidth = 2 + rng.next() * 3;
      ctx.strokeStyle = `rgba(60,40,18,${0.3 + ring * 0.12})`;
      ctx.stroke();
    }
    // centro más oscuro (por donde gotea)
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 22);
    g.addColorStop(0, 'rgba(30,20,10,0.7)');
    g.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return toTexture(c, { wrap: false });
  });
}

/** Yeso desnudo donde se ha caído el papel pintado: contorno rasgado, yeso con manchas y restos de cola. */
export function bareWallDecal(seed = 0) {
  return memo(`bare-${seed}`, () => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 384;
    const ctx = c.getContext('2d');
    const rng = new Rng(`bare-${seed}`);
    ctx.beginPath();
    const pts = [];
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rx = 52 + (rng.next() - 0.5) * 18;
      const ry = 170 + (rng.next() - 0.5) * 30;
      pts.push([64 + Math.cos(a) * rx, 192 + Math.sin(a) * ry * (Math.sin(a) > 0 ? 1 : 0.92)]);
    }
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#b7a891';
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${90 + rng.next() * 40},${76 + rng.next() * 30},${58 + rng.next() * 20},${0.08 + rng.next() * 0.12})`;
      ctx.beginPath();
      ctx.arc(rng.next() * 128, rng.next() * 384, 2 + rng.next() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(40,28,20,0.55)';
    ctx.stroke();
    return toTexture(c, { wrap: false });
  });
}

/** Grietas ramificadas (baldosas rotas). */
export function crackDecal(seed = 0) {
  return memo(`crack-${seed}`, () => {
    const [c, ctx] = canvas(256);
    const rng = new Rng(`crack-${seed}`);
    ctx.strokeStyle = 'rgba(6,4,3,0.9)';
    ctx.lineCap = 'round';
    const branch = (x, y, a, len, w) => {
      if (len < 8 || w < 0.4) return;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      for (let s = 0; s < 6; s++) {
        a += (rng.next() - 0.5) * 0.9;
        cx += Math.cos(a) * len / 6;
        cy += Math.sin(a) * len / 6;
        ctx.lineTo(cx, cy);
      }
      // halo de polvo oscuro alrededor y la grieta encima (los decals no reciben luz: nada claro)
      ctx.strokeStyle = 'rgba(20,14,10,0.22)';
      ctx.lineWidth = w + 3;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(6,4,3,0.92)';
      ctx.lineWidth = w;
      ctx.stroke();
      if (rng.next() > 0.35) branch(cx, cy, a + (rng.next() - 0.5) * 1.6, len * 0.6, w * 0.6);
      if (rng.next() > 0.6) branch(x + (cx - x) * 0.5, y + (cy - y) * 0.5, a + 1, len * 0.5, w * 0.5);
    };
    branch(128, 128, rng.next() * 6.28, 110, 3);
    branch(128, 128, rng.next() * 6.28, 90, 2.4);
    return toTexture(c, { wrap: false });
  });
}

/** Telaraña en una esquina (cuadrante superior izquierdo). */
export function webDecal() {
  return memo('web', () => {
    const [c, ctx] = canvas(256);
    ctx.strokeStyle = 'rgba(230,226,215,0.55)';
    ctx.lineWidth = 1.2;
    const rays = 7;
    for (let i = 0; i <= rays; i++) {
      const a = (i / rays) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
      ctx.stroke();
    }
    for (let r = 28; r < 250; r += 26) {
      ctx.beginPath();
      for (let i = 0; i <= rays; i++) {
        const a = (i / rays) * (Math.PI / 2);
        const rr = r * (1 - (i % 2) * 0.06) - Math.sin(i * 1.7) * 3;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(Math.cos(a - Math.PI / 14) * rr * 0.92, Math.sin(a - Math.PI / 14) * rr * 0.92, x, y);
      }
      ctx.stroke();
    }
    return toTexture(c, { wrap: false });
  });
}

// ---------------------------------------------------------------- mesas de juego (diegético)

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const isRedNumber = (n) => RED_NUMBERS.has(n);

function arcText(ctx, text, cx, cy, radius, centerAngle, flip = false) {
  const chars = [...text];
  const spacing = 0.055;
  const total = (chars.length - 1) * spacing;
  chars.forEach((ch, i) => {
    const a = centerAngle + (i * spacing - total / 2) * (flip ? -1 : 1);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

/** Trazado de la mesa de blackjack (transparente; se pega sobre el fieltro). */
export function blackjackLayout(size = 1024) {
  return memo(`bj-layout-${size}`, () => {
    const w = size;
    const h = Math.round(size * 0.6);
    const [c, ctx] = canvas(w, h);
    ctx.strokeStyle = 'rgba(230,200,110,0.9)';
    ctx.fillStyle = 'rgba(230,200,110,0.92)';
    ctx.lineWidth = Math.max(2, w / 300);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = w / 2;
    const cy = h * 0.04;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.18 + (i / 4) * 0.64);
      const x = cx + Math.cos(a) * w * 0.38;
      const y = cy + Math.sin(a) * h * 0.78;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.058, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, w * 0.05, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.font = `700 ${Math.round(w * 0.034)}px Cinzel, serif`;
    arcText(ctx, 'BLACKJACK PAYS 3 TO 2', cx, cy, h * 0.52, Math.PI / 2);
    ctx.font = `600 ${Math.round(w * 0.024)}px Cinzel, serif`;
    arcText(ctx, 'DEALER STANDS ON ALL 17', cx, cy, h * 0.4, Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.43, h * 0.86, 0, 0.12, Math.PI - 0.12);
    ctx.stroke();
    return toTexture(c, { wrap: false });
  });
}

/** Paño de ruleta europea (0 + 1–36, docenas y apuestas externas). */
export function rouletteLayout(size = 1024) {
  return memo(`rl-layout-${size}`, () => {
    const w = size;
    const h = Math.round(size / 2);
    const [c, ctx] = canvas(w, h);
    ctx.fillStyle = 'rgba(14,74,52,1)';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = Math.max(2, w / 340);
    ctx.strokeStyle = 'rgba(235,225,190,0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // misma geometría que la detección de clics (games/roulette-layout.js)
    for (const cell of ROULETTE_CELLS) {
      const x = cell.x * w;
      const y = cell.y * h;
      const cw = cell.w * w;
      const ch = cell.h * h;
      const n = cell.key.startsWith('n:') ? Number(cell.key.slice(2)) : null;
      const fill = cell.fill === 'green' ? '#0c7a3c' : cell.fill === 'number' ? (isRedNumber(n) ? '#a4182c' : '#0b0b0d') : cell.fill === 'red' ? '#a4182c' : cell.fill === 'black' ? '#0b0b0d' : null;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cw, ch);
      }
      ctx.strokeRect(x, y, cw, ch);
      ctx.fillStyle = '#f5ead7';
      const px = n !== null ? Math.min(ch * 0.5, cw * 0.62) : Math.min(ch * 0.42, cw * 0.36);
      ctx.font = `700 ${Math.round(px)}px Cinzel, serif`;
      ctx.fillText(cell.label, x + cw / 2, y + ch / 2);
    }
    return toTexture(c, { wrap: false });
  });
}
