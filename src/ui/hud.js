import { ECONOMY } from '../config.js';
import { el } from './ui-kit.js';

const GEM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 10 12 22 3 10Z" fill="currentColor" opacity=".85"/><path d="M12 2 21 10H3Z" fill="#fff" opacity=".35"/></svg>';
const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11Z" fill="currentColor"/></svg>';

function icon(svg, cls) {
  const span = el('span', cls);
  span.insertAdjacentHTML('beforeend', svg); // SVG estático y de confianza
  return span;
}

/** Interfaz durante el juego: saldo, avisos, indicador de interacción, pistas. */
export class Hud {
  #root;
  #marksEl;
  #prestigeEl;
  #prompt;
  #hint;
  #lockHint;
  #controls;
  #toasts;
  #crosshair;
  #wrap;
  #marksShown = 0;
  #marksTarget = 0;
  #objective;
  #tutorial;
  #tickTimer = 0;
  #tickCount = 0;
  /** Se llama mientras el contador de MARKS sube (para el sonido de monedas). */
  onMarksTick = null;

  constructor(root) {
    this.#root = el('div', 'hud');
    this.#wrap = this.#root;

    const stats = el('div', 'hud__stats');
    const marks = el('div', 'hud__marks');
    this.#marksEl = el('span', 'hud__marks-value', '0');
    marks.append(icon(GEM, 'hud__icon'), this.#marksEl, el('span', 'hud__label', ECONOMY.currency.label));
    const prestige = el('div', 'hud__prestige');
    this.#prestigeEl = el('span', 'hud__prestige-value', '0');
    prestige.append(icon(CROWN, 'hud__icon hud__icon--small'), el('span', 'hud__label', ECONOMY.prestige.label), this.#prestigeEl);
    stats.append(marks, prestige);

    this.#objective = el('div', 'hud__objective');
    this.#tutorial = el('div', 'hud__tutorial');
    this.#toasts = el('div', 'hud__toasts');
    this.#crosshair = el('div', 'hud__crosshair');
    this.#prompt = el('div', 'hud__prompt');
    this.#hint = el('div', 'hud__hint');
    this.#lockHint = el('div', 'hud__lock', 'HAZ CLIC PARA CONTINUAR');
    this.#controls = el('div', 'hud__controls', 'WASD mover · MAYÚS correr · E interactuar · ESC pausa');

    this.#root.append(stats, this.#objective, this.#tutorial, this.#toasts, this.#crosshair, this.#prompt, this.#hint, this.#lockHint, this.#controls);
    root.append(this.#root);
    this.#root.classList.add('is-hidden');
  }

  setVisible(visible) {
    this.#root.classList.toggle('is-hidden', !visible);
  }

  setMarks(value, instant = false) {
    if (!instant && value > this.#marksTarget) {
      this.#marksEl.classList.remove('is-bump');
      void this.#marksEl.offsetWidth; // reinicia la animación
      this.#marksEl.classList.add('is-bump');
    }
    this.#marksTarget = value;
    if (instant) {
      this.#marksShown = value;
      this.#marksEl.textContent = String(value);
    }
  }

  setPrestige(value) {
    this.#prestigeEl.textContent = String(value);
  }

  /** Cada frame: anima el contador de MARKS hacia su valor. */
  update(dt) {
    if (this.#marksShown === this.#marksTarget) return;
    const diff = this.#marksTarget - this.#marksShown;
    this.#marksShown += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 7);
    this.#tickTimer -= dt;
    if (this.#tickTimer <= 0 && diff > 0) {
      this.#tickTimer = 0.05;
      this.onMarksTick?.(this.#tickCount++ % 6);
    }
    if (Math.abs(this.#marksTarget - this.#marksShown) < 0.5) this.#marksShown = this.#marksTarget;
    this.#marksEl.textContent = String(Math.round(this.#marksShown));
  }

  /** "+N" flotante junto al contador. */
  popReward(amount) {
    const pop = el('span', 'hud__pop', `+${amount}`);
    this.#marksEl.parentElement.append(pop);
    setTimeout(() => pop.remove(), 1600);
  }

  toast({ title, text = '', kind = 'info' }) {
    const t = el('div', `toast toast--${kind}`);
    t.append(el('div', 'toast__title', title));
    if (text) t.append(el('div', 'toast__text', text));
    this.#toasts.append(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    setTimeout(() => {
      t.classList.remove('is-in');
      setTimeout(() => t.remove(), 500);
    }, 4200);
    while (this.#toasts.children.length > 3) this.#toasts.firstChild.remove();
  }

  /** @param {{key:string,text:string}|null} prompt */
  setPrompt(prompt) {
    if (!prompt) {
      this.#prompt.classList.remove('is-on');
      return;
    }
    this.#prompt.replaceChildren(el('kbd', '', prompt.key), el('span', '', prompt.text));
    this.#prompt.classList.add('is-on');
  }

  /** Objetivo más cercano: {name, desc, value, target, reward} o null. */
  setObjective(o) {
    if (!o) { this.#objective.classList.remove('is-on'); return; }
    const pct = Math.min(100, Math.round((o.value / o.target) * 100));
    const bar = el('div', 'hud__bar');
    const fill = el('div', 'hud__bar-fill');
    fill.style.width = `${pct}%`;
    bar.append(fill);
    this.#objective.replaceChildren(
      el('div', 'hud__panel-title', 'OBJETIVO'),
      el('div', 'hud__objective-name', o.name),
      el('div', 'hud__objective-desc', o.desc),
      bar,
      el('div', 'hud__objective-count', `${Math.min(o.value, o.target)} / ${o.target}  ·  +${o.reward} MARKS`),
    );
    this.#objective.classList.add('is-on');
  }

  /** Paso de tutorial {text} con su posición, o null para ocultarlo. */
  setTutorial(step, index = 0, total = 0) {
    if (!step) { this.#tutorial.classList.remove('is-on'); return; }
    const dots = el('div', 'hud__dots');
    for (let i = 0; i < total; i++) dots.append(el('span', i < index ? 'is-done' : i === index ? 'is-now' : ''));
    this.#tutorial.replaceChildren(el('div', 'hud__panel-title', `TUTORIAL · ${index + 1}/${total}`), el('div', 'hud__tutorial-text', step.text), dots);
    this.#tutorial.classList.add('is-on');
  }

  setMode(mode) {
    this.#root.classList.toggle('mode-machine', mode === 'machine');
    this.#crosshair.classList.toggle('is-on', mode === 'explore');
    this.#hint.classList.toggle('is-on', mode === 'machine');
    if (mode === 'machine') {
      this.#hint.replaceChildren(el('span', '', 'ESPACIO / E / CLIC · Activar'), el('span', '', 'Q · Salir de la máquina'));
    }
  }

  setControlsVisible(visible) {
    this.#controls.classList.toggle('is-on', visible);
  }

  showLockHint(visible) {
    this.#lockHint.classList.toggle('is-on', visible);
  }
}
