import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { TABLES } from '../world/layout.js';
import { toWorld } from '../world/props/tables.js';
import { MIN_BET, clampBet, maxBet, stepBet } from '../machines/slot-logic.js';
import { Shoe, cardPoints } from './cards.js';
import { BlackjackRound, handValue } from './blackjack.js';
import { colorOf, isBetKey, paysOf, settleRoulette, spinNumber, totalBets } from './roulette.js';
import { BlackjackView } from './blackjack-view.js';
import { RouletteView } from './roulette-view.js';

/**
 * MESAS JUGABLES: ROYAL BLACKJACK y ROYAL ROULETTE.
 *
 * Une la lógica pura (blackjack.js, roulette.js), las vistas 3D, la interfaz de mesa y el
 * progreso. Las apuestas se descuentan al jugar (como en un casino real) y se liquidan al
 * terminar la ronda; las rondas de práctica (misiones) no cuestan ni pagan.
 * Todo el ritmo va en tiempo de juego (update), nunca con setTimeout.
 */

const TABLE_ID = { blackjack: 'royal_blackjack', roulette: 'royal_roulette' };
const HOST = { blackjack: 'oliver', roulette: 'lucas' };
const PRACTICE_CHIPS = 10;
const CHALLENGE_NUMBERS = 6;
/** Mano guionizada del tutorial completo: 10+6 contra un 9 visible (la banca tiene 16). */
const TUTORIAL_SHOE = ['10H', '9S', '6D', '7C', '4S', 'KD', '3H', '8C', '5S', '2D', 'QS', '9H', 'AC', '7D'];

const tableDef = (game) => TABLES[game].find((x) => x.id === TABLE_ID[game]);

export class TableController {
  /**
   * @param {object} h dependencias: scene, camera, rig, npcs, hud, ui (TableHud), audio, fx, progress(),
   *   director, rng, onLeave(), onBankrupt(), onSettled(), canvas
   */
  constructor(h) {
    this.h = h;
    this.game = null;
    this.mode = null;
    this.phase = 'idle';
    this.seq = [];
    this.seqWait = 0;
    this.views = {
      blackjack: new BlackjackView({ scene: h.scene, table: tableDef('blackjack') }),
      roulette: new RouletteView({ scene: h.scene, table: tableDef('roulette') }),
    };
    this.shoe = new Shoe(h.rng, 6);
    this.round = null;
    this.bets = {};
    this.lastBets = null;
    this.history = [];
    this.challenge = false;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.hoverKey = null;
    this.tipShown = new Set();
    this.#bindPointer();
  }

  get active() {
    return !!this.game;
  }

  get progress() {
    return this.h.progress();
  }

  /** ¿Ronda en curso? (no se puede levantar de la mesa). */
  get busy() {
    return this.phase !== 'bet' && this.phase !== 'idle';
  }

  // ------------------------------------------------------------------ entrar / salir

  /** @param {'blackjack'|'roulette'} game  @param {{mode: string, practice: boolean}} access */
  enter(game, access) {
    const h = this.h;
    this.game = game;
    this.access = access;
    this.mode = access.mode;
    this.challenge = access.mode === 'challenge';
    this.phase = 'bet';
    this.seq = [];
    this.tipShown.clear();
    const id = TABLE_ID[game];
    h.npcs.reserveTable(id, true);
    h.npcs.dealerManual(id, true);
    const view = this.views[game];
    if (game === 'blackjack') view.setSkin(h.director.hasFlag('cards_royal') ? 'royal' : 'classic');
    else view.setSkin(h.director.hasFlag('wheel_gold') ? 'gold' : 'classic');
    // cámara: sentado en el centro de la mesa, mirando el tapete
    const def = tableDef(game);
    const [px, py, pz, tx, ty, tz] = game === 'blackjack' ? [0, 1.6, 1.4, 0, 0.86, 0.02] : [0.12, 2.02, 1.5, 0.22, 0.86, -0.06];
    const pw = toWorld(def, px, pz);
    const tw = toWorld(def, tx, tz);
    const pos = new THREE.Vector3(pw.x, py, pw.z);
    const target = new THREE.Vector3(tw.x, ty, tw.z);
    const aspect = h.camera.aspect || 16 / 9;
    const halfH = game === 'blackjack' ? 0.62 : 0.72; // media apertura horizontal deseada (rad)
    const fov = THREE.MathUtils.clamp((2 * Math.atan(Math.tan(halfH) / aspect) * 180) / Math.PI, 44, 72);
    h.rig.focusOn(() => ({ position: pos, target }), { fov, duration: 1.0 });
    h.ui.open({
      name: game === 'blackjack' ? 'ROYAL BLACKJACK' : 'ROYAL ROULETTE',
      rules: t(game === 'blackjack' ? 'table.bj.rules' : 'table.rl.rules'),
      mode: this.#modeLabel(),
    });
    if (game === 'roulette') h.ui.setHistory(this.history, colorOf);
    h.audio.sfx(game === 'blackjack' ? 'cardShuffle' : 'roulettePlace');
    this.#refresh();
    this.#introTip();
  }

