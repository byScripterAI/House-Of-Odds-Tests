import { ECONOMY } from '../config.js';
import { UPGRADES } from '../data/upgrades.js';
import { ACHIEVEMENTS, OBJECTIVES, ZONES } from '../data/progression.js';
import { EFFECTS, SYMBOLS, SYMBOL_IDS } from '../data/symbols.js';
import { symbolCanvas } from '../machines/symbol-art.js';
import { Screen, button, el, uiSfx } from './ui-kit.js';

const TABS = [
  ['casino', 'CASINO'],
  ['machine', 'MÁQUINA'],
  ['objectives', 'OBJETIVOS'],
  ['collection', 'COLECCIÓN'],
];

const GEM = '<svg class="gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 10 12 22 3 10Z" fill="currentColor"/><path d="M12 2 21 10H3Z" fill="#fff" opacity=".35"/></svg>';
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  lighting: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>'),
  decor: svg('<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8Z"/>'),
  expand: svg('<path d="M4 20V6l8-3 8 3v14M9 20v-6h6v6"/>'),
  install: svg('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
  mod: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
  symbol: svg('<path d="m12 3 2.4 6.3 6.6.3-5.2 4.1 1.8 6.5L12 16.5 6.4 20.2l1.8-6.5L3 9.6l6.6-.3Z"/>'),
  synergy: svg('<path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11Z"/>'),
};

const FUTURE_MACHINES = ['NEON RUSH', 'GOLDEN EMPEROR', 'THE ABYSS'];

/** Panel del mostrador: mejoras, objetivos y colección. */
export class ManagerPanel extends Screen {
  #getProgress;
  #onBuy;
  #onClose;
  #tab = 'casino';
  #justBought = null;
  #balance;
  #tabsEl;
  #content;

