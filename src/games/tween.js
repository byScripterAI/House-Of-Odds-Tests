/**
 * Interpolaciones mínimas para las animaciones de mesa (tiempo de juego: avanzan con update(dt),
 * así nunca se desincronizan aunque los FPS bajen).
 */

export const ease = {
  linear: (x) => x,
  out: (x) => 1 - (1 - x) ** 3,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  back: (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2,
};

export class Tweens {
  #list = [];

  /**
   * @param {number} duration segundos
   * @param {(k:number, raw:number) => void} step recibe el progreso con curva (k) y sin ella (raw)
   * @param {{delay?: number, curve?: (x:number)=>number, done?: Function}} [o]
   */
  add(duration, step, { delay = 0, curve = ease.out, done = null } = {}) {
    const tw = { t: -delay, d: Math.max(0.0001, duration), step, curve, done, started: false };
    this.#list.push(tw);
    return tw;
  }

  /** Espera (sin animar nada). */
  wait(seconds, done) {
    return this.add(seconds, () => {}, { curve: ease.linear, done });
  }

  get busy() {
    return this.#list.length > 0;
  }

  clear() {
    this.#list = [];
  }

  update(dt) {
    if (!this.#list.length) return;
    const finished = [];
    for (const tw of this.#list) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const raw = Math.min(1, tw.t / tw.d);
      tw.step(tw.curve(raw), raw);
      if (raw >= 1) finished.push(tw);
    }
    if (!finished.length) return;
    this.#list = this.#list.filter((x) => !finished.includes(x));
    for (const tw of finished) tw.done?.();
  }
}
