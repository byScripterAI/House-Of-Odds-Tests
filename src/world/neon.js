import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTexture } from './procedural-textures.js';

/**
 * RÓTULOS LUMINOSOS 3D (letras de canal con LED).
 *
 * Cada letra es una pieza con volumen: cara de metacrilato iluminada y cantos de latón con bisel. Detrás, un
 * resplandor suave sobre la pared. El bloom (ALTA/ULTRA) añade el halo de luz alrededor de cada letra.
 * Los contornos salen de Cinzel (assets/fonts/cinzel-neon.json, generado con scripts/fonts/neon-font.py).
 * Letras fundidas (`dead`): tubo gris sin luz que vuelve a encenderse al restaurar el local.
 * Si el texto tiene caracteres que no están en la fuente (p. ej. chino) se usa el rótulo plano de siempre.
 */

let FONT = null;

export async function loadNeonFont() {
  try {
    const loader = new THREE.FileLoader();
    loader.setResponseType('json');
    FONT = await loader.loadAsync(new URL('../../assets/fonts/cinzel-neon.json', import.meta.url).href);
  } catch (e) {
    console.warn('[neón] sin fuente de neón', e);
  }
}

/** ¿Se puede dibujar este texto con tubos? */
export function neonCanDraw(text) {
  if (!FONT || !text) return false;
  for (const ch of String(text)) if (ch !== ' ' && !FONT.glyphs[ch]) return false;
  return true;
}

const area = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
  return a / 2;
};
const inside = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** Simplificación Ramer–Douglas–Peucker de un contorno cerrado (en unidades «em»): mismas curvas, menos vértices. */
function simplify(flat, tol) {
  const n = flat.length / 2;
  if (n < 8) return flat;
  const keep = new Uint8Array(n);
  const rdp = (a, b) => {
    const ax = flat[a * 2], ay = flat[a * 2 + 1], bx = flat[b * 2], by = flat[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((flat[i * 2] - ax) * dy - (flat[i * 2 + 1] - ay) * dx) / len;
      if (d > bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    keep[best] = 1;
    rdp(a, best);
    rdp(best, b);
  };
  // punto más lejano al primero como segundo ancla (contorno cerrado)
  let far = 1, fd = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(flat[i * 2] - flat[0], flat[i * 2 + 1] - flat[1]);
    if (d > fd) { fd = d; far = i; }
  }
  keep[0] = keep[far] = 1;
  rdp(0, far);
  // tramo de cierre: de `far` al final y vuelta al primero
  const tail = [...flat.slice(far * 2), flat[0], flat[1]];
  const sub = simplify.closing(tail, tol);
  const out = [];
  for (let i = 0; i <= far; i++) if (keep[i]) out.push(flat[i * 2], flat[i * 2 + 1]);
  for (let i = 1; i < sub.length / 2 - 1; i++) out.push(sub[i * 2], sub[i * 2 + 1]);
  return out.length >= 6 ? out : flat;
}
/** RDP de una polilínea abierta (extremos fijos). */
simplify.closing = (flat, tol) => {
  const n = flat.length / 2;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const rdp = (a, b) => {
    const ax = flat[a * 2], ay = flat[a * 2 + 1], bx = flat[b * 2], by = flat[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((flat[i * 2] - ax) * dy - (flat[i * 2 + 1] - ay) * dx) / len;
      if (d > bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    keep[best] = 1;
    rdp(a, best);
    rdp(best, b);
  };
  rdp(0, n - 1);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(flat[i * 2], flat[i * 2 + 1]);
  return out;
};
const simplified = new Map();
const glyphContours = (ch) => {
  if (!simplified.has(ch)) simplified.set(ch, (FONT.glyphs[ch]?.c ?? []).map((flat) => simplify(flat, 0.0025)));
  return simplified.get(ch);
};

/** Contornos de un texto colocados (en metros), centrados. Devuelve [{char, index, contours:[Vector2[]]}]. */
function layout(text, size, y0) {
  const chars = [...text];
  let width = 0;
  for (const ch of chars) width += (FONT.glyphs[ch]?.a ?? 0.3) * size;
  let cursor = -width / 2;
  const out = [];
  chars.forEach((ch, index) => {
    const g = FONT.glyphs[ch];
    if (g?.c.length) {
      const contours = glyphContours(ch).map((flat) => {
        const pts = [];
        for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(cursor + flat[i] * size, y0 + flat[i + 1] * size));
        return pts;
      });
      out.push({ char: ch, index, contours });
    }
    cursor += (g?.a ?? 0.3) * size;
  });
  return { glyphs: out, width };
}

/** Letra de canal: contornos exteriores con sus huecos, extruida. */
function letterGeometry(contours, depth, fine = true) {
  const sorted = contours.map((c) => ({ c, a: area(c) })).sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  if (!sorted.length) return null;
  const outerSign = Math.sign(sorted[0].a);
  const shapes = [];
  for (const { c, a } of sorted) {
    if (Math.sign(a) === outerSign) shapes.push(new THREE.Shape(c));
  }
  for (const { c, a } of sorted) {
    if (Math.sign(a) === outerSign) continue;
    const host = shapes.find((s) => inside(c[0], s.getPoints()));
    host?.holes.push(new THREE.Path(c));
  }
  if (!shapes.length) return null;
  // bisel fino: el canto de latón brilla alrededor de la cara iluminada
  return new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: depth * 0.045, bevelSegments: fine ? 2 : 1, curveSegments: 1 });
}

