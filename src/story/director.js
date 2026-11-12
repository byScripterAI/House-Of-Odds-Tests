import * as THREE from 'three';
import { i18n, t } from '../i18n/index.js';
import { UPGRADES } from '../data/upgrades.js';
import { VENDORS, TAB_FILTERS } from '../data/vendors.js';
import { NAMED } from '../entities/npc-data.js';
import { CLASSIC, POIS, STORY_SPOTS, TABLES } from '../world/layout.js';
import { DIALOGUES, SMALLTALK } from './dialogues.js';
import { QUESTS } from './quests.js';
import { Q, QuestEngine, RELATION_LEVELS } from './quest-engine.js';

/**
 * DIRECTOR DE LA HISTORIA.
 *
 * Une el motor de misiones (puro) con el juego: elige qué conversación toca al
 * hablar con alguien, la reproduce (texto, voz, cámara, gestos), aplica sus
 * consecuencias, convierte las notas del motor en avisos, recompensas y
 * cambios del mundo, y mantiene la guía en pantalla (rastreador, iconos sobre
 * los personajes y baliza del objetivo).
 */

/** Puestos alternativos de los personajes durante las misiones. */
const POSTS = {
  daniel: {
    bench: { x: 12.35, z: 0.8, yaw: Math.PI / 2, activity: 'work' },
    classic: { x: CLASSIC.x + 1.5, z: CLASSIC.z + 0.35, yaw: -Math.PI / 2 + 0.35, activity: 'idle' },
  },
};

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

export class StoryDirector {
  /**
   * @param {object} h dependencias del juego (ver App)
   */
  constructor(h) {
    this.h = h;
    this.engine = null;
    this.dlg = null; // conversación en curso
    this.queue = []; // conversaciones/acciones pendientes
    this.after = []; // acciones al cerrar la conversación (abrir tienda, cinemática…)
    this.portraits = new Map();
    this.beaconTarget = null;
    this.trackKey = '';
  }

  get progress() {
    return this.h.getProgress();
  }

  ctx() {
    const p = this.progress;
    return { spins: p.state.stats.totalActivations, prestige: p.prestige, owned: [...p.state.upgrades] };
  }

  // ------------------------------------------------------------------ arranque

  /** Nueva partida o partida cargada: arranca el motor sobre el estado guardado. */
  begin() {
    this.engine = new QuestEngine(this.progress.state.story, QUESTS);
    this.dlg = null;
    this.queue = [];
    this.after = [];
    const notes = this.engine.evaluate(this.ctx());
    this.seq = {};
    this.#applyWorld(true);
    this.#handle(notes, { silent: true });
    this.refresh();
  }

  // ------------------------------------------------------------------ eventos del juego

  /** Interacción con un objeto. Devuelve true si la historia la gestiona. */
  interact(item) {
    if (!this.engine) return false;
    if (item.npc) {
      this.talk(item.npc);
      return true;
    }
    if (item.target && item.id?.startsWith('story:')) {
      this.h.audio.sfx('confirm');
      this.#handle(this.engine.emit({ type: 'interact', target: item.target }, this.ctx()));
      return true;
    }
    if (item.id === 'machine' && !this.engine.hasFlag('classic_repaired')) {
      this.h.audio.sfx('doorLocked');
      const m02 = this.engine.status('m02');
      this.h.hud.toast({ title: t('prompt.outOfOrder'), text: m02 === Q.ACTIVE ? t(`quest.m02.obj.${this.engine.objective('m02')?.def.id ?? 'meet'}`) : t('dlg.vic_daniel.start'), kind: 'locked' });
      return true;
    }
    return false;
  }

  /** Fin de una tirada (tras la animación). */
  onSpin(result) {
    if (!this.engine) return;
    this.#handle([...this.engine.emit({ type: 'spin', tier: result.tier }, this.ctx()), ...this.engine.evaluate(this.ctx())]);
  }

  /** Fin de una ronda en una mesa (blackjack / ruleta). */
  onPlay(game, { tags = [], practice = false } = {}) {
    if (!this.engine) return;
    this.#handle([...this.engine.emit({ type: 'play', game, tags, practice }, this.ctx()), ...this.engine.evaluate(this.ctx())]);
  }

  hasFlag(f) {
    return !!this.engine?.hasFlag(f);
  }

  /** Progreso del objetivo actual de una misión ({n, total}) o null. */
  objectiveProgress(qid) {
    return this.engine?.objective(qid)?.progress ?? null;
  }

