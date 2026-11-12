import { t } from '../i18n/index.js';
import { speechTimeline, visibleCount } from './speech-timing.js';
import { Screen, el, uiSfx } from './ui-kit.js';

/**
 * VENTANA DE CONVERSACIÓN.
 *
 * Bandas de cine arriba y abajo, retrato del personaje, nombre y cargo,
 * etiqueta de misión, texto con efecto máquina de escribir (con «blip» de voz)
 * y respuestas numeradas. No conoce la historia: el director le dice qué
 * mostrar y recibe las acciones del jugador.
 *
 * Teclas (las enruta la app): E / Espacio / Intro → continuar · 1-4 → elegir ·
 * ↑/↓ → mover selección · Tab → saltar hasta la próxima decisión.
 */
/** Ritmo de lectura sin voz grabada (s por sílaba): algo más ágil que hablando. */
const READ_PACE = 0.075;

export class DialogueBox extends Screen {
  #portrait;
  #portraitImg;
  #name;
  #role;
  #quest;
  #text;
  #choices;
  #hint;
  #full = '';
  #shown = 0;
  #typing = false;
  #timeline = null; // ritmo de habla (ui/speech-timing.js)
  #elapsed = 0;
  #waitVoice = 0; // s que se espera a saber la duración de la grabación
  #voiced = false;
  #acc = 0;
  #blipEvery = 0;
  #choiceList = [];
  #selected = 0;
  #onTyped = null;
  #handlers;

