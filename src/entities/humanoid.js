import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBox, seg } from '../gfx/geometry.js';

/**
 * HUMANOIDE PROCEDURAL.
 *
 * Un personaje = UNA malla con esqueleto (SkinnedMesh, colores por vértice)
 * + la cabeza (esfera con la cara pintada en un lienzo) + párpados. Así cada
 * PNJ cuesta 2-3 llamadas de dibujo aunque tenga 18 huesos y ropa detallada.
 *
 * Las piezas se modelan en «pose de reposo» (brazos caídos) en espacio del
 * modelo: frente hacia +Z, pies en y=0, altura ≈ 1,75 m antes de escalar.
 * Codos, rodillas y cintura usan pesos mezclados entre dos huesos para que
 * las articulaciones se doblen sin romperse.
 *
 * La animación es procedural (sin ficheros): `HumanoidAnimator` calcula una
 * pose objetivo según la actividad (de pie, andar, sentado, jugar, repartir,
 * hablar…) y amortigua hacia ella, de modo que las transiciones son suaves.
 */

// ------------------------------------------------------------------ esqueleto (reposo)

const J = {
  hips: [0, 0.95, 0],
  spine: [0, 1.1, 0],
  chest: [0, 1.28, 0],
  neck: [0, 1.49, 0],
  head: [0, 1.56, 0.005],
  uArmL: [0.2, 1.43, 0],
  fArmL: [0.225, 1.17, -0.01],
  handL: [0.235, 0.92, 0.0],
  uArmR: [-0.2, 1.43, 0],
  fArmR: [-0.225, 1.17, -0.01],
  handR: [-0.235, 0.92, 0.0],
  thighL: [0.095, 0.93, 0],
  shinL: [0.1, 0.5, 0.01],
  footL: [0.1, 0.085, 0],
  thighR: [-0.095, 0.93, 0],
  shinR: [-0.1, 0.5, 0.01],
  footR: [-0.1, 0.085, 0],
};
const PARENT = {
  hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  uArmL: 'chest', fArmL: 'uArmL', handL: 'fArmL', uArmR: 'chest', fArmR: 'uArmR', handR: 'fArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR',
};
export const BONES = ['root', ...Object.keys(J)];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));

const HEAD_C = new THREE.Vector3(0, 1.645, 0.015); // centro del cráneo (espacio modelo)
const HEAD_R = new THREE.Vector3(0.088, 0.11, 0.1);
const EYE_YAW = 0.36;
const EYE_PITCH = 0.12;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ cara (lienzo)

function hex(c) {
  return `#${new THREE.Color(c).getHexString()}`;
}

