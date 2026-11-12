import { MAIN_CREDITS } from '../data/credits.js';
import { t } from '../i18n/index.js';
import { Screen, button, el, uiSfx } from './ui-kit.js';

const SPEED = 0.085; // alturas de pantalla por segundo
const FAST = 4; // multiplicador al mantener Espacio / clic

/**
 * Créditos que suben/bajan por la pantalla con distintos tamaños y colores.
 * Botón superior para volver; al terminar solos también vuelven (onClose).
 * Sirve para los créditos del menú y para los finales (se le pasa otro contenido).
 */
export class CreditsScreen extends Screen {
  #track;
  #onClose = null;
  #raf = 0;
  #y = 0;
  #last = 0;
  #fast = false;
  #sparkle;

  constructor() {
    super('screen--credits');
    this.#track = el('div', 'rolling');
    this.#sparkle = el('div', 'rolling-sparkle');
    const back = button(() => t('credits.back'), () => this.close(), { cls: 'credits__back' });
    this.el.append(this.#sparkle, this.#track, back);
    this.el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) this.#fast = true; });
    window.addEventListener('pointerup', () => { this.#fast = false; });
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && this.visible) { e.preventDefault(); this.#fast = true; } });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.#fast = false; });
  }

  #build(blocks) {
    this.#track.replaceChildren();
    for (const b of blocks) {
      const node = el('div', `rolling__${b.t}`, b.k ? () => t(b.k) : (b.v ?? ''));
      if (b.color) node.style.setProperty('--c', b.color);
      this.#track.append(node);
    }
  }

  /** @param {() => void} onClose  @param {{blocks?: Array}} [opts] */
  open(onClose, { blocks = MAIN_CREDITS } = {}) {
    this.#onClose = onClose;
    this.#build(blocks);
    this.show();
    this.#y = window.innerHeight;
    this.#track.style.transform = `translate3d(0, ${this.#y}px, 0)`;
    this.#last = performance.now();
    cancelAnimationFrame(this.#raf);
    const tick = (now) => {
      const dt = Math.min(0.1, (now - this.#last) / 1000);
      this.#last = now;
      this.#y -= window.innerHeight * SPEED * (this.#fast ? FAST : 1) * dt;
      this.#track.style.transform = `translate3d(0, ${this.#y}px, 0)`;
      if (this.#y + this.#track.offsetHeight < 0) this.close(true);
      else this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  close(finished = false) {
    if (!this.visible) return;
    cancelAnimationFrame(this.#raf);
    this.hide();
    if (!finished) uiSfx('back');
    this.#onClose?.(finished);
  }
}
