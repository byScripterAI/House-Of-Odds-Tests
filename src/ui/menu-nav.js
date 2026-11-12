import { el, uiSfx } from './ui-kit.js';

/**
 * Lista de opciones de los menús (principal y pausa): UNA sola opción seleccionada, que siguen por igual el ratón
 * y las flechas/WASD; sonido al cambiar; resaltado dorado que se desliza hasta la opción (y sigue su altura si
 * despliega una descripción); Intro/Espacio la activa.
 */
export class MenuNav {
  items = [];
  focus = 0;
  #nav;
  #glide;
  #isActive;

  /** @param {HTMLElement} nav  @param {() => boolean} isActive  si el menú está en pantalla y sin diálogos encima */
  constructor(nav, isActive) {
    this.#nav = nav;
    this.#isActive = isActive;
    this.#glide = el('div', 'mm__glide');
    nav.prepend(this.#glide);
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.track()) : null;
    window.addEventListener('keydown', (e) => {
      if (!this.#isActive()) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.move(1);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.move(-1);
      else if (e.code === 'Enter' || e.code === 'Space') {
        const b = this.items[this.focus];
        if (b && !b.disabled && document.activeElement?.tagName !== 'BUTTON') b.click();
        else return;
      } else return;
      e.preventDefault();
    });
  }

  /** Añade una opción (botón .mm-item). */
  add(b) {
    const i = this.items.length;
    b.addEventListener('mouseenter', () => this.set(i));
    b.addEventListener('focus', () => this.set(i, true));
    this.items.push(b);
    this.#nav.append(b);
    this.ro?.observe(b);
    return b;
  }

  move(dir) {
    const n = this.items.length;
    let i = this.focus;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!this.items[i].disabled) break;
    }
    this.set(i);
  }

  set(i, silent = false) {
    if (this.items[i]?.disabled) return;
    if (i !== this.focus && !silent) uiSfx('hover');
    this.focus = i;
    this.items.forEach((b, k) => b.classList.toggle('is-focus', k === i));
    // el foco del navegador (clic o Tab) no debe dejar un segundo botón «seleccionado»
    const active = document.activeElement;
    if (active?.classList?.contains('mm-item') && active !== this.items[i]) active.blur();
    this.track();
  }

  /** Coloca el resaltado sobre la opción seleccionada (la transición CSS hace el deslizamiento). */
  track() {
    const b = this.items[this.focus];
    if (!b || !b.offsetParent) return;
    this.#glide.style.transform = `translateY(${b.offsetTop}px)`;
    this.#glide.style.height = `${b.offsetHeight}px`;
    this.#glide.classList.add('is-on');
  }
}
