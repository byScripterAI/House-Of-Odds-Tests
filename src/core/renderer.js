import * as THREE from 'three';
import { PALETTE, resolveGraphics } from '../config.js';
import { WebGLUnavailableError } from './errors.js';

/**
 * Envoltorio del WebGLRenderer de Three.js.
 *
 * Responsabilidades: crear el contexto, aplicar los ajustes gráficos EFECTIVOS
 * (perfil de calidad + interruptores), mantener el tamaño del canvas y avisar
 * de pérdida/recuperación de contexto.
 *
 * Eventos emitidos en el bus:
 *   renderer:resize        { width, height, aspect, pixelRatio }
 *   graphics:changed       { settings, antialiasNeedsRestart }
 *   renderer:contextlost
 *   renderer:contextrestored
 *
 * Limitación conocida: `antialias` es un atributo del contexto WebGL y NO se
 * puede cambiar con el contexto ya creado. Si cambia, `antialiasNeedsRestart`
 * será true y habrá que recrear el renderizador (Fase 6).
 */
export class GameRenderer {
  /** @type {THREE.WebGLRenderer} */
  webgl;
  settings;
  contextLost = false;
  size = { width: 1, height: 1, aspect: 1, pixelRatio: 1 };

  #canvas;
  #bus;
  #contextAntialias;

  constructor({ canvas, graphics, bus = null }) {
    this.#canvas = canvas;
    this.#bus = bus;
    this.settings = resolveGraphics(graphics);
    this.#contextAntialias = this.settings.antialias;

    try {
      this.webgl = new THREE.WebGLRenderer({
        canvas,
        antialias: this.#contextAntialias,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      throw new WebGLUnavailableError(error);
    }

    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.0;
    this.webgl.setClearColor(PALETTE.black, 1);
    // PCFSoftShadowMap está retirado desde three r186; PCFShadowMap es el tipo suave estándar.
    this.webgl.shadowMap.type = THREE.PCFShadowMap;
    this.webgl.shadowMap.enabled = this.settings.shadows;

    canvas.addEventListener('webglcontextlost', this.#onContextLost);
    canvas.addEventListener('webglcontextrestored', this.#onContextRestored);
    window.addEventListener('resize', this.#onResize);

    this.resize();
  }

  /** Aplica ajustes gráficos nuevos. Devuelve si el antialiasing requiere recrear el contexto. */
  apply(graphics) {
    this.settings = resolveGraphics(graphics);
    this.webgl.shadowMap.enabled = this.settings.shadows;
    this.resize();
    const antialiasNeedsRestart = this.settings.antialias !== this.#contextAntialias;
    this.#bus?.emit('graphics:changed', { settings: this.settings, antialiasNeedsRestart });
    return { antialiasNeedsRestart };
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelRatio =
      Math.min(window.devicePixelRatio || 1, this.settings.pixelRatioCap) * this.settings.renderScale;

    this.webgl.setPixelRatio(pixelRatio);
    this.webgl.setSize(width, height, false); // el tamaño CSS lo fija main.css
    this.size = { width, height, aspect: width / height, pixelRatio };
    this.#bus?.emit('renderer:resize', this.size);
  }

  render(scene, camera) {
    if (this.contextLost) return;
    this.webgl.render(scene, camera);
  }

  get info() {
    return this.webgl.info;
  }

  get antialiasNeedsRestart() {
    return this.settings.antialias !== this.#contextAntialias;
  }

  dispose() {
    this.#canvas.removeEventListener('webglcontextlost', this.#onContextLost);
    this.#canvas.removeEventListener('webglcontextrestored', this.#onContextRestored);
    window.removeEventListener('resize', this.#onResize);
    this.webgl.dispose();
  }

  #onResize = () => this.resize();

  #onContextLost = (event) => {
    event.preventDefault(); // permite que el navegador intente restaurar el contexto
    this.contextLost = true;
    console.warn('[Renderer] Contexto WebGL perdido; esperando recuperación…');
    this.#bus?.emit('renderer:contextlost');
  };

  #onContextRestored = () => {
    this.contextLost = false;
    console.info('[Renderer] Contexto WebGL restaurado.');
    this.#bus?.emit('renderer:contextrestored');
  };
}