  /** ¿Está activo el desafío de práctica de la ruleta (THE PERFECT NUMBER)? */
  challengeOpen() {
    return this.engine?.objective('x06')?.def.id === 'exact';
  }

  /**
   * ¿Se puede jugar en la mesa? → {ok, mode: 'play'|'practice'|'tutorial'|'predict'} o {ok:false, text}.
   * Las mesas se abren con sus misiones (La casa de las cartas, El giro perfecto); mientras tanto
   * solo admiten las rondas de práctica que la misión pide.
   */
  tableAccess(game) {
    const e = this.engine;
    const host = game === 'blackjack' ? 'oliver' : 'lucas';
    const quest = game === 'blackjack' ? 'm04' : 'm05';
    const name = game === 'blackjack' ? 'ROYAL BLACKJACK' : 'ROYAL ROULETTE';
    if (!e) return { ok: false, text: '' };
    const step = e.objective(quest)?.def.id;
    if (game === 'blackjack' && step === 'practice') return { ok: true, mode: e.getVar('bj_tutorial') === 'full' ? 'tutorial' : 'practice' };
    if (game === 'roulette' && step === 'predict') return { ok: true, mode: 'predict' };
    if (e.hasFlag(game === 'blackjack' ? 'blackjack_open' : 'roulette_open')) return { ok: true, mode: 'play' };
    const who = t(`npc.${host}.name`);
    return { ok: false, text: e.status(quest) === Q.ACTIVE ? t('table.msg.closedTalk', { who }) : t('table.msg.closed', { name, who }) };
  }

  onBuy(id) {
    if (!this.engine) return;
    this.#handle([...this.engine.emit({ type: 'buy', id }, this.ctx()), ...this.engine.evaluate(this.ctx())]);
  }

  /** Cambios de progreso que pueden desbloquear misiones (PRESTIGE…). */
  onProgress() {
    if (!this.engine || this.dlg) return;
    const notes = this.engine.evaluate(this.ctx());
    if (notes.length) this.#handle(notes);
    else this.refresh();
  }

  // ------------------------------------------------------------------ conversaciones

  /** El jugador habla con un personaje: elige la conversación adecuada. */
  talk(npc) {
    const e = this.engine;
    let id = null;
    // 1) un objetivo «hablar» con este personaje
    for (const q of e.active()) {
      const o = e.objective(q.id);
      if (o?.def.type === 'talk' && o.def.npc === npc) {
        id = o.def.dialogue;
        break;
      }
    }
    // 2) una misión disponible que este personaje ofrece (si la rechazaste, alterna con su charla/servicio)
    if (!id) {
      const offer = e.list((d, s) => s === Q.AVAILABLE && d.giver === npc && d.offer && e.canStart(d.id))[0];
      if (offer && (e.seen(offer.offer) === 0 || !this.offered?.[npc])) {
        id = offer.offer;
        (this.offered ??= {})[npc] = true;
      } else if (offer) this.offered[npc] = false;
    }
    // 3) charla según el progreso
    if (!id) id = (SMALLTALK[npc] ?? []).find((x) => e.test(x.cond))?.id ?? null;
    if (id) this.play(id);
  }

  /** Reproduce una conversación (o la encola si ya hay una). */
  play(id) {
    const d = DIALOGUES[id];
    if (!d) return;
    if (this.dlg) {
      this.queue.push(id);
      return;
    }
    const h = this.h;
    if (!h.enterDialogue()) {
      this.queue.push(id);
      return;
    }
    const npc = d.npc;
    const def = NAMED[npc];
    this.dlg = { id, d, npc, node: 'start' };
    const pp = h.getPlayerPos();
    h.npcs.talkStart(npc, pp);
    this.#frameCamera(npc);
    const questDef = d.quest ? QUESTS[d.quest] : null;
    h.dialogue.open({
      name: t(`npc.${npc}.name`),
      role: t(`npc.${npc}.role`),
      color: def.color,
      portrait: this.portraits.get(npc) ?? null,
      quest: questDef && !questDef.comingSoon ? t(`quest.${questDef.id}.title`) : null,
    });
    // el retrato se genera tras el primer fotograma (la cabeza ya está girada hacia ti)
    if (!this.portraits.has(npc)) {
      setTimeout(() => {
        const url = this.#portrait(npc);
        if (url && this.dlg?.npc === npc) h.dialogue.setPortrait(url);
      }, 450);
    }
    this.#run('start');
  }

