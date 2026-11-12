import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { el, uiSfx } from './ui-kit.js';

/**
 * Interfaz de las mesas (blackjack y ruleta): cabecera con el nombre y las reglas, consejos del
 * responsable de la mesa, barra de acciones con teclas (también se pueden pulsar), etiquetas de
 * total que siguen a las cartas en 3D, cartel de resultado, historial de la ruleta y ayuda al
 * pasar el ratón por el paño.
 */
export class TableHud {
  #root;
  #head;
  #name;
  #rules;
  #badge;
  #tip;
  #tipWho;
  #tipText;
  #bar;
  #betBox;
  #betValue;
  #betSub;
  #actions;
  #history;
  #labels;
  #labelEls = new Map();
  #result;
  #resultTitle;
  #resultSub;
  #tooltip;
  #msg;
  #msgTimer = 0;
  #resultTimer = 0;
  #onAction;
  #v = new THREE.Vector3();
  labels = [];

  /** @param {HTMLElement} parent  @param {{onAction: (id: string) => void}} h */
  constructor(parent, { onAction }) {
    this.#onAction = onAction;
    this.#root = el('div', 'table-hud');
    this.#head = el('div', 'table-hud__head');
    this.#name = el('div', 'table-hud__name');
    this.#rules = el('div', 'table-hud__rules');
    this.#badge = el('div', 'table-hud__badge');
    this.#head.append(this.#name, this.#rules, this.#badge);

    this.#tip = el('div', 'table-hud__tip');
    this.#tipWho = el('div', 'table-hud__tip-who');
    this.#tipText = el('div', 'table-hud__tip-text');
    this.#tip.append(this.#tipWho, this.#tipText);

    this.#bar = el('div', 'table-hud__bar');
    this.#history = el('div', 'table-hud__history');
    this.#betBox = el('div', 'table-hud__bet');
    const down = this.#actionButton({ id: 'betDown', key: 'S', label: '' }, 'tbtn--mini');
    const up = this.#actionButton({ id: 'betUp', key: 'W', label: '' }, 'tbtn--mini');
    this.#betValue = el('div', 'table-hud__bet-value', '5');
    this.#betSub = el('div', 'table-hud__bet-sub', '');
    const mid = el('div', 'table-hud__bet-mid');
    mid.append(el('div', 'table-hud__bet-label', () => t('table.bet')), this.#betValue, this.#betSub);
    this.#betBox.append(down, mid, up);
    this.betDown = down;
    this.betUp = up;
    this.#actions = el('div', 'table-hud__actions');
    this.#bar.append(this.#history, this.#betBox, this.#actions);

    this.#labels = el('div', 'table-hud__labels');
    this.#result = el('div', 'table-hud__result');
    this.#resultTitle = el('div', 'table-hud__result-title');
    this.#resultSub = el('div', 'table-hud__result-sub');
    this.#result.append(this.#resultTitle, this.#resultSub);
    this.#tooltip = el('div', 'table-hud__tooltip');
    this.#msg = el('div', 'table-hud__msg');

    this.#root.append(this.#labels, this.#head, this.#tip, this.#result, this.#msg, this.#bar, this.#tooltip);
    parent.append(this.#root);
  }

  get element() {
    return this.#root;
  }

  #actionButton(a, cls = '') {
    const b = el('button', `tbtn ${cls} ${a.primary ? 'tbtn--primary' : ''}`.trim());
    b.type = 'button';
    b.dataset.action = a.id;
    b.append(el('span', 'tbtn__key', a.key), el('span', 'tbtn__label', a.label));
    b.addEventListener('mouseenter', () => { if (!b.disabled) uiSfx('hover'); });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      this.#onAction(a.id);
    });
    b.addEventListener('mousedown', (e) => e.stopPropagation());
    return b;
  }

  open({ name, rules, mode = null }) {
    this.#name.textContent = name;
    this.#rules.textContent = rules;
    this.setMode(mode);
    this.setTip(null);
    this.setHistory(null);
    this.#result.classList.remove('is-on');
    this.#root.classList.add('is-on');
  }

  close() {
    this.#root.classList.remove('is-on');
    this.setLabels([]);
    this.tooltip(null);
  }

  setMode(mode) {
    this.#badge.textContent = mode ?? '';
    this.#badge.classList.toggle('is-on', !!mode);
  }

  /** Botones de acción: [{id, key, label, enabled, primary, hidden}] */
  setActions(list) {
    const sig = list.map((a) => `${a.id}|${a.key}|${a.label}|${a.enabled !== false}|${!!a.primary}`).join(';');
    if (sig === this.#actions.dataset.sig) return;
    this.#actions.dataset.sig = sig;
    this.#actions.replaceChildren(...list.map((a) => {
      const b = this.#actionButton(a);
      b.disabled = a.enabled === false;
      return b;
    }));
  }

  /** Apuesta: {value (texto), sub, canLower, canRaise, hidden} */
  setBet(b) {
    this.#betBox.classList.toggle('is-hidden', !!b.hidden);
    if (b.hidden) return;
    if (this.#betValue.textContent !== String(b.value)) {
      this.#betValue.textContent = String(b.value);
      this.#betValue.classList.remove('is-bump');
      void this.#betValue.offsetWidth;
      this.#betValue.classList.add('is-bump');
    }
    this.#betSub.textContent = b.sub ?? '';
    this.betDown.disabled = !b.canLower;
    this.betUp.disabled = !b.canRaise;
    this.#betBox.classList.toggle('is-practice', !!b.practice);
  }

  setTip(text, who = '') {
    this.#tip.classList.toggle('is-on', !!text);
    if (!text) return;
    if (this.#tipText.textContent !== text) {
      this.#tipText.textContent = text;
      this.#tip.classList.remove('is-pop');
      void this.#tip.offsetWidth;
      this.#tip.classList.add('is-pop');
    }
    this.#tipWho.textContent = who;
  }

  /** Historial de números de la ruleta (más reciente primero) o null para ocultarlo. */
  setHistory(nums, colorOf = null) {
    this.#history.classList.toggle('is-on', !!nums);
    if (!nums) return;
    this.#history.replaceChildren(el('span', 'table-hud__history-label', t('table.history')), ...nums.slice(0, 10).map((n, i) => {
      const p = el('span', `table-hud__pill table-hud__pill--${colorOf(n)}${i === 0 ? ' is-new' : ''}`, String(n));
      return p;
    }));
  }

  /** Etiquetas sobre la mesa: [{id, text, kind, point: THREE.Vector3}] */
  setLabels(list) {
    this.labels = list;
    const keep = new Set(list.map((l) => l.id));
    for (const [id, node] of this.#labelEls) {
      if (!keep.has(id)) {
        node.remove();
        this.#labelEls.delete(id);
      }
    }
    for (const l of list) {
      let node = this.#labelEls.get(l.id);
      if (!node) {
        node = el('div', 'table-hud__label');
        this.#labels.append(node);
        this.#labelEls.set(l.id, node);
      }
      node.className = `table-hud__label table-hud__label--${l.kind ?? 'plain'}`;
      if (node.textContent !== l.text) node.textContent = l.text;
    }
  }

  /** Cartel central: {title, sub, kind: 'win'|'big'|'push'|'lose'} */
  showResult({ title, sub = '', kind = 'win' }, seconds = 2.2) {
    this.#resultTitle.textContent = title;
    this.#resultSub.textContent = sub;
    this.#result.className = `table-hud__result table-hud__result--${kind}`;
    void this.#result.offsetWidth;
    this.#result.classList.add('is-on');
    this.#resultTimer = seconds;
  }

  hideResult() {
    this.#result.classList.remove('is-on');
    this.#resultTimer = 0;
  }

  message(text, seconds = 2.6) {
    this.#msg.textContent = text;
    this.#msg.classList.remove('is-on');
    void this.#msg.offsetWidth;
    this.#msg.classList.add('is-on');
    this.#msgTimer = seconds;
  }

  tooltip(text, x = 0, y = 0) {
    this.#tooltip.classList.toggle('is-on', !!text);
    if (!text) return;
    this.#tooltip.textContent = text;
    this.#tooltip.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 18)}px)`;
  }

  update(dt, camera) {
    if (this.#msgTimer > 0 && (this.#msgTimer -= dt) <= 0) this.#msg.classList.remove('is-on');
    if (this.#resultTimer > 0 && (this.#resultTimer -= dt) <= 0) this.#result.classList.remove('is-on');
    if (!this.labels.length || !camera) return;
    const w = this.#root.clientWidth || window.innerWidth;
    const h = this.#root.clientHeight || window.innerHeight;
    for (const l of this.labels) {
      const node = this.#labelEls.get(l.id);
      if (!node || !l.point) continue;
      this.#v.copy(l.point).project(camera);
      const on = this.#v.z < 1;
      node.style.opacity = on ? '' : '0';
      node.style.transform = `translate(-50%, -50%) translate(${Math.round((this.#v.x * 0.5 + 0.5) * w)}px, ${Math.round((-this.#v.y * 0.5 + 0.5) * h)}px)`;
    }
  }
}
