import { QUALITY_ORDER } from '../config.js';
import { LANGUAGES, i18n, t } from '../i18n/index.js';
import { keycap } from './icons.js';
import { Screen, button, el, languagePicker, segmented, slider, toggle, uiSfx } from './ui-kit.js';

const pct = (v) => `${Math.round(v * 100)} %`;
const TABS = ['graphics', 'audio', 'controls', 'language'];

/**
 * Ajustes (interfaz 2.0): pantalla completa con pestañas (Q/E o clic), lista de opciones a la
 * izquierda y panel de ayuda a la derecha que explica la opción enfocada. Cada cambio se aplica
 * al momento (`onChange`).
 */
export class SettingsMenu extends Screen {
  #getSettings;
  #onChange;
  #onAutoQuality;
  #onClose = null;
  #tab = 'graphics';
  #tabs;
  #list;
  #helpTitle;
  #helpText;

  /** @param {{getSettings:()=>object,onChange:(s:object)=>void,onAutoQuality?:()=>void}} h */
  constructor(h) {
    super('screen--settings');
    this.#getSettings = h.getSettings;
    this.#onChange = h.onChange;
    this.#onAutoQuality = h.onAutoQuality;
    const root = el('div', 'st');
    const head = el('header', 'st__head');
    this.#tabs = el('nav', 'st__tabs');
    head.append(el('h2', 'st__title', () => t('settings.title')), this.#tabs);
    const body = el('div', 'st__body');
    this.#list = el('div', 'st__list');
    const help = el('aside', 'st__help');
    this.#helpTitle = el('div', 'st__help-title', '');
    this.#helpText = el('div', 'st__help-text', '');
    help.append(el('div', 'ui-kicker', () => t(`settings.${this.#tab}`)), this.#helpTitle, el('hr', 'ui-rule'), this.#helpText);
    body.append(this.#list, help);
    const foot = el('footer', 'st__foot');
    const hints = el('div', 'st__hints');
    const hint = (k, key) => {
      const s = el('span', '');
      s.append(keycap(k), el('span', '', () => t(key)));
      return s;
    };
    hints.append(hint('Q / E', 'ui.nav.tabs'), hint('ESC', 'ui.nav.back'));
    foot.append(hints, button(() => t('common.back'), () => this.close(), { cls: 'btn--primary' }));
    root.append(head, body, foot);
    this.el.append(root);
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        const i = TABS.indexOf(this.#tab);
        this.#select(TABS[(i + (e.code === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length]);
        e.preventDefault();
      }
    });
  }

  open(onClose) {
    this.#onClose = onClose;
    this.#build();
    this.show();
  }

  refreshTexts() {
    if (this.visible) this.#build();
  }

  close() {
    this.hide();
    this.#onClose?.();
  }

  #select(tab) {
    if (tab === this.#tab) return;
    uiSfx('tab');
    this.#tab = tab;
    this.#build();
  }

  #help(title, key) {
    this.#helpTitle.textContent = title;
    this.#helpText.textContent = t(key);
  }

  #build() {
    this.#tabs.replaceChildren(...TABS.map((id) => {
      const b = el('button', `st-tab${id === this.#tab ? ' is-active' : ''}`, t(`settings.${id}`));
      b.type = 'button';
      b.addEventListener('click', () => this.#select(id));
      return b;
    }));
    const s = this.#getSettings();
    const change = (mutate) => {
      mutate(this.#getSettings());
      this.#onChange(this.#getSettings());
    };
    const row = (node, label, help) => {
      const set = () => this.#help(label, `ui.help.${help}`);
      node.addEventListener('mouseenter', set);
      node.addEventListener('focusin', set);
      return node;
    };
    const items = [];
    if (this.#tab === 'graphics') {
      items.push(
        row(toggle(s.graphics.auto && s.graphics.detected ? `${t('ui.settings.autoQuality')} · ${t(`settings.quality.${s.graphics.detected}`)}` : t('ui.settings.autoQuality'), !!s.graphics.auto, (v) => {
          if (v) this.#onAutoQuality?.();
          else change((x) => (x.graphics.auto = false));
          this.#build();
        }), t('ui.settings.autoQuality'), 'autoQuality'),
        row(segmented(t('settings.quality'), QUALITY_ORDER.map((id) => ({ value: id, label: t(`settings.quality.${id}`) })), s.graphics.quality, (v) => {
          change((x) => {
            x.graphics.quality = v;
            x.graphics.auto = false;
          });
          this.#build();
        }), t('settings.quality'), 'quality'),
        row(slider(t('settings.renderScale'), { min: 0.5, max: 1, step: 0.05, value: s.graphics.renderScale, format: pct }, (v) => change((x) => (x.graphics.renderScale = v))), t('settings.renderScale'), 'renderScale'),
        row(toggle(t('settings.shadows'), s.graphics.shadows, (v) => change((x) => (x.graphics.shadows = v))), t('settings.shadows'), 'shadows'),
        row(toggle(t('settings.postFx'), s.graphics.postFx !== false, (v) => change((x) => (x.graphics.postFx = v))), t('settings.postFx'), 'postFx'),
        row(toggle(t('settings.effects'), s.graphics.effects, (v) => change((x) => (x.graphics.effects = v))), t('settings.effects'), 'effects'),
        row(toggle(t('settings.screenFx'), s.graphics.screenFx !== false, (v) => change((x) => (x.graphics.screenFx = v))), t('settings.screenFx'), 'screenFx'),
        row(toggle(t('settings.antialias'), s.graphics.antialias, (v) => change((x) => (x.graphics.antialias = v))), t('settings.antialias'), 'antialias'),
        el('p', 'set-note', t('settings.gfxNote')),
      );
      this.#help(t('settings.quality'), 'ui.help.quality');
    } else if (this.#tab === 'audio') {
      for (const id of ['master', 'music', 'sfx', 'voice']) {
        items.push(row(slider(t(`settings.${id}`), { min: 0, max: 1, step: 0.05, value: s.audio[id], format: pct }, (v) => change((x) => (x.audio[id] = v))), t(`settings.${id}`), id));
      }
      this.#help(t('settings.master'), 'ui.help.master');
    } else if (this.#tab === 'controls') {
      items.push(
        row(slider(t('settings.sensitivity'), { min: 0.2, max: 3, step: 0.1, value: s.controls.mouseSensitivity, format: (v) => `${v.toFixed(1)}×` }, (v) => change((x) => (x.controls.mouseSensitivity = v))), t('settings.sensitivity'), 'sensitivity'),
        row(toggle(t('settings.showControls'), s.controls.showControls, (v) => change((x) => (x.controls.showControls = v))), t('settings.showControls'), 'showControls'),
      );
      this.#help(t('settings.sensitivity'), 'ui.help.sensitivity');
    } else {
      items.push(row(languagePicker(LANGUAGES, i18n.lang, (code) => i18n.set(code)), t('settings.language'), 'language'), el('p', 'set-note', t('settings.languageNote')));
      this.#help(t('settings.language'), 'ui.help.language');
    }
    this.#list.replaceChildren(...items);
  }
}
