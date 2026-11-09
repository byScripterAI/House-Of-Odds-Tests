/**
 * Utilidades de interfaz compartidas: creación de elementos (siempre con
 * textContent), botones con sonido, controles de ajustes y diálogo de
 * confirmación. Todo el DOM del juego se construye con estas funciones.
 */

let audioHook = null;
export function setUiAudio(audio) {
  audioHook = audio;
}
export const uiSfx = (name) => audioHook?.sfx(name);

export function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
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
    sw.textContent = v ? 'SÍ' : 'NO';
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

export function segmented(label, options, value, onChange) {
  const row = el('div', 'set-row');
  const name = el('span', 'set-row__label', label);
  const group = el('div', 'segmented');
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
export function confirmDialog(root, { title, text, confirm = 'ACEPTAR', cancel = 'CANCELAR' }) {
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
