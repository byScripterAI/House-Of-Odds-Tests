import * as THREE from 'three';

/**
 * MATERIALES PROCEDURALES DE CALIDAD (al estilo de Substance Designer): las texturas se «hornean» en la
 * GPU con shaders —ruido de gradiente periódico (tileable), fbm, deformación de dominio— y se guardan en
 * render targets con mipmaps. Cada material produce color, rugosidad y relieve (mapa normal) coherentes.
 *
 * Todo es repetible sin costuras (el ruido es periódico en el tamaño de la textura).
 */

const NOISE = /* glsl */ `
vec2 hash2(vec2 p, float seed) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))) + seed;
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float hash1(vec2 p, float seed) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
// ruido de gradiente con periodo 'per' (en celdas): repetible sin costuras
float pnoise(vec2 p, vec2 per, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, per), i10 = mod(i + vec2(1.0, 0.0), per), i01 = mod(i + vec2(0.0, 1.0), per), i11 = mod(i + vec2(1.0, 1.0), per);
  float a = dot(hash2(i00, seed), f);
  float b = dot(hash2(i10, seed), f - vec2(1.0, 0.0));
  float c = dot(hash2(i01, seed), f - vec2(0.0, 1.0));
  float d = dot(hash2(i11, seed), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, vec2 per, float seed, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * pnoise(p, per, seed + float(i) * 17.0);
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s;
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Recetas: cada una devuelve (color, rugosidad, altura) para un punto uv en [0,1). */
const RECIPES = {
  // Mármol oscuro (Nero Marquina) en losas de 1,2 m con junta fina: 4×4 losas por textura
  marble: /* glsl */ `
    vec2 tiles = vec2(4.0);
    vec2 tp = uv * tiles;
    vec2 cell = floor(tp);
    vec2 f = fract(tp);
    float id = hash1(cell, 3.0);
    float id2 = hash1(cell, 7.0);
    // cada losa es un corte distinto del bloque: vetas propias, discontinuas en la junta (como en la realidad)
    vec2 p = f + vec2(id * 7.1, id2 * 3.7);
    vec2 big = vec2(97.0);
    float n1 = fbm(p * 1.6, big, 11.0, 5);
    float n2 = fbm(p * 4.5 + n1 * 1.4, big, 12.0, 5);
    // vetas largas en diagonal: isolíneas de un gradiente deformado (ondulan, se cruzan y se adelgazan)
    float ang = 0.35 + id * 0.9;
    vec2 dir = vec2(cos(ang), sin(ang));
    float s1 = dot(p, dir) * 1.7 + n1 * 1.1 + n2 * 0.16;
    float d1 = abs(fract(s1) - 0.5) * 2.0;
    float w1 = 0.012 + 0.03 * smoothstep(0.1, 0.5, n2 + 0.25);
    float fade1 = smoothstep(-0.25, 0.25, fbm(p * 1.2 + 9.0, big, 13.0, 3));
    float main = (1.0 - smoothstep(w1 * 0.25, w1, 1.0 - d1)) * fade1;
    // segunda familia, más fina y cruzada
    vec2 dir2 = vec2(cos(ang + 1.9), sin(ang + 1.9));
    float s2 = dot(p, dir2) * 2.6 + n1 * 0.8 + n2 * 0.3;
    float d2 = abs(fract(s2) - 0.5) * 2.0;
    float fade2 = smoothstep(0.0, 0.3, fbm(p * 1.7 + 4.0, big, 14.0, 3));
    float crossV = (1.0 - smoothstep(0.002, 0.008, 1.0 - d2)) * fade2;
    // filamentos finos (craquelado de la piedra) cerca de las vetas grandes
    float v3 = abs(fbm(p * 6.0 + n1 * 2.0, big, 15.0, 5));
    float fine = (1.0 - smoothstep(0.0, 0.0035, v3)) * smoothstep(0.75, 0.98, d1 * 0.5 + 0.5);
    // nubes de fondo y un velo blanquecino junto a las vetas
    float cloud = fbm(p * 2.2, big, 6.0, 5);
    vec3 base = vec3(0.02, 0.019, 0.021) + vec3(0.012, 0.011, 0.01) * (cloud + 0.5);
    base *= 0.88 + id * 0.24;
    float veil = (1.0 - smoothstep(0.0, 0.14, 1.0 - d1)) * fade1 * 0.18;
    vec3 veinCol = mix(vec3(0.56, 0.55, 0.53), vec3(0.6, 0.57, 0.5), id2);
    col = base + veinCol * veil * 0.25;
    col = mix(col, veinCol, clamp(main * 0.7 + crossV * 0.4 + fine * 0.3, 0.0, 1.0));
    rough = 0.12 + cloud * 0.04 + main * 0.04;
    vec2 e = min(f, 1.0 - f);
    float joint = 1.0 - smoothstep(0.0, 0.004, min(e.x, e.y));
    col = mix(col, vec3(0.008, 0.007, 0.007), joint);
    rough = mix(rough, 0.8, joint);
    height = 1.0 - joint * 0.9 - main * 0.02;
  `,
  // Nogal en tablas verticales (zócalos y paneles)
  walnut: /* glsl */ `
    vec2 per = vec2(4.0, 1.0);
    float boards = 4.0;
    float bx = floor(uv.x * boards);
    float bid = hash1(vec2(bx, 1.0), 5.0);
    vec2 p = vec2(uv.x * boards * 6.0, uv.y * 1.0 + bid * 3.0);
    float g = fbm(vec2(p.x * 0.35, p.y * 3.0), vec2(boards * 6.0 * 0.35, 3.0), 3.0, 4);
    float rings = sin((p.x + g * 3.5) * 9.0) * 0.5 + 0.5;
    float pores = fbm(vec2(uv.x * 160.0, uv.y * 12.0), vec2(160.0, 12.0), 8.0, 3);
    vec3 dark = vec3(0.075, 0.035, 0.02);
    vec3 light = vec3(0.21, 0.11, 0.055);
    col = mix(dark, light, rings * 0.6 + g * 0.5 + 0.2) * (0.85 + bid * 0.3);
    col *= 0.92 + pores * 0.2;
    float gap = 1.0 - smoothstep(0.0, 0.004, min(fract(uv.x * boards), 1.0 - fract(uv.x * boards)));
    col = mix(col, vec3(0.01), gap);
    rough = 0.32 + pores * 0.08 + gap * 0.5;
    height = 1.0 - gap * 0.8 + rings * 0.03 + pores * 0.04;
  `,
  // Seda adamascada burdeos para la parte alta de las paredes (poco contraste, brillo satinado)
  damask: /* glsl */ `
    vec2 per = vec2(6.0, 6.0);
    vec2 p = uv * 6.0;
    vec2 c = fract(p) - 0.5;
    vec2 cc = fract(p + 0.5) - 0.5;
    // motivo de medallón: rombo con volutas (simétrico)
    float m1 = abs(c.x) + abs(c.y) * 0.62;
    float m2 = length(vec2(abs(cc.x) * 1.4, cc.y));
    float motif = smoothstep(0.30, 0.27, m1) - smoothstep(0.22, 0.19, m1) + smoothstep(0.16, 0.13, m1);
    motif += (smoothstep(0.2, 0.17, m2) - smoothstep(0.12, 0.09, m2)) * 0.8;
    float curl = sin(atan(c.y, c.x) * 6.0 + length(c) * 30.0) * smoothstep(0.32, 0.22, m1) * smoothstep(0.12, 0.2, m1);
    motif = clamp(motif + curl * 0.25, 0.0, 1.0);
    float weave = sin(uv.x * 900.0) * 0.5 + 0.5;
    float weave2 = sin(uv.y * 900.0) * 0.5 + 0.5;
    float n = fbm(uv * 8.0, vec2(8.0), 2.0, 4);
    vec3 a = vec3(0.13, 0.03, 0.036);
    vec3 b = vec3(0.2, 0.06, 0.06);
    col = mix(a, b, motif) * (0.94 + n * 0.12) * (0.96 + weave * 0.04);
    rough = mix(0.62, 0.42, motif) + weave2 * 0.04;
    height = 0.5 + motif * 0.08 + weave * 0.02;
  `,
  // Moqueta de casino: volutas y medallones dorados sobre burdeos con matices verde azulado
  carpet: /* glsl */ `
    vec2 per = vec2(4.0);
    vec2 p = uv * 4.0;
    vec2 c = fract(p) - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x);
    float rose = smoothstep(0.03, 0.0, abs(r - 0.18 - 0.05 * sin(a * 8.0)));
    float ring = smoothstep(0.02, 0.0, abs(r - 0.34));
    vec2 c2 = fract(p + 0.5) - 0.5;
    float star = smoothstep(0.035, 0.0, abs(length(c2) - 0.1 - 0.06 * cos(atan(c2.y, c2.x) * 4.0)));
    float sw = fbm(uv * 10.0, vec2(10.0), 4.0, 4);
    float swirl = smoothstep(0.03, 0.0, abs(sin((uv.x + sw * 0.25) * 60.0) * 0.5 + sin((uv.y - sw * 0.2) * 60.0) * 0.5));
    vec3 base = vec3(0.24, 0.035, 0.05);
    col = base;
    col = mix(col, vec3(0.05, 0.16, 0.15), swirl * 0.55);
    col = mix(col, vec3(0.62, 0.45, 0.17), clamp(rose + ring * 0.8 + star * 0.9, 0.0, 1.0));
    float fiber = fbm(uv * 220.0, vec2(220.0), 7.0, 2);
    col *= 0.86 + fiber * 0.28;
    rough = 0.95;
    height = 0.5 + fiber * 0.25;
  `,
  // Yeso del techo: color marfil cálido con ligera textura
  plaster: /* glsl */ `
    vec2 per = vec2(6.0);
    float n = fbm(uv * 6.0, per, 1.0, 6);
    col = vec3(0.43, 0.38, 0.32) * (0.92 + n * 0.16);
    rough = 0.9;
    height = 0.5 + n * 0.2;
  `,
  // Latón cepillado: variación de rugosidad direccional
  brushed: /* glsl */ `
    float n = fbm(vec2(uv.x * 2.0, uv.y * 300.0), vec2(2.0, 300.0), 3.0, 4);
    col = vec3(0.86, 0.68, 0.36) * (0.95 + n * 0.1);
    rough = 0.28 + n * 0.12;
    height = 0.5 + n * 0.05;
  `,
  // Cuero capitoné (asientos)
  leather: /* glsl */ `
    float n = fbm(uv * 24.0, vec2(24.0), 2.0, 5);
    float cr = fbm(uv * 60.0, vec2(60.0), 5.0, 3);
    col = vec3(0.18, 0.04, 0.045) * (0.85 + n * 0.3);
    rough = 0.42 + cr * 0.15;
    height = 0.5 + n * 0.25 + cr * 0.1;
  `,
};

function fragment(recipe) {
  return /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uOut; // 0 color · 1 rugosidad (G) · 2 normal
uniform float uTexel;
${NOISE}
void sampleAt(vec2 uv, out vec3 col, out float rough, out float height) {
  col = vec3(0.5); rough = 0.5; height = 0.5;
  ${RECIPES[recipe]}
}
void main() {
  vec3 col; float rough; float h;
  sampleAt(vUv, col, rough, h);
  if (uOut == 0) { gl_FragColor = vec4(col, 1.0); return; }
  if (uOut == 1) { gl_FragColor = vec4(1.0, rough, 0.0, 1.0); return; }
  vec3 c2; float r2; float hx; float hy;
  sampleAt(fract(vUv + vec2(uTexel, 0.0)), c2, r2, hx);
  sampleAt(fract(vUv + vec2(0.0, uTexel)), c2, r2, hy);
  vec3 n = normalize(vec3((h - hx) * 6.0, (h - hy) * 6.0, 1.0));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}
`;
}

