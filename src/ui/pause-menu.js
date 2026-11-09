import { Screen, button, el } from './ui-kit.js';

/** Menú de pausa (ESC). */
export class PauseMenu extends Screen {
  #status;

  /** @param {{onResume:Function,onSettings:Function,onSave:Function,onQuit:Function}} h */
  constructor(h) {
    super('menu-screen menu-screen--pause');
    const nav = el('nav', 'menu__nav');
    nav.append(
      button('CONTINUAR', h.onResume, { cls: 'btn--primary' }),
      button('AJUSTES', h.onSettings),
      button('GUARDAR PARTIDA', h.onSave),
      button('VOLVER AL MENÚ PRINCIPAL', h.onQuit),
    );
    this.#status = el('p', 'menu__foot', '');
    const wrap = el('div', 'menu');
    wrap.append(el('h1', 'menu__title', 'PAUSA'), nav, this.#status);
    this.el.append(wrap);
  }

  setStatus(text) {
    this.#status.textContent = text;
  }
}
