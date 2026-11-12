import { t } from '../i18n/index.js';
import { icon } from './icons.js';
import { MenuNav } from './menu-nav.js';
import { Screen, el, uiSfx } from './ui-kit.js';

/**
 * Menú de pausa (interfaz 2.0): fondo desenfocado del juego, opciones a la izquierda y, a la
 * derecha, el objetivo actual y las cifras de la partida.
 */
export class PauseMenu extends Screen {
  #status;
  #statusKey = null;
  #objective;
  #stats;
  #info = null;
  #nav;

  /** @param {{onResume:Function,onQuests:Function,onSettings:Function,onSave:Function,onQuit:Function}} h */
  constructor(h) {
    super('menu-screen menu-screen--pause');
    const root = el('div', 'pm');
    const side = el('div', 'pm__side');
    const nav = el('nav', 'mm__nav');
    // misma navegación que el menú principal: una sola selección (ratón y flechas), sonido y resaltado que se desliza
    this.#nav = new MenuNav(nav, () => this.visible && !document.querySelector('.screen--dialog.is-visible, .screen--settings.is-visible, .screen--center.is-visible'));
    const defs = [
      ['resume', 'pause.resume', h.onResume],
      ['scroll', 'pause.quests', h.onQuests],
      ['gear', 'pause.settings', h.onSettings],
      ['save', 'pause.save', h.onSave],
      ['exit', 'pause.quit', h.onQuit],
    ];
    for (const [ic, key, run] of defs) {
      const b = el('button', 'mm-item');
      b.type = 'button';
      const n = el('span', 'mm-item__n');
      n.append(icon(ic));
      b.append(n, el('span', 'mm-item__label', () => t(key)), icon('chevron', 'mm-item__arrow'));
      b.addEventListener('click', () => {
        uiSfx('confirm');
        run();
      });
      this.#nav.add(b);
    }
    nav.style.marginTop = '0';
    this.#status = el('p', 'pm__status', '');
    side.append(el('h1', 'pm__title', () => t('pause.title')), el('hr', 'ui-rule'), nav, this.#status);

    const info = el('aside', 'pm__info');
    this.#objective = el('div', 'pm-card');
    this.#stats = el('div', 'pm-stats');
    info.append(this.#objective, this.#stats);
    root.append(side, info);
    this.el.append(root);
  }

  show() {
    super.show();
    this.#nav.set(0, true);
    requestAnimationFrame(() => this.#nav.track());
  }

  /** @param {string} key clave i18n (o '' para limpiar) */
  setStatus(key) {
    this.#statusKey = key || null;
    this.refreshTexts();
  }

  /** {title, objective, marks, prestige, collection} — se rellena al abrir la pausa. */
  setInfo(info) {
    this.#info = info;
    this.refreshTexts();
  }

  refreshTexts() {
    this.#status.textContent = this.#statusKey ? t(this.#statusKey) : '';
    const i = this.#info;
    if (!i) return;
    this.#objective.replaceChildren(
      el('div', 'ui-kicker', t('ui.pause.objective')),
      el('div', 'pm-card__title', i.title || t('ui.menu.noQuest')),
      el('div', 'pm-card__text', i.objective ?? t('ui.pause.none')),
    );
    const stat = (v, label) => {
      const s = el('div', 'pm-stat');
      s.append(el('b', '', String(v)), el('span', '', label));
      return s;
    };
    this.#stats.replaceChildren(stat(i.marks, 'MARKS'), stat(i.prestige, 'PRESTIGE'), stat(i.collection, 'COLLECTION'));
  }
}
