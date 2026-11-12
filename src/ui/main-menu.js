import { GAME } from '../config.js';
import { t } from '../i18n/index.js';
import { icon, keycap } from './icons.js';
import { MenuNav } from './menu-nav.js';
import { Screen, el, uiSfx } from './ui-kit.js';

/**
 * Menú principal (interfaz 2.0): el casino en directo de fondo, columna izquierda con la marca y
 * las opciones numeradas (descripción al enfocar, navegación con flechas/ratón), tarjeta de la
 * partida guardada a la derecha y pie con versión y teclas.
 */
export class MainMenu extends Screen {
  #nav;
  #foot;
  #notice = '';
  #canContinue = false;
  #card;
  #cardBody;
  #save = null;

  /** @param {{onContinue:Function,onNew:Function,onSettings:Function,onCredits:Function}} h */
  constructor(h) {
    super('menu-screen screen--main');
    const root = el('div', 'mm');
    const side = el('div', 'mm__side');
    const brand = el('div', 'mm__brand');
    const logo = el('h1', 'mm__logo');
    logo.append('HOUSE', el('i', '', 'OF'), el('b', '', 'ODDS'));
    if (GAME.stage) logo.append(el('span', 'mm__beta', () => t('ui.beta.badge')));
    brand.append(el('div', 'ui-kicker', () => t('ui.menu.studio')), logo, el('p', 'mm__tagline', () => t('ui.menu.tagline')));

    const nav = el('nav', 'mm__nav');
    this.#nav = new MenuNav(nav, () => this.visible && !document.querySelector('.screen--dialog.is-visible, .screen--beta, .screen--settings.is-visible, .screen--credits.is-visible'));
    const defs = [
      { id: 'continue', label: 'menu.continue', desc: 'ui.menu.desc.continue', run: h.onContinue },
      { id: 'new', label: 'menu.new', desc: 'ui.menu.desc.new', run: h.onNew },
      { id: 'settings', label: 'menu.settings', desc: 'ui.menu.desc.settings', run: h.onSettings },
      { id: 'credits', label: 'menu.credits', desc: 'ui.menu.desc.credits', run: h.onCredits },
    ];
    defs.forEach((d, i) => {
      const b = el('button', 'mm-item');
      b.type = 'button';
      b.append(el('span', 'mm-item__n', String(i + 1).padStart(2, '0')), el('span', 'mm-item__label', () => t(d.label)), icon('chevron', 'mm-item__arrow'), el('span', 'mm-item__desc', () => t(d.desc)));
      b.addEventListener('click', () => {
        if (b.disabled) return;
        uiSfx('confirm');
        d.run();
      });
      this.#nav.add(b);
    });

    this.#foot = el('div', 'mm__foot');
    side.append(brand, nav, this.#foot);

    this.#card = el('aside', 'mm__card');
    this.#cardBody = el('div', 'mm__card-body');
    this.#card.append(el('div', 'ui-kicker', () => t('ui.menu.save')), this.#cardBody);
    this.#card.hidden = true;
    root.append(side, this.#card);
    this.el.append(root);

    this.refreshTexts();
  }

  show() {
    super.show();
    this.#nav.set(this.#canContinue ? 0 : 1, true);
  }

  /** Aviso temporal en el pie (p. ej. copia de seguridad restaurada). Sin clave → versión. */
  setNotice(key, params) {
    this.#notice = key ? { key, params } : '';
    this.refreshTexts();
  }

  /** Resumen de la partida guardada: {quest, marks, prestige, spins} o null. */
  setSaveInfo(info) {
    this.#save = info;
    this.refreshTexts();
  }

  refreshTexts() {
    const foot = [el('span', '', `v${GAME.version}${GAME.stage ? ` · ${t('ui.beta.badge')}` : ''}`), el('span', '', 'VANTA INTERACTIVE')];
    const hint = (k, label) => {
      const s = el('span', '');
      s.append(keycap(k), label);
      return s;
    };
    foot.push(hint('↑↓', t('ui.nav.navigate')), hint('↵', t('ui.nav.select')));
    if (this.#notice) foot.push(el('span', 'mm__notice', t(this.#notice.key, this.#notice.params)));
    this.#foot.replaceChildren(...foot);
    this.#nav.items[0].title = this.#canContinue ? '' : t('menu.noSave');
    const s = this.#save;
    this.#card.hidden = !s || !this.#canContinue;
    if (s) {
      const row = el('div', 'mm__card-row');
      const stat = (v, label) => {
        const x = el('span', '');
        x.append(el('b', '', String(v)), label);
        return x;
      };
      row.append(stat(s.marks, 'MARKS'), stat(s.prestige, 'PRESTIGE'), stat(s.spins, t('ui.pause.spins')));
      this.#cardBody.replaceChildren(el('div', 'mm__card-title', s.quest ? t(`quest.${s.quest}.title`) : t('ui.menu.noQuest')), el('hr', 'ui-rule'), row);
    }
  }

  setCanContinue(can) {
    this.#canContinue = can;
    this.#nav.items[0].disabled = !can;
    this.refreshTexts();
  }
}