/** Pinta la cara en una textura equirectangular (la esfera mira a +Z → u = 0,25). */
function faceTexture(a, size) {
  const w = size;
  const h = size / 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const skin = new THREE.Color(a.skin);
  ctx.fillStyle = hex(skin);
  ctx.fillRect(0, 0, w, h);
  const px = (u) => u * w;
  const py = (theta) => (theta / Math.PI) * h;
  const cx = px(0.25);
  const ang = (rad) => (rad / (Math.PI * 2)) * w;
  // sombreado suave de mejillas y mentón
  const shade = ctx.createRadialGradient(cx, py(Math.PI / 2 + 0.25), 2, cx, py(Math.PI / 2 + 0.25), ang(0.9));
  shade.addColorStop(0, 'rgba(255,190,170,0.0)');
  shade.addColorStop(1, 'rgba(60,20,10,0.18)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  // pelo pintado (nacimiento y nuca) — las mallas de pelo dan el volumen
  if (a.hair !== 'bald') {
    ctx.fillStyle = hex(a.hairColor);
    ctx.fillRect(0, 0, w, py(0.62));
    ctx.fillRect(px(0.45), 0, px(0.6), py(Math.PI * 0.62));
    // patillas
    for (const s of [-1, 1]) ctx.fillRect(cx + s * ang(1.25) - ang(0.12), py(0.6), ang(0.24), py(0.6));
  } else if (a.age > 50) {
    ctx.fillStyle = hex(a.hairColor);
    ctx.fillRect(px(0.45), py(1.1), px(0.6), py(0.5));
  }
  const eyeY = py(Math.PI / 2 - EYE_PITCH);
  const ex = ang(EYE_YAW);
  // cejas
  ctx.strokeStyle = hex(new THREE.Color(a.hairColor).multiplyScalar(0.8));
  ctx.lineWidth = Math.max(2, h * (a.female ? 0.016 : 0.024));
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * ex * 0.55, eyeY - h * 0.055);
    ctx.quadraticCurveTo(cx + s * ex * 1.0, eyeY - h * (a.stern ? 0.06 : 0.078), cx + s * ex * 1.45, eyeY - h * 0.05);
    ctx.stroke();
  }
  // ojos
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    ctx.fillStyle = '#f4efe8';
    ctx.beginPath();
    ctx.ellipse(x, eyeY, ex * 0.42, h * 0.024, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hex(a.eyes);
    ctx.beginPath();
    ctx.arc(x, eyeY, h * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0606';
    ctx.beginPath();
    ctx.arc(x, eyeY, h * 0.009, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - h * 0.006, eyeY - h * 0.007, h * 0.004, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a.female ? '#1a0d0d' : 'rgba(40,20,15,0.8)';
    ctx.lineWidth = a.female ? h * 0.011 : h * 0.007;
    ctx.beginPath();
    ctx.ellipse(x, eyeY + h * 0.004, ex * 0.44, h * 0.026, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  // nariz (sombra) y boca
  ctx.fillStyle = 'rgba(90,40,25,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, py(Math.PI / 2 + 0.16), ang(0.11), h * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();
  const mouthY = py(Math.PI / 2 + 0.34);
  ctx.fillStyle = hex(a.lips ?? new THREE.Color(a.skin).multiplyScalar(0.72).lerp(new THREE.Color(0xa0404a), 0.35));
  ctx.beginPath();
  ctx.ellipse(cx, mouthY, ang(0.2), h * (a.female ? 0.016 : 0.011), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,15,15,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.005);
  ctx.beginPath();
  ctx.moveTo(cx - ang(0.2), mouthY);
  ctx.quadraticCurveTo(cx, mouthY + h * (a.smile ? 0.012 : 0.002), cx + ang(0.2), mouthY);
  ctx.stroke();
  // rubor / arrugas / barba
  if (a.female) {
    ctx.fillStyle = 'rgba(220,90,90,0.12)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex * 1.25, py(Math.PI / 2 + 0.16), h * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (a.age > 50) {
    ctx.strokeStyle = 'rgba(70,30,20,0.25)';
    ctx.lineWidth = Math.max(1, h * 0.004);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ang(0.16), py(Math.PI / 2 + 0.2));
      ctx.quadraticCurveTo(cx + s * ang(0.28), py(Math.PI / 2 + 0.3), cx + s * ang(0.26), py(Math.PI / 2 + 0.42));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - ex, eyeY - h * 0.11);
    ctx.lineTo(cx + ex, eyeY - h * 0.11);
    ctx.stroke();
  }
  if (a.beard === 'stubble' || a.beard === 'full' || a.beard === 'moustache') {
    const bc = new THREE.Color(a.hairColor);
    ctx.fillStyle = `rgba(${(bc.r * 255) | 0},${(bc.g * 255) | 0},${(bc.b * 255) | 0},${a.beard === 'stubble' ? 0.13 : 0.8})`;
    if (a.beard === 'moustache') {
      ctx.beginPath();
      ctx.ellipse(cx, mouthY - h * 0.03, ang(0.22), h * 0.014, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.filter = `blur(${Math.max(1, h * 0.012)}px)`;
      ctx.beginPath();
      ctx.ellipse(cx, py(Math.PI / 2 + 0.45), ang(0.7), h * 0.12, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, mouthY - h * 0.028, ang(0.24), h * 0.016, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ construcción

/**
 * @typedef {object} Appearance
 * @property {boolean} female
 * @property {number} height     metros (≈1,55–1,92)
 * @property {number} build      0,85 (delgado) … 1,25 (corpulento)
 * @property {number} age
 * @property {number} skin       color piel
 * @property {number} hairColor
 * @property {string} hair       short | slick | bob | long | bun | ponytail | curly | bald | receding
 * @property {string} [beard]    stubble | full | moustache
 * @property {number} eyes
 * @property {number} [lips]
 * @property {object} outfit     { top, bottom, shoes, shirt?, tie?, vest?, sleeves?: 'rolled', dress?: true, accent? }
 * @property {string[]} [extras] glasses | earpiece | badge | cane | folder | toolbelt | watch | pocketSquare | necklace | glowBracelet | bowtie
 * @property {boolean} [smile] @property {boolean} [stern]
 */

/**
 * Crea un humanoide.
 * @param {Appearance} a
 * @param {{detail?: number, material?: THREE.Material, textureSize?: number}} opts
 */
export function createHumanoid(a, { detail = 1, material = null, textureSize = 256, lowDetail = false } = {}) {
  const parts = [];
  const tmp = new THREE.Object3D();
  const S = (n, min = 4) => seg(detail, n, min);
  const w = a.build ?? 1;
  const fem = !!a.female;

  /**
   * Añade una pieza: geometría ya posicionada (o se posiciona con `at`), un color y un hueso.
   * `blend`: { bone, y0, y1 } → el peso pasa al otro hueso entre y0 (0 %) e y1 (100 %).
   */
  function part(geo, color, bone, { at = null, rot = null, scale = null, blend = null } = {}) {
    let g = geo.index ? geo : geo;
    if (at || rot || scale) {
      tmp.position.set(...(at ?? [0, 0, 0]));
      tmp.rotation.set(...(rot ?? [0, 0, 0]));
      tmp.scale.set(...(scale ?? [1, 1, 1]));
      tmp.updateMatrix();
      g.applyMatrix4(tmp.matrix);
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const cc = new THREE.Color(color);
    const b0 = BI[bone];
    const b1 = blend ? BI[blend.bone] : b0;
    for (let i = 0; i < n; i++) {
      col[i * 3] = cc.r;
      col[i * 3 + 1] = cc.g;
      col[i * 3 + 2] = cc.b;
      let k = 0;
      if (blend) {
        const y = g.attributes.position.getY(i);
        k = smooth(blend.y0, blend.y1, y);
      }
      si[i * 4] = b0;
      si[i * 4 + 1] = b1;
      sw[i * 4] = 1 - k;
      sw[i * 4 + 1] = k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  }
  const capsule = (r, len, radial = 12) => new THREE.CapsuleGeometry(r, len, S(4, 2), S(radial, 6));
  const sphere = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, S(ws, 6), S(hs, 4));
  const box = (x, y, z, r = 0.01) => (detail >= 0.5 && r > 0 ? mergeVertices(roundedBox(x, y, z, r, detail)) : new THREE.BoxGeometry(x, y, z));

  const o = a.outfit;
  const top = o.top;
  const bottom = fem && o.dress ? o.top : o.bottom;
  const skin = a.skin;
  const sleeve = o.sleeves === 'rolled' ? null : top;
  const legsColor = fem && o.dress ? skin : bottom; // vestido: piernas con medias color piel

  /** Extremidad ahusada con extremos redondeados (perfil de torno): muslo, gemelo, brazo. */
  const limb = (rTop, rBot, len, radial = 12) => {
    const n = Math.max(2, S(4, 2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const ang = -Math.PI / 2 + (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(ang) * rBot, -len / 2 + Math.sin(ang) * rBot));
    }
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(ang) * rTop, len / 2 + Math.sin(ang) * rTop));
    }
    return new THREE.LatheGeometry(pts, S(radial, 6));
  };
  const lathe = (profile, radial = 18) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), S(radial, 8));

  // ---- piernas y pies
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const x = 0.098 * s;
    part(box(0.092, 0.075, 0.25, 0.028), o.shoes, `foot${L}`, { at: [x, 0.037, 0.045] });
    if (fem && o.heels) part(new THREE.CylinderGeometry(0.012, 0.009, 0.06, 6), o.shoes, `foot${L}`, { at: [x, 0.03, -0.065] });
    part(limb(0.054 * (0.92 + w * 0.08), 0.037, 0.34), legsColor, `shin${L}`, { at: [x, 0.29, 0.004], blend: { bone: `thigh${L}`, y0: 0.47, y1: 0.55 } });
    part(limb(0.088 * w, 0.056, 0.36), bottom, `thigh${L}`, { at: [x * 0.97, 0.71, 0], blend: { bone: `shin${L}`, y0: 0.55, y1: 0.47 } });
  }
  // ---- pelvis y torso
  part(lathe([[0.0, 0], [0.1 * w, 0.015], [0.138 * w, 0.06], [(fem ? 0.15 : 0.145) * w, 0.12], [0.142 * w, 0.18], [0.138 * w, 0.2]]), bottom, 'hips', { at: [0, 0.845, -0.005], scale: [1, 1, 0.74] });
  if (fem && o.dress) {
    // falda: cono corto que cuelga de la cadera
    const skirt = new THREE.CylinderGeometry(0.165 * w, 0.22 * w, 0.42, S(18, 8), 1, true);
    part(skirt, o.top, 'hips', { at: [0, 0.75, 0], scale: [1, 1, 0.78] });
    part(new THREE.CircleGeometry(0.22 * w, S(18, 8)), o.top, 'hips', { at: [0, 0.54, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.78, 1] });
  }
  const chestR = (fem ? 0.15 : 0.172) * w;
  const shoulderR = (fem ? 0.168 : 0.195) * w;
  const torsoProfile = [
    [0.142 * w, 0.0], [0.146 * w, 0.06], [(fem ? 0.128 : 0.15) * w, 0.17], [chestR * 0.97, 0.29], [chestR, 0.36], [shoulderR, 0.43], [shoulderR * 0.86, 0.485], [0.072, 0.515], [0.0, 0.52],
  ];
  part(lathe(torsoProfile, 22), top, 'spine', { at: [0, 0.985, 0], scale: [1, 1, 0.62], blend: { bone: 'chest', y0: 1.14, y1: 1.24 } });
  if (fem) part(sphere(1, 14, 10), top, 'chest', { at: [0, 1.315, 0.03], scale: [0.115 * w, 0.06, 0.07] });
  const front = chestR * 0.62;
  // camisa / corbata / chaleco / solapas
  if (o.shirt) {
    part(box(0.08, 0.2, 0.012, 0.004), o.shirt, 'chest', { at: [0, 1.38, front + 0.002], rot: [-0.2, 0, 0] });
    for (const s of [-1, 1]) part(box(0.045, 0.055, 0.02, 0.006), o.shirt, 'chest', { at: [s * 0.038, 1.475, front - 0.025], rot: [0.25, 0, s * 0.5] });
  }
  if (o.tie) part(box(0.034, 0.2, 0.01, 0.004), o.tie, 'chest', { at: [0, 1.365, front + 0.011], rot: [-0.2, 0, 0] });
  if (o.vest) part(box(0.2 * w, 0.24, 0.02, 0.008), o.vest, 'spine', { at: [0, 1.18, chestR * 0.58], rot: [-0.06, 0, 0], blend: { bone: 'chest', y0: 1.14, y1: 1.24 } });
  if (o.lapels !== false && o.jacket !== false && o.shirt) {
    for (const s of [-1, 1]) part(box(0.032, 0.21, 0.012, 0.004), top, 'chest', { at: [s * 0.058, 1.365, front + 0.007], rot: [-0.2, 0, -s * 0.32] });
    part(box(0.012, 0.02, 0.008, 0.002), 0x1a1a1a, 'spine', { at: [0, 1.2, front - 0.004] }); // botón
  }
  if ((a.extras ?? []).includes('bowtie')) for (const s of [-1, 1]) part(sphere(1, 8, 6), o.tie ?? 0x8a0f1e, 'chest', { at: [s * 0.024, 1.475, front - 0.01], scale: [0.026, 0.017, 0.012] });

  // ---- hombros, brazos y manos
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    part(sphere(1, 12, 8), top, 'chest', { at: [0.19 * s * w, 1.415, -0.005], scale: [0.056 * w, 0.05, 0.058 * w] });
    part(limb(0.05 * w, 0.042 * (0.9 + w * 0.1), 0.2), top, `uArm${L}`, { at: [0.212 * s * (0.98 + w * 0.02), 1.3, -0.005], rot: [0, 0, s * 0.07], blend: { bone: `fArm${L}`, y0: 1.22, y1: 1.14 } });
    part(limb(0.041 * (0.9 + w * 0.1), 0.031, 0.19), sleeve ?? skin, `fArm${L}`, { at: [0.229 * s, 1.04, -0.005], blend: { bone: `uArm${L}`, y0: 1.12, y1: 1.2 } });
    if (sleeve) part(new THREE.CylinderGeometry(0.036, 0.036, 0.03, S(10, 6)), o.shirt ?? top, `fArm${L}`, { at: [0.233 * s, 0.94, -0.005] }); // puño
    else part(new THREE.TorusGeometry(0.044, 0.014, 4, S(10, 6)), top, `uArm${L}`, { at: [0.222 * s, 1.17, -0.006], rot: [Math.PI / 2, 0, 0] }); // manga remangada
    part(box(0.028, 0.085, 0.052, 0.012), skin, `hand${L}`, { at: [0.237 * s, 0.86, 0.006] });
    part(limb(0.011, 0.01, 0.03, 6), skin, `hand${L}`, { at: [0.226 * s, 0.875, 0.04], rot: [0.55, 0, 0] });
  }
  // ---- cuello, mandíbula, orejas y nariz (en el hueso de la cabeza)
  part(new THREE.CylinderGeometry(0.056, 0.062, 0.1, S(12, 6)), skin, 'neck', { at: [0, 1.52, 0.0] });
  if (o.shirt) part(new THREE.CylinderGeometry(0.06, 0.063, 0.045, S(12, 6), 1, true), o.shirt, 'neck', { at: [0, 1.49, 0.0] });
  for (const s of [-1, 1]) part(sphere(1, 8, 6), skin, 'head', { at: [s * HEAD_R.x * 0.99, HEAD_C.y - 0.008, HEAD_C.z - 0.008], scale: [0.011, 0.026, 0.018] });
  part(sphere(1, 8, 6), new THREE.Color(skin).multiplyScalar(0.97), 'head', { at: [0, HEAD_C.y - 0.014, HEAD_C.z + HEAD_R.z * 0.975], scale: [0.0115, 0.021, 0.016], rot: [-0.3, 0, 0] });
  hairParts(a, part, sphere, S);
  // ---- accesorios
  const ex = new Set(a.extras ?? []);
  if (ex.has('glasses')) {
    for (const s of [-1, 1]) part(new THREE.TorusGeometry(0.02, 0.003, 4, S(12, 6)), 0x1a1410, 'head', { at: [s * 0.034, HEAD_C.y + 0.012, HEAD_C.z + HEAD_R.z * 0.93] });
    part(box(0.03, 0.004, 0.004, 0), 0x1a1410, 'head', { at: [0, HEAD_C.y + 0.014, HEAD_C.z + HEAD_R.z * 0.95] });
    for (const s of [-1, 1]) part(box(0.004, 0.004, 0.09, 0), 0x1a1410, 'head', { at: [s * 0.088, HEAD_C.y + 0.014, HEAD_C.z + 0.045] });
  }
  if (ex.has('earpiece')) {
    part(sphere(0.012, 6, 5), 0x111111, 'head', { at: [-HEAD_R.x - 0.004, HEAD_C.y - 0.01, HEAD_C.z] });
    part(new THREE.CylinderGeometry(0.0025, 0.0025, 0.14, 4), 0xc8c8c8, 'neck', { at: [-0.09, 1.55, -0.02], rot: [0, 0, 0.25] });
  }
  if (ex.has('badge')) part(box(0.035, 0.045, 0.006, 0.002), 0xd4af37, 'chest', { at: [0.085, 1.34, chestR * 0.62 + 0.012], rot: [-0.15, 0, 0] });
  if (ex.has('pocketSquare')) part(box(0.04, 0.025, 0.008, 0.002), 0xe6c35a, 'chest', { at: [0.1, 1.37, chestR * 0.62 + 0.012], rot: [-0.15, 0, 0.2] });
  if (ex.has('necklace')) part(new THREE.TorusGeometry(0.06, 0.004, 4, S(16, 8)), 0xe0b84a, 'chest', { at: [0, 1.45, 0.045], rot: [1.25, 0, 0], scale: [1, 1.3, 1] });
  if (ex.has('watch')) part(new THREE.TorusGeometry(0.036, 0.007, 4, S(12, 6)), 0xd4af37, 'fArmL', { at: [0.233, 0.95, -0.005], rot: [Math.PI / 2, 0, 0] });
  if (ex.has('glowBracelet')) for (const s of [-1, 1]) part(new THREE.TorusGeometry(0.036, 0.008, 4, S(12, 6)), 0x5af0ff, `fArm${s > 0 ? 'L' : 'R'}`, { at: [0.233 * s, 0.95, -0.005], rot: [Math.PI / 2, 0, 0] });
  if (ex.has('toolbelt')) {
    part(new THREE.TorusGeometry(0.16 * w, 0.018, 4, S(20, 8)), 0x3a2a1a, 'hips', { at: [0, 1.0, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.7, 1] });
    for (const s of [-1, 1]) part(box(0.07, 0.09, 0.04, 0.01), 0x4a3420, 'hips', { at: [s * 0.15 * w, 0.95, 0.05], rot: [0, s * 0.5, 0] });
    part(box(0.02, 0.12, 0.02, 0.004), 0x9a9da3, 'hips', { at: [0.17 * w, 0.92, -0.02] });
  }
  if (ex.has('cane')) {
    part(new THREE.CylinderGeometry(0.01, 0.01, 0.86, 6), 0x1a0e08, 'handR', { at: [-0.25, 0.44, 0.06] });
    part(sphere(0.022, 8, 6), 0xd4af37, 'handR', { at: [-0.25, 0.88, 0.06] });
  }
  if (ex.has('folder')) part(box(0.24, 0.3, 0.03, 0.005), 0x5a3a20, 'handL', { at: [0.27, 0.86, 0.05], rot: [0, 0, 0.08] });
  if (ex.has('tray')) part(new THREE.CylinderGeometry(0.17, 0.17, 0.012, S(16, 8)), 0xc0c4c8, 'handL', { at: [0.25, 0.87, 0.12] });

  // ---- malla con esqueleto
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error('createHumanoid: no se pudieron fusionar las piezas');
  for (const g of parts) g.dispose();
  geometry.computeBoundingSphere();
  const bones = {};
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';
  bones.root = rootBone;
  for (const name of Object.keys(J)) {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
  }
  for (const name of Object.keys(J)) {
    const p = J[name];
    const parent = PARENT[name];
    const pp = parent === 'root' ? [0, 0, 0] : J[parent];
    bones[name].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    bones[parent].add(bones[name]);
  }
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(rootBone);
  mesh.bind(skeleton);
  mesh.castShadow = !lowDetail;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false; // la caja de reposo no cubre poses sentadas: evitamos parpadeos

  // ---- cabeza (cara pintada) y párpados
  const faceMap = faceTexture(a, textureSize);
  const headMat = material?.isMeshLambertMaterial
    ? new THREE.MeshLambertMaterial({ map: faceMap })
    : new THREE.MeshStandardMaterial({ map: faceMap, roughness: 0.62, metalness: 0 });
  const headGeo = new THREE.SphereGeometry(1, S(28, 10), S(20, 8));
  {
    // de esfera a cráneo: mandíbula más estrecha, mentón algo adelantado, nuca más plana
    const p = headGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      if (y < 0) {
        const k = -y;
        x *= 1 - 0.28 * k * k;
        z *= 1 - (z < 0 ? 0.3 : 0.08) * k;
        if (z > 0) z += 0.06 * k * (1 - k);
        y *= 1.06;
      } else if (z < 0) {
        z *= 0.96;
      }
      p.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();
  }
  const head = new THREE.Mesh(headGeo, headMat);
  head.scale.copy(HEAD_R);
  const headLocal = HEAD_C.clone().sub(new THREE.Vector3(...J.head));
  head.position.copy(headLocal);
  bones.head.add(head);
  head.castShadow = !lowDetail;
  // mandíbula: suaviza la esfera hacia un óvalo de cara
  const lidMat = material?.isMeshLambertMaterial ? new THREE.MeshLambertMaterial({ color: a.skin }) : new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.6 });
  const lids = [];
  for (const s of [-1, 1]) {
    const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), lidMat);
    const yaw = s * EYE_YAW;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(EYE_PITCH), Math.sin(EYE_PITCH), Math.cos(yaw) * Math.cos(EYE_PITCH));
    lid.position.copy(headLocal).add(dir.multiply(HEAD_R).multiplyScalar(1.004));
    lid.position.y += 0.006;
    lid.scale.set(0.02, 0.0015, 0.008);
    lid.rotation.y = yaw;
    bones.head.add(lid);
    lids.push(lid);
  }

  const group = new THREE.Group();
  group.add(mesh);
  const scale = (a.height ?? 1.75) / 1.75;
  group.scale.setScalar(scale);

  return {
    group,
    mesh,
    bones,
    head,
    lids,
    appearance: a,
    scale,
    /** Altura de los ojos en mundo (para encuadres de diálogo). */
    eyeHeight: (HEAD_C.y + 0.012) * scale,
    dispose() {
      geometry.dispose();
      faceMap.dispose();
      headMat.dispose();
      headGeo.dispose();
      lidMat.dispose();
      for (const l of lids) l.geometry.dispose();
      skeleton.dispose();
    },
  };
}

