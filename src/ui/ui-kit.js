/**
 * Utilidades de interfaz compartidas: creación de elementos (siempre con
 * textContent), botones con sonido, controles de ajustes y diálogo de
 * confirmación. Todo el DOM del juego se construye con estas funciones.
 */

import { t } from '../i18n/index.js';

let audioHook = null;
export function setUiAudio(audio) {
  audioHook = audio;
}
export const uiSfx = (name) => audioHook?.sfx(name);

/**
 * Crea un elemento. `text` puede ser un string o una FUNCIÓN que devuelve el
 * texto: en ese caso el elemento se marca como traducible y se vuelve a pintar
 * al cambiar de idioma (ver `retranslate`).
 */
export function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof text === 'function') {
    node._tr = text;
    node.setAttribute('data-tr', '');
    node.textContent = text();
  } else if (text !== null) {
    node.textContent = text;
  }
  return node;
}

/** Vuelve a pintar todos los textos traducibles bajo `root` (cambio de idioma instantáneo). */
export function retranslate(root = document) {
  for (const node of root.querySelectorAll('[data-tr]')) node.textContent = node._tr();
}

export function button(label, onClick, { cls = '', disabled = false } = {}) {
  const b = el('button', `btn ${cls}`.trim(), label);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('mouseenter', () => {
    if (!b.disabled) uiSfx('hover');
  });
  b.addEventListener('click', (event) => {
    if (b.disabled) return;
    uiSfx('click');
    onClick(event);
  });
  return b;
}

/** Pantalla a todo el viewport con fundido (clase is-visible). */
export class Screen {
  constructor(className = '') {
    this.el = el('section', `screen ${className}`.trim());
  }
  get visible() {
    return this.el.classList.contains('is-visible');
  }
  show() {
    this.el.classList.add('is-visible');
  }
  hide() {
    this.el.classList.remove('is-visible');
  }
}

export function settingsSection(title) {
  const box = el('div', 'set-section');
  box.append(el('h3', 'set-section__title', title));
  return box;
}

export function slider(label, { min, max, step, value, format = (v) => String(v) }, onInput) {
  const row = el('label', 'set-row');
  const name = el('span', 'set-row__label', label);
  const input = el('input', 'set-slider');
  input.type = 'range';
  Object.assign(input, { min, max, step, value });
  const out = el('span', 'set-row__value', format(value));
  const paint = () => {
    out.textContent = format(Number(input.value));
    input.style.setProperty('--fill', `${((input.value - min) / (max - min)) * 100}%`);
  };
  input.addEventListener('input', () => {
    paint();
    onInput(Number(input.value));
  });
  paint();
  row.append(name, input, out);
  return row;
}

export function toggle(label, value, onChange) {
  const row = el('div', 'set-row');
  const name = el('span', 'set-row__label', label);
  const sw = el('button', 'switch');
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  const paint = (v) => {
    sw.setAttribute('aria-checked', String(v));
    sw.textContent = v ? t('common.yes') : t('common.no');
  };
  let state = value;
  paint(state);
  sw.addEventListener('click', () => {
    state = !state;
    paint(state);
    uiSfx('click');
    onChange(state);
  });
  row.append(name, sw);
  return row;
}

/** Selector de idioma: una rejilla con el nombre de cada idioma en su propio idioma. */
export function languagePicker(languages, value, onPick) {
  const grid = el('div', 'lang-grid');
  const buttons = languages.map((l) => {
    const b = el('button', 'lang-btn', l.native);
    b.type = 'button';
    b.lang = l.code;
    b.addEventListener('mouseenter', () => uiSfx('hover'));
    b.addEventListener('click', () => {
      uiSfx('click');
      onPick(l.code);
    });
    grid.append(b);
    return [l.code, b];
  });
  const mark = (code) => buttons.forEach(([c, b]) => {
    b.classList.toggle('is-active', c === code);
    b.setAttribute('aria-pressed', String(c === code));
  });
  mark(value);
  return grid;
}

export function segmented(label, options, value, onChange) {
  const row = el('div', options.length > 3 ? 'set-row set-row--stack' : 'set-row');
  const name = el('span', 'set-row__label', label);
  const group = el('div', options.length > 3 ? 'segmented segmented--wide' : 'segmented');
  const buttons = options.map((opt) => {
    const b = el('button', 'segmented__btn', opt.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      uiSfx('click');
      mark(opt.value);
      onChange(opt.value);
    });
    group.append(b);
    return [opt.value, b];
  });
  const mark = (v) => buttons.forEach(([val, b]) => b.classList.toggle('is-active', val === v));
  mark(value);
  row.append(name, group);
  return row;
}

/** Diálogo de confirmación modal. Resuelve true/false; ESC cancela. */
export function confirmDialog(root, { title, text, confirm = t('common.accept'), cancel = t('common.cancel') }) {
  return new Promise((resolve) => {
    const screen = new Screen('screen--dialog');
    const card = el('div', 'panel dialog');
    const finish = (answer) => {
      window.removeEventListener('keydown', onKey, true);
      screen.hide();
      setTimeout(() => screen.el.remove(), 500);
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };
    card.append(
      el('h2', 'dialog__title', title),
      el('p', 'dialog__text', text),
      (() => {
        const actions = el('div', 'dialog__actions');
        actions.append(button(cancel, () => finish(false), { cls: 'btn--ghost' }), button(confirm, () => finish(true), { cls: 'btn--primary' }));
        return actions;
      })(),
    );
    screen.el.append(card);
    root.append(screen.el);
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => screen.show());
  });
}
