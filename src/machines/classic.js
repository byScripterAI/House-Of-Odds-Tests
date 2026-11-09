import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { SYMBOLS } from '../data/symbols.js';
import { EFFECTS } from '../data/symbols.js';
import { glowTexture, plateTexture } from '../world/procedural-textures.js';
import { drawSymbol } from './symbol-art.js';

/**
 * THE CLASSIC — máquina arcade 3D construida con geometría procedural.
 * Coordenadas locales: origen en el suelo, frente hacia +Z.
 * Solo presentación: el resultado lo decide machines/slot-logic.js y llega
 * a `spin(result)`; aquí no hay azar ni economía.
 */

const N = 8; // facetas por rodillo
const STEP = (Math.PI * 2) / N;
const R = 0.36;
const APOTHEM = R * Math.cos(Math.PI / N);
const CHORD = 2 * R * Math.sin(Math.PI / N);
const REEL_W = 0.34;
const REEL_X = [-0.4, 0, 0.4];
const REEL_Y = 1.45;
const REEL_Z = -0.1;
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

function faceTexture(id) {
  const w = 256;
  const h = Math.round((256 * CHORD) / REEL_W);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12060a');
  bg.addColorStop(0.5, '#2c0d16');
  bg.addColorStop(1, '#12060a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b8902c';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, h - 4, w, 4);
  // medallón marfil: los símbolos siempre destacan sobre un fondo claro y limpio
  const rad = h * 0.46;
  const med = ctx.createRadialGradient(w / 2, h / 2 - rad * 0.2, rad * 0.1, w / 2, h / 2, rad);
  med.addColorStop(0, '#fffaf0');
  med.addColorStop(1, '#eadfc2');
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, rad, 0, Math.PI * 2);
  ctx.fillStyle = med;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();
  drawSymbol(ctx, id, w / 2, h / 2, h * 0.36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
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

export function createClassicMachine() {
  const group = new THREE.Group();
  group.name = 'the-classic';
  const owned = [];
  const track = (o) => (owned.push(o), o);

  const M = {
    body: track(new THREE.MeshStandardMaterial({ color: 0x151215, metalness: 0.65, roughness: 0.38 })),
    gold: track(new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.28 })),
    velvet: track(new THREE.MeshStandardMaterial({ color: 0x4d0b18, roughness: 0.95 })),
    black: track(new THREE.MeshStandardMaterial({ color: 0x060304, roughness: 0.85 })),
    glass: track(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04, transparent: true, opacity: 0.1, depthWrite: false })),
    strip: track(new THREE.MeshStandardMaterial({ color: 0x300509, emissive: 0xc42240, emissiveIntensity: 1.3 })),
    button: track(new THREE.MeshStandardMaterial({ color: 0x8c1226, emissive: 0xff2a48, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 })),
    payline: track(new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.8 })),
    dark: track(new THREE.MeshStandardMaterial({ color: 0x1b1a1c, metalness: 0.9, roughness: 0.4 })),
  };

  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

  // ---- carcasa ----
  box(1.84, 0.12, 1.04, M.gold, 0, 0.06, 0.02);
  box(1.64, 0.95, 0.9, M.body, 0, 0.595, 0);
  box(1.3, 0.6, 0.02, M.velvet, 0, 0.62, 0.455);
  for (const [w, h, x, y] of [[1.36, 0.03, 0, 0.935], [1.36, 0.03, 0, 0.305], [0.03, 0.6, -0.665, 0.62], [0.03, 0.6, 0.665, 0.62]]) box(w, h, 0.03, M.gold, x, y, 0.46);
  box(1.64, 0.1, 0.42, M.body, 0, 1.0, 0.66); // consola
  box(1.68, 0.025, 0.46, M.gold, 0, 1.055, 0.66);
  // bahía de rodillos (abierta por delante)
  box(1.64, 0.76, 0.05, M.velvet, 0, REEL_Y, -0.425);
  box(0.08, 0.76, 0.75, M.body, -0.78, REEL_Y, -0.075);
  box(0.08, 0.76, 0.75, M.body, 0.78, REEL_Y, -0.075);
  box(1.64, 0.04, 0.75, M.black, 0, 1.09, -0.075);
  box(1.64, 0.04, 0.75, M.black, 0, 1.81, -0.075);
  // bisel frontal
  box(1.64, 0.12, 0.06, M.gold, 0, 1.13, 0.27);
  box(1.64, 0.12, 0.06, M.gold, 0, 1.77, 0.27);
  box(0.22, 0.76, 0.06, M.gold, -0.71, REEL_Y, 0.27);
  box(0.22, 0.76, 0.06, M.gold, 0.71, REEL_Y, 0.27);
  // cristal y línea de pago
  const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(1.2, 0.52)), M.glass);
  glass.position.set(0, REEL_Y, 0.29);
  group.add(glass);
  const payline = new THREE.Mesh(track(new THREE.PlaneGeometry(1.2, 0.012)), M.payline);
  payline.position.set(0, REEL_Y, 0.285);
  group.add(payline);
  for (const s of [-1, 1]) {
    const tri = new THREE.Mesh(track(new THREE.CircleGeometry(0.03, 3)), M.payline);
    tri.position.set(s * 0.64, REEL_Y, 0.305);
    tri.rotation.z = s > 0 ? Math.PI : 0;
    group.add(tri);
  }
  // remate (pantalla) y cúpula
  box(1.64, 0.62, 0.6, M.body, 0, 2.14, -0.15);
  box(1.72, 0.08, 0.66, M.gold, 0, 2.47, -0.15);
  const dome = add(new THREE.CylinderGeometry(0.86, 0.86, 0.66, 28, 1, false, Math.PI / 2, Math.PI), M.gold, 0, 2.5, -0.15);
  dome.rotation.x = Math.PI / 2;
  dome.scale.set(1, 1, 0.34);
  for (const s of [-1, 1]) {
    box(0.07, 2.55, 0.95, M.gold, s * 0.855, 1.275, 0.0);
    const line = box(0.022, 2.1, 0.022, M.strip, s * 0.855, 1.3, 0.485);
    line.castShadow = false;
  }

  // ---- pantalla ----
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 640;
  screenCanvas.height = 200;
  const screenTex = track(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(1.28, 0.4)), screenMat);
  screen.position.set(0, 2.14, 0.152);
  group.add(screen);

  // ---- botón físico ----
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 28), M.gold, 0, 1.085, 0.7);
  const buttonMesh = add(new THREE.CylinderGeometry(0.105, 0.115, 0.05, 28), M.button, 0, 1.115, 0.7);
  const plate = new THREE.Mesh(track(new THREE.PlaneGeometry(0.34, 0.085)), track(new THREE.MeshBasicMaterial({ map: track(plateTexture('ACTIVAR', { w: 256, h: 64, font: '700 34px Cinzel, serif' })) })));
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 1.071, 0.84);
  group.add(plate);

  // ---- rodillos ----
  const faceMats = {};
  for (const id of Object.keys(SYMBOLS)) {
    const map = track(faceTexture(id));
    faceMats[id] = track(new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.28, roughness: 0.5, metalness: 0.05 }));
  }
  const faceGeo = track(new THREE.PlaneGeometry(REEL_W, CHORD * 1.01));
  const coreGeo = track(new THREE.CylinderGeometry(APOTHEM * 0.97, APOTHEM * 0.97, REEL_W, 16).rotateZ(Math.PI / 2));
  const capGeo = track(new THREE.CylinderGeometry(APOTHEM * 1.05, APOTHEM * 1.05, 0.025, 24).rotateZ(Math.PI / 2));
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
      cap.position.x = s * (REEL_W / 2 + 0.012);
      pivot.add(cap);
      return cap;
    });
    group.add(pivot);
    return { pivot, faces, caps, strip: [], phi: 0, phase: 'idle', t: 0, stopAt: 0, from: 0, to: 0, dur: 1, lastCell: 0, settle: 0 };
  });

  // ---- bombillas ----
  const bulbPos = [...perimeter(0, REEL_Y, 1.28, 0.6, 30, 0.305), ...perimeter(0, 2.14, 1.46, 0.5, 26, 0.158)];
  const bulbs = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.02, 8, 6)), track(new THREE.MeshBasicMaterial({ toneMapped: false })), bulbPos.length);
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
  const light = new THREE.PointLight(0xffd9a0, 14, 5, 2);
  light.position.set(0, 1.55, 1.3);
  group.add(light);

  // ---- partículas ----
  const MAX_SPARKS = 220;
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
    colliderLocal: { minX: -0.95, maxX: 0.95, minZ: -0.55, maxZ: 0.92 },
    onReelStop: null,
    onTick: null,
  };
  let mode = 'idle'; // idle | spin | result
  let modeTime = 0;
  let schedule = [0.9, 1.4, 1.9];
  let pending = null;
  let pressT = 0;
  let resultColor = new THREE.Color(0xffd76a);
  let flash = 0;
  let doneTimer = -1;
  let screenKey = '';

  function drawScreen(kind, result = null) {
    const key = kind + (result ? `${result.reward}|${result.effects.join()}` : '');
    if (key === screenKey) return;
    screenKey = key;
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
    if (kind === 'idle') {
      ctx.font = '700 66px Cinzel, serif';
      ctx.fillText('THE CLASSIC', w / 2, h * 0.4);
      ctx.shadowBlur = 6;
      ctx.font = '600 30px "Cormorant Garamond", serif';
      ctx.fillStyle = '#f5ead7';
      ctx.fillText('PULSA EL BOTÓN', w / 2, h * 0.75);
    } else if (kind === 'spin') {
      ctx.font = '700 62px Cinzel, serif';
      ctx.fillText('· · ·  GIRANDO  · · ·', w / 2, h / 2);
    } else if (result) {
      ctx.font = '700 72px Cinzel, serif';
      ctx.fillText(`+${result.reward} MARKS`, w / 2, h * 0.4);
      ctx.shadowBlur = 6;
      ctx.font = '600 32px "Cormorant Garamond", serif';
      ctx.fillStyle = result.bonus > 0 ? '#ffe9a8' : '#f5ead7';
      const names = result.effects.map((e) => EFFECTS[e]?.name).filter(Boolean);
      ctx.fillText(names.length ? names.join('  ·  ').toUpperCase() : `BASE ${result.base} · SIGUE JUGANDO`, w / 2, h * 0.76);
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

  api.update = (dt, time) => {
    modeTime += dt;
    pressT = Math.max(0, pressT - dt);
    flash = Math.max(0, flash - dt * 1.4);
    buttonMesh.position.y = 1.115 - (pressT > 0 ? 0.022 : 0);

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
      reel.pivot.rotation.x = reel.phi;
    }

    if (mode === 'spin' && reels.every((r) => r.phase === 'idle')) {
      mode = 'result';
      modeTime = 0;
      for (const reel of reels) reel.phi = mod(reel.phi, TAU);
      const res = pending;
      drawScreen('result', res);
      resultColor.set(res.tier === 'jackpot' ? 0xfff3b0 : res.bonus > 0 ? 0xffd76a : 0xf5ead7);
      flash = res.bonus > 0 ? 1 : 0.2;
      if (api.effects && res.bonus > 0) {
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
      position: group.localToWorld(new THREE.Vector3(0, 1.62, 2.4)),
      target: group.localToWorld(new THREE.Vector3(0, 1.6, 0)),
    };
  };

  api.dispose = () => {
    for (const o of owned) o.dispose?.();
    bulbs.dispose();
  };

  return api;
}
