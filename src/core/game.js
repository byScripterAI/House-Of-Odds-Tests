import { DEFAULT_SETTINGS, QUALITY_ORDER } from '../config.js';
import { EventBus } from './event-bus.js';
import { StateMachine } from './state-machine.js';
import { STATES, TRANSITIONS } from './game-states.js';
import { GameLoop } from './loop.js';
import { GameRenderer } from './renderer.js';
import { Rng } from './rng.js';

/**
 * Orquestador del juego. Posee los servicios del núcleo y nada más:
 *
 *   bus       EventBus compartido
 *   state     StateMachine de alto nivel (boot, menú, explorar, interactuar, pausa)
 *   renderer  GameRenderer
 *   loop      GameLoop
 *   rng       Rng con semilla
 *   settings  ajustes en memoria (el guardado llega en la Fase 7)
 *
 * "Controlador de escena": objeto con la forma
 *   { scene: THREE.Scene, camera: THREE.Camera,
 *     update(dt, time), onResize?(size), onGraphicsChanged?(settings), dispose?() }
 * El mundo del casino (Fase 3) y cualquier escena de prueba implementan esa forma;
 * Game solo sabe actualizarlo y renderizarlo.
 *
 * Dependencias: core → config. Game NO importa nada de ui/, audio/ ni systems/;
 * esos módulos se suscriben al bus o reciben `game` por parámetro.
 */
export class Game {
  bus = new EventBus();
  state = new StateMachine({ transitions: TRANSITIONS, initial: STATES.BOOT, bus: this.bus });
  rng = new Rng();
  settings;
  renderer = null;
  loop = null;
  controller = null;
  time = 0;

  #canvas;
  #unsubscribers = [];

  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {object} [options.settings] copia mutable de DEFAULT_SETTINGS
   */
  constructor({ canvas, settings = structuredClone(DEFAULT_SETTINGS) }) {
    this.#canvas = canvas;
    this.settings = settings;
  }

  /**
   * Crea renderizador y bucle. Puede lanzar WebGLUnavailableError.
   * @param {{onProgress?: (fraction: number, message: string) => Promise<void>|void}} [options]
   */
  async init({ onProgress = () => {} } = {}) {
    await onProgress(0.2, 'boot.renderer');
    this.renderer = new GameRenderer({
      canvas: this.#canvas,
      graphics: this.settings.graphics,
      bus: this.bus,
    });

    this.#unsubscribers.push(
      this.bus.on('renderer:resize', (size) => this.controller?.onResize?.(size)),
      this.bus.on('graphics:changed', ({ settings }) => this.controller?.onGraphicsChanged?.(settings)),
    );

    await onProgress(0.6, 'boot.loop');
    this.loop = new GameLoop({
      update: (dt) => this.#update(dt),
      render: () => this.#render(),
      onError: (error) => this.fail(error),
    });

    await onProgress(1, 'boot.ready');
  }

  start() {
    if (!this.loop) throw new Error('Game.start() llamado antes de init()');
    this.loop.start();
  }

  /** Sustituye la escena activa (liberando la anterior). */
  setScene(controller) {
    const previous = this.controller;
    this.controller = controller;
    controller.onResize?.(this.renderer.size);
    controller.onGraphicsChanged?.(this.renderer.settings);
    if (previous && previous !== controller) previous.dispose?.();
  }

  /** Cambia el nivel de calidad (low → medium → high). */
  setQuality(tier) {
    if (!QUALITY_ORDER.includes(tier)) throw new RangeError(`Calidad desconocida: ${tier}`);
    this.settings.graphics.quality = tier;
    return this.renderer.apply(this.settings.graphics);
  }

  /** Error irrecuperable: detiene el bucle y lo notifica (la UI decide cómo mostrarlo). */
  fail(error) {
    console.error('[Game] Error fatal:', error);
    this.loop?.stop();
    this.bus.emit('game:fatal', error);
  }

  dispose() {
    this.loop?.stop();
    this.controller?.dispose?.();
    this.controller = null;
    for (const off of this.#unsubscribers) off();
    this.#unsubscribers.length = 0;
    this.renderer?.dispose();
    this.renderer = null;
    this.bus.clear();
  }

  #update(dt) {
    this.time += dt;
    this.state.update(dt);
    this.controller?.update(dt, this.time);
  }

  #render() {
    if (this.controller) this.renderer.render(this.controller.scene, this.controller.camera, this.loop?.frameMs ? this.loop.frameMs / 1000 : 0.016);
  }
}
