import { GAME } from '../config.js';
import { t } from '../i18n/index.js';
import { icon, keycap } from './icons.js';
import { Screen, button, el, uiSfx } from './ui-kit.js';

/**
 * AVISO DE BETA al empezar partida (estilo de los menús: negro, oro y Cinzel). Explica que es una versión muy
 * temprana, que habrá errores y cómo informar de ellos. Se cierra con el botón, Intro o Escape.
 * @returns {Promise<void>}
 */
export function betaNotice(root) {
  return new Promise((resolve) => {
    const screen = new Screen('screen--beta');
    const card = el('div', 'beta');
    const head = el('header', 'beta__head');
    const title = el('h2', 'beta__title');
    title.append(el('span', 'beta__word', 'BETA'));
    head.append(el('div', 'ui-kicker', t('ui.beta.kicker')), title, el('p', 'beta__lead', t('ui.beta.lead')));
    const list = el('ol', 'beta__list');
    [['warn', 1], ['wrench', 2], ['scroll', 3]].forEach(([ic, n], i) => {
      const li = el('li', 'beta__item');
      li.style.animationDelay = `${380 + i * 120}ms`;
      const txt = el('div', 'beta__item-body');
      txt.append(el('h3', 'beta__item-title', t(`ui.beta.p${n}t`)), el('p', 'beta__item-text', t(`ui.beta.p${n}`)));
      li.append(el('span', 'beta__num', String(n).padStart(2, '0')), icon(ic, 'beta__icon'), txt);
      list.append(li);
    });
    const foot = el('footer', 'beta__foot');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      uiSfx('confirm');
      window.removeEventListener('keydown', onKey, true);
      screen.el.classList.add('is-leaving');
      setTimeout(() => {
        screen.hide();
        screen.el.remove();
        resolve();
      }, 420);
    };
    const onKey = (e) => {
      if (['Enter', 'NumpadEnter', 'Space', 'Escape'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    const go = button(t('ui.beta.go'), finish, { cls: 'btn--primary beta__go' });
    go.prepend(keycap('↵'));
    foot.append(el('span', 'beta__version', t('ui.beta.version', { v: `${GAME.version} ${t('ui.beta.badge')}` })), go);
    card.append(el('div', 'beta__glow'), head, el('hr', 'ui-rule'), list, foot);
    screen.el.append(card);
    root.append(screen.el);
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      screen.show();
      uiSfx('menuOpen');
    });
  });
}
