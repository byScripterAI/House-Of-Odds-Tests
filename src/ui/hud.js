import { ECONOMY } from '../config.js';
import { t } from '../i18n/index.js';
import { icon, keycap } from './icons.js';
import { el } from './ui-kit.js';

const TOAST_ICON = { objective: 'quest', achievement: 'trophy', error: 'warn', locked: 'lock', info: 'info', reward: 'coin' };
const fmt = (n) => Math.round(n).toLocaleString('es-ES').replace(/\./g, ' ');

/**
 * Interfaz durante el juego (interfaz 2.0).
 *  - Arriba a la derecha: MARKS y PRESTIGE; debajo, el rastreador de misión.
 *  - Arriba en el centro: brújula en cinta con el marcador del objetivo y la distancia.
 *  - Izquierda: avisos (misión, logros, errores) con icono y franja de color.
 *  - Abajo en el centro: interacción con su tecla; avisos de «cerrado» con candado.
 *  - Abajo a la izquierda: ayuda de teclas (opcional).
 * La interfaz pública es la misma que la anterior: el resto del juego no cambia.
 */
export class Hud {
  #root;
  #marksEl;
  #prestigeEl;
  #prompt;
  #hint;
  #lockHint;
  #controls;
  #toasts;
  #alert;
  #alertTimer = null;
  #crosshair;
  #marksShown = 0;
  #marksTarget = 0;
  #objective;
  #tutorial;
  #lastPrompt = null;
  #lastObjective = null;
  #lastTutorial = null;
  #lastQuest = null;
  #compass;
  #compassMark;
  #compassDist;
  #questKey = '';
  #questBase = '';
  #bet;
  #betValue;
  #betDown;
  #betUp;
  #betMax;
  #lastBet = null;
  #mode = 'explore';
  #tickTimer = 0;
  #tickCount = 0;
  /** Se llama mientras el contador de MARKS sube (para el sonido de monedas). */
  onMarksTick = null;