/** Peinados: piezas en el hueso de la cabeza. */
function hairParts(a, part, sphere, S) {
  const c = a.hairColor;
  const cx = HEAD_C.x;
  const cy = HEAD_C.y;
  const cz = HEAD_C.z;
  const R = HEAD_R;
  const cap = (thetaLen, k = 1.06, tilt = -0.35, phiStart = 0, phiLen = Math.PI * 2) =>
    new THREE.SphereGeometry(1, S(22, 8), S(12, 5), phiStart, phiLen, 0, thetaLen);
  const capAt = (geo, kx, ky, kz, dy = 0, tilt = -0.35) => part(geo, c, 'head', { at: [cx, cy + dy, cz - 0.004], rot: [tilt, 0, 0], scale: [R.x * kx, R.y * ky, R.z * kz] });
  switch (a.hair) {
    case 'bald':
      break;
    case 'receding':
      capAt(new THREE.SphereGeometry(1, S(18, 8), S(8, 4), Math.PI * 0.85, Math.PI * 1.3, 0.9, 0.9), 1.05, 1.02, 1.05, 0, 0);
      break;
    case 'slick':
      capAt(cap(1.3), 1.05, 1.06, 1.08, 0.004, -0.42);
      break;
    case 'curly': {
      capAt(cap(1.35), 1.08, 1.08, 1.1, 0.006, -0.35);
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        part(sphere(0.03, 6, 5), c, 'head', { at: [cx + Math.cos(ang) * 0.07, cy + 0.09 + Math.sin(i * 1.7) * 0.01, cz - 0.01 + Math.sin(ang) * 0.07] });
      }
      break;
    }
    case 'bob':
      capAt(cap(1.25), 1.08, 1.08, 1.1, 0.008, -0.2);
      capAt(new THREE.SphereGeometry(1, S(22, 8), S(12, 5), Math.PI * 0.75, Math.PI * 1.5, 0.6, 1.5), 1.14, 1.04, 1.12, -0.012, 0);
      break;
    case 'long':
    case 'ponytail':
    case 'bun': {
      capAt(cap(1.3), 1.07, 1.07, 1.1, 0.006, -0.25);
      capAt(new THREE.SphereGeometry(1, S(22, 8), S(12, 5), Math.PI * 0.8, Math.PI * 1.4, 0.6, 1.35), 1.1, 1.04, 1.1, -0.004, 0);
      if (a.hair === 'long') {
        part(new THREE.CylinderGeometry(0.085, 0.07, 0.24, S(14, 6), 1, true, Math.PI * 0.85, Math.PI * 1.3), c, 'head', { at: [cx, cy - 0.15, cz - 0.03], scale: [1.1, 1, 0.7] });
      } else if (a.hair === 'ponytail') {
        part(sphere(1, 10, 8), c, 'head', { at: [cx, cy + 0.01, cz - 0.115], scale: [0.03, 0.03, 0.03] });
        part(new THREE.CapsuleGeometry(0.028, 0.16, 3, 8), c, 'head', { at: [cx, cy - 0.08, cz - 0.13], rot: [0.2, 0, 0] });
      } else {
        part(sphere(1, 12, 10), c, 'head', { at: [cx, cy + 0.07, cz - 0.1], scale: [0.05, 0.045, 0.05] });
      }
      break;
    }
    default: // short
      capAt(cap(1.28), 1.05, 1.06, 1.08, 0.004, -0.38);
  }
  if (a.beard === 'full') part(sphere(1, 12, 8), c, 'head', { at: [cx, cy - 0.07, cz + 0.035], scale: [0.078, 0.06, 0.075] });
}
