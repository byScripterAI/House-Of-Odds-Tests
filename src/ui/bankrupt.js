import { t } from '../i18n/index.js';
import { Screen, button, el } from './ui-kit.js';

/**
 * BANCA ROTA: pantalla final cuando ya no puedes apostar.
 * Sistema de diseño 2.0: rótulo «FIN DE LA PARTIDA», título carmesí que se enfoca, filete, resumen
 * de la partida en tres cifras y fichas que caen y se apagan. El guardado ya se ha borrado cuando
 * aparece; el único camino es volver al menú principal y empezar de nuevo.
 */
export class BankruptScreen extends Screen {
  #cells;
  #onMenu;

  /** @param {{onMenu: Function}} h */
  constructor(h) {
    super('screen--bankrupt');
    this.#onMenu = h.onMenu;
    const wrap = el('div', 'bankrupt');
    const chips = el('div', 'bankrupt__chips');
    for (let i = 0; i < 7; i++) {
      const c = el('span', 'bankrupt__chip');
      c.style.setProperty('--i', String(i));
      c.style.setProperty('--x', `${(i - 3) * 13 + (i % 2 ? 4 : -3)}vw`);
      chips.append(c);
    }
    const title = el('h1', 'bankrupt__title');
    title.append(el('span', 'bankrupt__title-text', () => t('bankrupt.title')));
    const stats = el('div', 'pm-stats bankrupt__stats');
    this.#cells = ['spins', 'best', 'prestige'].map((k) => {
      const cell = el('div', 'pm-stat');
      const value = el('b', '', '0');
      cell.append(value, el('span', '', () => (k === 'spins' ? t('ui.pause.spins') : k === 'best' ? t('ui.bankrupt.best') : 'PRESTIGE')));
      stats.append(cell);
      return value;
    });
    wrap.append(
      el('div', 'ui-kicker bankrupt__kicker', () => t('ui.bankrupt.kicker')),
      title,
      el('div', 'bankrupt__rule'),
      el('p', 'bankrupt__text', () => t('bankrupt.text')),
      stats,
      el('p', 'bankrupt__deleted', () => t('bankrupt.deleted')),
      button(() => t('bankrupt.menu'), () => this.#onMenu(), { cls: 'btn--primary bankrupt__btn' }),
    );
    this.el.append(el('div', 'bankrupt__vignette'), chips, el('div', 'bankrupt__grain'), wrap);
  }

  /** @param {{spins:number, best:number, prestige:number}} s */
  open(s) {
    const fmt = (n) => Number(n || 0).toLocaleString();
    this.#cells[0].textContent = fmt(s.spins);
    this.#cells[1].textContent = fmt(s.best);
    this.#cells[2].textContent = fmt(s.prestige);
    this.el.classList.remove('is-play');
    this.show();
    void this.el.offsetWidth;
    this.el.classList.add('is-play');
  }
}
