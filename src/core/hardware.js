import { QUALITY_ORDER } from '../config.js';

/**
 * CALIDAD AUTOMÁTICA según el equipo.
 *
 * Al primer arranque (y cuando el jugador pulsa «Detectar») se mira la tarjeta gráfica, los núcleos y la
 * memoria, y se hace una prueba de rendimiento de ~100 ms con un shader pesado. Con eso se elige la calidad:
 * un PC muy modesto empieza en MUY BAJA o BAJA y no se queda colgado cargando el casino en MEDIA.
 * La parte de decisión (`tierFromSignals`) es pura y tiene pruebas.
 */

const rank = (tier) => QUALITY_ORDER.indexOf(tier);
const minTier = (...tiers) => tiers.reduce((a, b) => (rank(b) < rank(a) ? b : a));

/** Calidad que sugiere el nombre de la GPU (o null si no se reconoce). */
export function tierFromGpu(name = '') {
  const g = String(name).toLowerCase();
  if (!g) return null;
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return 'veryLow';
  if (/rtx\s*([3-5]0[6-9]0|20[78]0|a[2-6]000)|rx\s*(6[7-9]|7[6-9]|9[0-9])\d\d|radeon pro w|apple m[1-5]\s*(pro|max|ultra)|arc\s*a7/.test(g)) return 'ultra';
  if (/rtx|gtx\s*(10[6-8]|16[5-6])\d|rx\s*(5[6-9]|6[0-6]|7[0-5])\d\d|vega\s*(56|64)|apple m[1-5]|arc/.test(g)) return 'high';
  if (/gtx|radeon|iris(\(r\))?\s*xe|adreno(\s*\(tm\))?\s*(7[3-9]\d|8\d\d)|apple gpu|mali-g7[1-9]|mali-g[6-9]1[0-9]/.test(g)) return 'medium';
  if (/intel|uhd|hd graphics|iris|mali|adreno|powervr|videocore|tegra/.test(g)) return 'low';
  return null;
}

/** Tope que impone la prueba de rendimiento (ms por pasada del shader de prueba). */
export function tierFromBenchmark(ms) {
  if (!Number.isFinite(ms)) return 'medium';
  if (ms < 2.5) return 'ultra';
  if (ms < 6) return 'high';
  if (ms < 14) return 'medium';
  if (ms < 40) return 'low';
  return 'veryLow';
}

/**
 * Decide la calidad con todas las señales.
 * @param {{gpu?:string, benchMs?:number, cores?:number, memory?:number, mobile?:boolean, webgl2?:boolean}} s
 */
export function tierFromSignals(s) {
  if (s.webgl2 === false) return 'veryLow';
  const byGpu = tierFromGpu(s.gpu) ?? 'medium';
  const byBench = tierFromBenchmark(s.benchMs);
  const caps = [byGpu, byBench];
  if (s.mobile) caps.push('medium');
  if ((s.memory ?? 8) <= 2 || (s.cores ?? 8) <= 2) caps.push('low');
  else if ((s.memory ?? 8) <= 4 || (s.cores ?? 8) <= 4) caps.push('high');
  return minTier(...caps);
}

const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float;
uniform float u;
out vec4 o;
void main() {
  vec2 q = gl_FragCoord.xy / 512.0;
  float a = u;
  for (int i = 0; i < 160; i++) {
    q = vec2(sin(q.x * 3.1 + a) + cos(q.y * 2.7 - a), cos(q.x * 1.3 + q.y * 0.7) * 1.1);
    a += 0.013 * q.x;
  }
  o = vec4(q * 0.5 + 0.5, a, 1.0);
}`;

/** Prueba de GPU: ms medios por pasada a 512×512 (NaN si no se puede medir). */
function benchmark(gl) {
  try {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = gl.getUniformLocation(prog, 'u');
    gl.viewport(0, 0, 512, 512);
    const pass = (k) => {
      gl.uniform1f(u, k * 0.37);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const px = new Uint8Array(4);
    pass(0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // calentamiento (compilación real)
    const times = [];
    for (let r = 0; r < 3; r++) {
      const t0 = performance.now();
      for (let k = 0; k < 4; k++) pass(r * 4 + k + 1);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // espera a que termine la GPU
      times.push((performance.now() - t0) / 4);
      if (times.at(-1) > 120) break; // GPU muy lenta: no hace falta seguir
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  } catch {
    return NaN;
  }
}

/** Detección completa en el navegador. Devuelve {tier, signals}. */
export function detectQuality() {
  const nav = globalThis.navigator ?? {};
  const signals = {
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory || 8,
    mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(nav.userAgent ?? '') || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent ?? '')),
    gpu: '',
    webgl2: true,
    benchMs: NaN,
  };
  let gl = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    gl = canvas.getContext('webgl2', { antialias: false, depth: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    if (!gl) signals.webgl2 = false;
    else {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      signals.gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      signals.benchMs = benchmark(gl);
    }
  } catch {
    signals.webgl2 = false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return { tier: tierFromSignals(signals), signals };
}
