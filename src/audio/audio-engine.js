/**
 * Audio del juego con Web Audio API.
 *
 *  - Todo tiene una versión PROCEDURAL integrada (el juego suena sin ningún fichero).
 *  - Si existe `assets/audio/<nombre>.mp3` (o variantes `<nombre>_1.mp3`…) se usa en su lugar.
 *  - La lista de ficheros presentes viene de `assets/audio/manifest.json`: el servidor local
 *    la genera al vuelo y en un alojamiento estático (Vercel…) la crea `npm run audio`.
 *  - Voces de diálogo: `assets/audio/voice/<id>.mp3`, cargadas bajo demanda.
 *
 * El AudioContext solo puede arrancar tras un gesto del usuario → `unlock()`.
 * Grafo: sfxBus / musicBus / voiceBus → master → compresor → salida.
 * Si Web Audio no existe, todos los métodos son no-ops.
 */

import { AUDIO_DIR, MANIFEST_FILE, SOUND_ALIASES, SOUND_BY_NAME, SOUND_NAMES, VOICE_DIR } from './sound-list.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const vol = (v) => v * v; // curva perceptual simple
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

/** Sonidos cuyo tono sube con el argumento (cada rodillo, cada salto del contador…). */
const PITCHED = new Set(['tick', 'reelStop', 'marksTick', 'npcBlip', 'dialogText', 'betUp', 'betDown']);

/** Perfiles de música procedural (cuando no hay mp3). */
const PROFILES = {
  game: { chords: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [38, 50, 57, 60, 64], [40, 52, 56, 59, 62]], scale: [69, 72, 74, 76, 79, 81], every: [1.4, 4], lp: 780, sec: 8, pad: 0.09, type: 'triangle' },
  musicMenu: { chords: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64]], scale: [69, 72, 76, 81], every: [3, 7], lp: 620, sec: 10, pad: 0.075, type: 'triangle' },
  musicNeon: { chords: [[48, 60, 63, 67, 70], [44, 56, 60, 63, 67], [46, 58, 62, 65, 69], [43, 55, 58, 62, 65]], scale: [72, 75, 77, 79, 82, 84], every: [0.5, 1.6], lp: 1400, sec: 6, pad: 0.08, type: 'sawtooth' },
  musicGolden: { chords: [[48, 60, 64, 67, 71], [43, 55, 59, 62, 66], [45, 57, 60, 64, 67], [41, 53, 57, 60, 64]], scale: [72, 74, 76, 79, 81, 84], every: [1.2, 3.2], lp: 900, sec: 8, pad: 0.085, type: 'triangle' },
  musicUnderground: { chords: [[38, 50, 53, 57], [37, 49, 52, 56], [36, 48, 51, 55], [35, 47, 50, 54]], scale: [62, 65, 69, 70], every: [3, 8], lp: 420, sec: 9, pad: 0.1, type: 'sawtooth' },
  musicVip: { chords: [[50, 62, 65, 69, 72], [46, 58, 62, 65, 69], [43, 55, 58, 62, 65], [45, 57, 61, 64, 67]], scale: [74, 77, 81, 84], every: [2.5, 6], lp: 700, sec: 10, pad: 0.07, type: 'sine' },
  musicCredits: { chords: [[48, 60, 64, 67, 71], [43, 55, 59, 62, 67], [45, 57, 60, 64, 67], [41, 53, 57, 60, 64]], scale: [72, 74, 76, 79, 81, 84, 86], every: [0.9, 2.4], lp: 1000, sec: 7, pad: 0.095, type: 'triangle' },
  musicEnding: { chords: [[41, 53, 57, 60, 64], [48, 60, 64, 67, 71], [43, 55, 59, 62, 67], [45, 57, 60, 64, 69]], scale: [77, 79, 81, 84, 88], every: [2, 5], lp: 850, sec: 11, pad: 0.1, type: 'sine' },
  musicBankrupt: { chords: [[33, 45, 48, 52], [31, 43, 46, 50]], scale: [57, 60], every: [6, 12], lp: 380, sec: 12, pad: 0.11, type: 'sawtooth' },
};

/** Perfiles de ambiente procedural: [filtro Hz, Q, ganancia, zumbido grave Hz|0]. */
const AMBIENCE = {
  ambience: [520, 0.6, 0.035, 0],
  ambienceMenu: [480, 0.6, 0.017, 0],
  ambienceEmpty: [260, 0.5, 0.016, 50],
  ambienceNeon: [900, 0.8, 0.03, 110],
  ambienceGolden: [440, 0.5, 0.032, 0],
  ambienceUnderground: [190, 0.9, 0.05, 55],
  ambienceVip: [380, 0.5, 0.012, 0],
  ambienceCorridor: [140, 1.2, 0.05, 48],
};

/** Qué música y qué ambiente le tocan a cada zona. */
export const ZONE_SOUND = Object.freeze({
  main_floor: { music: 'musicGame', ambience: 'ambience' },
  neon_lounge: { music: 'musicNeon', ambience: 'ambienceNeon' },
  golden_room: { music: 'musicGolden', ambience: 'ambienceGolden' },
  underground: { music: 'musicUnderground', ambience: 'ambienceUnderground' },
  vip_hall: { music: 'musicVip', ambience: 'ambienceVip' },
});

export class AudioEngine {
  ctx = null;
  #volumes;
  #master;
  #sfxBus;
  #musicBus;
  #voiceBus;
  #farBus;
  #out = null; // bus de destino de los sfx procedurales (sfxBus salvo en los sonidos lejanos)
  #noise;
  #bank = new Map(); // nombre → AudioBuffer[] (ficheros opcionales de assets/audio)
  #voiceFiles = new Map(); // id (minúsculas) → nombre de fichero
  #voiceCache = new Map(); // id → AudioBuffer
  #voice = null; // { src, id }
  #voiceToken = 0;
  #music = null; // { name, gain, stop }
  #ambience = null;
  #loops = new Map();
  #lifeTimer = null;
  #manifestLoaded = false;

