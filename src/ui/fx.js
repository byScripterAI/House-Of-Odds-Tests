import { el } from './ui-kit.js';

/**
 * EFECTOS DE PANTALLA («jugo»): confeti de papel y lámina dorada, fuegos artificiales, lluvia de fichas,
 * chispas, ondas, destellos, sacudida de cámara y rótulos de celebración. Todo en un canvas 2D transparente
 * sobre el juego (no toca la lógica ni el 3D). Paleta art déco del juego: oros, marfil, carmesí y negro.
 *
 *  - Confeti: rectángulos y tiras de papel con cara y envés (se ve el giro), aleteo lateral y caída frenada por
 *    el aire; los de lámina dorada destellan al ponerse de cara.
 *  - Fuegos: cohete con estela que sube y estalla en una esfera de chispas con rastro, crepitar y gravedad.
 *  - Sacudida: modelo de «trauma» con ruido suave (no saltos aleatorios por fotograma), con giro leve y
 *    un golpe inicial direccional; se suma si llegan varias.
 */

const PAPER = ['#d4af37', '#f6dc8c', '#b8862b', '#f0e7d8', '#c42240', '#8e1424', '#ffe9a8'];
const FIRE = [['#fff3cf', '#f6dc8c'], ['#ffd76a', '#d4af37'], ['#ff6a7e', '#c42240'], ['#ffffff', '#ffe9a8'], ['#ffb46a', '#e07a20']];
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export class Fx {
  #canvas;
  #ctx;
  #parts = [];
  #rockets = [];
  #rings = [];
  #flash = { color: '#fff', a: 0 };
  #trauma = 0;
  #traumaDecay = 1.6;
  #kick = { x: 0, y: 0 };
  #time = 0;
  #seed = [rand(0, 100), rand(0, 100), rand(0, 100)];
  #targets;
  #w = 1;
  #h = 1;
  #dpr = 1;
  #coinSprite = null;
  /** Se pueden desactivar sacudidas y destellos (accesibilidad) sin perder las partículas. */
  screenFx = true;
  /** Multiplicador de cantidad de partículas (calidad gráfica). */
  density = 1;

  constructor(root, shakeTargets) {
    this.#canvas = el('canvas', 'fx-canvas');
    this.#ctx = this.#canvas.getContext('2d');
    this.#targets = shakeTargets;
    root.append(this.#canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.#dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.#w = window.innerWidth;
    this.#h = window.innerHeight;
    this.#canvas.width = Math.round(this.#w * this.#dpr);
    this.#canvas.height = Math.round(this.#h * this.#dpr);
  }

  #push(p) {
    if (this.#parts.length < 1400) this.#parts.push(p);
  }

  /** Escala de tamaño según la pantalla (los efectos se ven igual en 720p y en 4K). */
  get #u() {
    return Math.max(0.7, Math.min(1.6, this.#h / 900));
  }

  // ------------------------------------------------------------------ confeti

  /** Ráfaga de confeti desde (x,y) (fracción de pantalla) en abanico hacia arriba. */
  confetti(count, x = 0.5, y = 0.62, spread = 1) {
    const n = Math.round(count * this.density);
    const u = this.#u;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-0.75, 0.75) * spread;
      const sp = rand(520, 1250) * u * Math.min(1.3, 0.7 + spread * 0.35);
      this.#paper(x * this.#w, y * this.#h, Math.cos(a) * sp, Math.sin(a) * sp);
    }
  }

  /** Dos cañones de confeti desde las esquinas inferiores, cruzándose. */
  cannons(count = 120) {
    const n = Math.round((count * this.density) / 2);
    const u = this.#u;
    for (const side of [0, 1]) {
      const x = side ? this.#w + 10 : -10;
      for (let i = 0; i < n; i++) {
        const a = side ? rand(-2.5, -1.95) : rand(-1.2, -0.64);
        const sp = rand(1000, 1900) * u;
        this.#paper(x, this.#h * rand(0.85, 1.02), Math.cos(a) * sp, Math.sin(a) * sp);
      }
    }
  }

  #paper(x, y, vx, vy) {
    const u = this.#u;
    const streamer = Math.random() < 0.18;
    const color = pick(PAPER);
    const foil = color === '#d4af37' || color === '#f6dc8c' || color === '#b8862b';
    this.#push({
      kind: 'paper', x, y, vx, vy,
      life: rand(3.2, 5.2), age: 0,
      w: (streamer ? rand(4, 6) : rand(7, 12)) * u,
      h: (streamer ? rand(22, 34) : rand(10, 16)) * u,
      rot: rand(0, TAU), vr: rand(-6, 6), // giro en el plano
      flip: rand(0, TAU), vf: rand(7, 15), // volteo (cara / envés)
      sway: rand(0, TAU), swayF: rand(2, 4), swayA: rand(30, 80) * u,
      color, back: shade(color, 0.55), foil,
      term: rand(90, 150) * u, // velocidad de caída límite (aire)
    });
  }

  // ------------------------------------------------------------------ fichas / monedas

  #coinImg() {
    if (this.#coinSprite) return this.#coinSprite;
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S * 0.38, S * 0.32, S * 0.05, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#fff3cf');
    g.addColorStop(0.45, '#e9c45a');
    g.addColorStop(1, '#8a6a1e');
    x.fillStyle = g;
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 1, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(90,60,10,0.9)';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 7, 0, TAU);
    x.stroke();
    // canto con muescas (ficha de casino)
    x.strokeStyle = 'rgba(255,245,215,0.85)';
    x.lineWidth = 4;
    for (let k = 0; k < 8; k++) {
      x.beginPath();
      x.arc(S / 2, S / 2, S / 2 - 3, (k / 8) * TAU, (k / 8) * TAU + 0.22);
      x.stroke();
    }
    x.fillStyle = 'rgba(90,60,10,0.85)';
    x.font = `700 ${S * 0.42}px Cinzel, serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('H', S / 2, S / 2 + 2);
    this.#coinSprite = c;
    return c;
  }

  /** Lluvia de fichas doradas desde arriba (con profundidad: las cercanas, más grandes y rápidas). */
  coins(count) {
    const n = Math.round(count * this.density);
    const u = this.#u;
    for (let i = 0; i < n; i++) {
      const depth = rand(0.45, 1.25);
      this.#push({ kind: 'coin', x: rand(0, this.#w), y: rand(-this.#h * 0.6, -20), vx: rand(-40, 40), vy: rand(80, 260) * depth, g: 1300 * depth, life: rand(2.4, 3.6), age: 0, size: rand(18, 30) * u * depth, rot: rand(0, TAU), vr: rand(5, 13), depth });
    }
  }

  // ------------------------------------------------------------------ chispas y fuegos

  /** Chispas radiales con estela. */
  sparks(count, x, y, color = '#ffd76a', power = 1) {
    const n = Math.round(count * this.density);
    const u = this.#u;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(160, 700) * power * u;
      this.#push({ kind: 'spark', x: x * this.#w, y: y * this.#h, px: x * this.#w, py: y * this.#h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 520, life: rand(0.45, 1.1), age: 0, size: rand(1.4, 2.8) * u, color, hot: '#fff6dc', drag: 0.955 });
    }
  }

  /** Fuego artificial: cohete desde abajo que estalla en (x,y). */
  firework(x = rand(0.2, 0.8), y = rand(0.16, 0.42), { color = null, size = 1 } = {}) {
    const [hot, col] = color ? ['#fff6dc', color] : pick(FIRE);
    const sx = x * this.#w + rand(-60, 60);
    const sy = this.#h + 10;
    const tx = x * this.#w;
    const ty = y * this.#h;
    const t = rand(0.7, 1.0);
    this.#rockets.push({ x: sx, y: sy, px: sx, py: sy, vx: (tx - sx) / t, vy: (ty - sy) / t - 0.5 * 600 * t, g: 600, t, age: 0, hot, col, size });
  }

  #explode(r) {
    const n = Math.round(rand(70, 110) * this.density * r.size);
    const u = this.#u * r.size;
    const ring = Math.random() < 0.3;
    for (let i = 0; i < n; i++) {
      // esfera: dirección uniforme proyectada (más densa en el borde, como un fuego real)
      const a = rand(0, TAU);
      const z = ring ? 0 : rand(-1, 1);
      const k = Math.sqrt(1 - z * z);
      const sp = (ring ? 420 : rand(330, 420)) * u;
      this.#push({ kind: 'spark', x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * k * sp, vy: Math.sin(a) * k * sp, g: 160, life: rand(1.1, 1.8), age: 0, size: rand(1.6, 2.6) * u, color: r.col, hot: r.hot, drag: 0.94, crackle: Math.random() < 0.35 });
    }
    // núcleo brillante
    this.#push({ kind: 'bloom', x: r.x, y: r.y, life: 0.35, age: 0, size: 140 * u, color: r.hot });
    this.flash(r.col, 0.06);
  }

  /** Onda expansiva (doble aro con brillo). */
  ring(x, y, color = '#ffd76a', size = 360) {
    this.#rings.push({ x: x * this.#w, y: y * this.#h, color, age: 0, life: 0.8, size: size * this.#u });
  }

  flash(color = '#ffe9a8', alpha = 0.35) {
    if (!this.screenFx) return;
    this.#flash = { color, a: Math.max(this.#flash.a, alpha) };
  }

  /**
   * Sacudida. `amp` en píxeles (intensidad) y `dur` en segundos. Se acumula como «trauma» y decae suave.
   * `dir` (radianes, opcional): golpe inicial en esa dirección.
   */
  shake(amp, dur = 0.25, dir = null) {
    if (!this.screenFx) return;
    const t = Math.min(1, amp / 26);
    this.#trauma = Math.min(1, Math.max(this.#trauma, t) + t * 0.25);
    this.#traumaDecay = 1 / Math.max(0.18, dur) * 0.85;
    const a = dir ?? rand(0, TAU);
    this.#kick.x += Math.cos(a) * amp * 0.6;
    this.#kick.y += Math.sin(a) * amp * 0.6;
  }

  // ------------------------------------------------------------------ rótulo de celebración

  /**
   * Rótulo central con el estilo de los menús (Cinzel dorado entre filetes, rótulo pequeño encima).
   * opts: kicker (texto pequeño de arriba), sub (línea de abajo), glow (color de acento), size, ms.
   */
  bigText(text, { glow = '#d4af37', size = 1, ms = 1800, kicker = '', sub = '' } = {}) {
    for (const old of this.#canvas.parentElement.querySelectorAll('.fx-card')) old.classList.add('is-replaced');
    const node = el('div', 'fx-card');
    node.style.setProperty('--fx-accent', glow);
    node.style.setProperty('--fx-size', String(size));
    node.style.setProperty('--fx-ms', `${ms}ms`);
    const top = el('div', 'fx-card__top');
    top.append(el('span', 'fx-card__rule'), el('span', 'fx-card__kicker', kicker || '◆'), el('span', 'fx-card__rule fx-card__rule--r'));
    const title = el('div', 'fx-card__title');
    // letra a letra para que entren escalonadas
    [...String(text)].forEach((ch, i) => {
      const s = el('span', 'fx-card__ch', ch === ' ' ? ' ' : ch);
      s.style.animationDelay = `${120 + i * 28}ms`;
      title.append(s);
    });
    node.append(el('div', 'fx-card__band'), top, title);
    if (sub) node.append(el('div', 'fx-card__sub', sub));
    node.append(el('span', 'fx-card__rule fx-card__rule--bottom'));
    this.#canvas.parentElement.append(node);
    setTimeout(() => node.remove(), ms + 600);
  }

  /** Celebración por nivel: 'small' | 'big' | 'jackpot' | 'buy' | 'objective' */
  celebrate(kind) {
    switch (kind) {
      case 'small':
        this.confetti(60, 0.5, 0.7, 0.9);
        this.flash('#ffe9a8', 0.12);
        this.shake(5, 0.22, Math.PI / 2);
        break;
      case 'big':
        this.cannons(200);
        this.coins(36);
        this.firework(0.3, 0.3);
        setTimeout(() => this.firework(0.7, 0.26), 380);
        this.flash('#ffe9a8', 0.24);
        this.shake(12, 0.45, Math.PI / 2);
        this.ring(0.5, 0.5, '#ffd76a');
        break;
      case 'jackpot':
        this.flash('#fff6dc', 0.55);
        this.shake(26, 1.2, Math.PI / 2);
        this.ring(0.5, 0.5, '#fff3cf', 720);
        this.cannons(320);
        this.coins(150);
        for (let i = 0; i < 9; i++) setTimeout(() => this.firework(rand(0.12, 0.88), rand(0.12, 0.4), { size: rand(0.9, 1.3) }), 200 + i * 330);
        for (let i = 1; i <= 3; i++) setTimeout(() => { this.cannons(120); this.shake(9, 0.3); }, i * 900);
        break;
      case 'buy':
        this.confetti(70, 0.5, 0.66, 1);
        this.firework(0.5, 0.28, { size: 0.8 });
        this.flash('#ffe9a8', 0.16);
        this.shake(6, 0.22, Math.PI / 2);
        break;
      case 'objective':
        this.confetti(80, 0.5, 0.42, 1.1);
        this.flash('#ffe9a8', 0.1);
        break;
      default:
    }
  }

  // ------------------------------------------------------------------ bucle

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.#time += dt;
    const ctx = this.#ctx;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);

    // cohetes
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.#rockets.length - 1; i >= 0; i--) {
      const r = this.#rockets[i];
      r.age += dt;
      r.px = r.x;
      r.py = r.y;
      r.vy += r.g * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      // estela de chispitas
      if (Math.random() < 0.8) this.#push({ kind: 'spark', x: r.x, y: r.y, px: r.x, py: r.y, vx: rand(-30, 30), vy: rand(20, 80), g: 300, life: rand(0.25, 0.5), age: 0, size: rand(1, 1.8) * this.#u, color: '#ffb46a', hot: '#fff1d0', drag: 0.9 });
      ctx.strokeStyle = r.hot;
      ctx.lineWidth = 2.2 * this.#u;
      ctx.beginPath();
      ctx.moveTo(r.px, r.py);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      if (r.age >= r.t) {
        this.#rockets.splice(i, 1);
        this.#explode(r);
      }
    }

    // partículas
    for (let i = this.#parts.length - 1; i >= 0; i--) {
      const p = this.#parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > this.#h + 80) {
        this.#parts.splice(i, 1);
        continue;
      }
      const fade = Math.min(1, (p.life - p.age) / 0.6);
      if (p.kind === 'paper') {
        ctx.globalCompositeOperation = 'source-over';
        // aire: frena el impulso y deja una caída lenta con aleteo
        // el impulso del cañón dura un instante; luego manda el aire
        const air = p.age < 0.45 ? 0.8 : 2.4;
        p.vy += 760 * dt;
        p.vx *= Math.exp(-dt * air);
        p.vy *= Math.exp(-dt * air * 0.6);
        if (p.vy > p.term) p.vy += (p.term - p.vy) * Math.min(1, dt * 6);
        p.sway += p.swayF * dt;
        p.x += (p.vx + Math.cos(p.sway) * p.swayA * (p.vy > 0 ? 1 : 0.2)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        const c = Math.cos(p.flip);
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.max(0.08, Math.abs(c)));
        ctx.fillStyle = c >= 0 ? p.color : p.back;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        // lámina dorada: destello al ponerse de cara
        if (p.foil && c > 0.93) {
          ctx.fillStyle = 'rgba(255,250,230,0.85)';
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
        continue;
      }
      if (p.kind === 'coin') {
        ctx.globalCompositeOperation = 'source-over';
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const sx = Math.cos(p.rot);
        ctx.globalAlpha = fade * Math.min(1, 0.55 + p.depth * 0.45);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(Math.max(0.12, Math.abs(sx)), 1);
        ctx.drawImage(this.#coinImg(), -p.size / 2, -p.size / 2, p.size, p.size);
        // canto oscuro cuando se ve de lado
        if (Math.abs(sx) < 0.3) {
          ctx.fillStyle = '#6a4c12';
          ctx.fillRect(-p.size * 0.12, -p.size / 2, p.size * 0.24, p.size);
        }
        ctx.restore();
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      if (p.kind === 'bloom') {
        const k = p.age / p.life;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + k));
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
        continue;
      }
      // chispa con estela (línea desde la posición anterior)
      p.px = p.x;
      p.py = p.y;
      p.vy += p.g * dt;
      const dr = p.drag ** (dt * 60);
      p.vx *= dr;
      p.vy *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.age / p.life;
      let a = fade;
      if (p.crackle && k > 0.55) a *= Math.random() < 0.5 ? 1.4 : 0.15; // crepitar al final
      ctx.globalAlpha = Math.min(1, a);
      ctx.strokeStyle = k < 0.25 ? p.hot : p.color;
      ctx.lineWidth = p.size * (1 - k * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.px - p.vx * dt * 2.5, p.py - p.vy * dt * 2.5);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ondas
    for (let i = this.#rings.length - 1; i >= 0; i--) {
      const r = this.#rings[i];
      r.age += dt;
      if (r.age >= r.life) {
        this.#rings.splice(i, 1);
        continue;
      }
      const k = r.age / r.life;
      const rad = r.size * (1 - (1 - k) ** 3);
      ctx.globalAlpha = (1 - k) ** 1.5 * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad * 0.86, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // destello (viñeta de luz)
    if (this.#flash.a > 0.003) {
      const g = ctx.createRadialGradient(this.#w / 2, this.#h / 2, this.#h * 0.1, this.#w / 2, this.#h / 2, this.#h * 0.95);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, this.#flash.color);
      ctx.globalAlpha = Math.min(1, this.#flash.a);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.#w, this.#h);
      ctx.globalAlpha = 1;
      this.#flash.a *= 0.0015 ** dt;
    }

    // sacudida: ruido suave por trauma² + golpe inicial que se amortigua
    let tx = '';
    this.#kick.x *= Math.exp(-dt * 14);
    this.#kick.y *= Math.exp(-dt * 14);
    if (this.#trauma > 0.001 || Math.abs(this.#kick.x) + Math.abs(this.#kick.y) > 0.2) {
      this.#trauma = Math.max(0, this.#trauma - this.#traumaDecay * dt);
      const s = this.#trauma * this.#trauma;
      const t = this.#time;
      const [a, b, c] = this.#seed;
      const n = (o, f) => Math.sin(t * f + o) * 0.6 + Math.sin(t * f * 2.13 + o * 1.7) * 0.3 + Math.sin(t * f * 4.7 + o * 0.3) * 0.1;
      const max = 28 * this.#u;
      const x = n(a, 31) * max * s + this.#kick.x;
      const y = n(b, 27) * max * s + this.#kick.y;
      const rot = n(c, 19) * 1.6 * s;
      tx = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
    }
    for (const el2 of this.#targets) if (el2.style.transform !== tx) el2.style.transform = tx;
  }
}
