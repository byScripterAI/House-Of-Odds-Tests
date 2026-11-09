import { Screen, button, el, segmented, settingsSection, slider, toggle } from './ui-kit.js';

const pct = (v) => `${Math.round(v * 100)} %`;

/**
 * Menú de ajustes (se abre desde el menú principal y desde la pausa).
 * Construye los controles con los valores actuales cada vez que se abre y
 * notifica cada cambio con `onChange(settings)`.
 */
export class SettingsMenu extends Screen {
  #getSettings;
  #onChange;
  #body;
  #onClose = null;

  /** @param {{getSettings:()=>object,onChange:(s:object)=>void}} h */
  constructor(h) {
    super('screen--center');
    this.#getSettings = h.getSettings;
    this.#onChange = h.onChange;
    const card = el('div', 'panel panel--settings');
    this.#body = el('div', 'settings__body');
    card.append(el('h2', 'panel__title', 'AJUSTES'), this.#body, button('VOLVER', () => this.close(), { cls: 'btn--primary' }));
    this.el.append(card);
  }

  open(onClose) {
    this.#onClose = onClose;
    this.#build();
    this.show();
  }

  close() {
    this.hide();
    this.#onClose?.();
  }

  #build() {
    const s = this.#getSettings();
    const change = (mutate) => {
      mutate(this.#getSettings());
      this.#onChange(this.#getSettings());
    };

    const gfx = settingsSection('GRÁFICOS');
    gfx.append(
      segmented('Calidad', [{ value: 'low', label: 'BAJA' }, { value: 'medium', label: 'MEDIA' }, { value: 'high', label: 'ALTA' }], s.graphics.quality, (v) => change((x) => (x.graphics.quality = v))),
      slider('Resolución de renderizado', { min: 0.5, max: 1, step: 0.05, value: s.graphics.renderScale, format: pct }, (v) => change((x) => (x.graphics.renderScale = v))),
      toggle('Sombras', s.graphics.shadows, (v) => change((x) => (x.graphics.shadows = v))),
      toggle('Efectos visuales', s.graphics.effects, (v) => change((x) => (x.graphics.effects = v))),
      toggle('Sacudidas y destellos de pantalla', s.graphics.screenFx !== false, (v) => change((x) => (x.graphics.screenFx = v))),
      toggle('Antialiasing', s.graphics.antialias, (v) => change((x) => (x.graphics.antialias = v))),
      el('p', 'set-note', 'La calidad baja desactiva sombras y efectos. El antialiasing se aplica al recargar la página.'),
    );

    const audio = settingsSection('AUDIO');
    audio.append(
      slider('Volumen general', { min: 0, max: 1, step: 0.05, value: s.audio.master, format: pct }, (v) => change((x) => (x.audio.master = v))),
      slider('Música', { min: 0, max: 1, step: 0.05, value: s.audio.music, format: pct }, (v) => change((x) => (x.audio.music = v))),
      slider('Efectos de sonido', { min: 0, max: 1, step: 0.05, value: s.audio.sfx, format: pct }, (v) => change((x) => (x.audio.sfx = v))),
    );

    const controls = settingsSection('CONTROLES');
    controls.append(
      slider('Sensibilidad del ratón', { min: 0.2, max: 3, step: 0.1, value: s.controls.mouseSensitivity, format: (v) => `${v.toFixed(1)}×` }, (v) => change((x) => (x.controls.mouseSensitivity = v))),
      toggle('Mostrar controles', s.controls.showControls, (v) => change((x) => (x.controls.showControls = v))),
    );

    this.#body.replaceChildren(gfx, audio, controls);
  }
}