/** Separa una ExtrudeGeometry en [caras (tapas), cantos (laterales y bisel)]. */
function splitExtrude(geo) {
  const out = [[], []];
  for (const gr of geo.groups) {
    const g2 = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) {
      const a = geo.attributes[k];
      g2.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    out[gr.materialIndex ?? 0].push(g2);
  }
  geo.dispose();
  return out;
}

/**
 * Crea un rótulo de LETRAS LUMINOSAS 3D (letras de canal): cara de metacrilato iluminada por LED, cantos de latón
 * con bisel y un resplandor suave en la pared. Contornos de Cinzel ya unidos (sin solapes).
 * @param {object} ctx  contexto del mundo (kit, g, track)
 * @param {string} text
 * @param {{w:number,h:number,color?:string,glow?:string,sub?:string|null,dead?:number[]}} o  ancho/alto del hueco (m)
 */
export function createNeonSign(ctx, text, o) {
  const { kit, g } = ctx;
  const group = new THREE.Group();
  group.name = 'neon';
  const glow = new THREE.Color(o.glow ?? '#d4af37');
  const core = new THREE.Color(o.color ?? '#fff3c4');
  // cara iluminada: color cálido del rótulo; el bloom pone el halo
  const faceColor = core.clone().lerp(glow, 0.45);
  const brass = kit.make({ color: 0xc9a25a, metal: 1, rough: 0.32, envIntensity: 1.1, dirt: 'hall' });
  const lit = kit.make({ color: faceColor.clone().multiplyScalar(0.6), emissive: faceColor, emissiveIntensity: 1.5, rough: 0.35, dirt: null });
  const dead = kit.make({ color: 0x2a2420, emissive: faceColor, emissiveIntensity: 0, rough: 0.3, dirt: null });
  const haloMat = kit.basic({ map: (ctx.track ?? ((x) => x))(glowTexture()), color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2 });
  haloMat.toneMapped = true;
  const owned = [];
  let level = 1;
  let deadLevel = 0;
  let stutter = 1;
  const dims = { w: o.w, h: o.h };

  function build(text, sub) {
    for (const m of owned.splice(0)) {
      m.geometry.dispose();
      m.removeFromParent();
    }
    const hasSub = !!sub;
    const capH = FONT.cap || 0.7;
    // tamaño: que quepa a lo ancho y a lo alto (con hueco para el subtítulo)
    let size = (dims.h * (hasSub ? 0.56 : 0.76)) / capH;
    const probe = layout(text, size, 0);
    if (probe.width > dims.w * 0.94) size *= (dims.w * 0.94) / probe.width;
    const y0 = hasSub ? dims.h * 0.5 - size * capH - dims.h * 0.04 : (-size * capH) / 2;
    const main = layout(text, size, y0);
    const faces = [];
    const facesDead = [];
    const sides = [];
    const letter = (gl, sz, isDead) => {
      const depth = Math.max(0.02, sz * 0.09);
      const lg = letterGeometry(gl.contours, depth, (ctx.g?.detail ?? 1) >= 1);
      if (!lg) return;
      const [caps, walls] = splitExtrude(lg);
      (isDead ? facesDead : faces).push(...caps);
      sides.push(...walls);
    };
    for (const gl of main.glyphs) letter(gl, size, o.dead?.includes(gl.index));
    let bottom = y0;
    if (hasSub) {
      const sSize = size * 0.34;
      const sy = -dims.h * 0.5 + dims.h * 0.06;
      const sub0 = layout(String(sub).toUpperCase(), sSize, sy);
      for (const gl of sub0.glyphs) letter(gl, sSize, false);
      bottom = sy;
    }
    const add = (list, mat, cast) => {
      if (!list.length) return;
      const geo = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = !cast;
      group.add(mesh);
      owned.push(mesh);
    };
    add(sides, brass, !!g?.shadows);
    add(faces, lit, false);
    add(facesDead, dead, false);
    // resplandor suave sobre la pared (un óvalo, sin letras: no hace «doble imagen»)
    const top = y0 + size * capH;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(dims.w, main.width) * 1.35, (top - bottom) * 2.6 + 0.3), haloMat);
    halo.position.set(0, (top + bottom) / 2, -0.02);
    halo.renderOrder = -1;
    group.add(halo);
    owned.push(halo);
  }

  function apply() {
    lit.emissiveIntensity = 1.5 * level;
    dead.emissiveIntensity = 1.5 * level * deadLevel * stutter;
    dead.color.setRGB(0.16, 0.14, 0.12).lerp(lit.color, deadLevel);
    haloMat.opacity = 0.2 * level;
  }

  build(text, o.sub ?? null);
  apply();
  return {
    group,
    /** Brillo general (parpadeo). `stutterK` solo afecta a las letras fundidas. */
    setLevel(v, stutterK = 1) {
      level = v;
      stutter = stutterK;
      apply();
    },
    /** 0 = letras fundidas apagadas · 1 = arregladas (encendidas como las demás). */
    setDeadLevel(v) {
      deadLevel = v;
      apply();
    },
    setText(t, sub = null) {
      build(t, sub);
      apply();
    },
    dispose() {
      for (const m of owned.splice(0)) m.geometry.dispose();
      haloMat.map?.dispose();
    },
  };
}