const cache = new Map();

/**
 * Hornea un material procedural. Devuelve {map, roughnessMap, normalMap} (texturas repetibles).
 * Las texturas de color están en sRGB, como cualquier foto.
 */
export function bakeMaterial(renderer, recipe, size = 1024) {
  const key = `${recipe}|${size}`;
  if (cache.has(key)) return cache.get(key);
  const scene = new THREE.Scene();
  const cam = new THREE.Camera();
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fragment(recipe), uniforms: { uOut: { value: 0 }, uTexel: { value: 1 / size } }, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);
  const make = (out, srgb) => {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
      anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    });
    mat.uniforms.uOut.value = out;
    const prevRT = renderer.getRenderTarget();
    const prevTone = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevRT);
    renderer.toneMapping = prevTone;
    rt.texture.userData.rt = rt;
    return rt.texture;
  };
  // el color se escribe en lineal y el RT sRGB lo convierte; los demás datos van en lineal
  const res = { map: make(0, true), roughnessMap: make(1, false), normalMap: make(2, false) };
  mat.dispose();
  quad.geometry.dispose();
  cache.set(key, res);
  return res;
}

/** Copia con repetición propia (las texturas base se comparten). */
export function repeatTex(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Libera todo lo horneado (al cambiar de calidad gráfica). */
export function clearBakedMaterials() {
  for (const res of cache.values()) for (const t of Object.values(res)) t.userData.rt?.dispose();
  cache.clear();
}
