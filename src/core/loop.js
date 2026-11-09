/**
 * Bucle principal con requestAnimationFrame.
 *
 * - dt en segundos, limitado a `maxDelta` para que volver de una pestaña en
 *   segundo plano (o un tirón) no provoque saltos de física/animación.
 * - Mide FPS suavizados para el overlay de depuración.
 * - Si update/render lanzan, el bucle se detiene y se notifica por `onError`
 *   (evita inundar la consola con el mismo error 60 veces por segundo).
 * - El planificador es inyectable para poder probarlo sin navegador.
 */
export class GameLoop {
  #update;
  #render;
  #onError;
  #request;
  #cancel;
  #maxDelta;
  #running = false;
  #handle = null;
  #last = 0;

  fps = 0;
  frameMs = 0;

  /**
   * @param {object} options
   * @param {(dt: number) => void} options.update
   * @param {(dt: number) => void} options.render
   * @param {(error: unknown) => void} [options.onError]
   * @param {number} [options.maxDelta]
   * @param {{request: Function, cancel: Function}} [options.scheduler]
   */
  constructor({ update, render, onError = null, maxDelta = 0.1, scheduler = null }) {
    this.#update = update;
    this.#render = render;
    this.#onError = onError ?? ((error) => console.error('[GameLoop]', error));
    this.#maxDelta = maxDelta;
    this.#request = scheduler?.request ?? ((cb) => requestAnimationFrame(cb));
    this.#cancel = scheduler?.cancel ?? ((id) => cancelAnimationFrame(id));
  }

  get running() {
    return this.#running;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = 0; // el primer frame fija la referencia de tiempo (dt = 0)
    this.#handle = this.#request(this.#tick);
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    if (this.#handle !== null) this.#cancel(this.#handle);
    this.#handle = null;
  }

  #tick = (now) => {
    if (!this.#running) return;
    this.#handle = this.#request(this.#tick);

    const rawDt = this.#last === 0 ? 0 : (now - this.#last) / 1000;
    this.#last = now;
    const dt = Math.min(Math.max(rawDt, 0), this.#maxDelta);

    if (rawDt > 0) {
      const instantFps = 1 / rawDt;
      this.fps = this.fps === 0 ? instantFps : this.fps * 0.9 + instantFps * 0.1;
      this.frameMs = this.frameMs === 0 ? rawDt * 1000 : this.frameMs * 0.9 + rawDt * 1000 * 0.1;
    }

    try {
      this.#update(dt);
      this.#render(dt);
    } catch (error) {
      this.stop();
      this.#onError(error);
    }
  };
}