  constructor(root) {
    this.#root = el('div', 'hud hud2');

    // saldo
    const stats = el('div', 'h-stats');
    const marks = el('div', 'h-stat h-stat--marks');
    this.#marksEl = el('span', 'h-stat__value', '0');
    marks.append(icon('gem', 'h-stat__icon'), this.#marksEl, el('span', 'h-stat__label', ECONOMY.currency.label));
    const prestige = el('div', 'h-stat h-stat--prestige');
    this.#prestigeEl = el('span', 'h-stat__value', '0');
    prestige.append(icon('crown', 'h-stat__icon'), this.#prestigeEl, el('span', 'h-stat__label', ECONOMY.prestige.label));
    stats.append(marks, prestige);

    this.#objective = el('div', 'h-quest');
    this.#tutorial = el('div', 'h-tutorial');
    this.#toasts = el('div', 'h-toasts');
    this.#alert = el('div', 'h-alert');
    this.#crosshair = el('div', 'h-cross');
    this.#prompt = el('div', 'h-prompt');
    this.#hint = el('div', 'h-hints');
    this.#lockHint = el('div', 'h-lock');
    this.#lockHint.append(icon('mouse'), el('span', '', () => t('hud.lockHint')));
    this.#controls = el('div', 'h-controls');

    // brújula en cinta
    this.#compass = el('div', 'h-compass');
    const tape = el('div', 'h-compass__tape');
    this.#compassMark = el('div', 'h-compass__mark');
    this.#compassMark.append(icon('quest'));
    this.#compassDist = el('div', 'h-compass__dist');
    this.#compassMark.append(this.#compassDist);
    tape.append(el('span', 'h-compass__center'));
    this.#compass.append(tape, this.#compassMark);

    // apuesta (dentro de la máquina)
    this.#bet = el('div', 'h-bet');
    this.#betDown = el('span', 'h-bet__arrow');
    this.#betDown.append(keycap('S'));
    this.#betValue = el('span', 'h-bet__value', '5');
    this.#betUp = el('span', 'h-bet__arrow');
    this.#betUp.append(keycap('W'));
    this.#betMax = el('span', 'h-bet__max', '');
    const mid = el('div', 'h-bet__mid');
    mid.append(el('span', 'h-bet__label', () => t('hud.bet')), this.#betValue, this.#betMax);
    this.#bet.append(this.#betDown, mid, this.#betUp);

    this.#root.append(this.#compass, stats, this.#objective, this.#tutorial, this.#toasts, this.#crosshair, this.#prompt, this.#alert, this.#bet, this.#hint, this.#lockHint, this.#controls);
    root.append(this.#root);
    this.#root.classList.add('is-hidden');
    this.#renderControls();
  }

  /** Conversaciones y cinemáticas: se ocultan mira, interacción, rastreador y brújula. */
  setDialogueMode(on) {
    this.#root.classList.toggle('is-dialogue', on);
  }

  setVisible(visible) {
    this.#root.classList.toggle('is-hidden', !visible);
  }

  setMarks(value, instant = false) {
    if (!instant && value !== this.#marksTarget) {
      const node = this.#marksEl.parentElement;
      node.classList.remove('is-up', 'is-down');
      void node.offsetWidth;
      node.classList.add(value > this.#marksTarget ? 'is-up' : 'is-down');
    }
    this.#marksTarget = value;
    if (instant) {
      this.#marksShown = value;
      this.#marksEl.textContent = fmt(value);
    }
  }

  setPrestige(value) {
    const txt = fmt(value);
    if (this.#prestigeEl.textContent === txt) return;
    this.#prestigeEl.textContent = txt;
    const node = this.#prestigeEl.parentElement;
    node.classList.remove('is-up');
    void node.offsetWidth;
    node.classList.add('is-up');
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
    this.#marksEl.textContent = fmt(this.#marksShown);
  }

  /** «+N» flotante junto al contador. */
  popReward(amount) {
    const pop = el('span', 'h-pop', `+${fmt(amount)}`);
    this.#marksEl.parentElement.append(pop);
    setTimeout(() => pop.remove(), 1600);
  }

  /**
   * Aviso. kind: objective | achievement | reward | info | error | locked.
   * «locked» (puertas, mesas, máquinas fuera de servicio) va abajo en el centro, con candado.
   */
  toast({ title, text = '', kind = 'info' }) {
    if (kind === 'locked') return this.#showAlert(title, text);
    const node = el('div', `h-toast h-toast--${kind}${text ? '' : ' h-toast--solo'}`);
    const ic = el('div', 'h-toast__icon');
    ic.append(icon(TOAST_ICON[kind] ?? 'info'));
    const body = el('div', 'h-toast__body');
    body.append(el('div', 'h-toast__title', title));
    if (text) body.append(el('div', 'h-toast__text', text));
    node.append(ic, body, el('div', 'h-toast__timer'));
    this.#toasts.append(node);
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
      node.classList.remove('is-in');
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 450);
    }, 4600);
    while (this.#toasts.children.length > 4) this.#toasts.firstChild.remove();
  }

  #showAlert(title, text) {
    // estilo de los menús: candado en un rombo entre filetes dorados, rótulo pequeño, título Cinzel y texto en cursiva
    this.#alert.replaceChildren();
    const top = el('div', 'h-alert__top');
    const badge = el('span', 'h-alert__badge');
    badge.append(icon('lock'));
    top.append(el('span', 'h-alert__rule'), badge, el('span', 'h-alert__rule h-alert__rule--r'));
    this.#alert.append(top, el('div', 'h-alert__kicker', t('ui.alert.locked')), el('div', 'h-alert__title', title));
    if (text) this.#alert.append(el('div', 'h-alert__text', text));
    this.#alert.append(el('span', 'h-alert__rule h-alert__rule--bottom'));
    this.#alert.classList.remove('is-on');
    void this.#alert.offsetWidth;
    this.#alert.classList.add('is-on');
    clearTimeout(this.#alertTimer);
    this.#alertTimer = setTimeout(() => this.#alert.classList.remove('is-on'), 3400);
  }

  /** @param {{key:string,textKey:string,params?:object}|null} prompt */
  setPrompt(prompt) {
    this.#lastPrompt = prompt;
    if (!prompt) {
      this.#prompt.classList.remove('is-on');
      return;
    }
    this.#prompt.replaceChildren(keycap(prompt.key, true), el('span', 'h-prompt__text', () => t(prompt.textKey, prompt.params)));
    this.#prompt.classList.add('is-on');
  }

  /** Tras un cambio de idioma: repinta lo que se construye con parámetros. */
  refreshTexts() {
    this.setPrompt(this.#lastPrompt);
    if (this.#lastBet) this.setBet(this.#lastBet);
    if (this.#lastQuest) this.#questKey = '';
    else this.setObjective(this.#lastObjective);
    this.setTutorial(this.#lastTutorial?.step ?? null, this.#lastTutorial?.index, this.#lastTutorial?.total);
    this.setMode(this.#mode);
    this.#renderControls();
  }

  #renderControls() {
    // «WASD mover · MAYÚS correr · …» → teclas dibujadas
    const parts = String(t('hud.controls')).split('·').map((s) => s.trim()).filter(Boolean);
    this.#controls.replaceChildren(...parts.map((p) => {
      const m = /^(\S+)\s+(.*)$/.exec(p);
      const s = el('span', 'h-controls__item');
      if (m) s.append(keycap(m[1]), el('span', '', m[2]));
      else s.append(el('span', '', p));
      return s;
    }));
  }

  /**
   * Rastreador de misión: {type, title, text, n?, total?} o null.
   * Solo se reconstruye (y anima) cuando cambia el contenido.
   */
  setQuest(q) {
    this.#lastQuest = q;
    this.#lastObjective = null;
    if (!q || !q.text) {
      this.#objective.classList.remove('is-on');
      this.#questKey = '';
      return;
    }
    const key = `${q.type}|${q.title}|${q.text}|${q.n}|${q.total}`;
    if (key === this.#questKey) return;
    const base = q.text.replace(/[(（][^()（）]*[)）]$/, '');
    const changedObjective = !!this.#questKey && this.#questBase !== base;
    this.#questKey = key;
    this.#questBase = base;
    const parts = [];
    if (q.type !== 'hint') parts.push(el('div', `h-quest__type h-quest__type--${q.type}`, t(`quest.type.${q.type}`)));
    if (q.title) parts.push(el('div', 'h-quest__title', q.title));
    const line = el('div', 'h-quest__line');
    line.append(el('span', 'h-quest__box'), el('span', 'h-quest__text', q.text));
    parts.push(line);
    if (q.total > 1) {
      const bar = el('div', 'h-quest__bar');
      const fill = el('div', 'h-quest__fill');
      fill.style.transform = `scaleX(${Math.min(1, q.n / q.total)})`;
      bar.append(fill);
      parts.push(bar);
    }
    this.#objective.replaceChildren(...parts);
    this.#objective.classList.toggle('is-hint', q.type === 'hint');
    this.#objective.classList.add('is-on');
    if (changedObjective) {
      this.#objective.classList.remove('is-pulse');
      void this.#objective.offsetWidth;
      this.#objective.classList.add('is-pulse');
    }
  }

  /** Panel de apuesta: {bet, max, canLower, canRaise, free}. */
  setBet(b) {
    this.#lastBet = b;
    const text = b.free ? t('hud.freeSpin') : String(b.bet);
    if (this.#betValue.textContent !== text) {
      this.#betValue.textContent = text;
      this.#betValue.classList.remove('is-bump');
      void this.#betValue.offsetWidth;
      this.#betValue.classList.add('is-bump');
    }
    this.#bet.classList.toggle('is-free', !!b.free);
    this.#betDown.classList.toggle('is-off', !b.canLower || b.free);
    this.#betUp.classList.toggle('is-off', !b.canRaise || b.free);
    this.#betMax.textContent = b.free ? '' : t('hud.betMax', { n: b.max });
  }

  /** «+250 MARKS» / «−25 MARKS» al resolver una tirada. */
  popNet(net, outcome) {
    const node = el('div', `h-net is-${outcome}`, net > 0 ? t('hud.net.win', { n: net }) : net < 0 ? t('hud.net.lose', { n: -net }) : t('result.push'));
    this.#root.append(node);
    setTimeout(() => node.remove(), 1700);
  }

  /** Brújula hacia el objetivo: {angle (rad, 0 = delante), dist (m)} o null. */
  setWaypoint(w) {
    if (!w) {
      this.#compass.classList.remove('is-on');
      return;
    }
    this.#compass.classList.add('is-on');
    // ±90° visibles en la cinta; fuera de ese arco el marcador se queda en el borde con flecha
    const half = Math.PI / 2;
    const a = Math.max(-half, Math.min(half, -w.angle));
    this.#compassMark.style.left = `${50 + (a / half) * 50}%`;
    this.#compassMark.classList.toggle('is-edge', Math.abs(w.angle) > half);
    this.#compassMark.classList.toggle('is-left', -w.angle < 0);
    const d = `${Math.round(w.dist)} m`;
    if (this.#compassDist.textContent !== d) this.#compassDist.textContent = d;
  }

  /** Objetivo de progresión (sistema antiguo): {id, value, target, reward} o null. */
  setObjective(o) {
    this.#lastObjective = o;
    if (!o) {
      if (!this.#lastQuest) this.#objective.classList.remove('is-on');
      return;
    }
    const bar = el('div', 'h-quest__bar');
    const fill = el('div', 'h-quest__fill');
    fill.style.transform = `scaleX(${Math.min(1, o.value / o.target)})`;
    bar.append(fill);
    this.#objective.replaceChildren(
      el('div', 'h-quest__type', t('hud.objective')),
      el('div', 'h-quest__title', t(`objective.${o.id}.name`)),
      el('div', 'h-quest__text', t(`objective.${o.id}.desc`)),
      bar,
    );
    this.#objective.classList.add('is-on');
  }

  /** Paso de tutorial {text} con su posición, o null para ocultarlo. */
  setTutorial(step, index = 0, total = 0) {
    this.#lastTutorial = step ? { step, index, total } : null;
    if (!step) {
      this.#tutorial.classList.remove('is-on');
      return;
    }
    this.#tutorial.replaceChildren(el('div', 'h-quest__type', t('hud.tutorial', { index: index + 1, total })), el('div', 'h-quest__text', t(`tut.${step.id}`)));
    this.#tutorial.classList.add('is-on');
  }

  setMode(mode) {
    this.#mode = mode;
    this.#root.classList.toggle('mode-machine', mode === 'machine');
    this.#root.classList.toggle('mode-table', mode === 'table');
    this.#crosshair.classList.toggle('is-on', mode === 'explore');
    this.#hint.classList.toggle('is-on', mode === 'machine');
    if (mode === 'machine') {
      const item = (txt) => {
        const m = /^(.+?)\s+·\s+(.+)$/.exec(txt);
        const s = el('span', 'h-hints__item');
        if (m) {
          const keys = m[1].split('/').map((k) => k.trim());
          for (const k of keys) s.append(keycap(k));
          s.append(el('span', '', m[2]));
        } else s.append(el('span', '', txt));
        return s;
      };
      this.#hint.replaceChildren(item(t('hud.machine.spin')), item(t('hud.machine.bet')), item(t('hud.machine.leave')));
    }
  }

  setControlsVisible(visible) {
    this.#controls.classList.toggle('is-on', visible);
  }

  showLockHint(visible) {
    this.#lockHint.classList.toggle('is-on', visible);
  }
}
