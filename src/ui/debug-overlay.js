import * as THREE from 'three';
import { GAME, QUALITY_ORDER } from '../config.js';

/**
 * Overlay de diagnóstico para desarrollo.
 *   F3  mostrar / ocultar
 *   F4  (con el overlay visible) rotar la calidad low → medium → high
 *
 * Lee del Game; no escribe nada salvo pedir el cambio de calidad.
 */
export class DebugOverlay {
  #game;
  #el;
  #timer = null;

  constructor({ root, game }) {
    this.#game = game;
    this.#el = document.createElement('pre');
    this.#el.className = 'debug-overlay';
    this.#el.hidden = true;
    root.append(this.#el);
    window.addEventListener('keydown', this.#onKey);
  }

  get visible() {
    return !this.#el.hidden;
  }

  toggle(force = this.#el.hidden) {
    this.#el.hidden = !force;
    if (force) {
      this.#refresh();
      this.#timer = setInterval(() => this.#refresh(), 250);
    } else if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.#onKey);
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#el.remove();
  }

  #onKey = (event) => {
    if (event.repeat) return;
    if (event.code === 'F3') {
      event.preventDefault();
      this.toggle();
    } else if (event.code === 'F4' && this.visible) {
      event.preventDefault();
      const game = this.#game;
      const index = QUALITY_ORDER.indexOf(game.renderer.settings.quality);
      game.setQuality(QUALITY_ORDER[(index + 1) % QUALITY_ORDER.length]);
      this.#refresh();
    }
  };

  #refresh() {
    const { renderer, loop, state } = this.#game;
    if (!renderer || !loop) return;

    const { settings, size, info } = renderer;
    const mark = (flag) => (flag ? 'sí' : 'no');
    const aa = renderer.antialiasNeedsRestart
      ? `${mark(settings.antialias)} (requiere reiniciar el renderizador)`
      : mark(settings.antialias);

    this.#el.textContent = [
      `${GAME.name} v${GAME.version} · three r${THREE.REVISION}`,
      `estado      ${state.current}`,
      `fps         ${loop.fps.toFixed(1)}  (${loop.frameMs.toFixed(1)} ms)`,
      `calidad     ${settings.quality}   [F4 cambia]`,
      `sombras     ${mark(settings.shadows)}   post ${['bloom', 'ao', 'smaa'].filter((k) => settings.post[k]).join('+') || 'off'}`,
      `antialias   ${aa}`,
      `resolución  ${size.width}×${size.height} @ ${size.pixelRatio.toFixed(2)}x`,
      `draw calls  ${info.render.calls}`,
      `triángulos  ${info.render.triangles}`,
      `geometrías  ${info.memory.geometries}   texturas ${info.memory.textures}`,
      `contexto    ${renderer.contextLost ? 'PERDIDO' : 'ok'}`,
    ].join('\n');
  }
}