  constructor(audioSettings) {
    this.#volumes = { voice: 1, ...audioSettings };
  }

  get ready() {
    return this.ctx !== null;
  }

  /** Llamar desde un gesto del usuario (clic/tecla). Devuelve si hay audio disponible. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.#buildGraph();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch (error) {
      console.warn('[Audio] No disponible:', error);
      this.ctx = null;
      return false;
    }
  }

  /** Nombres de los sonidos cargados desde assets/audio (el resto usa la versión procedural). */
  get loaded() {
    return [...this.#bank.keys()];
  }

  get currentMusic() {
    return this.#music?.name ?? null;
  }

  get currentAmbience() {
    return this.#ambience?.name ?? null;
  }

  // ---------- ficheros opcionales ----------

  async #getJson(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (type && !type.includes('json')) return null; // p. ej. un 404 reescrito a index.html
      return await res.json();
    } catch {
      return null;
    }
  }

  async #decode(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) return null;
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null; // sin fichero o ilegible → se usa el sonido procedural
    }
  }

  /**
   * Lee el manifiesto y carga los .mp3 presentes. Sin manifiesto (alojamiento estático al que
   * no se ha pasado `npm run audio`) se prueba cada nombre del catálogo por si existe.
   */
  async loadFiles() {
    if (!this.ctx) return;
    const manifest = await this.#getJson(`${AUDIO_DIR}${MANIFEST_FILE}`);
    /** @type {Map<string,string[]>} nombre → ficheros reales */
    const wanted = new Map();
    const add = (name, file) => wanted.set(name, [...(wanted.get(name) ?? []), file]);

    if (manifest && Array.isArray(manifest.files)) {
      this.#manifestLoaded = true;
      for (const file of manifest.files) {
        const m = /^(.+?)(?:_(\d+))?\.mp3$/i.exec(String(file));
        if (!m) continue;
        const lower = m[1].toLowerCase();
        const name = SOUND_NAMES.find((n) => n.toLowerCase() === lower) ?? SOUND_NAMES.find((n) => n.toLowerCase() === (SOUND_ALIASES[m[1]] ?? SOUND_ALIASES[lower])?.toLowerCase());
        if (name) add(name, file);
      }
      for (const file of manifest.voice ?? []) this.#voiceFiles.set(String(file).replace(/\.mp3$/i, '').toLowerCase(), String(file));
    } else {
      for (const name of SOUND_NAMES) add(name, `${name}.mp3`);
      for (const [legacy, name] of Object.entries(SOUND_ALIASES)) add(name, `${legacy}.mp3`);
    }

    const jobs = [...wanted.entries()].flatMap(([name, files]) => files.map((file) => ({ name, file })));
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const { name, file } = jobs[next++];
        const buffer = await this.#decode(`${AUDIO_DIR}${file}`);
        if (buffer) this.#bank.set(name, [...(this.#bank.get(name) ?? []), buffer]);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    // lo que ya estaba sonando en procedural se sustituye por el fichero si ha aparecido
    this.#refreshLoopsAfterLoad();
  }

  #bufferFor(name) {
    let n = name;
    for (let i = 0; i < 3 && n; i++) {
      const list = this.#bank.get(n);
      if (list?.length) return list[list.length === 1 ? 0 : Math.floor(Math.random() * list.length)];
      n = SOUND_BY_NAME[n]?.fallback;
    }
    return null;
  }

  #refreshLoopsAfterLoad() {
    const m = this.#music?.name;
    const a = this.#ambience?.name;
    if (m && this.#music.procedural && this.#bufferFor(m)) { this.#music.stop(0.5); this.#music = null; this.setMusic(m); }
    if (a && this.#ambience.procedural && this.#bufferFor(a)) { this.#ambience.stop(0.5); this.#ambience = null; this.setAmbience(a); }
  }

  #playBuffer(buffer, { arg = 0, bus = this.#sfxBus, loop = false, gain = 1, rate = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.playbackRate.value = rate ?? 1 + Math.min(6, arg) * 0.04;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus);
    src.start();
    return { src, gain: g };
  }

  // ---------- volumen ----------

  setVolumes(audio) {
    this.#volumes = { voice: 1, ...audio };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.#master.gain.setTargetAtTime(vol(audio.master), t, 0.03);
    this.#musicBus.gain.setTargetAtTime(vol(audio.music), t, 0.03);
    this.#sfxBus.gain.setTargetAtTime(vol(audio.sfx), t, 0.03);
    this.#voiceBus.gain.setTargetAtTime(vol(audio.voice ?? 1), t, 0.03);
  }

  #buildGraph() {
    const c = this.ctx;
    this.#master = c.createGain();
    const comp = c.createDynamicsCompressor();
    this.#sfxBus = c.createGain();
    this.#musicBus = c.createGain();
    this.#voiceBus = c.createGain();
    this.#farBus = c.createGain();
    this.#farBus.gain.value = 0.28;
    const farLp = c.createBiquadFilter();
    farLp.type = 'lowpass';
    farLp.frequency.value = 2600;
    this.#farBus.connect(farLp).connect(this.#sfxBus);
    this.#out = this.#sfxBus;
    this.#sfxBus.connect(this.#master);
    this.#musicBus.connect(this.#master);
    this.#voiceBus.connect(this.#master);
    this.#master.connect(comp).connect(c.destination);
    this.setVolumes(this.#volumes);

    const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.#noise = buffer;
  }

  // ---------- primitivas procedurales ----------

  #tone({ freq, to = null, dur = 0.2, type = 'sine', gain = 0.15, delay = 0, attack = 0.005, bus = this.#out, filter = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  #noiseBurst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.1, delay = 0, sweepTo = null, bus = this.#out }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.#noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  #arp(notes, { step = 0.09, dur = 0.25, type = 'triangle', gain = 0.12, delay = 0 } = {}) {
    notes.forEach((n, i) => this.#tone({ freq: mtof(n), dur, type, gain, delay: delay + i * step }));
  }

  /** Ejecuta `fn` enviando los sfx procedurales a otro bus (sonidos lejanos, más flojos y apagados). */
  #via(bus, fn) {
    const prev = this.#out;
    this.#out = bus;
    try { fn(); } finally { this.#out = prev; }
  }

  // ---------- efectos ----------

  /**
   * @param {string} name   nombre del catálogo (sound-list.js)
   * @param {number} arg    tono / intensidad según el sonido
   */
  sfx(name, arg = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const actual = SOUND_ALIASES[name] ?? name;
    const buffer = this.#bufferFor(actual);
    if (buffer) {
      const far = actual.startsWith('far');
      this.#playBuffer(buffer, { arg: PITCHED.has(actual) ? arg : 0, bus: far ? this.#farBus : this.#sfxBus });
      return;
    }
    try {
      this.#procedural(actual, arg);
    } catch (error) {
      console.warn('[Audio] sfx', name, error);
    }
  }

  /** Reproduce un sonido «de fondo» lejano (clientes, otras máquinas…). */
  /** () => afluencia de clientes (0 = cerrado/vacío). Sin ella no suena la vida del casino. */
  lifeGate = null;

  ambientLife(on) {
    clearTimeout(this.#lifeTimer);
    this.#lifeTimer = null;
    if (!on || !this.ctx) return;
    const tick = () => {
      // solo si el casino está abierto y hay clientes jugando (`lifeGate` lo decide la partida)
      const crowd = this.lifeGate?.() ?? 0;
      if (crowd > 0) this.sfx(pickOne(['farSlot', 'farSlot', 'farChips', 'farRoulette', 'farCheer']));
      // con más gente, más a menudo
      this.#lifeTimer = setTimeout(tick, crowd > 0 ? rand(4000, 11000) / Math.min(2, 0.7 + crowd * 0.3) : 3000);
    };
    this.#lifeTimer = setTimeout(tick, rand(2000, 5000));
  }

  #procedural(name, arg) {
    switch (name) {
      // ---- interfaz ----
      case 'hover': this.#tone({ freq: 1400, dur: 0.04, gain: 0.04 }); break;
      case 'click':
        this.#tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.12 });
        this.#tone({ freq: 780, dur: 0.09, gain: 0.07, delay: 0.02 });
        break;
      case 'back': this.#tone({ freq: 440, to: 300, dur: 0.12, type: 'triangle', gain: 0.1 }); break;
      case 'confirm': this.#arp([72, 76, 79], { step: 0.07, dur: 0.18 }); break;
      case 'error': this.#tone({ freq: 160, to: 110, dur: 0.2, type: 'sawtooth', gain: 0.08, filter: 600 }); break;
      case 'toast': this.#arp([83, 88], { step: 0.08, dur: 0.3, type: 'sine', gain: 0.08 }); break;
      case 'tutorial': this.#arp([76, 83, 88], { step: 0.08, dur: 0.35, type: 'sine', gain: 0.11 }); break;
      case 'marksTick': this.#tone({ freq: 1900 + (arg % 6) * 90, dur: 0.04, type: 'square', gain: 0.025 }); break;
      case 'menuOpen': this.#noiseBurst({ dur: 0.28, freq: 500, sweepTo: 2600, q: 1.2, gain: 0.05 }); break;
      case 'menuClose': this.#noiseBurst({ dur: 0.22, freq: 2400, sweepTo: 450, q: 1.2, gain: 0.045 }); break;
      case 'tabSwitch': this.#tone({ freq: 330, dur: 0.06, type: 'triangle', gain: 0.09 }); this.#tone({ freq: 660, dur: 0.05, gain: 0.04, delay: 0.015 }); break;
      case 'sliderTick': this.#tone({ freq: 900, dur: 0.02, gain: 0.03 }); break;
      case 'toggle': this.#tone({ freq: 240, dur: 0.05, type: 'square', gain: 0.05, filter: 1200 }); this.#tone({ freq: 480, dur: 0.06, type: 'triangle', gain: 0.06, delay: 0.03 }); break;
      case 'languageChange': this.#arp([84, 88, 91], { step: 0.06, dur: 0.3, type: 'sine', gain: 0.07 }); this.#noiseBurst({ dur: 0.3, freq: 800, sweepTo: 3500, gain: 0.04 }); break;
      case 'pause': this.#tone({ freq: 520, to: 260, dur: 0.28, type: 'triangle', gain: 0.1 }); break;
      case 'resume': this.#tone({ freq: 260, to: 520, dur: 0.28, type: 'triangle', gain: 0.1 }); break;

      // ---- mundo ----
      case 'step': this.#noiseBurst({ dur: 0.1, freq: 260 + Math.random() * 80, type: 'lowpass', gain: 0.05 }); break;
      case 'stepCarpet': this.#noiseBurst({ dur: 0.12, freq: 170 + Math.random() * 40, type: 'lowpass', gain: 0.035 }); break;
      case 'doorOpen':
        this.#tone({ freq: 140, to: 90, dur: 0.07, gain: 0.18 });
        this.#tone({ freq: 220, to: 330, dur: 0.45, type: 'sawtooth', gain: 0.025, filter: 700, delay: 0.08 });
        this.#noiseBurst({ dur: 0.4, freq: 600, sweepTo: 1400, q: 3, gain: 0.025, delay: 0.08 });
        break;
      case 'doorClose':
        this.#tone({ freq: 90, to: 55, dur: 0.18, gain: 0.32 });
        this.#noiseBurst({ dur: 0.08, freq: 2500, type: 'highpass', gain: 0.06, delay: 0.16 });
        this.#tone({ freq: 1800, dur: 0.05, type: 'square', gain: 0.03, delay: 0.18 });
        break;
      case 'doorLocked':
        this.#tone({ freq: 95, to: 70, dur: 0.14, gain: 0.3 });
        this.#tone({ freq: 95, to: 70, dur: 0.14, gain: 0.3, delay: 0.16 });
        this.#noiseBurst({ dur: 0.1, freq: 3000, type: 'highpass', gain: 0.05, delay: 0.3 });
        break;
      case 'machineEnter':
        this.#noiseBurst({ dur: 0.5, freq: 400, sweepTo: 3000, q: 1.5, gain: 0.07 });
        this.#tone({ freq: 120, to: 240, dur: 0.5, type: 'sawtooth', gain: 0.05, filter: 700 });
        break;
      case 'machineExit': this.#noiseBurst({ dur: 0.35, freq: 3000, sweepTo: 300, q: 1.5, gain: 0.06 }); break;
      case 'shopOpen':
        this.#noiseBurst({ dur: 0.08, freq: 3500, type: 'highpass', gain: 0.1 });
        this.#tone({ freq: 2093, dur: 0.5, gain: 0.1, delay: 0.1 });
        this.#tone({ freq: 3136, dur: 0.6, gain: 0.07, delay: 0.1 });
        break;
      case 'farSlot':
        this.#via(this.#farBus, () => {
          this.#arp([88, 91, 95, 100], { step: 0.07, dur: 0.25, type: 'square', gain: 0.07 });
          this.#noiseBurst({ dur: 0.6, freq: 700, sweepTo: 1600, q: 2, gain: 0.06, delay: 0.3 });
        });
        break;
      case 'farChips':
        this.#via(this.#farBus, () => { for (let i = 0; i < 4; i++) this.#tone({ freq: rand(2200, 3200), dur: 0.05, type: 'square', gain: 0.07, delay: i * rand(0.05, 0.12) }); });
        break;
      case 'farRoulette':
        this.#via(this.#farBus, () => {
          for (let i = 0; i < 14; i++) this.#tone({ freq: rand(1800, 2600), dur: 0.03, type: 'square', gain: 0.06, delay: (i / 14) ** 0.6 * 2.4 });
          this.#noiseBurst({ dur: 2.4, freq: 300, type: 'lowpass', gain: 0.04 });
        });
        break;
      case 'farCheer':
        this.#via(this.#farBus, () => { for (let i = 0; i < 24; i++) this.#noiseBurst({ dur: 0.08, freq: rand(1200, 3200), q: 0.8, gain: 0.05, delay: rand(0, 1.3) }); });
        break;

      // ---- diálogos y misiones ----
      case 'dialogOpen': this.#arp([79, 86], { step: 0.07, dur: 0.3, type: 'sine', gain: 0.07 }); this.#noiseBurst({ dur: 0.25, freq: 600, sweepTo: 2000, gain: 0.03 }); break;
      case 'dialogClose': this.#arp([86, 79], { step: 0.06, dur: 0.22, type: 'sine', gain: 0.06 }); break;
      case 'dialogText': this.#tone({ freq: 1500 + (arg % 5) * 60, dur: 0.018, type: 'square', gain: 0.018 }); break;
      case 'dialogAdvance': this.#tone({ freq: 700, to: 900, dur: 0.07, type: 'triangle', gain: 0.07 }); break;
      case 'dialogChoice': this.#arp([84, 91], { step: 0.05, dur: 0.15, type: 'triangle', gain: 0.09 }); break;
      case 'npcBlip': {
        const f = 150 + (arg % 7) * 22 + Math.random() * 30;
        this.#tone({ freq: f, to: f * rand(0.85, 1.25), dur: 0.07, type: 'sawtooth', gain: 0.05, filter: 1100 });
        break;
      }
      case 'questNew': this.#arp([67, 72, 76, 79, 84], { step: 0.09, dur: 0.4, gain: 0.11 }); break;
      case 'questUpdate': this.#arp([83, 88], { step: 0.1, dur: 0.3, type: 'sine', gain: 0.09 }); break;
      case 'questComplete':
        this.#arp([72, 76, 79, 84, 88, 91], { step: 0.1, dur: 0.5, gain: 0.12 });
        this.#tone({ freq: 70, to: 45, dur: 0.4, gain: 0.22 });
        break;
      case 'relationUp': this.#arp([76, 79, 83], { step: 0.12, dur: 0.6, type: 'sine', gain: 0.08 }); break;

      // ---- máquinas ----
      case 'buttonPress':
        this.#tone({ freq: 90, to: 50, dur: 0.12, gain: 0.34 });
        this.#noiseBurst({ dur: 0.05, freq: 2200, type: 'highpass', gain: 0.09 });
        this.#tone({ freq: 1200, dur: 0.04, type: 'square', gain: 0.04, delay: 0.02 });
        break;
      case 'buttonRelease': this.#tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', gain: 0.07 }); this.#noiseBurst({ dur: 0.04, freq: 3000, type: 'highpass', gain: 0.04 }); break;
      case 'lever':
        this.#tone({ freq: 200, to: 90, dur: 0.25, type: 'sawtooth', gain: 0.05, filter: 500 });
        this.#tone({ freq: 80, to: 45, dur: 0.15, gain: 0.3, delay: 0.25 });
        break;
      case 'spinStart':
        this.#tone({ freq: 110, dur: 0.1, gain: 0.25 });
        this.#noiseBurst({ dur: 0.6, freq: 300, sweepTo: 2200, q: 2, gain: 0.07 });
        this.#tone({ freq: 180, to: 520, dur: 0.6, type: 'sawtooth', gain: 0.03, filter: 900 });
        break;
      case 'tick': this.#tone({ freq: 800 + (arg % 3) * 120, dur: 0.02, gain: 0.035 }); break;
      case 'reelStop':
        this.#tone({ freq: 150 + arg * 30, to: 60, dur: 0.16, gain: 0.32 });
        this.#noiseBurst({ dur: 0.07, freq: 900, type: 'lowpass', gain: 0.12 });
        break;
      case 'betUp': this.#tone({ freq: 600 + (arg % 8) * 40, to: 900 + (arg % 8) * 40, dur: 0.07, type: 'triangle', gain: 0.09 }); break;
      case 'betDown': this.#tone({ freq: 800 - (arg % 8) * 30, to: 500, dur: 0.07, type: 'triangle', gain: 0.09 }); break;
      case 'betMax': this.#arp([79, 84, 91], { step: 0.05, dur: 0.25, gain: 0.1 }); this.#tone({ freq: 90, to: 55, dur: 0.2, gain: 0.3 }); break;
      case 'betPlace': for (let i = 0; i < 5; i++) this.#tone({ freq: rand(1800, 2800), dur: 0.06, type: 'triangle', gain: 0.05, delay: i * 0.05 }); break;
      case 'push': this.#arp([76, 76], { step: 0.14, dur: 0.3, type: 'sine', gain: 0.09 }); break;
      case 'lose': this.#tone({ freq: 330, to: 200, dur: 0.45, type: 'triangle', gain: 0.1, filter: 900 }); break;
      case 'winSmall': this.#arp([76, 79, 83], { step: 0.09 }); break;
      case 'winBig':
        this.#arp([72, 76, 79, 84, 88], { step: 0.085, dur: 0.35, gain: 0.13 });
        this.#noiseBurst({ dur: 0.8, freq: 5000, type: 'highpass', gain: 0.03, delay: 0.3 });
        break;
      case 'jackpot':
        this.#tone({ freq: 70, to: 40, dur: 0.6, gain: 0.4 });
        this.#arp([72, 76, 79, 84, 88, 91, 96], { step: 0.09, dur: 0.5, gain: 0.14 });
        this.#arp([84, 88, 91, 96], { step: 0.12, dur: 0.9, type: 'sine', gain: 0.07 });
        this.#noiseBurst({ dur: 1.2, freq: 6000, type: 'highpass', gain: 0.04, delay: 0.4 });
        break;
      case 'coin':
        this.#tone({ freq: 1568, dur: 0.07, type: 'square', gain: 0.05 });
        this.#tone({ freq: 2349, dur: 0.22, type: 'square', gain: 0.05, delay: 0.06 });
        break;
      case 'coins':
        for (let i = 0; i < 28; i++) {
          const d = (i / 28) ** 0.8 * (1.6 + arg * 0.6);
          this.#tone({ freq: 1500 + Math.random() * 1700, dur: 0.12, type: 'triangle', gain: 0.05, delay: d });
        }
        break;
      case 'applause':
        for (let i = 0; i < 70; i++) {
          this.#noiseBurst({ dur: 0.05 + Math.random() * 0.05, freq: 1500 + Math.random() * 3000, q: 0.8, gain: 0.05 * Math.sin((i / 70) * Math.PI) + 0.01, delay: Math.random() * (2.2 + arg) });
        }
        break;
      case 'applauseBig':
        for (let i = 0; i < 160; i++) {
          this.#noiseBurst({ dur: 0.05 + Math.random() * 0.06, freq: 1200 + Math.random() * 3600, q: 0.8, gain: 0.055 * Math.sin((i / 160) * Math.PI) + 0.012, delay: Math.random() * 4.6 });
        }
        for (let i = 0; i < 6; i++) this.#noiseBurst({ dur: 0.5, freq: rand(500, 900), q: 2, gain: 0.025, delay: rand(0.2, 3.4) });
        break;
      case 'confetti':
        this.#noiseBurst({ dur: 0.15, freq: 1200, type: 'highpass', gain: 0.14 });
        this.#tone({ freq: 300, to: 900, dur: 0.18, type: 'triangle', gain: 0.1 });
        break;
      case 'sparkle': this.#arp([88, 91, 95, 100, 103], { step: 0.05, dur: 0.3, type: 'sine', gain: 0.06 }); break;
      case 'abilityReady': this.#tone({ freq: 220, to: 880, dur: 0.4, type: 'sawtooth', gain: 0.04, filter: 1400 }); this.#arp([91, 96], { step: 0.1, dur: 0.3, type: 'sine', gain: 0.08, delay: 0.35 }); break;
      case 'abilityUse':
        this.#tone({ freq: 60, to: 35, dur: 0.6, gain: 0.35 });
        this.#noiseBurst({ dur: 0.7, freq: 400, sweepTo: 7000, q: 2, gain: 0.09 });
        this.#arp([79, 84, 88, 91], { step: 0.06, dur: 0.4, gain: 0.09, delay: 0.1 });
        break;

      // ---- cartas y fichas ----
      case 'cardShuffle':
        for (let i = 0; i < 26; i++) this.#noiseBurst({ dur: 0.05, freq: rand(2500, 5000), q: 0.7, type: 'bandpass', gain: 0.05, delay: i * 0.07 + rand(0, 0.03) });
        break;
      case 'cardDeal': this.#noiseBurst({ dur: 0.11, freq: 1800, sweepTo: 5500, q: 0.9, gain: 0.08 }); this.#tone({ freq: 160, dur: 0.05, gain: 0.07, delay: 0.09 }); break;
      case 'cardFlip': this.#noiseBurst({ dur: 0.08, freq: 3500, sweepTo: 1500, q: 0.9, gain: 0.07 }); break;
      case 'chipBet': this.#tone({ freq: rand(2200, 2700), dur: 0.05, type: 'square', gain: 0.06 }); this.#tone({ freq: rand(1400, 1800), dur: 0.08, type: 'triangle', gain: 0.07, delay: 0.015 }); break;
      case 'chipStack': for (let i = 0; i < 6; i++) this.#tone({ freq: rand(1800, 2600), dur: 0.05, type: 'square', gain: 0.05, delay: i * 0.06 }); break;
      case 'blackjack': this.#arp([72, 76, 79, 84, 88, 91], { step: 0.08, dur: 0.45, gain: 0.12 }); this.#tone({ freq: 70, to: 42, dur: 0.4, gain: 0.25 }); break;
      case 'bust': this.#tone({ freq: 140, to: 55, dur: 0.4, type: 'sawtooth', gain: 0.12, filter: 500 }); this.#noiseBurst({ dur: 0.12, freq: 600, type: 'lowpass', gain: 0.12 }); break;
      case 'dealerReveal': for (let i = 0; i < 8; i++) this.#tone({ freq: 140, dur: 0.04, gain: 0.07, delay: i * 0.045 }); this.#noiseBurst({ dur: 0.2, freq: 1500, sweepTo: 4500, gain: 0.06, delay: 0.38 }); break;
      case 'doubleDown': this.#tone({ freq: 90, to: 55, dur: 0.15, gain: 0.28 }); for (let i = 0; i < 4; i++) this.#tone({ freq: rand(2000, 2800), dur: 0.05, type: 'square', gain: 0.05, delay: 0.08 + i * 0.05 }); break;

      // ---- ruleta ----
      case 'rouletteBall':
        for (let i = 0; i < 40; i++) this.#tone({ freq: rand(1700, 2500), dur: 0.025, type: 'square', gain: 0.04, delay: (i / 40) ** 0.55 * 4.5 });
        break;
      case 'rouletteLand':
        for (let i = 0; i < 9; i++) this.#tone({ freq: rand(1500, 2400), dur: 0.03, type: 'square', gain: 0.07, delay: i * (0.03 + i * 0.012) });
        this.#tone({ freq: 700, dur: 0.12, type: 'triangle', gain: 0.1, delay: 0.6 });
        break;
      case 'roulettePlace': this.#tone({ freq: 480, dur: 0.07, type: 'triangle', gain: 0.07 }); this.#noiseBurst({ dur: 0.06, freq: 1200, type: 'lowpass', gain: 0.05 }); break;
      case 'rouletteWin': this.#arp([76, 83, 88, 91], { step: 0.08, dur: 0.4, gain: 0.11 }); break;

      // ---- progreso ----
      case 'buy':
        this.#tone({ freq: 1318, dur: 0.1, gain: 0.12 });
        this.#tone({ freq: 1760, dur: 0.3, gain: 0.12, delay: 0.08 });
        break;
      case 'buyMachine':
        this.#tone({ freq: 1318, dur: 0.1, gain: 0.12 });
        this.#tone({ freq: 1760, dur: 0.12, gain: 0.12, delay: 0.07 });
        this.#tone({ freq: 2637, dur: 0.4, gain: 0.12, delay: 0.14 });
        this.#noiseBurst({ dur: 0.25, freq: 2500, sweepTo: 8000, type: 'bandpass', q: 3, gain: 0.06, delay: 0.1 });
        this.#arp([91, 96, 100], { step: 0.06, dur: 0.3, type: 'sine', gain: 0.06 });
        break;
      case 'decorPlace': this.#tone({ freq: 110, to: 70, dur: 0.25, gain: 0.25 }); this.#arp([88, 95, 100], { step: 0.07, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.1 }); break;
      case 'construction':
        for (let i = 0; i < 9; i++) { this.#noiseBurst({ dur: 0.05, freq: 1800, q: 4, gain: 0.1, delay: i * 0.38 }); this.#tone({ freq: 200, to: 120, dur: 0.07, type: 'square', gain: 0.07, delay: i * 0.38 }); }
        this.#noiseBurst({ dur: 1.0, freq: 900, sweepTo: 1500, q: 5, gain: 0.05, delay: 1.2 });
        break;
      case 'constructionDone': this.#arp([72, 79, 84, 88], { step: 0.1, dur: 0.5, gain: 0.12 }); this.#noiseBurst({ dur: 0.9, freq: 3000, type: 'highpass', gain: 0.03, delay: 0.3 }); break;
      case 'cleaning':
        for (let i = 0; i < 6; i++) this.#noiseBurst({ dur: 0.3, freq: 1800, sweepTo: 3600, q: 0.8, gain: 0.04, delay: i * 0.33 });
        this.#tone({ freq: 110, to: 130, dur: 1.9, type: 'sawtooth', gain: 0.025, filter: 500 });
        break;
      case 'phoneRing':
        // timbre clásico: dos ráfagas de campanilla
        for (const d of [0, 1.05]) for (let i = 0; i < 16; i++) this.#tone({ freq: i % 2 ? 1260 : 1580, dur: 0.03, type: 'square', gain: 0.035, filter: 3000, delay: d + i * 0.045 });
        break;
      case 'crewArrive':
        this.#noiseBurst({ dur: 0.35, freq: 300, sweepTo: 120, q: 1, gain: 0.12 });
        for (let i = 0; i < 8; i++) this.#noiseBurst({ dur: 0.07, freq: 500, sweepTo: 250, q: 2, gain: 0.08, delay: 0.5 + i * 0.18 });
        this.#tone({ freq: 220, to: 200, dur: 0.6, type: 'triangle', gain: 0.02, delay: 1.2 });
        break;
      case 'repairWorks':
        // martillazos, un taladro que sube y baja y unas pasadas de sierra
        for (let i = 0; i < 5; i++) {
          this.#noiseBurst({ dur: 0.05, freq: 1400, q: 2, gain: 0.16, delay: i * 0.22 });
          this.#tone({ freq: 180, to: 90, dur: 0.08, type: 'triangle', gain: 0.1, delay: i * 0.22 });
        }
        this.#tone({ freq: 380, to: 620, dur: 0.9, type: 'sawtooth', gain: 0.035, filter: 1800, delay: 1.2 });
        this.#tone({ freq: 620, to: 420, dur: 0.4, type: 'sawtooth', gain: 0.03, filter: 1800, delay: 2.1 });
        for (let i = 0; i < 4; i++) this.#noiseBurst({ dur: 0.16, freq: 2600, sweepTo: 1800, q: 3, gain: 0.06, delay: 2.4 + i * 0.16 });
        break;
      case 'breakerLever':
        this.#noiseBurst({ dur: 0.12, freq: 2200, sweepTo: 800, q: 4, gain: 0.18 });
        this.#tone({ freq: 140, to: 60, dur: 0.25, type: 'square', gain: 0.12, filter: 900 });
        break;
      case 'lightsOn':
        this.#tone({ freq: 90, to: 40, dur: 0.35, gain: 0.3 });
        for (let i = 0; i < 3; i++) this.#noiseBurst({ dur: 0.08, freq: 1200, sweepTo: 400, q: 3, gain: 0.16, delay: i * 0.09 });
        this.#tone({ freq: 50, to: 120, dur: 1.4, type: 'sawtooth', gain: 0.06, filter: 400, delay: 0.1 });
        this.#tone({ freq: 100, to: 240, dur: 1.4, type: 'sine', gain: 0.05, delay: 0.1 });
        break;
      case 'repair':
        for (let i = 0; i < 5; i++) this.#tone({ freq: rand(900, 1500), dur: 0.05, type: 'square', gain: 0.05, delay: i * 0.18 });
        this.#noiseBurst({ dur: 0.5, freq: 2500, sweepTo: 9000, q: 3, gain: 0.07, delay: 1 });
        this.#tone({ freq: 70, to: 200, dur: 0.8, type: 'sawtooth', gain: 0.06, filter: 600, delay: 1.2 });
        break;
      case 'unlock': this.#arp([81, 85, 88, 93], { step: 0.11, dur: 0.6, type: 'sine', gain: 0.1 }); break;
      case 'objective': this.#arp([79, 84, 88, 91, 96], { step: 0.09, dur: 0.5, type: 'sine', gain: 0.1 }); break;
      case 'achievement':
        this.#arp([72, 79, 84, 88], { step: 0.1, dur: 0.45, gain: 0.12 });
        this.#tone({ freq: 70, to: 45, dur: 0.4, gain: 0.25 });
        break;
      case 'prestige': this.#tone({ freq: 1568, dur: 0.35, type: 'sine', gain: 0.08 }); this.#tone({ freq: 2093, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.06 }); break;
      case 'bankrupt':
        this.#tone({ freq: 70, to: 30, dur: 1.4, gain: 0.45 });
        this.#arp([57, 53, 50, 45], { step: 0.35, dur: 1.1, type: 'sawtooth', gain: 0.06 });
        this.#noiseBurst({ dur: 1.6, freq: 500, sweepTo: 80, type: 'lowpass', gain: 0.1 });
        break;
      case 'endingDoor':
        this.#tone({ freq: 45, to: 38, dur: 3, gain: 0.35 });
        this.#arp([45, 52, 57, 60], { step: 0.5, dur: 2.2, type: 'sine', gain: 0.07, delay: 0.5 });
        this.#noiseBurst({ dur: 2.6, freq: 200, sweepTo: 900, q: 1, gain: 0.05 });
        break;
      case 'theEnd':
        this.#arp([48, 55, 60, 64, 67, 72], { step: 0.35, dur: 3, type: 'sine', gain: 0.09 });
        this.#tone({ freq: 55, to: 50, dur: 4, gain: 0.3 });
        break;
      default: break; // sonidos opcionales sin versión procedural (p. ej. variantes de ambiente)
    }
  }

  // ---------- bucles de efectos (rodillos, rueda de ruleta…) ----------

  startLoop(name) {
    if (!this.ctx || this.ctx.state !== 'running' || this.#loops.has(name)) return;
    const buffer = this.#bufferFor(name);
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + 0.12);
    g.connect(this.#sfxBus);
    let stopNodes;
    if (buffer) {
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(g);
      src.start();
      stopNodes = () => src.stop();
    } else if (name === 'reelSpin' || name === 'rouletteSpin') {
      const src = c.createBufferSource();
      src.buffer = this.#noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = name === 'reelSpin' ? 900 : 360;
      f.Q.value = 1.4;
      const ng = c.createGain();
      ng.gain.value = name === 'reelSpin' ? 0.05 : 0.04;
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = name === 'reelSpin' ? 19 : 5.5;
      lg.gain.value = ng.gain.value * 0.7;
      lfo.connect(lg).connect(ng.gain);
      src.connect(f).connect(ng).connect(g);
      src.start();
      lfo.start();
      stopNodes = () => { src.stop(); lfo.stop(); };
    } else {
      g.disconnect();
      return;
    }
    this.#loops.set(name, { gain: g, stop: stopNodes });
  }

  stopLoop(name, fade = 0.15) {
    const loop = this.#loops.get(name);
    if (!loop || !this.ctx) return;
    this.#loops.delete(name);
    const t = this.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(t);
    loop.gain.gain.setTargetAtTime(0.0001, t, fade / 3);
    setTimeout(() => { try { loop.stop(); } catch { /* ya parado */ } loop.gain.disconnect(); }, fade * 1000 + 120);
  }

  // ---------- música y ambiente ----------

  /** Cambia de música con fundido cruzado. `null` la apaga. */
  setMusic(name, fade = 1.2) {
    if (!this.ctx) return;
    if ((this.#music?.name ?? null) === name) return;
    this.#music?.stop(fade);
    this.#music = name ? this.#startLayer(name, fade, 'music') : null;
  }

  setAmbience(name, fade = 1.5) {
    if (!this.ctx) return;
    if ((this.#ambience?.name ?? null) === name) return;
    this.#ambience?.stop(fade);
    this.#ambience = name ? this.#startLayer(name, fade, 'ambience') : null;
  }

  /** Todo lo que suene de fondo (música, ambiente, vida lejana) se apaga. */
  stopMusic() {
    this.setMusic(null, 0.4);
    this.setAmbience(null, 0.4);
    this.ambientLife(false);
  }

  #startLayer(name, fade, kind) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + fade);
    g.connect(this.#musicBus);
    const buffer = this.#bufferFor(name);
    const layer = { name, gain: g, procedural: !buffer, stop: null };
    let end;
    if (buffer) {
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(g);
      src.start();
      end = () => src.stop();
    } else {
      end = kind === 'music' ? this.#proceduralMusic(name, g) : this.#proceduralAmbience(name, g);
    }
    layer.stop = (fadeOut = 1) => {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.linearRampToValueAtTime(0.0001, t + fadeOut);
      setTimeout(() => { try { end(); } catch { /* ya parado */ } g.disconnect(); }, fadeOut * 1000 + 200);
    };
    return layer;
  }

  #proceduralAmbience(name, out) {
    const [freq, q, gain, hum] = AMBIENCE[name] ?? AMBIENCE.ambience;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.#noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = freq < 250 ? 'lowpass' : 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = gain * 0.45;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(out);
    src.start();
    lfo.start();
    let humOsc = null;
    if (hum) {
      humOsc = c.createOscillator();
      const hg = c.createGain();
      humOsc.type = 'sine';
      humOsc.frequency.value = hum;
      hg.gain.value = 0.035;
      humOsc.connect(hg).connect(out);
      humOsc.start();
    }
    return () => { src.stop(); lfo.stop(); humOsc?.stop(); };
  }

  #proceduralMusic(name, out) {
    const profile = PROFILES[name] ?? PROFILES.game;
    let chordIndex = 0;
    const c = this.ctx;
    let nextChord = c.currentTime + 0.1;
    let nextPluck = c.currentTime + rand(2, 4);
    const schedule = () => {
      while (nextChord < c.currentTime + 1) {
        this.#playChord(profile, profile.chords[chordIndex % profile.chords.length], nextChord, out);
        chordIndex++;
        nextChord += profile.sec;
      }
      while (nextPluck < c.currentTime + 0.5) {
        this.#pluck(pickOne(profile.scale), Math.max(nextPluck, c.currentTime), out, profile.type === 'sawtooth' ? 'square' : 'sine');
        nextPluck += rand(profile.every[0], profile.every[1]);
      }
    };
    const timer = setInterval(schedule, 250);
    schedule();
    return () => clearInterval(timer);
  }

  #playChord(profile, notes, t, out) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = profile.lp;
    lp.connect(out);
    const end = t + profile.sec + 3;
    notes.forEach((m, i) => {
      for (const detune of [-7, 7]) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = i === 0 ? 'sine' : profile.type;
        osc.frequency.value = mtof(m);
        osc.detune.value = detune;
        const peak = i === 0 ? profile.pad : profile.pad * 0.36;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 2.5);
        g.gain.setValueAtTime(peak, t + profile.sec - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, end);
        osc.connect(g).connect(lp);
        osc.start(t);
        osc.stop(end + 0.1);
      }
    });
  }

  #pluck(midi, t, out, type = 'sine') {
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = mtof(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(type === 'square' ? 0.025 : 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 2.3);
  }

  // ---------- voces de diálogo ----------

  /** ¿Hay un fichero de voz grabado para esta línea? (según el manifiesto) */
  hasVoice(id, lang = null) {
    return this.#voiceFiles.has(String(id).toLowerCase()) || (!!lang && this.#voiceFiles.has(`${lang}/${id}`.toLowerCase()));
  }

  /**
   * Reproduce la voz de una línea de diálogo. Corta la anterior (si el jugador salta a lo
   * siguiente, deja de sonar la que estaba sonando). Devuelve true si había fichero.
   * @param {string} id  p. ej. «m01_intro__v1»
   * @param {{onEnd?: Function, onStart?: (seconds:number)=>void, lang?: string}} [opts]  onStart recibe la duración
   */
  async playVoice(id, { onEnd = null, onStart = null, lang = null } = {}) {
    this.stopVoice();
    if (!this.ctx || this.ctx.state !== 'running') return false;
    // primero la versión del idioma actual (voice/<idioma>/<id>.mp3), si no la general
    const localized = lang ? `${lang}/${String(id)}`.toLowerCase() : null;
    const key = localized && this.#voiceFiles.has(localized) ? localized : String(id).toLowerCase();
    const file = this.#voiceFiles.get(key);
    if (!file) return false;
    const token = ++this.#voiceToken;
    let buffer = this.#voiceCache.get(key);
    if (!buffer) {
      buffer = await this.#decode(`${VOICE_DIR}${file}`);
      if (!buffer) return false;
      this.#voiceCache.set(key, buffer);
      if (this.#voiceCache.size > 24) this.#voiceCache.delete(this.#voiceCache.keys().next().value);
    }
    if (token !== this.#voiceToken) return true; // el jugador ya pasó a otra línea mientras cargaba
    const { src } = this.#playBuffer(buffer, { bus: this.#voiceBus, rate: 1 });
    this.#voice = { src, id: key };
    onStart?.(buffer.duration);
    src.onended = () => {
      if (this.#voice?.src === src) this.#voice = null;
      if (token === this.#voiceToken) onEnd?.();
    };
    return true;
  }

  stopVoice() {
    this.#voiceToken++;
    const v = this.#voice;
    this.#voice = null;
    if (v) {
      v.src.onended = null;
      try { v.src.stop(); } catch { /* ya parado */ }
    }
  }

  get voicePlaying() {
    return this.#voice !== null;
  }
}
