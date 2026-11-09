/**
 * Audio procedural con Web Audio API (sin ficheros de sonido).
 *
 * El AudioContext solo puede arrancar tras un gesto del usuario → `unlock()`.
 * Grafo: sfxBus / musicBus → master → compresor → salida.
 * Si Web Audio no existe, todos los métodos son no-ops.
 */

import { AUDIO_DIR, SOUND_NAMES } from './sound-list.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const vol = (v) => v * v; // curva perceptual simple

const CHORDS = [
  [45, 57, 60, 64, 71], // Am9
  [41, 53, 57, 60, 64], // Fmaj7
  [38, 50, 57, 60, 64], // Dm9
  [40, 52, 56, 59, 62], // E7
];
const PENTATONIC = [69, 72, 74, 76, 79, 81];
const CHORD_SECONDS = 8;

export class AudioEngine {
  ctx = null;
  #volumes;
  #master;
  #sfxBus;
  #musicBus;
  #noise;
  #musicTimer = null;
  #nextChord = 0;
  #nextPluck = 0;
  #chordIndex = 0;
  #ambience = null;
  #musicOn = false;
  #files = new Map(); // nombre → AudioBuffer (ficheros opcionales de assets/audio)
  #fileLoop = { music: null, ambience: null };

  constructor(audioSettings) {
    this.#volumes = { ...audioSettings };
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
    return [...this.#files.keys()];
  }

  /** Busca assets/audio/<nombre>.mp3 para cada sonido; los que no existan se ignoran (suena el procedural). */
  async loadFiles() {
    if (!this.ctx) return;
    // El servidor local publica la lista de .mp3 existentes (sin 404 por cada ausente);
    // en un alojamiento estático sin esa lista se prueban todos los nombres.
    let present = null;
    try {
      const res = await fetch(`${AUDIO_DIR}_list.json`);
      if (res.ok) present = new Set((await res.json()).map((n) => String(n).toLowerCase()));
    } catch { /* sin lista */ }
    const names = present ? SOUND_NAMES.filter((n) => present.has(`${n}.mp3`)) : SOUND_NAMES;
    await Promise.all(names.map(async (name) => {
      try {
        const res = await fetch(`${AUDIO_DIR}${name}.mp3`);
        if (!res.ok) return;
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.#files.set(name, buffer);
      } catch { /* sin fichero o ilegible: se usa el sonido procedural */ }
    }));
    if (this.#musicOn) this.#swapLoops();
  }

  #playBuffer(buffer, arg = 0, bus = this.#sfxBus, loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.playbackRate.value = 1 + Math.min(6, arg) * 0.04;
    src.connect(bus);
    src.start();
    return src;
  }

  /** Si hay music.mp3 / ambience.mp3 sustituyen a la música y el ambiente procedurales. */
  #swapLoops() {
    const m = this.#files.get('music');
    const a = this.#files.get('ambience');
    if (m && !this.#fileLoop.music) {
      clearInterval(this.#musicTimer);
      this.#musicTimer = null;
      this.#fileLoop.music = this.#playBuffer(m, 0, this.#musicBus, true);
      if (!a) return;
    }
    if (a && !this.#fileLoop.ambience) {
      try { this.#ambience?.stop(); } catch { /* ya parado */ }
      this.#ambience = null;
      this.#fileLoop.ambience = this.#playBuffer(a, 0, this.#musicBus, true);
    }
  }

  setVolumes(audio) {
    this.#volumes = { ...audio };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.#master.gain.setTargetAtTime(vol(audio.master), t, 0.03);
    this.#musicBus.gain.setTargetAtTime(vol(audio.music), t, 0.03);
    this.#sfxBus.gain.setTargetAtTime(vol(audio.sfx), t, 0.03);
  }

  #buildGraph() {
    const c = this.ctx;
    this.#master = c.createGain();
    const comp = c.createDynamicsCompressor();
    this.#sfxBus = c.createGain();
    this.#musicBus = c.createGain();
    this.#sfxBus.connect(this.#master);
    this.#musicBus.connect(this.#master);
    this.#master.connect(comp).connect(c.destination);
    this.setVolumes(this.#volumes);

    const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.#noise = buffer;
  }

  // ---------- primitivas ----------

  #tone({ freq, to = null, dur = 0.2, type = 'sine', gain = 0.15, delay = 0, attack = 0.005, bus = this.#sfxBus, filter = null }) {
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

  #noiseBurst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.1, delay = 0, sweepTo = null }) {
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
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.#sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  #arp(notes, { step = 0.09, dur = 0.25, type = 'triangle', gain = 0.12 } = {}) {
    notes.forEach((n, i) => this.#tone({ freq: mtof(n), dur, type, gain, delay: i * step }));
  }

  // ---------- efectos ----------

  sfx(name, arg = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const file = this.#files.get(name);
    if (file && name !== 'music' && name !== 'ambience') {
      this.#playBuffer(file, name === 'tick' || name === 'reelStop' || name === 'marksTick' ? arg : 0);
      return;
    }
    switch (name) {
      case 'hover': this.#tone({ freq: 1400, dur: 0.04, gain: 0.04 }); break;
      case 'click':
        this.#tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.12 });
        this.#tone({ freq: 780, dur: 0.09, gain: 0.07, delay: 0.02 });
        break;
      case 'back': this.#tone({ freq: 440, to: 300, dur: 0.12, type: 'triangle', gain: 0.1 }); break;
      case 'confirm': this.#arp([72, 76, 79], { step: 0.07, dur: 0.18 }); break;
      case 'error': this.#tone({ freq: 160, to: 110, dur: 0.2, type: 'sawtooth', gain: 0.08, filter: 600 }); break;
      case 'toast': this.#arp([83, 88], { step: 0.08, dur: 0.3, type: 'sine', gain: 0.08 }); break;
      case 'door':
        this.#tone({ freq: 95, to: 70, dur: 0.14, gain: 0.3 });
        this.#tone({ freq: 95, to: 70, dur: 0.14, gain: 0.3, delay: 0.16 });
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
      case 'buy':
        this.#tone({ freq: 1318, dur: 0.1, gain: 0.12 });
        this.#tone({ freq: 1760, dur: 0.3, gain: 0.12, delay: 0.08 });
        break;
      case 'unlock': this.#arp([81, 85, 88, 93], { step: 0.11, dur: 0.6, type: 'sine', gain: 0.1 }); break;
      case 'tutorial': this.#arp([76, 83, 88], { step: 0.08, dur: 0.35, type: 'sine', gain: 0.11 }); break;
      case 'marksTick': this.#tone({ freq: 1900 + (arg % 6) * 90, dur: 0.04, type: 'square', gain: 0.025 }); break;
      case 'step': this.#noiseBurst({ dur: 0.1, freq: 260, type: 'lowpass', gain: 0.05 }); break;
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
      case 'confetti':
        this.#noiseBurst({ dur: 0.15, freq: 1200, type: 'highpass', gain: 0.14 });
        this.#tone({ freq: 300, to: 900, dur: 0.18, type: 'triangle', gain: 0.1 });
        break;
      case 'sparkle': this.#arp([88, 91, 95, 100, 103], { step: 0.05, dur: 0.3, type: 'sine', gain: 0.06 }); break;
      case 'buyMachine':
        this.#tone({ freq: 1318, dur: 0.1, gain: 0.12 });
        this.#tone({ freq: 1760, dur: 0.12, gain: 0.12, delay: 0.07 });
        this.#tone({ freq: 2637, dur: 0.4, gain: 0.12, delay: 0.14 });
        this.#noiseBurst({ dur: 0.25, freq: 2500, sweepTo: 8000, type: 'bandpass', q: 3, gain: 0.06, delay: 0.1 });
        this.#arp([91, 96, 100], { step: 0.06, dur: 0.3, type: 'sine', gain: 0.06 });
        break;
      case 'objective': this.#arp([79, 84, 88, 91, 96], { step: 0.09, dur: 0.5, type: 'sine', gain: 0.1 }); break;
      case 'achievement':
        this.#arp([72, 79, 84, 88], { step: 0.1, dur: 0.45, gain: 0.12 });
        this.#tone({ freq: 70, to: 45, dur: 0.4, gain: 0.25 });
        break;
      case 'prestige': this.#tone({ freq: 1568, dur: 0.35, type: 'sine', gain: 0.08 }); this.#tone({ freq: 2093, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.06 }); break;
      default: break;
    }
  }

  // ---------- música y ambiente ----------

  startMusic() {
    if (!this.ctx || this.#musicOn) return;
    this.#musicOn = true;
    const t = this.ctx.currentTime;
    this.#nextChord = t + 0.1;
    this.#nextPluck = t + 3;
    this.#startAmbience();
    this.#musicTimer = setInterval(() => this.#scheduleMusic(), 250);
    this.#scheduleMusic();
    this.#swapLoops();
  }

  stopMusic() {
    this.#musicOn = false;
    clearInterval(this.#musicTimer);
    this.#musicTimer = null;
    try { this.#ambience?.stop(); } catch { /* ya parado */ }
    this.#ambience = null;
    for (const k of ['music', 'ambience']) {
      try { this.#fileLoop[k]?.stop(); } catch { /* ya parado */ }
      this.#fileLoop[k] = null;
    }
  }

  #startAmbience() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.#noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 520;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.035;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.#musicBus);
    src.start();
    lfo.start();
    this.#ambience = { stop: () => { src.stop(); lfo.stop(); } };
  }

  #scheduleMusic() {
    const c = this.ctx;
    if (!c || !this.#musicOn) return;
    while (this.#nextChord < c.currentTime + 1) {
      this.#playChord(CHORDS[this.#chordIndex % CHORDS.length], this.#nextChord);
      this.#chordIndex++;
      this.#nextChord += CHORD_SECONDS;
    }
    while (this.#nextPluck < c.currentTime + 0.5) {
      const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      this.#pluck(note, Math.max(this.#nextPluck, c.currentTime));
      this.#nextPluck += 1.4 + Math.random() * 2.6;
    }
  }

  #playChord(notes, t) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 780;
    lp.connect(this.#musicBus);
    const end = t + CHORD_SECONDS + 3;
    notes.forEach((m, i) => {
      for (const detune of [-7, 7]) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = mtof(m);
        osc.detune.value = detune;
        const peak = i === 0 ? 0.09 : 0.032;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 2.5);
        g.gain.setValueAtTime(peak, t + CHORD_SECONDS - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, end);
        osc.connect(g).connect(lp);
        osc.start(t);
        osc.stop(end + 0.1);
      }
    });
  }

  #pluck(midi, t) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = mtof(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc.connect(g).connect(this.#musicBus);
    osc.start(t);
    osc.stop(t + 2.3);
  }
}
