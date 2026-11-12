import { t } from '../i18n/index.js';
import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { SYMBOLS } from '../data/symbols.js';
import { EFFECTS } from '../data/symbols.js';
import { roundedBox, seg } from '../gfx/geometry.js';
import { glowTexture, plateTexture } from '../world/procedural-textures.js';
import { drawSymbol } from './symbol-art.js';
import { instantiate } from '../world/props/models.js';

/**
 * THE CLASSIC — máquina arcade 3D construida con geometría procedural.
 * Coordenadas locales: origen en el suelo, frente hacia +Z.
 * Solo presentación: el resultado lo decide machines/slot-logic.js y llega
 * a `spin(result)`; aquí no hay azar ni economía.
 *
 * Construcción v2: cada pieza ocupa su propio volumen (sin caras coplanares ni
 * piezas que se atraviesen), los rodillos viven en una cavidad real y los
 * símbolos se iluminan por sí mismos, de modo que se leen igual arriba, en el
 * centro y abajo sin depender de las luces de la sala.
 */

const N = 8; // facetas por rodillo
const STEP = (Math.PI * 2) / N;
const R = 0.36;
const APOTHEM = R * Math.cos(Math.PI / N);
const CHORD = 2 * R * Math.sin(Math.PI / N);
const REEL_W = 0.34;
const REEL_X = [-0.37, 0, 0.37];
const REEL_Y = 1.45;
const REEL_Z = -0.1;
const WIN_W = 1.14;
const WIN_H = 0.58;
const FRONT_Z = 0.3; // plano frontal del bisel
const SPIN_SPEED = 16; // rad/s
const STRIP_BASE = ['cherry', 'bell', 'diamond', 'crown', 'seven', 'cherry', 'bell', 'diamond'];
const STRIP_OFFSET = [0, 3, 5];

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export function stripFor(reel, hasStar) {
  const base = [...STRIP_BASE];
  if (hasStar) base[5] = 'star';
  return base.map((_, i) => base[(i + STRIP_OFFSET[reel]) % N]);
}

function faceTexture(id, px) {
  const w = px;
  const h = Math.round((px * CHORD) / REEL_W);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a0d16');
  bg.addColorStop(0.5, '#4a1624');
  bg.addColorStop(1, '#2a0d16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b8902c';
  ctx.fillRect(0, 0, w, Math.max(3, h * 0.016));
  ctx.fillRect(0, h - Math.max(3, h * 0.016), w, Math.max(3, h * 0.016));
  // medallón marfil: los símbolos siempre destacan sobre un fondo claro y limpio
  const rad = h * 0.47;
  const med = ctx.createRadialGradient(w / 2, h / 2 - rad * 0.2, rad * 0.1, w / 2, h / 2, rad);
  med.addColorStop(0, '#fffaf0');
  med.addColorStop(1, '#ecdfc0');
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, rad, 0, Math.PI * 2);
  ctx.fillStyle = med;
  ctx.fill();
  ctx.lineWidth = Math.max(4, h * 0.025);
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();
  drawSymbol(ctx, id, w / 2, h / 2, h * 0.37);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Degradado transparente que oscurece arriba/abajo: da la sensación de cilindro curvo. */
function curvatureTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.78)');
  g.addColorStop(0.22, 'rgba(0,0,0,0.28)');
  g.addColorStop(0.42, 'rgba(0,0,0,0)');
  g.addColorStop(0.58, 'rgba(0,0,0,0)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function perimeter(cx, cy, w, h, n, z) {
  const total = 2 * (w + h);
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total;
    let x;
    let y;
    if (d < w) { x = -w / 2 + d; y = h / 2; }
    else if ((d -= w) < h) { x = w / 2; y = h / 2 - d; }
    else if ((d -= h) < w) { x = w / 2 - d; y = -h / 2; }
    else { d -= w; x = -w / 2; y = -h / 2 + d; }
    out.push([cx + x, cy + y, z]);
  }
  return out;
}

/**
 * @param {{g?: object, kit?: object}} [opts] ajustes gráficos efectivos y fábrica de materiales
 *        (sin ellos usa materiales estándar básicos: así se puede crear aislada, p. ej. en pruebas).
 */