  /** Salir de la mesa (Q). Solo entre rondas. */
  leave() {
    if (!this.game) return false;
    if (this.busy) {
      this.h.audio.sfx('error');
      this.h.ui.message(t('table.msg.finishFirst'));
      return false;
    }
    this.#close();
    this.h.onLeave();
    return true;
  }

  #close() {
    const id = TABLE_ID[this.game];
    this.h.npcs.reserveTable(id, false);
    this.h.npcs.dealerManual(id, false);
    if (this.game === 'roulette') {
      this.views.roulette.clearChips();
      this.views.roulette.hover(null);
      this.bets = {};
    }
    this.h.ui.close();
    this.game = null;
    this.phase = 'idle';
    this.round = null;
    this.seq = [];
  }

  /**
   * Cierre forzoso (salir al menú, BANCA ROTA…): una ronda en marcha se resuelve al instante y de
   * forma justa (plantarse en todas las manos; la bola ya lanzada cae donde iba a caer).
   */
  forfeit() {
    if (!this.game) return;
    if (this.game === 'blackjack' && this.round && this.round.phase !== 'done') {
      while (this.round.phase === 'player') this.round.stand();
    }
    if (this.game === 'blackjack' && this.round?.phase === 'done' && !this.round.settled) this.#settleBlackjack(true);
    if (this.game === 'roulette' && this.spinResult && !this.spinResult.settled) this.#settleRoulette(true);
    this.views.blackjack.reset();
    this.#close();
  }

  // ------------------------------------------------------------------ entrada

  /** Teclado en la mesa. Devuelve true si la tecla se ha usado. */
  onKey(e) {
    if (!this.game) return false;
    const c = e.code;
    if (c === 'KeyQ') return this.leave(), true;
    if (this.game === 'blackjack') {
      const map = this.phase === 'player'
        ? { Digit1: 'hit', Numpad1: 'hit', KeyE: 'hit', Digit2: 'stand', Numpad2: 'stand', Space: 'stand', Digit3: 'double', Numpad3: 'double', Digit4: 'split', Numpad4: 'split' }
        : { Space: 'deal', KeyE: 'deal', Enter: 'deal', NumpadEnter: 'deal', KeyW: 'betUp', ArrowUp: 'betUp', KeyS: 'betDown', ArrowDown: 'betDown' };
      if (map[c]) {
        e.preventDefault();
        this.action(map[c]);
        return true;
      }
    } else {
      const map = { Space: 'spin', Enter: 'spin', NumpadEnter: 'spin', KeyE: 'spin', KeyC: 'clear', Backspace: 'clear', KeyR: 'repeat', KeyW: 'betUp', ArrowUp: 'betUp', KeyS: 'betDown', ArrowDown: 'betDown', KeyP: 'challenge' };
      if (map[c]) {
        e.preventDefault();
        this.action(map[c]);
        return true;
      }
    }
    return false;
  }

  /** Acción desde teclado o botón. */
  action(id) {
    if (!this.game) return;
    if (id === 'leave') return void this.leave();
    if (id === 'betUp' || id === 'betDown') return this.#changeBet(id === 'betUp' ? 1 : -1);
    if (this.game === 'blackjack') {
      if (id === 'deal') this.#deal();
      else if (this.phase === 'player' && this.seq.length === 0) this.#play(id);
    } else if (id === 'spin') this.#spin();
    else if (id === 'clear') this.#clearBets();
    else if (id === 'repeat') this.#repeatBets();
    else if (id === 'challenge') this.#toggleChallenge();
  }

  #bindPointer() {
    const inUi = (e) => !!e.target?.closest?.('.table-hud__bar, .tbtn, .pause, .screen.is-visible');
    window.addEventListener('mousemove', (e) => {
      if (this.game !== 'roulette') return;
      if (inUi(e)) {
        this.#hover(null);
        return;
      }
      this.#hover(this.#pick(e), e);
    });
    window.addEventListener('mousedown', (e) => {
      if (this.game !== 'roulette' || inUi(e) || !this.h.isActive()) return;
      const key = this.#pick(e);
      if (!key) return;
      if (e.button === 0) this.#placeChip(key, e.shiftKey ? -1 : 1);
      else if (e.button === 2) this.#placeChip(key, -1);
    });
    window.addEventListener('contextmenu', (e) => {
      if (this.game === 'roulette') e.preventDefault();
    });
  }

  #pick(e) {
    const r = this.h.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.h.camera);
    return this.views.roulette.pickCell(this.ray);
  }

  #hover(key, e = null) {
    const ui = this.h.ui;
    if (this.phase !== 'bet' || !key || (this.challenge && !key.startsWith('n:'))) {
      if (this.hoverKey) this.views.roulette.hover(null);
      this.hoverKey = null;
      ui.tooltip(null);
      if (e) document.body.style.cursor = '';
      return;
    }
    if (key !== this.hoverKey) {
      this.hoverKey = key;
      this.views.roulette.hover(key);
    }
    document.body.style.cursor = 'pointer';
    if (e) ui.tooltip(this.#betName(key), e.clientX, e.clientY);
  }

  #betName(key) {
    const pays = paysOf(key);
    const [kind, v] = key.split(':');
    const name = kind === 'n' ? t('table.bet.n', { n: v }) : kind === 'dozen' ? t('table.bet.dozen', { n: v }) : kind === 'col' ? t('table.bet.col', { n: v }) : t(`table.bet.${key}`);
    return `${name} · ${t('table.pays', { n: pays })}`;
  }

  // ------------------------------------------------------------------ apuesta

  #practice() {
    return this.mode === 'practice' || this.mode === 'tutorial' || this.mode === 'predict' || this.challenge;
  }

  #modeLabel() {
    if (this.challenge) return t('table.mode.challenge');
    if (this.#practice()) return t('table.mode.practice');
    return null;
  }

  #changeBet(dir) {
    if (this.#practice() || this.busy) return;
    const p = this.progress;
    const loadout = p.loadout();
    const before = p.bet;
    const next = p.setBet(stepBet(before, dir, loadout, Math.max(MIN_BET, p.marks)));
    this.h.audio.sfx(next === before ? 'error' : dir > 0 ? 'betUp' : 'betDown');
    this.h.onSettled();
    this.#refresh();
  }

  // ------------------------------------------------------------------ secuencias (tiempo de juego)

  #queue(fn, wait = 0) {
    this.seq.push({ fn, wait });
  }

  update(dt) {
    this.views.blackjack.update(dt);
    this.views.roulette.update(dt);
    if (this.seqWait > 0) this.seqWait -= dt;
    while (this.seqWait <= 0 && this.seq.length) {
      const step = this.seq.shift();
      const extra = step.fn() ?? 0;
      this.seqWait += step.wait + extra;
    }
    if (this.seqWait < 0 && !this.seq.length) this.seqWait = 0;
    if (this.game) this.h.ui.update(dt, this.h.camera);
  }

  // ------------------------------------------------------------------ BLACKJACK

  #deal() {
    if (this.phase !== 'bet' || this.seq.length) return;
    const h = this.h;
    // ¿sigue abierta? (la práctica de la misión termina tras una mano)
    const access = h.director.tableAccess('blackjack');
    if (!access.ok) {
      h.audio.sfx('error');
      h.ui.message(access.text);
      return;
    }
    this.mode = access.mode;
    const practice = this.#practice();
    const p = this.progress;
    let bet = 0;
    if (!practice) {
      bet = p.bet;
      if (!p.canAfford(bet)) {
        if (p.marks < MIN_BET) return h.onBankrupt();
        p.setBet(clampBet(bet, p.loadout(), p.marks));
        h.audio.sfx('error');
        h.ui.message(t('hud.noFunds', { n: p.bet }));
        this.#refresh();
        return;
      }
      p.wager(bet);
      h.onSettled();
    }
    const tutorial = this.mode === 'tutorial';
    let shoe = this.shoe;
    if (tutorial) shoe = Shoe.stacked(TUTORIAL_SHOE);
    else if (shoe.needsShuffle) {
      shoe.shuffle();
      h.ui.message(t('table.msg.shuffle'));
      h.audio.sfx('cardShuffle');
      this.seqWait = 1.2;
    }
    this.round = new BlackjackRound({ shoe, bet });
    this.round.practice = practice;
    this.phase = 'dealing';
    this.views.blackjack.placeBet(bet, { practice });
    h.audio.sfx('chipBet');
    h.ui.hideResult();
    this.#refresh();
    this.#runEvents(this.round.deal(), 0.35);
  }

  #play(id) {
    const r = this.round;
    const h = this.h;
    if (!r || r.phase !== 'player') return;
    const opt = r.options();
    if (!opt[id]) {
      h.audio.sfx('error');
      return;
    }
    if ((id === 'double' || id === 'split') && !r.practice) {
      const extra = r.extraCost;
      if (!this.progress.wager(extra)) {
        h.audio.sfx('error');
        h.ui.message(t(id === 'double' ? 'table.msg.cantDouble' : 'table.msg.cantSplit'));
        return;
      }
      h.onSettled();
    }
    if (id === 'double') h.audio.sfx('doubleDown');
    if (id === 'split') h.audio.sfx('chipBet');
    const events = r[id]();
    this.phase = 'dealing';
    this.#refresh();
    this.#runEvents(events);
  }

  /** Reproduce eventos de la lógica en la vista, con sonido, gestos del crupier y etiquetas. */
  #runEvents(events, delay = 0) {
    const view = this.views.blackjack;
    const h = this.h;
    const id = TABLE_ID.blackjack;
    if (delay) this.#queue(() => 0, delay);
    for (const ev of events) {
      this.#queue(() => {
        const wait = view.apply(ev);
        if (ev.type === 'card') {
          h.audio.sfx('cardDeal');
          h.npcs.dealerGesture(id);
          if (!ev.hidden) h.audio.sfx('cardFlip');
        } else if (ev.type === 'reveal') h.audio.sfx('dealerReveal');
        else if (ev.type === 'bust') {
          h.audio.sfx('bust');
          if (ev.hand >= 0) h.fx.shake(6, 0.2);
        } else if (ev.type === 'blackjack' && ev.who === 'player') {
          h.audio.sfx('blackjack');
          h.fx.celebrate('small');
        }
        this.#labels();
        return wait;
      });
    }
    this.#queue(() => {
      const r = this.round;
      if (!r) return 0;
      if (r.phase === 'done') return this.#settleBlackjack();
      this.phase = 'player';
      this.#refresh();
      this.#tip();
      return 0;
    });
  }

  #settleBlackjack(instant = false) {
    const r = this.round;
    const h = this.h;
    if (!r || r.settled) return 0;
    r.settled = true;
    const res = r.results;
    const practice = !!r.practice;
    const tags = [];
    if (res.outcome === 'win') tags.push('win');
    if (res.hands.some((x) => x.total === 21 && x.outcome !== 'bust')) tags.push('21');
    if (res.blackjack) tags.push('blackjack');
    this.progress.settleTable('blackjack', { staked: res.staked, payout: res.payout, outcome: res.outcome, blackjack: res.blackjack, practice });
    h.onSettled();
    h.director.onPlay('blackjack', { tags, practice });
    if (instant) return 0;
    // cartel y sonido
    const best = res.hands.reduce((a, x) => (x.payout - x.bet > a.payout - a.bet ? x : a), res.hands[0]);
    const net = res.net;
    let title;
    let kind;
    if (res.blackjack && res.outcome === 'win') [title, kind] = [t('table.res.blackjack'), 'big'];
    else if (res.outcome === 'win') [title, kind] = [practice ? t('table.res.winPractice') : t('table.res.win', { n: net }), 'win'];
    else if (res.outcome === 'push') [title, kind] = [t('table.res.push'), 'push'];
    else if (best.outcome === 'bust') [title, kind] = [t('table.res.bust'), 'lose'];
    else [title, kind] = [t('table.res.lose'), 'lose'];
    const sub = res.dealerBust ? t('table.res.dealerBust') : t('table.res.versus', { you: res.hands.map((x) => x.total).join(' · '), dealer: res.dealer });
    h.ui.showResult({ title, sub, kind });
    if (kind === 'big') {
      h.audio.sfx('winBig');
      h.fx.celebrate('big');
    } else if (kind === 'win') {
      h.audio.sfx('winSmall');
      h.audio.sfx('chipStack');
      h.fx.celebrate('small');
    } else if (kind === 'push') h.audio.sfx('push');
    else h.audio.sfx('lose');
    if (!practice) h.hud.popNet(net, res.outcome);
    const wait = this.views.blackjack.settle(res);
    this.#queue(() => 0, wait + 1.0);
    this.#queue(() => {
      h.npcs.dealerGesture(TABLE_ID.blackjack);
      return this.views.blackjack.clearRound();
    });
    this.#queue(() => {
      this.round = null;
      this.phase = 'bet';
      this.#labels();
      this.#afterRound(practice);
      return 0;
    });
    return 0;
  }

  #labels() {
    const h = this.h;
    if (this.game !== 'blackjack' || !this.round) return h.ui.setLabels([]);
    const r = this.round;
    const view = this.views.blackjack;
    const list = [];
    const visible = r.dealer.hidden ? r.dealer.cards.slice(0, 1) : r.dealer.cards;
    const shownDealer = view.dealer.length;
    if (shownDealer) {
      const v = handValue(visible.slice(0, shownDealer));
      list.push({ id: 'dealer', text: `${t('table.dealer')} ${this.#fmt(v, visible.slice(0, shownDealer))}`, kind: v.bust ? 'bust' : 'dealer', point: view.labelPoint('dealer') });
    }
    r.hands.forEach((hand, i) => {
      const shown = view.hands[i]?.length ?? 0;
      if (!shown) return;
      const cards = hand.cards.slice(0, shown);
      const v = handValue(cards);
      const natural = cards.length === 2 && v.total === 21 && r.hands.length === 1;
      const name = r.hands.length > 1 ? t('table.hand', { n: i + 1 }) : t('table.you');
      list.push({ id: `hand${i}`, text: natural ? 'BLACKJACK' : `${name} ${this.#fmt(v, cards)}`, kind: natural ? 'bj' : v.bust ? 'bust' : i === r.active && r.phase === 'player' ? 'active' : 'plain', point: view.labelPoint('player', i) });
    });
    h.ui.setLabels(list);
  }

  #fmt(v, cards) {
    if (v.bust) return `${v.total} · ${t('table.busted')}`;
    if (v.soft && v.total !== 21) return `${v.total - 10}/${v.total}`;
    void cards;
    return String(v.total);
  }

  /** Consejos de Oliver durante la práctica (tutorial completo) o un recordatorio rápido. */
  #tip() {
    const h = this.h;
    const r = this.round;
    if (this.game !== 'blackjack' || !r || this.mode !== 'tutorial' || r.phase !== 'player') return;
    const hand = r.hand;
    const v = handValue(hand.cards);
    const up = cardPoints(r.dealer.cards[0]) === 1 ? 11 : cardPoints(r.dealer.cards[0]);
    const opt = r.options();
    let key;
    if (opt.split && (hand.cards[0].r === 'A' || cardPoints(hand.cards[0]) === 8)) key = 'tip.bj.split';
    else if (opt.double && (v.total === 11 || (v.total === 10 && up < 10)) && !v.soft) key = 'tip.bj.double';
    else if (v.total <= 11) key = 'tip.bj.hitLow';
    else if (v.soft && v.total <= 17) key = 'tip.bj.hitVs';
    else if (v.total >= 17) key = 'tip.bj.stand';
    else if (up >= 7) key = 'tip.bj.hitVs';
    else key = 'tip.bj.stand';
    const first = !this.tipShown.has('values');
    this.tipShown.add('values');
    const upName = up === 11 ? t('table.ace') : String(up);
    const text = (first ? `${t('tip.bj.values', { total: v.soft ? `${v.total - 10}/${v.total}` : v.total, up: upName })} ` : '') + t(key, { total: v.total, up: upName });
    h.ui.setTip(text, t(`npc.${HOST.blackjack}.name`));
  }

  #introTip() {
    const h = this.h;
    const who = t(`npc.${HOST[this.game]}.name`);
    if (this.game === 'blackjack') {
      if (this.mode === 'tutorial') h.ui.setTip(t('tip.bj.deal'), who);
      else if (this.mode === 'practice') h.ui.setTip(t('tip.bj.quick'), who);
      else h.ui.setTip(null);
    } else if (this.mode === 'predict') {
      const o = h.director.objectiveProgress('m05');
      h.ui.setTip(t('tip.rl.predict', { n: Math.min((o?.n ?? 0) + 1, o?.total ?? 3), total: o?.total ?? 3 }), who);
    } else if (this.challenge) h.ui.setTip(t('tip.rl.challenge', { n: CHALLENGE_NUMBERS }), who);
    else if (!this.tipShown.has('howto')) {
      this.tipShown.add('howto');
      h.ui.setTip(t('tip.rl.howto'), who);
    } else h.ui.setTip(null);
  }

  /** Tras cada ronda: la práctica puede haber terminado (la mesa vuelve a cerrarse hasta hablar). */
  #afterRound(practice) {
    const h = this.h;
    const access = h.director.tableAccess(this.game);
    if (practice) {
      if (!access.ok) {
        this.mode = 'closed';
        h.ui.setMode(null);
        h.ui.setTip(t('table.msg.practiceDone', { who: t(`npc.${HOST[this.game]}.name`) }), t(`npc.${HOST[this.game]}.name`));
      } else {
        this.mode = access.mode;
        this.challenge = access.mode === 'challenge' || (this.challenge && h.director.challengeOpen());
        h.ui.setMode(this.#modeLabel());
        this.#introTip();
      }
    } else if (this.game === 'blackjack') {
      h.ui.setTip(null);
    }
    this.#refresh();
    if (!practice && this.progress.marks < MIN_BET) this.#queue(() => (h.onBankrupt(), 0), 1.2);
  }

  // ------------------------------------------------------------------ RULETA

  #placeChip(key, dir) {
    if (this.phase !== 'bet' || !isBetKey(key) || this.mode === 'closed') return;
    const h = this.h;
    const practice = this.#practice();
    if (this.challenge && !key.startsWith('n:')) return;
    const bets = { ...this.bets };
    if (dir < 0) {
      if (!bets[key]) return;
      const step = practice ? 1 : this.progress.bet;
      bets[key] -= step;
      if (bets[key] <= 0) delete bets[key];
      h.audio.sfx('chipStack');
    } else if (practice) {
      const count = Object.values(bets).reduce((s, v) => s + v, 0);
      if (this.challenge) {
        if (bets[key]) return;
        if (Object.keys(bets).length >= CHALLENGE_NUMBERS) {
          h.audio.sfx('error');
          h.ui.message(t('table.msg.challengeLimit', { n: CHALLENGE_NUMBERS }));
          return;
        }
      } else if (count >= PRACTICE_CHIPS) {
        h.audio.sfx('error');
        h.ui.message(t('table.msg.practiceLimit', { n: PRACTICE_CHIPS }));
        return;
      }
      bets[key] = (bets[key] ?? 0) + 1;
      h.audio.sfx('roulettePlace');
    } else {
      const chip = this.progress.bet;
      const total = totalBets(bets) + chip;
      const limit = maxBet(this.progress.loadout());
      if (total > limit) {
        h.audio.sfx('error');
        h.ui.message(t('table.msg.limit', { n: limit }));
        return;
      }
      if (total > this.progress.marks) {
        h.audio.sfx('error');
        h.ui.message(t('table.msg.noFunds'));
        return;
      }
      bets[key] = (bets[key] ?? 0) + chip;
      h.audio.sfx('roulettePlace');
    }
    this.bets = bets;
    this.views.roulette.showBets(bets, { practice });
    this.#refresh();
  }

  #clearBets() {
    if (this.phase !== 'bet' || !Object.keys(this.bets).length) return;
    this.bets = {};
    this.views.roulette.showBets({}, {});
    this.h.audio.sfx('chipStack');
    this.#refresh();
  }

  #repeatBets() {
    if (this.phase !== 'bet' || !this.lastBets || this.#practice()) return;
    const total = totalBets(this.lastBets);
    if (total > this.progress.marks || total > maxBet(this.progress.loadout())) {
      this.h.audio.sfx('error');
      this.h.ui.message(t('table.msg.noFunds'));
      return;
    }
    this.bets = { ...this.lastBets };
    this.views.roulette.showBets(this.bets, { practice: false });
    this.h.audio.sfx('chipStack');
    this.#refresh();
  }

  #toggleChallenge() {
    if (this.phase !== 'bet' || !this.h.director.challengeOpen() || this.mode === 'predict') return;
    this.challenge = !this.challenge;
    this.bets = {};
    this.views.roulette.showBets({}, {});
    this.h.audio.sfx('toggle');
    this.h.ui.setMode(this.#modeLabel());
    this.#introTip();
    this.#refresh();
  }

  #spin() {
    if (this.phase !== 'bet' || this.seq.length) return;
    const h = this.h;
    const access = h.director.tableAccess('roulette');
    if (!access.ok) {
      h.audio.sfx('error');
      h.ui.message(access.text);
      return;
    }
    if (!this.challenge) this.mode = access.mode;
    const practice = this.#practice();
    const total = totalBets(this.bets);
    if (!total) {
      h.audio.sfx('error');
      h.ui.message(t('table.msg.needBet'));
      if (!practice && this.progress.marks < MIN_BET) h.onBankrupt();
      return;
    }
    if (!practice) {
      if (!this.progress.wager(total)) {
        h.audio.sfx('error');
        h.ui.message(t('table.msg.noFunds'));
        return;
      }
      h.onSettled();
    }
    const number = spinNumber(h.rng);
    this.spinResult = { number, bets: { ...this.bets }, practice, settled: false };
    this.phase = 'spin';
    this.#hover(null);
    h.ui.hideResult();
    h.npcs.dealerGesture(TABLE_ID.roulette);
    h.audio.startLoop('rouletteSpin');
    h.audio.sfx('rouletteBall');
    this.#refresh();
    this.views.roulette.launch(number, {
      onBounce: (i) => { if (i < 6) h.audio.sfx('tick', i); },
      onLand: () => this.#settleRoulette(),
    });
    this.#queue(() => (h.ui.message(t('table.rl.noMore'), 1.8), 0), 2.4);
  }

  #settleRoulette(instant = false) {
    const s = this.spinResult;
    const h = this.h;
    if (!s || s.settled) return;
    s.settled = true;
    h.audio.stopLoop('rouletteSpin');
    const res = settleRoulette(s.bets, s.number);
    const won = res.wins.length > 0;
    const tags = [];
    if (won) tags.push('win');
    if (res.wins.some((w) => !w.key.startsWith('n:'))) tags.push('category');
    if (res.straight) tags.push('straight');
    const outcome = s.practice ? (won ? 'win' : 'lose') : res.outcome;
    this.progress.settleTable('roulette', { staked: s.practice ? 0 : res.staked, payout: s.practice ? 0 : res.payout, outcome, straight: res.straight, practice: s.practice });
    h.onSettled();
    this.history.unshift(s.number);
    this.history.length = Math.min(this.history.length, 12);
    if (!s.practice) this.lastBets = s.bets;
    h.director.onPlay('roulette', { tags, practice: s.practice });
    this.spinResult = null;
    this.bets = {};
    if (instant) {
      this.views.roulette.clearChips();
      return;
    }
    h.audio.sfx('rouletteLand');
    const view = this.views.roulette;
    view.showWin(s.number);
    h.ui.setHistory(this.history, colorOf);
    const title = `${s.number} ${t(`table.color.${colorOf(s.number)}`)}`;
    let sub;
    let kind;
    if (s.practice) [sub, kind] = [won ? (res.straight ? t('table.res.straightHit') : t('table.res.predictHit')) : t('table.res.predictMiss'), won ? (res.straight ? 'big' : 'win') : 'lose'];
    else if (res.outcome === 'win') [sub, kind] = [t('table.res.rlWin', { n: res.net }), res.straight ? 'big' : 'win'];
    else if (res.outcome === 'push') [sub, kind] = [t('table.res.push'), 'push'];
    else [sub, kind] = [t('table.res.rlLose'), 'lose'];
    h.ui.showResult({ title, sub, kind }, 2.6);
    if (kind === 'big') {
      h.audio.sfx('rouletteWin');
      h.audio.sfx('winBig');
      h.fx.celebrate('big');
    } else if (kind === 'win') {
      h.audio.sfx('rouletteWin');
      h.fx.celebrate('small');
    } else if (kind === 'push') h.audio.sfx('push');
    else h.audio.sfx('lose');
    if (!s.practice) h.hud.popNet(res.net, res.outcome);
    this.#queue(() => 0, 1.3);
    this.#queue(() => {
      h.npcs.dealerGesture(TABLE_ID.roulette);
      h.audio.sfx('chipStack');
      return view.collect(res.wins.map((w) => w.key));
    });
    this.#queue(() => {
      this.phase = 'bet';
      this.#afterRound(s.practice);
      return 0;
    });
  }

  // ------------------------------------------------------------------ interfaz

  #refresh() {
    const h = this.h;
    if (!this.game) return;
    const ui = h.ui;
    const p = this.progress;
    const practice = this.#practice();
    const loadout = p.loadout();
    const bet = p.bet;
    const max = maxBet(loadout);
    const cap = Math.max(MIN_BET, p.marks);
    const closed = this.mode === 'closed';
    const betInfo = practice || closed
      ? { value: closed ? '—' : t('table.free'), sub: closed ? '' : t('table.mode.practice'), canLower: false, canRaise: false, practice: true }
      : { value: bet, sub: t('hud.betMax', { n: max }), canLower: !this.busy && bet > MIN_BET, canRaise: !this.busy && stepBet(bet, +1, loadout, cap) > bet };
    const leave = { id: 'leave', key: 'Q', label: t('table.act.leave'), enabled: !this.busy };
    if (this.game === 'blackjack') {
      ui.setBet(betInfo);
      if (this.phase === 'player') {
        const opt = this.round?.options() ?? {};
        const extra = this.round?.extraCost ?? 0;
        const afford = this.round?.practice || p.marks >= extra;
        ui.setActions([
          { id: 'hit', key: '1', label: t('table.act.hit'), enabled: !!opt.hit, primary: true },
          { id: 'stand', key: '2', label: t('table.act.stand'), enabled: !!opt.stand, primary: true },
          { id: 'double', key: '3', label: t('table.act.double'), enabled: !!opt.double && afford },
          { id: 'split', key: '4', label: t('table.act.split'), enabled: !!opt.split && afford },
          leave,
        ]);
      } else {
        ui.setActions([
          { id: 'deal', key: t('key.space'), label: t('table.act.deal'), enabled: this.phase === 'bet' && !closed, primary: true },
          leave,
        ]);
      }
    } else {
      const total = totalBets(this.bets);
      ui.setBet(practice || closed
        ? { ...betInfo, sub: closed ? '' : this.challenge ? t('table.chalCount', { n: Object.keys(this.bets).length, max: CHALLENGE_NUMBERS }) : t('table.chipsCount', { n: total, max: PRACTICE_CHIPS }) }
        : { ...betInfo, value: bet, sub: t('table.totalBet', { n: total, max }) });
      const actions = [
        { id: 'spin', key: t('key.space'), label: t('table.act.spin'), enabled: this.phase === 'bet' && total > 0 && !closed, primary: true },
        { id: 'clear', key: 'C', label: t('table.act.clear'), enabled: this.phase === 'bet' && total > 0 },
      ];
      if (!practice) actions.push({ id: 'repeat', key: 'R', label: t('table.act.repeat'), enabled: this.phase === 'bet' && !!this.lastBets && !total });
      if (h.director.challengeOpen() && this.mode !== 'predict') actions.push({ id: 'challenge', key: 'P', label: this.challenge ? t('table.act.normal') : t('table.act.challenge'), enabled: this.phase === 'bet' });
      actions.push(leave);
      ui.setActions(actions);
    }
  }

  /** Texto traducible repintado (cambio de idioma). */
  refreshTexts() {
    if (!this.game) return;
    this.h.ui.open({ name: this.game === 'blackjack' ? 'ROYAL BLACKJACK' : 'ROYAL ROULETTE', rules: t(this.game === 'blackjack' ? 'table.bj.rules' : 'table.rl.rules'), mode: this.#modeLabel() });
    if (this.game === 'roulette') this.h.ui.setHistory(this.history, colorOf);
    this.h.ui.setActions([]);
    this.#refresh();
    this.#labels();
    this.#introTip();
  }
}