  /** @param {{onAdvance: Function, onChoose: (id:string) => void, onSkip: Function, onBlip?: Function}} h */
  constructor(h) {
    super('screen--dialogue');
    this.#handlers = h;
    const top = el('div', 'dlg-bar dlg-bar--top');
    const bottom = el('div', 'dlg-bar dlg-bar--bottom');
    const panel = el('div', 'dlg');
    this.#portrait = el('div', 'dlg__portrait');
    this.#portraitImg = el('img', 'dlg__portrait-img');
    this.#portraitImg.alt = '';
    this.#portrait.append(this.#portraitImg);
    const body = el('div', 'dlg__body');
    const head = el('div', 'dlg__head');
    this.#name = el('div', 'dlg__name');
    this.#role = el('div', 'dlg__role');
    this.#quest = el('div', 'dlg__quest');
    head.append(this.#name, this.#role, this.#quest);
    this.#text = el('p', 'dlg__text');
    this.#choices = el('div', 'dlg__choices');
    this.#hint = el('div', 'dlg__hint');
    const cont = el('span', 'dlg__key', 'E');
    const contLabel = el('span', 'dlg__hint-label', () => t('dlg.ui.continue'));
    const skip = el('span', 'dlg__key dlg__key--ghost', 'TAB');
    const skipLabel = el('span', 'dlg__hint-label', () => t('dlg.ui.skip'));
    this.#hint.append(cont, contLabel, skip, skipLabel);
    body.append(head, this.#text, this.#choices, this.#hint);
    panel.append(this.#portrait, body);
    panel.addEventListener('click', (e) => {
      if (e.target.closest('.dlg__choice')) return;
      this.advance();
    });
    this.el.append(top, bottom, panel);
  }

  /**
   * @param {{name:string, role:string, color:string, portrait?:string|null, quest?:string|null}} who
   */
  open(who) {
    this.setSpeaker(who);
    this.#quest.textContent = who.quest ? `${t('dlg.ui.questLabel')} · ${who.quest}` : '';
    this.#quest.hidden = !who.quest;
    this.#text.textContent = '';
    this.#choices.replaceChildren();
    this.show();
    uiSfx('dialogOpen');
  }

  setSpeaker({ name, role = '', color = '#d4af37', portrait = null, player = false }) {
    this.el.style.setProperty('--speaker', color);
    this.el.classList.toggle('is-player', player);
    this.#name.textContent = name;
    this.#role.textContent = role;
    this.#role.hidden = !role;
    if (portrait) this.#portraitImg.src = portrait;
    this.#portrait.classList.toggle('has-image', !!portrait);
  }

  setPortrait(url) {
    if (!url) return;
    this.#portraitImg.src = url;
    this.#portrait.classList.add('has-image');
  }

  /** Muestra una línea con efecto de escritura. `onTyped` se llama al terminar de escribirse. */
  line(text, { onTyped = null, waitVoice = false } = {}) {
    this.#choices.replaceChildren();
    this.#choiceList = [];
    this.#full = text;
    this.#shown = 0;
    this.#acc = 0;
    this.#elapsed = 0;
    this.#voiced = false;
    // con voz grabada se espera un instante a conocer su duración; si no llega, ritmo de lectura
    this.#waitVoice = waitVoice ? 0.6 : 0;
    this.#timeline = waitVoice ? null : speechTimeline(text, { perSyllable: READ_PACE });
    this.#typing = true;
    this.#onTyped = onTyped;
    this.#text.textContent = '';
    this.#text.classList.remove('is-done');
    this.#hint.classList.remove('is-ready');
    this.el.classList.remove('has-choices');
    this.#text.animate([{ opacity: 0.4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }

  /** Muestra las respuestas (el texto de la pregunta queda encima). */
  choices(list) {
    this.#typing = false;
    this.#choiceList = list;
    this.#selected = 0;
    this.el.classList.add('has-choices');
    this.#hint.classList.remove('is-ready');
    this.#choices.replaceChildren(
      ...list.map((c, i) => {
        const b = el('button', 'dlg__choice');
        b.type = 'button';
        b.append(el('span', 'dlg__num', String(i + 1)), el('span', 'dlg__choice-text', c.text));
        b.addEventListener('mouseenter', () => this.#select(i));
        b.addEventListener('click', () => this.choose(i));
        b.style.animationDelay = `${i * 70}ms`;
        return b;
      }),
    );
    this.#select(0, true);
    uiSfx('dialogChoice');
  }

  #select(i, silent = false) {
    if (!this.#choiceList.length) return;
    this.#selected = (i + this.#choiceList.length) % this.#choiceList.length;
    [...this.#choices.children].forEach((b, k) => b.classList.toggle('is-selected', k === this.#selected));
    if (!silent) uiSfx('hover');
  }

  moveSelection(delta) {
    this.#select(this.#selected + delta);
  }

  choose(i = this.#selected) {
    const c = this.#choiceList[i];
    if (!c) return;
    this.#choiceList = [];
    [...this.#choices.children].forEach((b, k) => b.classList.toggle('is-picked', k === i));
    uiSfx('confirm');
    setTimeout(() => this.#handlers.onChoose(c.id), 160);
  }

  get hasChoices() {
    return this.#choiceList.length > 0;
  }

  get typing() {
    return this.#typing;
  }

  /** Continuar: si se está escribiendo, completa el texto; si no, pasa a la siguiente línea. */
  advance() {
    if (!this.visible) return;
    if (this.#choiceList.length) {
      this.choose();
      return;
    }
    if (this.#typing) {
      this.#finishTyping();
      return;
    }
    uiSfx('dialogAdvance');
    this.#handlers.onAdvance();
  }

  skip() {
    if (this.#choiceList.length) return;
    this.#finishTyping();
    this.#handlers.onSkip();
  }

  #finishTyping() {
    if (!this.#typing) return;
    this.#typing = false;
    this.#shown = this.#timeline?.chars.length ?? this.#full.length;
    this.#text.textContent = this.#full;
    this.#text.classList.add('is-done');
    this.#hint.classList.add('is-ready');
    const cb = this.#onTyped;
    this.#onTyped = null;
    cb?.();
  }

  /** Duración real de la grabación de esta línea: el texto se escribe al ritmo de la voz. */
  setVoiceDuration(seconds) {
    if (!this.#typing || !(seconds > 0)) return;
    this.#timeline = speechTimeline(this.#full, { duration: seconds });
    this.#voiced = true;
    this.#waitVoice = 0;
  }

  /** La grabación no existe o no se pudo reproducir: ritmo de lectura. */
  noVoice() {
    if (!this.#typing || this.#timeline) return;
    this.#waitVoice = 0;
    this.#timeline = speechTimeline(this.#full, { perSyllable: READ_PACE });
  }

  /** Avanza la escritura (desde el bucle del juego). */
  update(dt) {
    if (!this.#typing || !this.visible) return;
    if (!this.#timeline) {
      this.#waitVoice -= dt;
      if (this.#waitVoice <= 0) this.noVoice();
      return;
    }
    this.#elapsed += dt;
    const tl = this.#timeline;
    const n = visibleCount(tl, this.#elapsed);
    if (n === this.#shown) return;
    const before = this.#shown;
    this.#shown = n;
    this.#text.textContent = tl.chars.slice(0, n).join('');
    this.#blipEvery += n - before;
    if (this.#blipEvery >= 3) {
      this.#blipEvery = 0;
      if (!this.#voiced) this.#handlers.onBlip?.();
    }
    if (n >= tl.chars.length) this.#finishTyping();
  }

  /** Aviso flotante de relación («Victoria · CONFIANZA ↑»). */
  flash(text, color = '#58e6ff') {
    const f = el('div', 'dlg__flash', text);
    f.style.setProperty('--flash', color);
    this.el.append(f);
    setTimeout(() => f.remove(), 2400);
  }

  close() {
    this.#typing = false;
    this.#choiceList = [];
    this.hide();
    uiSfx('dialogClose');
  }
}