  /** @param {{getProgress:()=>import('../systems/progress.js').Progress,onBuy:(id:string)=>object,onClose:Function}} h */
  constructor(h) {
    super('screen--center');
    this.#getProgress = h.getProgress;
    this.#onBuy = h.onBuy;
    this.#onClose = h.onClose;

    const card = el('div', 'panel panel--manager');
    const head = el('div', 'manager__head');
    this.#balance = el('div', 'manager__balance');
    head.append(el('h2', 'panel__title', 'TIENDA'), this.#balance);
    this.#tabsEl = el('div', 'tabs');
    for (const [id, label] of TABS) {
      const b = button(label, () => {
        this.#tab = id;
        this.#justBought = null;
        this.refresh();
      }, { cls: 'tab' });
      b.dataset.tab = id;
      this.#tabsEl.append(b);
    }
    this.#content = el('div', 'manager__content');
    card.append(head, this.#tabsEl, this.#content, button('CERRAR  ·  ESC', () => this.#onClose(), { cls: 'btn--ghost manager__close' }));
    this.el.append(card);
  }

  open() {
    this.refresh();
    this.show();
  }

  refresh() {
    const p = this.#getProgress();
    this.#balance.textContent = `${p.marks} ${ECONOMY.currency.label}  ·  ${ECONOMY.prestige.label} ${p.prestige}`;
    for (const b of this.#tabsEl.children) b.classList.toggle('is-active', b.dataset.tab === this.#tab);
    const view = { casino: () => this.#upgrades('casino'), machine: () => this.#upgrades('machine'), objectives: () => this.#objectives(), collection: () => this.#collection() }[this.#tab]();
    this.#content.replaceChildren(view);
  }

  #upgrades(branch) {
    const p = this.#getProgress();
    const grid = el('div', 'cards');
    const list = Object.values(UPGRADES).filter((x) => x.branch === branch);
    // primero lo que puedes comprar ya, luego lo demás en el orden original
    const rank = (u) => (p.has(u.id) ? 3 : p.canBuy(u.id).ok ? 0 : p.canBuy(u.id).reason === 'marks' ? 1 : 2);
    list.sort((a, b) => rank(a) - rank(b));
    for (const u of list) {
      const owned = p.has(u.id);
      const check = p.canBuy(u.id);
      const state = owned ? 'is-owned' : check.ok ? 'is-ready' : check.reason === 'marks' ? 'is-near' : 'is-locked';
      const card = el('div', `card ${state}${u.id === this.#justBought ? ' is-new' : ''}`);
      const icon = el('div', 'card__icon');
      icon.insertAdjacentHTML('beforeend', ICONS[u.group] ?? ICONS.mod); // SVG estático y de confianza
      const head = el('div', 'card__head');
      head.append(icon, el('h4', 'card__name', u.name));
      card.append(head, el('p', 'card__desc', u.desc));
      const foot = el('div', 'card__foot');
      if (owned) {
        foot.append(el('span', 'card__tag', '✓ INSTALADA'));
      } else if (check.reason === 'prestige') {
        foot.append(el('span', 'card__lock', `Requiere ${ECONOMY.prestige.label} ${check.need}`));
      } else if (check.reason === 'requires') {
        foot.append(el('span', 'card__lock', `Requiere: ${UPGRADES[check.need].name}`));
      } else {
        const price = el('span', 'card__price', `${u.cost}`);
        price.insertAdjacentHTML('afterbegin', GEM);
        if (check.ok) {
          const buy = button('COMPRAR', (event) => {
            const r = event.currentTarget.getBoundingClientRect();
            const origin = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
            this.#justBought = u.id;
            const result = this.#onBuy(u.id, origin);
            if (!result.ok) uiSfx('error');
            this.refresh();
          }, { cls: 'btn--primary btn--small btn--buy' });
          foot.append(price, buy);
        } else {
          const meter = el('div', 'card__meter');
          const fill = el('div', 'card__meter-fill');
          fill.style.width = `${Math.max(4, Math.min(100, (p.marks / u.cost) * 100))}%`;
          meter.append(fill);
          foot.append(price, el('span', 'card__need', `Faltan ${u.cost - p.marks}`), meter);
        }
      }
      card.append(foot);
      grid.append(card);
    }
    return grid;
  }

  #objectives() {
    const p = this.#getProgress();
    const metrics = p.metrics();
    const wrap = el('div', 'objectives');
    const list = el('div', 'objective-list');
    for (const o of OBJECTIVES) {
      const done = p.state.objectives.completed.includes(o.id);
      const value = Math.min(o.target, metrics[o.metric]);
      const row = el('div', `objective${done ? ' is-done' : ''}`);
      const top = el('div', 'objective__top');
      top.append(el('span', 'objective__name', `${done ? '✓ ' : ''}${o.name}`), el('span', 'objective__reward', `+${o.reward} ${ECONOMY.currency.label}`));
      const bar = el('div', 'bar');
      const fill = el('div', 'bar__fill');
      fill.style.width = `${(value / o.target) * 100}%`;
      bar.append(fill);
      row.append(top, el('div', 'objective__desc', `${o.desc}  (${value}/${o.target})`), bar);
      list.append(row);
    }
    const ach = el('div', 'achievements');
    ach.append(el('h3', 'set-section__title', `LOGROS  ${p.state.achievements.length}/${ACHIEVEMENTS.length}`));
    const grid = el('div', 'ach-grid');
    for (const a of ACHIEVEMENTS) {
      const got = p.state.achievements.includes(a.id);
      const item = el('div', `ach${got ? ' is-got' : ''}`);
      item.append(el('div', 'ach__name', got ? a.name : '???'), el('div', 'ach__desc', got ? a.desc : 'Aún por descubrir'));
      grid.append(item);
    }
    ach.append(grid);
    wrap.append(list, ach);
    return wrap;
  }

  #collection() {
    const p = this.#getProgress();
    const c = p.state.collection;
    const wrap = el('div', 'collection');

    const symbols = el('div', 'symbol-grid');
    for (const id of SYMBOL_IDS) {
      const found = c.symbols.includes(id);
      const cell = el('div', `symbol${found ? ' is-found' : ''}`);
      cell.append(symbolCanvas(id, 72, !found), el('div', 'symbol__name', found ? SYMBOLS[id].name : '???'));
      symbols.append(cell);
    }

    const effects = el('div', 'chips');
    for (const e of Object.values(EFFECTS)) {
      effects.append(el('span', `chip${c.effects.includes(e.id) ? ' is-found' : ''}`, c.effects.includes(e.id) ? e.name : '???'));
    }

    const machines = el('div', 'list');
    machines.append(el('div', 'list__row is-found', '✓ THE CLASSIC'));
    for (const name of FUTURE_MACHINES) machines.append(el('div', 'list__row', `${name} — bloqueada · próximamente`));

    const zones = el('div', 'list');
    for (const z of Object.values(ZONES)) {
      zones.append(el('div', `list__row${z.built ? ' is-found' : ''}`, z.built ? `✓ ${z.name} — abierta` : `${z.name} — ${ECONOMY.prestige.label} ${z.unlock.prestige} · ${z.unlock.marks} ${ECONOMY.currency.label} · próximamente`));
    }

    const block = (title, node) => {
      const b = el('div', 'collection__block');
      b.append(el('h3', 'set-section__title', title), node);
      return b;
    };
    wrap.append(block(`SÍMBOLOS  ${c.symbols.length}/${SYMBOL_IDS.length}`, symbols), block(`EFECTOS  ${c.effects.length}/${Object.keys(EFFECTS).length}`, effects), block('MÁQUINAS', machines), block('ZONAS', zones));
    return wrap;
  }
}
