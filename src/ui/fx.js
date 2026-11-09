import { el } from './ui-kit.js';

/**
 * Efectos de pantalla ("jugo"): confeti, monedas, chispas, anillos, destellos,
 * sacudida de pantalla y textos gigantes. Todo en un canvas 2D transparente
 * sobre el juego; no toca la lógica ni el 3D.
 */

const COLORS = ['#ffd76a', '#f3dc8a', '#ff3b5c', '#ffffff', '#ff9a3c', '#58e6ff', '#c58bff'];
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Fx {
  #canvas;
  #ctx;
  #parts = [];
  #rings = [];
  #flash = { color: '#fff', a: 0 };
  #shake = { amp: 0, t: 0, dur: 0.001 };
  #targets;
  #w = 1;
  #h = 1;
  #dpr = 1;
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
    if (this.#parts.length < 900) this.#parts.push(p);
  }

  /** Confeti que sale de (x,y) (fracción 0-1 de pantalla) en abanico hacia arriba y cae. */
  confetti(count, x = 0.5, y = 0.62, spread = 1) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2) * spread;
      const sp = rand(300, 1100) * Math.min(1.4, 0.6 + spread * 0.5);
      this.#push({ kind: 'confetti', x: x * this.#w, y: y * this.#h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, life: rand(1.6, 3), age: 0, size: rand(6, 13), rot: rand(0, TAU), vr: rand(-12, 12), color: pick(COLORS), drag: 0.985 });
    }
  }

  /** Lluvia de monedas desde arriba. */
  coins(count) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      this.#push({ kind: 'coin', x: rand(0, this.#w), y: rand(-this.#h * 0.4, -10), vx: rand(-60, 60), vy: rand(100, 400), g: 1100, life: rand(2, 3.2), age: 0, size: rand(12, 22), rot: rand(0, TAU), vr: rand(4, 12), color: '#ffd76a', drag: 1 });
    }
  }

  /** Chispas radiales. */
  sparks(count, x, y, color = '#ffd76a', power = 1) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(120, 620) * power;
      this.#push({ kind: 'spark', x: x * this.#w, y: y * this.#h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 400, life: rand(0.4, 1), age: 0, size: rand(2, 5), color, drag: 0.96 });
    }
  }

  /** Anillo expansivo. */
  ring(x, y, color = '#ffd76a', size = 360) {
    this.#rings.push({ x: x * this.#w, y: y * this.#h, color, age: 0, life: 0.7, size });
  }

  flash(color = '#ffe9a8', alpha = 0.35) {
    if (!this.screenFx) return;
    this.#flash = { color, a: Math.max(this.#flash.a, alpha) };
  }

  /** Sacudida de pantalla: amp en píxeles, dur en segundos. */
  shake(amp, dur = 0.25) {
    if (!this.screenFx) return;
    if (amp >= this.#shake.amp * (this.#shake.t / this.#shake.dur)) this.#shake = { amp, t: dur, dur };
  }

  /** Texto gigante central que revienta y se desvanece. */
  bigText(text, { color = '#fff3b0', glow = '#d4af37', size = 1, ms = 1800 } = {}) {
    const node = el('div', 'fx-bigtext', text);
    node.style.setProperty('--fx-color', color);
    node.style.setProperty('--fx-glow', glow);
    node.style.setProperty('--fx-size', String(size));
    node.style.animationDuration = `${ms}ms`;
    this.#canvas.parentElement.append(node);
    setTimeout(() => node.remove(), ms + 100);
  }

  /** Celebración por nivel: 'small' | 'big' | 'jackpot' | 'buy' | 'objective' */
  celebrate(kind) {
    switch (kind) {
      case 'small': this.confetti(70, 0.5, 0.65); this.flash('#ffe9a8', 0.18); this.shake(5, 0.2); break;
      case 'big':
        this.confetti(180, 0.5, 0.65, 1.3); this.coins(40); this.flash('#ffe9a8', 0.3); this.shake(12, 0.4);
        this.ring(0.5, 0.55, '#ffd76a');
        break;
      case 'jackpot':
        this.flash('#ffffff', 0.6); this.shake(26, 1.1);
        this.ring(0.5, 0.55, '#ffffff', 700);
        this.confetti(320, 0.5, 0.65, 1.6); this.coins(160);
        for (let i = 1; i <= 5; i++) {
          setTimeout(() => {
            this.confetti(150, rand(0.15, 0.85), rand(0.5, 0.8), 1.4);
            this.sparks(40, rand(0.2, 0.8), rand(0.2, 0.6), pick(COLORS), 1.4);
            this.ring(rand(0.2, 0.8), rand(0.3, 0.6), pick(COLORS), 420);
            this.shake(10, 0.25);
          }, i * 480);
        }
        break;
      case 'buy': this.confetti(60, 0.5, 0.6); this.flash('#ffe9a8', 0.22); this.shake(7, 0.18); break;
      case 'objective': this.confetti(90, 0.5, 0.3, 1.2); this.flash('#ff9aa8', 0.18); break;
      default:
    }
  }

  update(dt) {
    const ctx = this.#ctx;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);

    // partículas
    for (let i = this.#parts.length - 1; i >= 0; i--) {
      const p = this.#parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > this.#h + 60) { this.#parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= p.drag ** (dt * 60);
      p.vy *= p.kind === 'confetti' ? 0.985 ** (dt * 60) : 1;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fade = Math.min(1, (p.life - p.age) / 0.4);
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      if (p.kind === 'confetti') {
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.sin(p.rot * 1.7)) * 0.9 + 0.1);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'coin') {
        p.rot += p.vr * dt;
        const sx = Math.abs(Math.cos(p.rot));
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.5 * Math.max(0.15, sx), p.size * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#a67c00';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;

    // anillos
    for (let i = this.#rings.length - 1; i >= 0; i--) {
      const r = this.#rings[i];
      r.age += dt;
      if (r.age >= r.life) { this.#rings.splice(i, 1); continue; }
      const k = r.age / r.life;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.size * (1 - (1 - k) ** 3), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // destello de pantalla
    if (this.#flash.a > 0.003) {
      const g = ctx.createRadialGradient(this.#w / 2, this.#h / 2, this.#h * 0.15, this.#w / 2, this.#h / 2, this.#h * 0.95);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      ctx.globalAlpha = Math.min(1, this.#flash.a);
      g.addColorStop(1, this.#flash.color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.#w, this.#h);
      ctx.globalAlpha = 1;
      this.#flash.a *= 0.001 ** dt; // decae rápido
    }

    // sacudida
    const s = this.#shake;
    let tx = '';
    if (s.t > 0) {
      s.t = Math.max(0, s.t - dt);
      const k = (s.t / s.dur) ** 2;
      tx = `translate(${rand(-1, 1) * s.amp * k}px, ${rand(-1, 1) * s.amp * k}px) rotate(${rand(-1, 1) * s.amp * k * 0.05}deg)`;
    }
    for (const t of this.#targets) if (t.style.transform !== tx) t.style.transform = tx;
  }
}
