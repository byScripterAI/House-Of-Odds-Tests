import { t } from '../i18n/index.js';
import { NAMED } from '../entities/npc-data.js';
import { QUESTS } from '../story/quests.js';
import { Q } from '../story/quest-engine.js';
import { Screen, button, el, uiSfx } from './ui-kit.js';

const TABS = ['main', 'side', 'mastery', 'done'];

/**
 * DIARIO DE MISIONES (pausa → MISIONES, o tecla J).
 * Lista por categorías, detalle con objetivos, contacto, recompensas y
 * relación; permite marcar la misión que guía la brújula.
 */
export class QuestLog extends Screen {
  #getEngine;
  #onTrack;
  #onClose;
  #tab = 'main';
  #selected = null;
  #tabs;
  #list;
  #detail;
  #relations;

  /** @param {{getEngine: Function, onTrack: (id:string) => void, onClose: Function}} h */
  constructor(h) {
    super('screen--center');
    this.#getEngine = h.getEngine;
    this.#onTrack = h.onTrack;
    this.#onClose = h.onClose;
    const card = el('div', 'panel panel--quests');
    const head = el('div', 'quests__head');
    head.append(el('h2', 'panel__title', () => t('quest.ui.title')));
    this.#tabs = el('div', 'tabs');
    for (const id of TABS) {
      const b = button(() => t(`quest.ui.tab.${id}`), () => {
        this.#tab = id;
        this.#selected = null;
        uiSfx('tabSwitch');
        this.refresh();
      }, { cls: 'tab' });
      b.dataset.tab = id;
      this.#tabs.append(b);
    }
    const body = el('div', 'quests__body');
    this.#list = el('div', 'quests__list');
    this.#detail = el('div', 'quests__detail');
    body.append(this.#list, this.#detail);
    this.#relations = el('div', 'quests__relations');
    card.append(head, this.#tabs, body, this.#relations, button(() => t('shop.close'), () => this.#onClose(), { cls: 'btn--ghost manager__close' }));
    this.el.append(card);
  }

  open() {
    const e = this.#getEngine();
    this.#selected = e?.trackedQuest() ?? null;
    if (this.#selected) this.#tab = QUESTS[this.#selected]?.type === 'main' ? 'main' : QUESTS[this.#selected]?.type ?? 'main';
    this.refresh();
    this.show();
  }

  #entries(e) {
    const vis = (s) => s === Q.ACTIVE || s === Q.AVAILABLE || s === Q.REPEATABLE;
    if (this.#tab === 'done') return e.list((d, s) => s === Q.COMPLETED);
    return e.list((d, s) => d.type === this.#tab && (vis(s) || (d.comingSoon && e.requirementsMet({ requires: { quests: d.requires.quests } }))));
  }

  refresh() {
    const e = this.#getEngine();
    if (!e) return;
    for (const b of this.#tabs.children) b.classList.toggle('is-active', b.dataset.tab === this.#tab);
    const list = this.#entries(e);
    if (!list.some((d) => d.id === this.#selected)) this.#selected = list[0]?.id ?? null;
    this.#list.replaceChildren(
      ...(list.length ? list.map((d) => {
        const st = d.comingSoon ? 'soon' : e.status(d.id);
        const item = el('button', `quests__item is-${st}${d.id === this.#selected ? ' is-selected' : ''}${e.trackedQuest() === d.id ? ' is-tracked' : ''}`);
        item.type = 'button';
        item.append(el('span', 'quests__item-title', t(`quest.${d.id}.title`)), el('span', 'quests__item-state', d.comingSoon ? '…' : t(`quest.state.${st === Q.REPEATABLE ? 'active' : st}`)));
        item.addEventListener('click', () => {
          this.#selected = d.id;
          uiSfx('click');
          this.refresh();
        });
        return item;
      }) : [el('p', 'quests__empty', t('quest.ui.empty'))]),
    );
    this.#renderDetail(e);
    this.#relations.replaceChildren(
      ...Object.keys(NAMED).filter((id) => (e.state.rel[id] ?? 0) > 0).map((id) => {
        const r = e.relation(id);
        const chip = el('div', 'quests__rel');
        chip.style.setProperty('--npc', NAMED[id].color);
        const meter = el('div', 'quests__rel-meter');
        const fill = el('div', 'quests__rel-fill');
        fill.style.width = `${r.points}%`;
        meter.append(fill);
        chip.append(el('span', 'quests__rel-name', t(`npc.${id}.name`)), el('span', 'quests__rel-level', t(`rel.${r.level}`)), meter);
        return chip;
      }),
    );
  }

  #renderDetail(e) {
    const id = this.#selected;
    const d = id ? QUESTS[id] : null;
    if (!d) {
      this.#detail.replaceChildren(el('p', 'quests__empty', t('quest.ui.empty')));
      return;
    }
    const st = e.status(id);
    const parts = [
      el('div', 'quests__tags', null),
      el('h3', 'quests__title', t(`quest.${id}.title`)),
      el('p', 'quests__desc', t(`quest.${id}.desc`)),
    ];
    parts[0].append(el('span', `hud__quest-type hud__quest-type--${d.type}`, t(`quest.type.${d.type}`)));
    if (d.comingSoon) {
      parts.push(el('p', 'quests__soon', t('quest.ui.soon')));
    } else {
      const giver = el('p', 'quests__giver', t('quest.ui.giver', { name: t(`npc.${d.giver}.name`), role: t(`npc.${d.giver}.role`) }));
      giver.style.setProperty('--npc', NAMED[d.giver].color);
      parts.push(giver);
      const objs = el('ol', 'quests__objectives');
      const cur = e.objective(id);
      const doneCount = st === Q.COMPLETED ? d.objectives.length : cur?.index ?? 0;
      d.objectives.forEach((o, i) => {
        if (st !== Q.COMPLETED && i > doneCount) return; // los siguientes objetivos se descubren al avanzar
        const done = i < doneCount;
        const params = i === doneCount && cur ? { n: cur.progress.n, total: cur.progress.total } : { n: o.points?.length ?? o.count ?? 1, total: o.points?.length ?? o.count ?? 1 };
        objs.append(el('li', done ? 'is-done' : 'is-current', t(`quest.${id}.obj.${o.id}`, params)));
      });
      if (st === Q.AVAILABLE) objs.append(el('li', 'is-current', t('quest.ui.available', { name: t(`npc.${d.giver}.name`) })));
      parts.push(objs);
      const r = d.rewards ?? {};
      const rw = [];
      if (r.marks) rw.push(t('quest.reward.marks', { n: r.marks }));
      if (r.prestige) rw.push(t('quest.reward.prestige', { n: r.prestige }));
      if (r.flags?.includes('title_classic_master')) rw.push(t('quest.reward.title', { title: t('title.classic_master') }));
      for (const u of r.unlocks ?? []) rw.push(t(`reward.unlock.${u}`));
      if (rw.length) parts.push(el('div', 'quests__rewards', `${t('quest.ui.rewards')}: ${rw.join('  ·  ')}`));
      if (st === Q.ACTIVE || st === Q.REPEATABLE) {
        const tracked = e.trackedQuest() === id;
        parts.push(button(() => t(tracked ? 'quest.ui.tracking' : 'quest.ui.track'), () => {
          this.#onTrack(id);
          uiSfx('confirm');
          this.refresh();
        }, { cls: tracked ? 'btn--small is-active' : 'btn--primary btn--small', disabled: tracked }));
      }
    }
    this.#detail.replaceChildren(...parts);
  }
}