  #frameCamera(npc) {
    const h = this.h;
    h.rig.focusOn(() => {
      const head = h.npcs.headPosition(npc, _t) ?? _t.set(0, 1.6, 0);
      const eye = h.getPlayerEye();
      // cámara a la altura de los ojos del jugador, un poco más cerca y ligeramente ladeada
      const dx = head.x - eye.x;
      const dz = head.z - eye.z;
      const dist = Math.max(0.6, Math.hypot(dx, dz));
      const k = Math.max(0, (dist - 1.25) / dist);
      _v.set(eye.x + dx * k - (dz / dist) * 0.22, head.y + 0.02, eye.z + dz * k + (dx / dist) * 0.22);
      return { position: _v, target: head };
    }, { fov: 44, duration: 0.8 });
  }

  /** Avanza por los nodos hasta mostrar una línea o una elección. */
  #run(nodeId) {
    const s = this.dlg;
    if (!s) return;
    let guard = 0;
    let id = nodeId;
    while (guard++ < 50) {
      const node = s.d.nodes[id];
      if (!node) return this.#endDialogue();
      if (node.branch) {
        const hit = node.branch.find((b) => this.engine.test(b.cond));
        id = hit ? hit.next : node.else;
        continue;
      }
      s.node = id;
      if (node.say) {
        this.#applyEffects(node.effects);
        this.#showLine(node, id);
        return;
      }
      if (node.choices) {
        const list = node.choices.filter((c) => this.engine.test(c.cond)).map((c) => ({ id: c.id, text: t(`dlg.${s.id}.${id}.${c.id}`) }));
        this.h.npcs.setTalking(s.npc, false);
        this.h.dialogue.choices(list);
        return;
      }
      return this.#endDialogue();
    }
  }

  #showLine(node, nodeId) {
    const s = this.dlg;
    const h = this.h;
    const isPlayer = node.say === 'player';
    const speaker = isPlayer ? null : NAMED[node.say];
    h.dialogue.setSpeaker(isPlayer
      ? { name: t('npc.player'), role: '', color: '#e8e2d6', player: true }
      : { name: t(`npc.${node.say}.name`), role: t(`npc.${node.say}.role`), color: speaker.color, portrait: this.portraits.get(node.say) ?? null });
    const text = t(`dlg.${s.id}.${nodeId}`);
    if (!isPlayer) h.npcs.setTalking(node.say, true);
    const voiceId = `${s.id}__${nodeId}`;
    // con grabación, el texto se escribe al ritmo de la voz (la caja espera a saber cuánto dura)
    const voiced = !isPlayer && h.audio.hasVoice(voiceId, i18n.lang) && h.audio.ctx?.state === 'running';
    h.dialogue.line(text, { waitVoice: voiced, onTyped: () => { if (!isPlayer && !h.audio.voicePlaying) h.npcs.setTalking(node.say, false); } });
    h.audio.stopVoice();
    if (!isPlayer) {
      h.audio.playVoice(voiceId, {
        lang: i18n.lang,
        onStart: (sec) => { if (this.dlg === s) h.dialogue.setVoiceDuration(sec); },
        onEnd: () => { if (this.dlg === s) h.npcs.setTalking(node.say, false); },
      }).then((ok) => { if (!ok && this.dlg === s) h.dialogue.noVoice(); });
    }
  }

  /** La ventana pide continuar. */
  advance() {
    const s = this.dlg;
    if (!s) return;
    const node = s.d.nodes[s.node];
    if (node?.end) return this.#endDialogue();
    this.#run(node?.next);
  }

  /** El jugador eligió una respuesta. */
  choose(choiceId) {
    const s = this.dlg;
    if (!s) return;
    const node = s.d.nodes[s.node];
    const c = node?.choices?.find((x) => x.id === choiceId);
    if (!c) return;
    this.h.audio.sfx('dialogChoice');
    this.#applyEffects(c.effects);
    this.#run(c.next);
  }

  /** Saltar: avanza (aplicando consecuencias) hasta la próxima decisión o el final. */
  skip() {
    const s = this.dlg;
    if (!s) return;
    this.h.audio.stopVoice();
    let id = s.d.nodes[s.node]?.end ? null : s.d.nodes[s.node]?.next;
    let guard = 0;
    while (id && guard++ < 50) {
      const node = s.d.nodes[id];
      if (!node || node.choices || node.branch) break;
      this.#applyEffects(node.effects);
      if (node.end) {
        s.node = id;
        return this.#endDialogue();
      }
      id = node.next;
    }
    if (id) this.#run(id);
    else this.#endDialogue();
  }

  #applyEffects(effects) {
    if (!effects) return;
    const e = this.engine;
    for (const fx of effects) {
      if (fx.rel) {
        const before = e.relation(fx.rel[0]).index;
        e.addRelation(fx.rel[0], fx.rel[1]);
        const after = e.relation(fx.rel[0]);
        if (after.index > before) {
          this.h.dialogue.flash(`${t(`npc.${fx.rel[0]}.name`)} · ${t(`rel.${after.level}`)} ▲`, NAMED[fx.rel[0]].color);
          this.h.audio.sfx('relationUp');
        }
      }
      if (fx.set) e.setVar(fx.set[0], fx.set[1]);
      if (fx.flag) e.setFlag(fx.flag);
      if (fx.start) this.after.push(() => this.#handle(e.start(fx.start, this.ctx())));
      if (fx.grant) this.after.push(() => this.#grant(fx.grant));
      if (fx.shop) this.after.push(() => this.h.openShop(fx.shop));
      if (fx.npcPost) this.#setPost(fx.npcPost[0], fx.npcPost[1]);
    }
  }

  #endDialogue() {
    const s = this.dlg;
    if (!s) return;
    const h = this.h;
    this.dlg = null;
    h.audio.stopVoice();
    h.npcs.talkEnd();
    h.dialogue.close();
    this.engine.markSeen(s.id);
    const notes = this.engine.emit({ type: 'dialogue', id: s.id }, this.ctx());
    const after = this.after.splice(0);
    const next = this.queue.shift();
    const opensShop = after.length && !next;
    h.exitDialogue({ toShop: false, keepFocus: !!next });
    this.#handle(notes);
    for (const fn of after) fn();
    if (next) h.after(0.35, () => this.play(next));
    void opensShop;
    h.save();
  }

  get active() {
    return !!this.dlg;
  }

  /** Desafío en curso que pide un premio en THE CLASSIC: {key, tier} (para el director de suerte) o null. */
  challengeWin() {
    const e = this.engine;
    if (!e) return null;
    for (const q of e.active()) {
      if (q.type !== 'mastery') continue;
      const o = e.objective(q.id);
      if (o?.def.type === 'win') return { key: `${q.id}:${o.def.id}`, tier: o.def.tier ?? 'small' };
    }
    return null;
  }

  /**
   * ¿Puede el jugador recuperar MARKS sin apostar? Hay una misión activa o disponible que da MARKS
   * y cuyos objetivos pendientes no exigen jugar ni comprar (hablar, visitar, usar objetos…).
   * Si es así, quedarse sin MARKS no es BANCA ROTA: aún hay salida.
   */
  canRecoverWithoutBetting() {
    const e = this.engine;
    if (!e) return false;
    const needsMoney = new Set(['spin', 'win', 'buy', 'wait']);
    return e.list((d, st) => (st === Q.ACTIVE || st === Q.AVAILABLE) && !d.comingSoon && (d.rewards?.marks ?? 0) > 0).some((q) => {
      const cur = e.objective(q.id);
      const from = cur ? q.objectives.findIndex((x) => x.id === cur.def.id) : 0;
      // las rondas de mesa de una misión son de práctica (gratis) salvo que exijan MARKS
      return q.objectives.slice(Math.max(0, from)).every((x) => !needsMoney.has(x.type) && !(x.type === 'play' && x.practice === false));
    });
  }

  /** ¿La próxima tirada la invita la casa? (demostración de THE CLASSIC en «La primera máquina») */
  freeSpin() {
    return this.engine?.objective('m02')?.def.id === 'demo';
  }

  // ------------------------------------------------------------------ notas del motor

  #handle(notes, { silent = false } = {}) {
    const h = this.h;
    let delay = 0;
    const later = (fn) => {
      h.after(delay / 1000, fn);
      delay += 900;
    };
    for (const n of notes) {
      const q = QUESTS[n.quest];
      switch (n.kind) {
        case 'started':
          if (silent) break;
          later(() => {
            h.notice({ title: t('quest.toast.started'), text: t(`quest.${n.quest}.title`), kind: 'objective', sfx: 'questNew', fx: 'objective' });
          });
          break;
        case 'blocked':
          if (!silent) later(() => h.notice({ title: t('quest.toast.blocked'), text: t(`quest.${n.by}.title`), kind: 'objective' }));
          break;
        case 'available':
          if (silent || !q || q.autoStart) break;
          later(() => h.notice({ title: t(`quest.${n.quest}.title`), text: t('quest.toast.available', { name: t(`npc.${q.giver}.name`) }), kind: 'objective', sfx: 'questNew' }));
          break;
        case 'progress':
          if (!silent) h.audio.sfx('questUpdate');
          break;
        case 'objective':
          if (!silent) {
            const od = q?.objectives.find((o) => o.id === n.objective);
            const total = od?.points?.length ?? od?.count ?? od?.spins ?? 1;
            later(() => h.notice({ title: t('quest.toast.objective'), text: t(`quest.${n.quest}.obj.${n.objective}`, { n: total, total }), kind: 'objective', sfx: 'objective' }));
          }
          if (n.onDone) this.#onDone(n.onDone, silent);
          break;
        case 'completed':
          this.#reward(n, silent);
          break;
        default:
      }
    }
    this.#applyWorld();
    this.refresh();
    if (!silent && notes.length) h.save();
  }

  #onDone(a, silent) {
    const h = this.h;
    const e = this.engine;
    if (a.npcPost) this.#setPost(a.npcPost[0], a.npcPost[1]);
    if (a.item) e.setVar(`item_${a.item[0]}`, a.item[1]);
    if (a.grant) this.#grant(a.grant, silent);
    if (a.reception) e.setFlag('reception_done');
    if (a.repairHall) {
      e.setFlag('hall_repaired');
      // la app retiene los desperfectos a la vista y los quita bajo la pantalla de «REPARANDO…»
      if (!silent) h.repairHall();
    }
    if (a.openPanel && !silent) {
      // cinemática: la cámara se acerca al costado y la tapa de mantenimiento se abre
      this.seq.door = false;
      h.cinematic(
        (time) => {
          const k = Math.min(1, time / 2.6);
          const e = k * k * (3 - 2 * k);
          _v.set(CLASSIC.x + 1.75 - e * 0.15, CLASSIC.y + 1.15 - e * 0.15, CLASSIC.z - 1.0 + e * 0.1);
          _t.set(CLASSIC.x + 0.5, CLASSIC.y + 0.55, CLASSIC.z - 0.06);
          return { position: _v, target: _t };
        },
        3.2,
        () => {
          h.after(0.9, () => {
            this.seq.door = null;
            h.world.openServiceDoor(true);
            h.audio.sfx('doorOpen');
          });
        },
      );
    }
    if (a.boot && !silent) {
      // reparación: seta RESET, piloto en verde, se cierra la tapa y la cámara va al frente a ver cómo los
      // rodillos vuelven a su sitio y THE CLASSIC arranca
      this.seq.door = true;
      this.seq.powered = false;
      const T_DOOR = 2.0;
      const T_BOOT = 2.7;
      h.cinematic(
        (time) => {
          if (time < T_DOOR + 0.2) {
            _v.set(CLASSIC.x + 1.55, CLASSIC.y + 0.95, CLASSIC.z - 0.85);
            _t.set(CLASSIC.x + 0.55, CLASSIC.y + 0.55, CLASSIC.z - 0.05);
          } else {
            const k = Math.min(1, (time - T_DOOR - 0.2) / 1.6);
            const e = k * k * (3 - 2 * k);
            _v.set(CLASSIC.x + 1.55 - e * 1.2, CLASSIC.y + 0.95 + e * 0.75, CLASSIC.z - 0.85 + e * 3.4);
            _t.set(CLASSIC.x + 0.55 - e * 0.55, CLASSIC.y + 0.55 + e * 0.85, CLASSIC.z - 0.05);
          }
          return { position: _v, target: _t };
        },
        T_BOOT + 4.4,
        () => {
          h.after(0.8, () => {
            h.world.pressResetButton();
            h.audio.sfx('buttonPress');
          });
          h.after(1.2, () => h.audio.sfx('breakerLever'));
          h.after(T_DOOR, () => {
            this.seq.door = null;
            h.world.openServiceDoor(false);
            h.audio.sfx('doorClose');
          });
          h.after(T_BOOT, () => {
            this.seq.powered = null;
            h.world.bootMachine();
            h.audio.sfx('repair');
          });
          // los rodillos encajan uno a uno
          for (let r = 0; r < 3; r++) h.after(T_BOOT + 0.5 + r * 0.45, () => h.audio.sfx('reelStop'));
          h.after(T_BOOT + 2.6, () => {
            h.audio.sfx('unlock');
            h.fx.celebrate('big');
            h.fx.bigText(t('fx.repaired'), { size: 0.9, ms: 2400, kicker: 'THE CLASSIC' });
          });
        },
      );
    }
    if (a.dialogue && !silent) h.after(a.boot ? 7.4 : a.openPanel ? 3.5 : 0.25, () => this.play(a.dialogue));
  }

  #grant(id, silent = false) {
    const h = this.h;
    if (!this.progress.grant(id)) return;
    if (silent) {
      h.world.applyProgress(this.progress.loadout());
      return;
    }
    // misma presentación que una compra: la cámara va a verlo aparecer
    h.present(id);
  }

  #reward(n, silent) {
    const h = this.h;
    const r = n.rewards ?? {};
    if (n.first && (r.marks || r.prestige)) this.progress.reward({ marks: r.marks ?? 0, prestige: r.prestige ?? 0 });
    if (r.npcPost) this.#setPost(r.npcPost[0], r.npcPost[1]);
    if (r.item) this.engine.setVar(`item_${r.item[0]}`, r.item[1]);
    if (silent || !n.first) return;
    const parts = [];
    if (r.marks) parts.push(t('quest.reward.marks', { n: r.marks }));
    if (r.prestige) parts.push(t('quest.reward.prestige', { n: r.prestige }));
    if (r.flags?.includes('title_classic_master')) parts.push(t('quest.reward.title', { title: t('title.classic_master') }));
    for (const u of r.unlocks ?? []) parts.push(t(`reward.unlock.${u}`));
    h.after(0.6, () => {
      h.audio.sfx('questComplete');
      h.fx.celebrate('big');
      h.fx.bigText(t(`quest.${n.quest}.title`), { size: 0.9, ms: 2800, kicker: t('quest.toast.completed') });
      h.notice({ title: `${t('quest.toast.completed')} · ${t(`quest.${n.quest}.title`)}`, text: parts.join('  ·  '), kind: 'objective', sfx: 'coins' });
      h.syncHud();
      if (r.event === 'grand_opening') h.whenIdle(() => this.#grandOpening());
    });
  }

  /** Evento de reapertura: puertas abiertas, gente entrando, aplausos y confeti. */
  #grandOpening() {
    const h = this.h;
    h.cinematic(
      (time) => {
        const a = 0.6 + time * 0.12;
        _v.set(Math.sin(a) * 7.5, 4.2 - Math.min(1.5, time * 0.25), 4 + Math.cos(a) * 5);
        _t.set(0, 1.4, 4.5);
        return { position: _v, target: _t };
      },
      7,
      () => {
        h.audio.sfx('applauseBig');
        h.audio.sfx('confetti');
        h.fx.celebrate('jackpot');
        h.fx.bigText(t('event.grand_opening'), { size: 1.2, ms: 3600, kicker: t('fx.k.event'), sub: t('event.grand_opening.sub') });
        h.after(1.2, () => h.hud.toast({ title: t('event.grand_opening'), text: t('event.grand_opening.sub'), kind: 'objective' }));
      },
    );
  }

  #setPost(npc, postId) {
    const post = POSTS[npc]?.[postId];
    if (post) this.h.npcs.setNamed(npc, { post });
    this.engine.setVar(`post_${npc}`, postId);
  }

  // ------------------------------------------------------------------ mundo y guía

  /** Refleja en el mundo el estado narrativo (sobrevive a cargar partida). */
  #applyWorld(instant = false) {
    const e = this.engine;
    const h = this.h;
    const interacts = [];
    for (const q of e.active()) {
      const o = e.objective(q.id);
      if (o?.def.type === 'interact') interacts.push(o.def.target);
    }
    const s02 = e.objective('s02');
    const repairedClassic = e.hasFlag('classic_repaired') || e.status('m02') === Q.COMPLETED;
    const seq = this.seq ?? {};
    h.world.setStory({
      powered: seq.powered ?? repairedClassic,
      serviceDoor: seq.door ?? ['tools', 'mechanism'].includes(e.objective('m02')?.def.id),
      instantDoor: instant,
      machineBlocked: !(e.hasFlag('classic_repaired') || e.status('m02') === Q.COMPLETED),
      entranceOpen: e.hasFlag('entrance_open'),
      breaker: this.progress.has('lighting-1'),
      repaired: e.hasFlag('hall_repaired') || e.status('m03') === Q.COMPLETED || ['sign', 'classic', 'report'].includes(e.objective('m03')?.def.id),
      receptionStyle: e.hasFlag('reception_done') ? e.getVar('reception_style') ?? 'elegant' : null,
      receptionKit: s02?.def.id === 'place',
      items: { toolbox: e.getVar('item_toolbox') !== false, doc_box: e.getVar('item_doc_box') !== false },
      machineSkin: e.hasFlag('classic_vintage') ? 'vintage' : 'classic',
      interacts,
    });
    h.npcs.setCrowd(e.hasFlag('reopened') ? (this.progress.prestige >= 120 ? 3 : this.progress.prestige >= 60 ? 2 : 1) : 0);
    const post = e.getVar('post_daniel');
    const want = POSTS.daniel[post] ?? POSTS.daniel.bench;
    const dn = h.npcs.get('daniel');
    if (dn && (Math.abs(dn.post?.x - want.x) > 0.01 || Math.abs(dn.post?.z - want.z) > 0.01)) h.npcs.setNamed('daniel', { post: want });
  }

  /** Objetivo actual para el HUD y la baliza. */
  current() {
    const e = this.engine;
    if (!e) return null;
    const qid = e.trackedQuest();
    if (qid) {
      const o = e.objective(qid);
      const q = QUESTS[qid];
      return { quest: qid, type: q.type, title: t(`quest.${qid}.title`), text: t(`quest.${qid}.obj.${o.def.id}`, { n: o.progress.n, total: o.progress.total }), n: o.progress.n, total: o.progress.total, target: this.#targetOf(o) };
    }
    const pend = e.pendingUnlock(this.ctx());
    if (pend?.kind === 'spins') return { type: 'hint', title: t(`quest.${pend.quest}.title`), text: t('quest.hud.waitSpins', { name: t(`npc.${pend.giver}.name`), n: pend.n, total: pend.total }), n: pend.n, total: pend.total, target: { x: CLASSIC.x, z: CLASSIC.z + 1.6, y: 2.4 } };
    if (pend?.kind === 'prestige') return { type: 'hint', title: t(`quest.${pend.quest}.title`), text: t('quest.hud.waitPrestige', { n: pend.n, total: pend.total }), n: pend.n, total: pend.total, target: null };
    const offer = e.list((d, s) => s === Q.AVAILABLE && d.offer && e.canStart(d.id))[0];
    if (offer) return { type: 'hint', title: t(`quest.${offer.id}.title`), text: t('quest.ui.available', { name: t(`npc.${offer.giver}.name`) }), target: this.#npcTarget(offer.giver) };
    if (pend?.kind === 'soon') return { type: 'hint', title: t(`quest.${pend.quest}.title`), text: t('quest.hud.soon', { title: t(`quest.${pend.quest}.title`) }), target: null };
    return { type: 'hint', title: '', text: t('quest.hud.free'), target: null };
  }

  #npcTarget(npc) {
    const n = this.h.npcs.get(npc);
    return n ? { npc, x: n.pos.x, z: n.pos.z, y: 2.3 } : null;
  }

  #targetOf(o) {
    const d = o.def;
    switch (d.type) {
      case 'talk':
        return this.#npcTarget(d.npc);
      case 'visit': {
        const pp = this.h.getPlayerPos();
        let best = null;
        for (const p of d.points) {
          if (o.progress.seen?.includes(p)) continue;
          const poi = POIS[p];
          const dist = Math.hypot(poi.x - pp.x, poi.z - pp.z);
          if (!best || dist < best.dist) best = { x: poi.x, z: poi.z, y: 1.6, dist };
        }
        return best;
      }
      case 'interact': {
        const s = STORY_SPOTS[d.target];
        return { x: s.x, z: s.z, y: s.y + 0.6 };
      }
      case 'spin':
      case 'win':
      case 'wait':
        return { x: CLASSIC.x, z: CLASSIC.z + 1.6, y: 2.4 };
      case 'play': {
        const tb = d.game === 'blackjack' ? TABLES.blackjack[0] : TABLES.roulette[0];
        return { x: tb.x, z: tb.z + 1.3, y: 1.9 };
      }
      default:
        return null;
    }
  }

  /** Repinta rastreador e iconos (tras cambios o idioma). */
  refresh() {
    const h = this.h;
    if (!this.engine) return;
    const cur = this.current();
    h.hud.setQuest(cur);
    this.beaconTarget = cur?.target ?? null;
    // iconos sobre las cabezas
    const e = this.engine;
    const p = this.progress;
    h.markers.clearNpcs();
    const affordable = new Set();
    for (const [vendor, v] of Object.entries(VENDORS)) {
      if (vendor === 'counter') continue;
      const ok = Object.values(UPGRADES).some((u) => v.tabs.some((tab) => TAB_FILTERS[tab]?.(u)) && p.canBuy(u.id).ok);
      if (ok && e.isDone('m02')) affordable.add(vendor);
    }
    for (const npc of Object.keys(NAMED)) {
      let kind = null;
      if (e.active().some((q) => { const o = e.objective(q.id); return o?.def.type === 'talk' && o.def.npc === npc; })) kind = 'talk';
      else if (e.list((d, s) => s === Q.AVAILABLE && d.giver === npc && d.offer && e.canStart(d.id)).length) kind = 'quest';
      else if (affordable.has(npc)) kind = 'shop';
      h.markers.setNpc(npc, kind);
    }
  }

  /** Cada fotograma: visitas, baliza, brújula y ventana de diálogo. */
  update(dt, { exploring }) {
    const h = this.h;
    if (!this.engine) return;
    h.dialogue.update(dt);
    const pp = h.getPlayerPos();
    h.markers.group.visible = exploring;
    h.markers.update(dt, (id) => {
      const head = h.npcs.headPosition(id, new THREE.Vector3());
      // de cerca basta con el aviso de interacción: el icono no tapa la cara
      return head && Math.hypot(head.x - pp.x, head.z - pp.z) > 2.6 ? head : null;
    });
    // visitas
    if (exploring) {
      for (const q of this.engine.active()) {
        const o = this.engine.objective(q.id);
        if (o?.def.type !== 'visit') continue;
        for (const pt of o.def.points) {
          if (o.progress.seen.includes(pt)) continue;
          const poi = POIS[pt];
          if (Math.hypot(poi.x - pp.x, poi.z - pp.z) < poi.r) {
            this.#handle(this.engine.emit({ type: 'visit', point: pt }, this.ctx()));
            return;
          }
        }
      }
    }
    // baliza (sigue al personaje si el objetivo es hablar con alguien)
    let target = this.beaconTarget;
    if (target?.npc) {
      const n = h.npcs.get(target.npc);
      target = n ? { ...target, x: n.pos.x, z: n.pos.z } : null;
    }
    const near = target && Math.hypot(target.x - pp.x, target.z - pp.z) < 1.6;
    h.markers.setBeacon(target && !target.npc && !near && exploring ? target : null);
    // brújula del HUD
    if (target && exploring && !near && Math.hypot(target.x - pp.x, target.z - pp.z) > 2.4) {
      const dx = target.x - pp.x;
      const dz = target.z - pp.z;
      const ang = Math.atan2(-dx, -dz) - h.getPlayerYaw();
      h.hud.setWaypoint({ angle: Math.atan2(Math.sin(ang), Math.cos(ang)), dist: Math.hypot(dx, dz) });
    } else h.hud.setWaypoint(null);
  }

  // ------------------------------------------------------------------ retratos

  /** Retrato del personaje (render a textura, una vez por personaje y calidad). */
  #portrait(npc) {
    const h = this.h;
    const n = h.npcs.get(npc);
    if (!n) return null;
    try {
      const renderer = h.renderer;
      const size = 192;
      const rt = new THREE.WebGLRenderTarget(size, size);
      const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 30);
      const head = h.npcs.headPosition(npc, new THREE.Vector3());
      const yaw = n.yaw;
      cam.position.set(head.x + Math.sin(yaw) * 0.85, head.y + 0.03, head.z + Math.cos(yaw) * 0.85);
      cam.lookAt(head.x, head.y - 0.02, head.z);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(h.world.scene, cam);
      const px = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      renderer.setRenderTarget(prev);
      rt.dispose();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      // salida lineal → sRGB con un poco de exposición; filas invertidas (WebGL empieza abajo)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = ((size - 1 - y) * size + x) * 4;
          const o = (y * size + x) * 4;
          for (let k = 0; k < 3; k++) img.data[o + k] = Math.min(255, Math.pow(px[i + k] / 255 * 1.35, 1 / 2.2) * 255);
          img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL('image/png');
      this.portraits.set(npc, url);
      return url;
    } catch (err) {
      console.warn('[Story] No se pudo generar el retrato', err);
      return null;
    }
  }

  clearPortraits() {
    this.portraits.clear();
  }

  /** Niveles de relación (para el diario). */
  relations() {
    return Object.keys(NAMED).filter((id) => NAMED[id].post).map((id) => ({ id, ...this.engine.relation(id), levels: RELATION_LEVELS.length }));
  }
}
