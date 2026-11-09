import { GAME } from '../config.js';
import { Screen, button, el } from './ui-kit.js';

/** Menú principal. Los botones solo llaman a los manejadores recibidos. */
export class MainMenu extends Screen {
  #continueBtn;
  #foot;
  #footText = `v${GAME.version}`;

  /** @param {{onContinue:Function,onNew:Function,onSettings:Function,onCredits:Function}} h */
  constructor(h) {
    super('menu-screen');
    const logo = el('h1', 'menu__logo');
    logo.append('HOUSE ', el('span', 'menu__logo-of', 'OF'), ' ODDS');

    const nav = el('nav', 'menu__nav');
    this.#continueBtn = button('CONTINUAR', h.onContinue, { disabled: true });
    nav.append(
      this.#continueBtn,
      button('NUEVA PARTIDA', h.onNew),
      button('AJUSTES', h.onSettings),
      button('CRÉDITOS', h.onCredits),
    );

    const wrap = el('div', 'menu');
    wrap.append(
      logo,
      nav,
      (this.#foot = el('p', 'menu__foot', this.#footText)),
    );
    this.el.append(wrap);
  }

  /** Línea inferior: aviso temporal (p. ej. copia de seguridad restaurada). Sin texto → vuelve a la versión. */
  setNotice(text) {
    this.#foot.textContent = text || this.#footText;
  }

  setCanContinue(can) {
    this.#continueBtn.disabled = !can;
    this.#continueBtn.title = can ? '' : 'No hay ninguna partida guardada';
  }
}