export function createClassicMachine({ g = null, kit = null } = {}) {
  const detail = g?.detail ?? 1;
  const group = new THREE.Group();
  group.name = 'the-classic';
  const owned = [];
  const track = (o) => (owned.push(o), o);
  const mk = (o) => (kit ? kit.make({ dirt: 'hall', grimeStrength: 0.55, ...o }) : track(new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6, emissive: o.emissive ?? 0, emissiveIntensity: o.emissiveIntensity ?? 1 })));

  const M = {
    body: mk({ color: 0x1a1518, metal: 0.55, rough: 0.36, clearcoat: 0.5 }),
    gold: mk({ color: PALETTE.gold, metal: 1, rough: 0.26, envIntensity: 1.3, dirt: null }),
    velvet: mk({ color: 0x5a0d1d, rough: 0.95, sheen: 0.6 }),
    black: mk({ color: 0x050304, rough: 0.8, dirt: null }),
    cavity: mk({ color: 0x0b0507, rough: 0.9, dirt: null, side: THREE.DoubleSide }),
    steel: mk({ color: 0x9a9da3, metal: 1, rough: 0.28, envIntensity: 1.2 }),
    dark: mk({ color: 0x1b1a1c, metal: 0.9, rough: 0.4, dirt: null }),
    strip: mk({ color: 0x300509, emissive: 0xc42240, emissiveIntensity: 1.3, dirt: null }),
    lamp: mk({ color: 0x402810, emissive: 0xffd9a0, emissiveIntensity: 1.2, dirt: null }),
    button: mk({ color: 0x8c1226, emissive: 0xff2a48, emissiveIntensity: 0.6, rough: 0.25, metal: 0.1, dirt: null }),
    buttonSmall: mk({ color: 0x2a2f36, emissive: 0x4f6a8c, emissiveIntensity: 0.4, rough: 0.3, dirt: null }),
  };
  const basic = (o) => (kit ? kit.basic(o) : track(new THREE.MeshBasicMaterial({ toneMapped: false, ...o })));
  M.glass = track(new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.07, depthWrite: false }));
  M.payline = basic({ color: 0xff3050, transparent: true, opacity: 0.85, depthWrite: false });

  const geoCache = new Map();
  const getGeo = (key, make) => {
    if (!geoCache.has(key)) geoCache.set(key, track(make()));
    return geoCache.get(key);
  };
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, r = 0.012) => add(getGeo(`b|${w}|${h}|${d}|${r}`, () => (detail >= 0.5 && r > 0 ? roundedBox(w, h, d, r, detail) : new THREE.BoxGeometry(w, h, d))), mat, x, y, z);

  M.chrome = mk({ color: 0xc8ccd2, metal: 1, rough: 0.14, envIntensity: 1.3 });
  M.bay = mk({ color: 0x2c2e31, metal: 0.7, rough: 0.55 });
  M.rubber = mk({ color: 0x0c0c0d, rough: 0.75, dirt: null });
  M.led = mk({ color: 0x400808, emissive: 0xff2020, emissiveIntensity: 2.2, rough: 0.3, dirt: null });
  M.reset = mk({ color: 0xb0101e, emissive: 0xff2030, emissiveIntensity: 0, rough: 0.3, dirt: null });

  // ---- mueble: modelo hecho a mano (scripts/models/classic.py) ----
  const body = instantiate('classic', (key) => M[key] ?? null);
  const node = (name) => body?.getObjectByName(name) ?? null;
  if (body) {
    body.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    group.add(body);
  } else {
    // sin el modelo (no debería pasar): un bloque para que la sala no quede vacía
    box(1.44, 2.5, 1.02, M.body, 0, 1.25, -0.1, 0.02);
  }
  const spinButton = node('SpinButton');
  const spinRest = spinButton ? spinButton.position.y : 0;
  const door = node('ServiceDoor');
  const resetButton = node('ResetButton');
  const resetRest = resetButton ? resetButton.position.x : 0;
  const statusLed = node('StatusLED');
  if (statusLed) statusLed.material = M.led;

  // placa del pulsador (texto traducido)
  const plateTex = () => plateTexture(t('machine.button'), { w: 256, h: 64, font: '700 34px Cinzel, serif' });
  const plateMat = track(new THREE.MeshBasicMaterial({ map: plateTex(), toneMapped: false }));
  const plate = node('SpinPlate');
  if (plate) plate.material = plateMat;

  // ---- pantalla de apuesta (LCD de la consola) ----
  const betCanvas = document.createElement('canvas');
  betCanvas.width = 256;
  betCanvas.height = 72;
  const betTex = track(new THREE.CanvasTexture(betCanvas));
  betTex.colorSpace = THREE.SRGBColorSpace;
  const betLcd = node('BetScreen');
  if (betLcd) betLcd.material = track(new THREE.MeshBasicMaterial({ map: betTex, toneMapped: false }));
  let betState = { text: '', sub: '' };
  function drawBet(text, sub = '') {
    if (betState.text === text && betState.sub === sub) return;
    betState = { text, sub };
    const ctx = betCanvas.getContext('2d');
    ctx.fillStyle = '#071410';
    ctx.fillRect(0, 0, 256, 72);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7dffb8';
    ctx.shadowColor = '#3dff9a';
    ctx.shadowBlur = 8;
    let size = 34;
    ctx.font = `700 ${size}px "Cinzel", serif`;
    while (size > 14 && ctx.measureText(text).width > 236) ctx.font = `700 ${(size -= 2)}px "Cinzel", serif`;
    ctx.fillText(text, 128, sub ? 26 : 36);
    if (sub) {
      ctx.font = '600 18px "Cormorant Garamond", serif';
      ctx.shadowBlur = 3;
      ctx.fillText(sub, 128, 54);
    }
    betTex.needsUpdate = true;
  }
  drawBet('—');

  // cristal, línea de pago y sombreado de curvatura (delante de los rodillos)
  const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(WIN_W, WIN_H)), M.glass);
  glass.position.set(0, REEL_Y, FRONT_Z + 0.006);
  group.add(glass);
  const curvTex = track(curvatureTexture());
  const curvMat = track(new THREE.MeshBasicMaterial({ map: curvTex, transparent: true, depthWrite: false, toneMapped: false }));
  for (const x of REEL_X) {
    const shade = new THREE.Mesh(getGeo('shade', () => new THREE.PlaneGeometry(REEL_W, WIN_H)), curvMat);
    shade.position.set(x, REEL_Y, 0.285);
    group.add(shade);
  }
  const payline = new THREE.Mesh(track(new THREE.PlaneGeometry(WIN_W, 0.012)), M.payline);
  payline.position.set(0, REEL_Y, FRONT_Z + 0.009);
  group.add(payline);
  for (const s of [-1, 1]) {
    const tri = new THREE.Mesh(track(new THREE.CircleGeometry(0.035, 3)), M.payline);
    tri.position.set(s * (WIN_W / 2 + 0.06), REEL_Y, FRONT_Z + 0.034);
    tri.rotation.z = s > 0 ? Math.PI : 0;
    group.add(tri);
  }

  // ---- pantalla ----
  const SCR_Y = 2.2;
  const HEAD_FRONT = 0.12;
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 640;
  screenCanvas.height = 192;
  const screenTex = track(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const screen = node('Screen');
  if (screen) screen.material = screenMat;

  // ---- rodillos ----
  const texPx = Math.max(256, Math.min(512, g?.textureSize ?? 512));
  const faceMats = {};
  const faceColor = new THREE.Color().setScalar(0.82); // bajo el umbral del bloom: no lava los símbolos
  for (const id of Object.keys(SYMBOLS)) {
    const map = track(faceTexture(id, texPx));
    faceMats[id] = track(new THREE.MeshBasicMaterial({ map, color: faceColor }));
  }
  const faceGeo = track(new THREE.PlaneGeometry(REEL_W, CHORD * 1.005));
  const coreGeo = track(new THREE.CylinderGeometry(APOTHEM * 0.96, APOTHEM * 0.96, REEL_W, seg(detail, 16, 8)).rotateZ(Math.PI / 2));
  const capGeo = track(new THREE.CylinderGeometry(APOTHEM * 1.04, APOTHEM * 1.04, 0.022, seg(detail, 24, 10)).rotateZ(Math.PI / 2));
  const capMat = { dark: M.dark, gilded: M.gold };

  const reels = REEL_X.map((x, r) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, REEL_Y, REEL_Z);
    const core = new THREE.Mesh(coreGeo, M.black);
    pivot.add(core);
    const faces = [];
    for (let i = 0; i < N; i++) {
      const theta = i * STEP;
      const f = new THREE.Mesh(faceGeo, faceMats.cherry);
      f.position.set(0, APOTHEM * Math.sin(theta), APOTHEM * Math.cos(theta));
      f.rotation.x = -theta;
      pivot.add(f);
      faces.push(f);
    }
    const caps = [-1, 1].map((s) => {
      const cap = new THREE.Mesh(capGeo, M.dark);
      cap.position.x = s * (REEL_W / 2 + 0.011);
      pivot.add(cap);
      return cap;
    });
    group.add(pivot);
    return { pivot, faces, caps, strip: [], phi: 0, phase: 'idle', t: 0, stopAt: 0, from: 0, to: 0, dur: 1, lastCell: 0, settle: 0 };
  });

  // ---- bombillas (alrededor de la ventana y de la pantalla) ----
  const bulbPos = [...perimeter(0, REEL_Y, WIN_W + 0.2, WIN_H + 0.2, 34, FRONT_Z + 0.046), ...perimeter(0, SCR_Y, 1.2 + 0.2, 0.36 + 0.12, 28, HEAD_FRONT + 0.046)];
  const bulbs = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.016, seg(detail, 8, 4), seg(detail, 6, 3))), track(new THREE.MeshBasicMaterial({ toneMapped: false })), bulbPos.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  bulbPos.forEach((p, i) => {
    dummy.position.set(...p);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
    bulbs.setColorAt(i, tint.set(0x442200));
  });
  group.add(bulbs);

  // ---- luz propia ----
  const light = new THREE.PointLight(0xffd9a0, 12, 5, 2);
  light.position.set(0, 1.55, 1.5);
  group.add(light);

  // ---- partículas ----
  const MAX_SPARKS = Math.max(60, Math.round(220 * (g?.particleScale ?? 1)));
  const sparkGeo = track(new THREE.BufferGeometry());
  const sparkPos = new Float32Array(MAX_SPARKS * 3);
  const sparkCol = new Float32Array(MAX_SPARKS * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkMat = track(new THREE.PointsMaterial({ size: 0.07, map: track(glowTexture()), vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);
  const sparkVel = new Float32Array(MAX_SPARKS * 3);
  const sparkLife = new Float32Array(MAX_SPARKS);
  let sparkCursor = 0;

  function burst(count, color) {
    for (let k = 0; k < count; k++) {
      const i = sparkCursor++ % MAX_SPARKS;
      sparkPos.set([(Math.random() - 0.5) * 1.0, REEL_Y + (Math.random() - 0.5) * 0.3, 0.35], i * 3);
      sparkVel.set([(Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 2.2, 0.6 + Math.random() * 1.6], i * 3);
      sparkLife[i] = 0.8 + Math.random() * 0.9;
      sparkCol.set([color.r, color.g, color.b], i * 3);
    }
  }

  // ---- estado ----
  const api = {
    group,
    busy: false,
    loadout: null,
    effects: true,
    colliderLocal: { minX: -0.9, maxX: 0.9, minZ: -0.72, maxZ: 0.9 },
    onReelStop: null,
    onTick: null,
  };
  let mode = 'idle'; // idle | spin | result
  let powered = true;
  let bootT = -1;
  const BOOT_TIME = 2.6;
  let modeTime = 0;
  let schedule = [0.9, 1.4, 1.9];
  let pending = null;
  let pressT = 0;
  let resultColor = new THREE.Color(0xffd76a);
  let flash = 0;
  let doneTimer = -1;
  let screenKey = '';
  let lastScreen = ['idle', null];

  function drawScreen(kind, result = null) {
    const key = kind + (result ? `${result.payout}|${result.outcome}|${result.effects.join()}` : '');
    if (key === screenKey) return;
    screenKey = key;
    lastScreen = [kind, result];
    const ctx = screenCanvas.getContext('2d');
    const w = screenCanvas.width;
    const h = screenCanvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a0711');
    g.addColorStop(1, '#0b0305');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(212,175,55,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#d4af37';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f3dc8a';
    // escribe ajustando el tamaño para que nunca se salga del marco (idiomas largos)
    const fit = (text, weight, size, family, y, maxW = w - 70) => {
      let px = size;
      ctx.font = `${weight} ${px}px ${family}`;
      while (px > 16 && ctx.measureText(text).width > maxW) ctx.font = `${weight} ${(px -= 2)}px ${family}`;
      ctx.fillText(text, w / 2, y);
    };
    const DISPLAY = 'Cinzel, serif';
    const SERIF = '"Cormorant Garamond", serif';
    if (kind === 'off') {
      ctx.fillStyle = '#050304';
      ctx.fillRect(10, 10, w - 20, h - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(160,40,50,0.55)';
      fit(t('machine.classic.off'), 700, 54, DISPLAY, h / 2);
    } else if (kind === 'idle') {
      fit('THE CLASSIC', 700, 66, DISPLAY, h * 0.4);
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#f5ead7';
      fit(t('machine.classic.idle'), 600, 30, SERIF, h * 0.75);
    } else if (kind === 'spin') {
      fit(t('machine.classic.spinning'), 700, 62, DISPLAY, h / 2);
    } else if (result) {
      const win = result.outcome === 'win';
      const push = result.outcome === 'push';
      if (!win && !push) {
        ctx.fillStyle = '#ff8a96';
        ctx.shadowColor = '#c42240';
      } else if (push) {
        ctx.fillStyle = '#bfe8ff';
        ctx.shadowColor = '#58b6ff';
      }
      fit(win ? `+${result.payout} MARKS` : push ? t('result.push') : t('result.lose'), 700, win ? 72 : 60, DISPLAY, h * 0.4);
      ctx.shadowBlur = 6;
      ctx.fillStyle = win ? '#ffe9a8' : '#f5ead7';
      const names = result.effects.filter((e) => EFFECTS[e]).map((e) => t(`effect.${e}`));
      const mult = win ? `×${Number.isInteger(result.multiplier) ? result.multiplier : result.multiplier.toFixed(2)}` : '';
      fit([mult, ...names.map((n) => n.toUpperCase())].filter(Boolean).join('  ·  ') || `${t('hud.bet')} ${result.bet}`, 600, 32, SERIF, h * 0.76);
    }
    screenTex.needsUpdate = true;
  }

  function assignStrips() {
    const hasStar = !!api.loadout?.star;
    reels.forEach((reel, r) => {
      reel.strip = stripFor(r, hasStar);
      reel.faces.forEach((f, i) => (f.material = faceMats[reel.strip[i]]));
      reel.caps.forEach((c) => (c.material = api.loadout?.gilded ? capMat.gilded : capMat.dark));
    });
  }

  api.applyLoadout = (loadout) => {
    api.loadout = loadout;
    assignStrips();
  };
  /** Pantalla LCD de apuesta de la consola (la economía la actualiza). */
  api.setBet = (text, sub = '') => drawBet(String(text), sub);

  /** Máquina averiada (sin corriente) o en marcha. `boot` reproduce el arranque (~2,6 s). */
  api.setPowered = (on, { boot = false } = {}) => {
    if (on && boot && !powered) {
      bootT = 0;
      return;
    }
    powered = on;
    bootT = -1;
    screenKey = '';
    drawScreen(on ? 'idle' : 'off');
  };
  Object.defineProperty(api, 'powered', { get: () => powered && bootT < 0 });
  Object.defineProperty(api, 'booting', { get: () => bootT >= 0 });

  /** Acabado del mueble: 'classic' (lacado negro y terciopelo) o 'vintage' (nogal y crema, el original de 1962). */
  const SKINS = {
    classic: { body: 0x1a1518, velvet: 0x5a0d1d },
    vintage: { body: 0x4a2814, velvet: 0xcdbb90 },
  };
  api.setSkin = (id) => {
    const sk = SKINS[id] ?? SKINS.classic;
    M.body.color.set(sk.body);
    M.velvet.color.set(sk.velvet);
  };

  api.setEffects = (on) => {
    api.effects = on;
    sparks.visible = on;
  };

  /** Rodillos en una posición inicial coherente (símbolos distintos visibles). */
  reels.forEach((reel, r) => (reel.phi = ((r * 3 + 1) % N) * STEP));
  api.applyLoadout({ star: false, gilded: false, quick: false, flare: false });
  drawScreen('idle');

  /** Inicia un giro con un resultado ya decidido por slot-logic. */
  api.spin = (result, { rng = null } = {}) => {
    if (api.busy) return false;
    api.busy = true;
    pending = result;
    mode = 'spin';
    modeTime = 0;
    doneTimer = -1;
    pressT = 0.18;
    schedule = api.loadout?.quick ? [0.65, 1.0, 1.35] : [0.9, 1.4, 1.9];
    reels.forEach((reel, r) => {
      reel.phase = 'spin';
      reel.t = 0;
      reel.stopAt = schedule[r];
      const wanted = result.symbols[r];
      const matches = reel.strip.map((s, i) => (s === wanted ? i : -1)).filter((i) => i >= 0);
      reel.target = matches.length > 1 ? (rng ? rng.pick(matches) : matches[0]) : matches[0];
      reel.lastCell = Math.floor((reel.phi + STEP / 2) / STEP);
    });
    drawScreen('spin');
    return true;
  };

  function stopReel(reel) {
    const omega = SPIN_SPEED;
    const dMin = (omega * 0.7) / 3;
    const base = reel.phi + dMin;
    const goal = base + mod(reel.target * STEP - base, TAU);
    reel.from = reel.phi;
    reel.to = goal;
    reel.dur = Math.min(1.05, Math.max(0.7, (3 * (goal - reel.phi)) / omega));
    reel.t = 0;
    reel.phase = 'stop';
  }

  // ---- mantenimiento: tapa lateral, seta de reinicio, piloto y rodillos desajustados ----
  const DOOR_OPEN = -1.78;
  const service = { door: 0, doorTarget: 0, reset: 0, ok: true, broken: 0, brokenTarget: 0, fixT: -1, hint: false };
  // desajuste de cada rodillo: inclinación, hundimiento y giro fuera de su sitio
  const MISALIGN = [{ tilt: 0.07, dy: -0.035, dx: 0.012, dphi: STEP * 0.45 }, { tilt: -0.11, dy: 0.02, dx: -0.01, dphi: -STEP * 0.38 }, { tilt: 0.05, dy: -0.05, dx: 0.008, dphi: STEP * 0.3 }];
  /** Abre o cierra la tapa de servicio (lado derecho). */
  api.setServiceDoor = (open, { instant = false } = {}) => {
    service.doorTarget = open ? 1 : 0;
    if (instant) service.door = service.doorTarget;
  };
  Object.defineProperty(api, 'serviceDoorOpen', { get: () => service.doorTarget > 0 });
  /** Rodillos desajustados (máquina averiada). Al quitarlo con `animate` vuelven a su sitio uno a uno. */
  api.setReelsBroken = (on, { animate = false } = {}) => {
    service.brokenTarget = on ? 1 : 0;
    service.ok = !on;
    if (!on && animate && service.broken > 0) service.fixT = 0;
    else {
      service.broken = service.brokenTarget;
      service.fixT = -1;
    }
  };
  /** Pulsa la seta de reinicio: el piloto pasa de rojo a verde. */
  api.pressReset = () => {
    service.reset = 0.35;
    service.ok = true;
  };
  /** Hace latir la seta (el jugador tiene que pulsarla). */
  api.setResetHint = (on) => (service.hint = on);
  const ledRed = new THREE.Color(0xff2020);
  const ledGreen = new THREE.Color(0x30ff70);
  const smooth = (x) => x * x * (3 - 2 * x);
  function updateService(dt, time) {
    service.door += Math.sign(service.doorTarget - service.door) * Math.min(Math.abs(service.doorTarget - service.door), dt * 1.25);
    if (door) door.rotation.y = DOOR_OPEN * smooth(service.door);
    service.reset = Math.max(0, service.reset - dt);
    if (resetButton) resetButton.position.x = resetRest - (service.reset > 0.15 ? 0.012 : service.reset > 0 ? 0.012 * (service.reset / 0.15) : 0);
    M.reset.emissiveIntensity = service.hint && !service.ok ? 0.35 + 0.35 * Math.sin(time * 6) : 0;
    M.led.emissive.copy(service.ok ? ledGreen : ledRed);
    M.led.emissiveIntensity = service.ok ? 2.4 : 1.2 + 1.2 * (Math.sin(time * 9) > 0 ? 1 : 0);
    if (service.fixT >= 0) service.fixT += dt;
  }
  /** Cuánto desajuste le queda al rodillo `r` (1 = roto, 0 = en su sitio). */
  function misalign(r) {
    if (service.fixT < 0) return service.broken;
    const k = Math.min(1, Math.max(0, (service.fixT - r * 0.45) / 0.55));
    if (k >= 1 && r === reels.length - 1) {
      service.broken = 0;
      service.fixT = -1;
    }
    // vuelve a su sitio con un pequeño rebote
    return k >= 1 ? 0 : (1 - k) ** 2 * Math.cos(k * 9);
  }

  api.update = (dt, time) => {
    modeTime += dt;
    pressT = Math.max(0, pressT - dt);
    flash = Math.max(0, flash - dt * 1.4);
    const press = pressT > 0 ? 0.03 : 0;
    if (spinButton) spinButton.position.y = spinRest - press;
    updateService(dt, time);

    for (const [r, reel] of reels.entries()) {
      if (reel.phase === 'spin') {
        reel.t += dt;
        const ramp = Math.min(1, reel.t / 0.25);
        reel.phi += SPIN_SPEED * ramp * dt;
        const cell = Math.floor((reel.phi + STEP / 2) / STEP);
        if (cell !== reel.lastCell) {
          reel.lastCell = cell;
          api.onTick?.(r);
        }
        if (modeTime >= reel.stopAt) stopReel(reel);
      } else if (reel.phase === 'stop') {
        reel.t += dt;
        const k = Math.min(1, reel.t / reel.dur);
        reel.phi = reel.from + (reel.to - reel.from) * easeOutCubic(k);
        if (k >= 1) {
          reel.phase = 'settle';
          reel.t = 0;
          api.onReelStop?.(r);
        }
      } else if (reel.phase === 'settle') {
        reel.t += dt;
        const amp = 0.05 * Math.exp(-reel.t * 14) * Math.sin(reel.t * 38);
        reel.phi = reel.to + amp;
        if (reel.t > 0.3) {
          reel.phi = reel.to;
          reel.phase = 'idle';
        }
      }
      const mis = misalign(r);
      const d = MISALIGN[r];
      reel.pivot.rotation.x = reel.phi + d.dphi * mis;
      reel.pivot.rotation.z = d.tilt * mis;
      reel.pivot.position.set(REEL_X[r] + d.dx * mis, REEL_Y + d.dy * mis, REEL_Z);
    }

    if (mode === 'spin' && reels.every((r) => r.phase === 'idle')) {
      mode = 'result';
      modeTime = 0;
      for (const reel of reels) reel.phi = mod(reel.phi, TAU);
      const res = pending;
      drawScreen('result', res);
      const won = res.outcome === 'win';
      resultColor.set(res.tier === 'jackpot' ? 0xfff3b0 : won ? 0xffd76a : res.outcome === 'push' ? 0xf5ead7 : 0xff5060);
      flash = won ? 1 : 0.2;
      if (api.effects && won) {
        const mult = api.loadout?.flare ? 1.6 : 1;
        burst(Math.min(MAX_SPARKS, Math.round((res.tier === 'jackpot' ? 150 : res.tier === 'big' ? 80 : 36) * mult)), resultColor);
      }
      doneTimer = 0.45;
    }
    if (doneTimer >= 0) {
      doneTimer -= dt;
      if (doneTimer < 0) {
        const res = pending;
        api.busy = false;
        pending = null;
        api.onDone?.(res);
      }
    }
    if (mode === 'result' && modeTime > 3.2 && !api.busy) {
      mode = 'idle';
      drawScreen('idle');
    }

    // apagada (averiada) o arrancando
    if (!powered || bootT >= 0) {
      let level = 0;
      if (bootT >= 0) {
        bootT += dt;
        level = Math.min(1, bootT / BOOT_TIME);
        if (bootT >= BOOT_TIME) {
          bootT = -1;
          powered = true;
          screenKey = '';
          drawScreen('idle');
        } else if (bootT > BOOT_TIME * 0.55 && screenKey === 'off') {
          screenKey = '';
          drawScreen('idle');
        }
      }
      for (let i = 0; i < bulbPos.length; i++) {
        const on = level > 0 && Math.random() < level * level;
        tint.set(0x221108).multiplyScalar(on ? 4 + level * 6 : 1);
        bulbs.setColorAt(i, tint);
      }
      bulbs.instanceColor.needsUpdate = true;
      M.button.emissiveIntensity = level * (0.5 + 0.5 * Math.sin(time * 20));
      M.strip.emissiveIntensity = 0.12 + level * 1.2 * (Math.random() < level ? 1 : 0.2);
      M.lamp.emissiveIntensity = 0.1 + level * 1.1;
      light.intensity = level * 14;
      // con la tapa abierta, la luz de la máquina alumbra el hueco de servicio (lámpara de mantenimiento)
      if (service.door > 0.01 && level === 0) {
        light.position.set(1.2, 0.75, -0.2);
        light.distance = 1.8;
        light.color.set(0xfff1dc);
        light.intensity = 2.6 * smooth(service.door);
      } else if (light.distance !== 5) {
        light.position.set(0, 1.55, 1.5);
        light.distance = 5;
        light.color.set(0xffd9a0);
      }
      return;
    }
    M.lamp.emissiveIntensity = 1.2;

    // bombillas: reposo (respiración), giro (persecución), resultado (destellos)
    const speed = mode === 'spin' ? 14 : mode === 'result' ? 9 : 2;
    const win = mode === 'result' && flash > 0.05;
    for (let i = 0; i < bulbPos.length; i++) {
      const wave = (Math.sin(time * speed - i * 0.55) + 1) / 2;
      const base = mode === 'idle' ? 0.25 + 0.55 * wave : 0.15 + 0.85 * wave;
      tint.setRGB(1, 0.72 - 0.25 * (1 - wave), 0.25 + 0.4 * (win ? 1 : 0));
      if (win) tint.lerp(resultColor, 0.5);
      tint.multiplyScalar(base);
      bulbs.setColorAt(i, tint);
    }
    bulbs.instanceColor.needsUpdate = true;

    M.button.emissiveIntensity = api.busy ? 0.15 : 0.55 + 0.45 * Math.sin(time * 3.2);
    M.strip.emissiveIntensity = 1.0 + 0.5 * Math.sin(time * 2) + flash * 2;
    light.intensity = 14 + flash * 18;
    light.color.set(0xffd9a0).lerp(resultColor, flash * 0.6);

    // partículas
    let alive = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (sparkLife[i] <= 0) {
        sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0;
        continue;
      }
      alive = true;
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 4.2 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      const fade = Math.max(0, Math.min(1, sparkLife[i]));
      sparkCol[i * 3] *= 0.5 + 0.5 * fade ** 0.2;
      sparkCol[i * 3 + 1] *= 0.5 + 0.5 * fade ** 0.2;
      sparkCol[i * 3 + 2] *= 0.5 + 0.5 * fade ** 0.2;
      if (fade < 0.25) {
        sparkCol[i * 3] *= fade * 3;
        sparkCol[i * 3 + 1] *= fade * 3;
        sparkCol[i * 3 + 2] *= fade * 3;
      }
    }
    if (alive) {
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
    }
  };

  /** Posición/mirada de cámara para usar la máquina (coordenadas de mundo). */
  api.cameraPose = () => {
    group.updateWorldMatrix(true, false);
    return {
      position: group.localToWorld(new THREE.Vector3(0, 1.74, 2.5)),
      target: group.localToWorld(new THREE.Vector3(0, 1.56, 0)),
    };
  };

  /** Cambio de idioma: vuelve a dibujar la pantalla con el texto nuevo. */
  api.refreshTexts = () => {
    plateMat.map?.dispose();
    plateMat.map = plateTex();
    plateMat.needsUpdate = true;
    screenKey = '';
    drawScreen(...lastScreen);
  };

  api.dispose = () => {
    for (const o of owned) o.dispose?.();
    plateMat.map?.dispose();
    bulbs.dispose();
    geoCache.clear();
  };

  return api;
}
