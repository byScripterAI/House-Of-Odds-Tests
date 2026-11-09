import * as THREE from 'three';
import { STATES } from './core/game-states.js';
import { ACHIEVEMENTS, OBJECTIVES, ZONES } from './data/progression.js';
import { EFFECTS, SYMBOLS } from './data/symbols.js';
import { UPGRADES } from './data/upgrades.js';
import { AudioEngine } from './audio/audio-engine.js';
import { resolveActivation } from './machines/slot-logic.js';
import { Progress } from './systems/progress.js';
import { pickInteractable } from './systems/movement.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { createWorld } from './world/world.js';
import { Fx } from './ui/fx.js';
import { Hud } from './ui/hud.js';
import { HINTS, INTRO_ID, INTRO_STEPS, Tutorial } from './systems/tutorial.js';
import { CreditsScreen } from './ui/credits.js';
import { MainMenu } from './ui/main-menu.js';
import { ManagerPanel } from './ui/manager-panel.js';
import { PauseMenu } from './ui/pause-menu.js';
import { SettingsMenu } from './ui/settings-menu.js';
import { confirmDialog, setUiAudio } from './ui/ui-kit.js';

const { MAIN_MENU, EXPLORING, INTERACTING, PAUSED, MANAGER } = STATES;
const byId = (list) => new Map(list.map((x) => [x.id, x]));
const OBJECTIVE_BY_ID = byId(OBJECTIVES);
const ACHIEVEMENT_BY_ID = byId(ACHIEVEMENTS);
const EFFECT_BY_ID = new Map(Object.entries(EFFECTS));

/**
 * Aplicación: cablea mundo, jugador, cámara, interfaz, audio y guardado.
 * Aquí vive el flujo de pantallas (menú → juego → pausa/mostrador/máquina);
 * la lógica de juego está en systems/ y machines/, y el dibujo en world/.
 */
export class App {
  /** @param {{game: import('./core/game.js').Game, uiRoot: HTMLElement, save: import('./save/save-manager.js').SaveManager}} deps */
  constructor({ game, uiRoot, save }) {
    this.game = game;
    this.bus = game.bus;
    this.uiRoot = uiRoot;
    this.save = save;
    this.state = game.state;
    this.progress = new Progress(this.bus, null);

    // --- audio ---
    this.audio = new AudioEngine(game.settings.audio);
    setUiAudio(this.audio);

    // --- mundo, jugador y cámara ---
    this.world = createWorld({ renderer: game.renderer.webgl, graphics: game.renderer.settings });
    this.player = new Player({
      canvas: game.renderer.webgl.domElement,
      getSettings: () => game.settings,
      colliders: this.world.colliders,
      onLockChange: (locked) => this.#onLockChange(locked),
    });
    this.player.reset(this.world.spawn.x, this.world.spawn.z, this.world.spawn.yaw);
    this.rig = new CameraRig(this.world.camera, {
      player: this.player,
      machinePose: () => this.world.machine.cameraPose(),
      focus: new THREE.Vector3(0, 1.5, -1.5),
    });

    // --- interfaz ---
    this.hud = new Hud(uiRoot);
    this.hud.onMarksTick = (i) => this.audio.sfx('marksTick', i);
    this.fx = new Fx(uiRoot, [game.renderer.webgl.domElement, uiRoot]);
    this.#applyFxSettings();
    this.tutorial = new Tutorial({ done: true });
    this.mainMenu = new MainMenu({
      onContinue: () => this.#continue(),
      onNew: () => this.#newGame(),
      onSettings: () => this.#openSettings(this.mainMenu),
      onCredits: () => this.#openCredits(),
    });
    this.credits = new CreditsScreen();
    this.settingsMenu = new SettingsMenu({
      getSettings: () => game.settings,
      onChange: () => this.#onSettingsChanged(),
    });
    this.pauseMenu = new PauseMenu({
      onResume: () => this.#resume(),
      onSettings: () => this.#openSettings(this.pauseMenu),
      onSave: () => this.#manualSave(),
      onQuit: () => this.#quitToMenu(),
    });
    this.manager = new ManagerPanel({
      getProgress: () => this.progress,
      onBuy: (id, origin) => this.#buy(id, origin),
      onClose: () => this.#closeManager(),
    });
    uiRoot.append(this.mainMenu.el, this.credits.el, this.settingsMenu.el, this.pauseMenu.el, this.manager.el);

    // --- estado interno ---
    this.inGame = false;
    this.lockHeld = false;
    this.pausedAt = 0;
    this.deferHud = false;
    this.heldNotices = [];
    this.collected = { symbols: [], effects: [] };
    this.lookAcc = 0;
    this.moveAcc = 0;
    this.lastYaw = 0;
    this.lastPos = { x: 0, z: 0 };
    this.stepCell = 0;
    this.alertAt = -1e9;
    this.saveTimer = null;
    this.settingsTimer = null;
    this.audioUnlocked = false;
    this.current = null; // interactuable apuntado
    this.shopAlert = false;

    this.#bindMachine();
    this.#bindProgress();
    this.#bindInput();

    // Controlador de escena que Game actualiza y renderiza.
    this.controller = {
      scene: this.world.scene,
      camera: this.world.camera,
      update: (dt, time) => this.#update(dt, time),
      onResize: (size) => this.world.onResize(size),
      onGraphicsChanged: (g) => this.world.onGraphicsChanged(g),
      dispose: () => this.world.dispose(),
    };
    game.setScene(this.controller);
    this.world.applyProgress(this.progress.loadout());
    this.player.attach();
  }

  /** Muestra el menú principal (estado BOOT → MAIN_MENU) y arranca los temporizadores. */
  start() {
    this.#enterMenu();
    setInterval(() => { if (this.inGame && this.#playing()) this.#saveNow(); }, 30000);
  }

  // ---------------------------------------------------------------- bucle

  #playing() {
    const s = this.state.current;
    return s === EXPLORING || s === INTERACTING;
  }

  #update(dt, time) {
    const s = this.state.current;
    if (s === EXPLORING) this.player.update(dt);
    this.rig.update(dt);
    this.world.update(dt, time, { paused: s === PAUSED });
    this.hud.update(dt);
    this.fx.update(dt);
    if (this.#playing() || s === MANAGER) this.progress.addPlayTime(dt);

    if (s === EXPLORING && this.player.enabled) {
      const item = pickInteractable(this.world.interactables, this.player.pos, this.player.yaw);
      if (item !== this.current) {
        this.current = item;
        this.hud.setPrompt(item ? item.prompt : null);
      }
      this.#trackMovement();
    } else if (this.current) {
      this.current = null;
      this.hud.setPrompt(null);
    }
  }

  /** Pasos al caminar y detección de «he mirado / me he movido» para el tutorial. */
  #trackMovement() {
    const p = this.player;
    let dyaw = Math.abs(p.yaw - this.lastYaw);
    if (dyaw > 3) dyaw = 0; // salto por reinicio de posición
    this.lookAcc += dyaw;
    this.lastYaw = p.yaw;
    const d = Math.hypot(p.pos.x - this.lastPos.x, p.pos.z - this.lastPos.z);
    if (d < 1) this.moveAcc += d;
    this.lastPos.x = p.pos.x;
    this.lastPos.z = p.pos.z;
    if (this.lookAcc > 0.6) this.#tut('look');
    if (this.moveAcc > 2) this.#tut('move');
    if (p.moving) {
      const cell = Math.floor(p.bob / Math.PI);
      if (cell !== this.stepCell) {
        this.stepCell = cell;
        this.audio.sfx('step');
      }
    }
  }

  // ---------------------------------------------------------------- entrada

  #bindInput() {
    // Los navegadores solo permiten audio tras un gesto del usuario.
    const unlock = () => {
      if (this.audioUnlocked) return;
      if (this.audio.unlock()) {
        this.audioUnlocked = true;
        this.audio.startMusic();
        this.audio.loadFiles();
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    document.addEventListener('keydown', (e) => this.#onKey(e));
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const s = this.state.current;
      if (s === EXPLORING) {
        if (!this.player.locked) this.player.requestLock();
      } else if (s === INTERACTING) {
        if (!this.player.locked) this.player.requestLock();
        else this.#spin();
      }
    });
    const flush = () => { if (this.inGame) this.#saveNow(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  }

  #onKey(e) {
    if (e.repeat) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    const s = this.state.current;
    switch (e.code) {
      case 'Escape':
        this.#onEscape();
        break;
      case 'KeyE':
        if (s === EXPLORING && this.current) this.#interact(this.current);
        else if (s === INTERACTING) this.#spin();
        break;
      case 'Space':
        if (s === INTERACTING) { e.preventDefault(); this.#spin(); }
        else if (s === EXPLORING) e.preventDefault();
        break;
      case 'KeyQ':
        if (s === INTERACTING) this.#leaveMachine();
        break;
      default:
    }
  }

  #onEscape() {
    if (this.credits.visible) { this.credits.close(); return; }
    if (this.settingsMenu.visible) { this.settingsMenu.close(); return; }
    const s = this.state.current;
    if (s === MANAGER) this.#closeManager();
    else if (s === PAUSED) {
      if (performance.now() - this.pausedAt > 250) this.#resume(); // Firefox puede entregar ESC tras soltar el ratón
    } else if (this.#playing()) this.#pause();
  }

  /** Pointer Lock concedido o perdido. Perderlo en pleno juego equivale a pulsar ESC. */
  #onLockChange(locked) {
    if (locked) {
      this.lockHeld = true;
      this.hud.showLockHint(false);
      return;
    }
    const wasHeld = this.lockHeld;
    this.lockHeld = false;
    if (!this.#playing()) return;
    if (wasHeld) this.#pause();
    else this.hud.showLockHint(true); // la petición fue rechazada: hace falta un clic
  }

  /** Tras reanudar/entrar: si el navegador no concede el bloqueo, pide un clic. */
  #expectLock() {
    this.player.requestLock();
    setTimeout(() => {
      if (this.#playing() && !this.player.locked) this.hud.showLockHint(true);
    }, 300);
  }

  // ---------------------------------------------------------------- flujo de pantallas

  #enterMenu() {
    this.state.tryTransition(MAIN_MENU);
    this.inGame = false;
    this.hud.setVisible(false);
    this.hud.setPrompt(null);
    this.hud.showLockHint(false);
    this.world.setShopAlert(false);
    this.shopAlert = false;
    this.player.enabled = false;
    this.player.exitLock();
    this.rig.setMode('cinematic');
    this.mainMenu.setCanContinue(this.save.has());
    this.mainMenu.show();
  }

  #beginPlay(raw) {
    this.progress = new Progress(this.bus, raw);
    this.deferHud = false;
    this.heldNotices = [];
    this.world.applyProgress(this.progress.loadout());
    this.hud.setMarks(this.progress.marks, true);
    this.hud.setPrestige(this.progress.prestige);
    this.player.reset(this.world.spawn.x, this.world.spawn.z, this.world.spawn.yaw);
    this.mainMenu.hide();
    this.mainMenu.setNotice('');
    document.activeElement?.blur?.();
    if (!this.state.tryTransition(EXPLORING)) return;
    this.inGame = true;
    this.hud.setVisible(true);
    this.hud.setMode('explore');
    this.#refreshControlsHint();
    this.rig.setMode('player', { duration: 2.2 });
    this.player.enabled = true;
    this.audio.sfx('confirm');
    this.#expectLock();
    this.#startTutorial();
    this.#refreshObjective();
    this.#refreshShopAlert(true);
  }

  #continue() {
    const loaded = this.save.load();
    if (!loaded.ok) {
      this.mainMenu.setCanContinue(false);
      this.mainMenu.setNotice(loaded.reason === 'none' ? 'No hay ninguna partida guardada.' : 'La partida guardada está dañada y no se puede recuperar. Empieza una nueva partida.');
      this.audio.sfx('error');
      return;
    }
    const raw = loaded.data?.progress ?? null;
    this.#beginPlay(raw);
    if (loaded.source === 'backup') this.hud.toast({ title: 'COPIA DE SEGURIDAD', text: 'La partida principal estaba dañada; se ha restaurado la copia anterior.', kind: 'error' });
  }

  async #newGame() {
    if (this.save.has()) {
      const ok = await confirmDialog(this.uiRoot, {
        title: 'NUEVA PARTIDA',
        text: 'Empezarás desde cero y se borrará tu partida guardada (los ajustes se conservan). Esta acción no se puede deshacer.',
        confirm: 'BORRAR Y EMPEZAR',
        cancel: 'CANCELAR',
      });
      if (!ok) return;
      this.save.clear();
    }
    this.#beginPlay(null);
    this.#saveNow();
  }

  #openSettings(returnTo) {
    returnTo.hide();
    this.settingsMenu.open(() => returnTo.show());
  }

  #openCredits() {
    this.mainMenu.hide();
    this.credits.open(() => this.mainMenu.show());
  }

  #pause() {
    if (!this.state.tryTransition(PAUSED)) return;
    this.pausedAt = performance.now();
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.showLockHint(false);
    this.hud.setPrompt(null);
    this.pauseMenu.setStatus('');
    this.pauseMenu.show();
    this.audio.sfx('back');
  }

  #resume() {
    const back = this.state.previous === INTERACTING ? INTERACTING : EXPLORING;
    this.pauseMenu.hide();
    if (!this.state.tryTransition(back)) return;
    this.player.enabled = back === EXPLORING;
    this.#refreshControlsHint();
    document.activeElement?.blur?.();
    this.#expectLock();
  }

  #manualSave() {
    const ok = this.#saveNow();
    if (!ok) this.pauseMenu.setStatus('No se pudo guardar: el almacenamiento del navegador no está disponible.');
    else if (!this.save.persistent) this.pauseMenu.setStatus('Guardado solo en memoria: el navegador bloquea el almacenamiento local.');
    else this.pauseMenu.setStatus('Partida guardada.');
    this.audio.sfx(ok ? 'confirm' : 'error');
  }

  #quitToMenu() {
    this.#saveNow();
    this.pauseMenu.hide();
    if (this.state.previous === INTERACTING || this.state.current === PAUSED) this.rig.setMode('cinematic');
    this.#enterMenu();
  }

  // ---------------------------------------------------------------- interacción

  #interact(item) {
    if (item.id === 'machine') return this.#enterMachine();
    if (item.id === 'counter') return this.#openManager();
    this.audio.sfx('door');
    if (item.id === 'wing') {
      this.hud.toast({ title: 'ALA NORTE', text: 'La puerta está cerrada con llave. Puedes ampliar el salón desde el mostrador (pestaña CASINO).' });
    } else if (item.zone) {
      const z = ZONES[item.zone];
      this.hud.toast({ title: z.name, text: `Cerrada por ahora. Se abrirá con ${z.unlock.prestige} de PRESTIGE y ${z.unlock.marks} MARKS en una actualización futura.` });
    }
  }

  #enterMachine() {
    if (!this.state.tryTransition(INTERACTING)) return;
    this.player.enabled = false;
    const m = this.world.machine.group.position;
    this.player.yaw = Math.atan2(-(m.x - this.player.pos.x), -(m.z - this.player.pos.z));
    this.player.pitch = -0.12;
    this.hud.setPrompt(null);
    this.hud.setMode('machine');
    this.#refreshControlsHint();
    this.rig.setMode('machine');
    this.audio.sfx('machineEnter');
    this.fx.sparks(30, 0.5, 0.5, '#ffd76a', 0.7);
    this.#tut('enterMachine');
  }

  #leaveMachine() {
    if (!this.state.tryTransition(EXPLORING)) return;
    this.player.enabled = true;
    this.lastYaw = this.player.yaw;
    this.hud.setMode('explore');
    this.#refreshControlsHint();
    this.rig.setMode('player');
    this.audio.sfx('machineExit');
    this.#tut('leaveMachine');
  }

  #openManager() {
    if (!this.state.tryTransition(MANAGER)) return;
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setPrompt(null);
    this.hud.showLockHint(false);
    this.manager.open();
    this.audio.sfx('shopOpen');
    this.fx.sparks(24, 0.5, 0.3, '#ffb020', 0.8);
    this.#tut('openShop');
  }

  #closeManager() {
    if (this.state.current !== MANAGER) return;
    this.manager.hide();
    this.state.tryTransition(EXPLORING);
    this.player.enabled = true;
    document.activeElement?.blur?.();
    this.#saveNow();
    this.#expectLock();
  }

  /** @param {string} id mejora  @param {{x:number,y:number}} [origin] centro del botón pulsado (0-1 de pantalla) */
  #buy(id, origin = { x: 0.5, y: 0.5 }) {
    const result = this.progress.buy(id);
    if (!result.ok) return result;
    const up = UPGRADES[id];
    const isMachine = up.branch === 'machine';
    this.audio.sfx(isMachine ? 'buyMachine' : 'buy');
    this.audio.sfx('sparkle');
    this.fx.sparks(isMachine ? 70 : 50, origin.x, origin.y, isMachine ? '#58e6ff' : '#ffd76a', 1.2);
    this.fx.ring(origin.x, origin.y, isMachine ? '#58e6ff' : '#ffd76a', 260);
    this.fx.celebrate('buy');
    this.fx.coins(isMachine ? 18 : 30);
    this.fx.bigText(isMachine ? '¡MEJORA INSTALADA!' : '¡COMPRADO!', { size: 0.6, ms: 1300, glow: isMachine ? '#58e6ff' : '#d4af37' });
    this.world.applyProgress(this.progress.loadout(), { animate: true });
    this.hud.toast({ title: 'MEJORA INSTALADA', text: up.name });
    if (id === 'expand-hall') {
      this.audio.sfx('unlock');
      this.fx.celebrate('big');
      this.fx.bigText('¡ALA NORTE ABIERTA!', { size: 0.9, ms: 2600 });
    }
    this.#hint(`upgrade:${id}`);
    this.#tut('buy');
    this.#refreshObjective();
    this.#refreshShopAlert();
    this.#saveNow();
    return result;
  }

  // ---------------------------------------------------------------- máquina

  #spin() {
    if (this.state.current !== INTERACTING) return;
    const machine = this.world.machine;
    if (machine.busy) return;
    const result = resolveActivation(this.game.rng, this.progress.loadout());
    this.deferHud = true; // el saldo visible sube cuando se detienen los rodillos
    this.progress.recordActivation(result); // el progreso se guarda ya: nunca depende de la animación
    if (!machine.spin(result, { rng: this.game.rng })) {
      this.deferHud = false;
      this.#syncHud();
      return;
    }
    this.audio.sfx('spinStart');
    this.fx.shake(4, 0.18);
    this.fx.sparks(22, 0.5, 0.78, '#ffd76a', 0.9);
    this.rig.shake(0.015);
    this.#tut('spin');
  }

  #bindMachine() {
    const m = this.world.machine;
    m.onReelStop = (i) => {
      this.audio.sfx('reelStop', i);
      this.fx.shake(6 + i * 3, 0.14);
      this.fx.sparks(16 + i * 8, 0.5 + (i - 1) * 0.1, 0.5, '#ffffff', 0.8);
      this.rig.shake(0.012 + i * 0.006);
    };
    m.onTick = (i) => this.audio.sfx('tick', i);
    m.onDone = (result) => {
      this.deferHud = false;
      this.#syncHud();
      this.hud.popReward(result.reward);
      this.#flushCollected();
      this.#celebrate(result);
      const held = this.heldNotices.splice(0);
      held.forEach((n, i) => setTimeout(() => this.#notice(n), 900 + i * 900));
      this.#refreshObjective();
      this.#refreshShopAlert();
    };
  }

  /** Premio del giro: cuanto mayor, más sonido, partículas y sacudida. */
  #celebrate(result) {
    const names = result.effects.map((id) => EFFECT_BY_ID.get(id)?.name).filter(Boolean);
    const label = names.join(' · ').toUpperCase();
    switch (result.tier) {
      case 'jackpot':
        this.audio.sfx('jackpot');
        this.audio.sfx('applause', 2);
        this.audio.sfx('coins', 3);
        this.fx.celebrate('jackpot');
        this.fx.bigText('¡PREMIO GORDO!', { size: 1.3, color: '#ffffff', glow: '#ff3b5c', ms: 3200 });
        this.rig.shake(0.09);
        break;
      case 'big':
        this.audio.sfx('winBig');
        this.audio.sfx('applause');
        this.audio.sfx('coins', 1);
        this.fx.celebrate('big');
        this.fx.bigText(`¡${label || 'PREMIO'}!`, { size: 0.85, ms: 2000 });
        this.rig.shake(0.045);
        break;
      case 'small':
        this.audio.sfx('winSmall');
        this.audio.sfx('coin');
        this.fx.celebrate('small');
        this.fx.bigText(label, { size: 0.55, ms: 1400 });
        this.rig.shake(0.02);
        break;
      default:
        this.audio.sfx('coin');
        this.fx.sparks(18, 0.93, 0.08, '#ffd76a', 0.7);
    }
    if (result.tier !== 'none') this.hud.toast({ title: label || 'PREMIO', text: `+${result.bonus} de bonus` });
  }

  // ---------------------------------------------------------------- progreso y HUD

  #bindProgress() {
    const b = this.bus;
    b.on('marks:changed', () => {
      if (this.deferHud) return;
      this.hud.setMarks(this.progress.marks);
      this.#refreshShopAlert();
    });
    b.on('prestige:changed', () => {
      if (this.deferHud) return;
      this.hud.setPrestige(this.progress.prestige);
      if (this.progress.prestige >= 50) this.#hint('prestige:50');
    });
    b.on('progress:changed', () => this.#scheduleSave());
    b.on('objective:completed', ({ id, reward }) => {
      const o = OBJECTIVE_BY_ID.get(id);
      this.#notice({ title: 'OBJETIVO CUMPLIDO', text: `${o?.name ?? id} · +${reward} MARKS`, kind: 'objective', sfx: 'objective', fx: 'objective' });
    });
    b.on('achievement:unlocked', ({ id }) => {
      const a = ACHIEVEMENT_BY_ID.get(id);
      this.#notice({ title: 'LOGRO DESBLOQUEADO', text: a?.name ?? id, kind: 'objective', sfx: 'achievement', fx: 'big' });
    });
    b.on('collection:discovered', ({ kind, id }) => {
      const name = kind === 'symbols' ? SYMBOLS[id]?.name : EFFECT_BY_ID.get(id)?.name;
      this.collected[kind === 'symbols' ? 'symbols' : 'effects'].push(name ?? id);
      if (!this.deferHud) setTimeout(() => this.#flushCollected(), 0);
    });
  }

  /** Agrupa los descubrimientos de un mismo giro en un único aviso por tipo. */
  #flushCollected() {
    const { symbols, effects } = this.collected;
    if (symbols.length) this.#notice({ title: 'COLECCIÓN', text: `${symbols.length > 1 ? 'Nuevos símbolos' : 'Nuevo símbolo'}: ${symbols.join(', ')}`, sfx: 'sparkle' });
    if (effects.length) this.#notice({ title: 'COLECCIÓN', text: `${effects.length > 1 ? 'Nuevos efectos' : 'Nuevo efecto'}: ${effects.join(', ')}`, sfx: 'sparkle' });
    this.collected = { symbols: [], effects: [] };
  }

  #notice(n) {
    if (this.deferHud) { this.heldNotices.push(n); return; }
    this.hud.toast(n);
    this.audio.sfx(n.sfx ?? 'toast');
    if (n.fx) this.fx.celebrate(n.fx);
    if (n.fx === 'big') this.fx.shake(8, 0.25);
  }

  // ---------------------------------------------------------------- tutorial, objetivos y avisos

  #tut(event) {
    this.tutorial.report(event);
  }

  #startTutorial() {
    const finished = this.progress.hasTutorial(INTRO_ID) || this.progress.state.stats.totalActivations >= 3;
    this.lookAcc = 0;
    this.moveAcc = 0;
    this.lastYaw = this.player.yaw;
    this.lastPos = { x: this.player.pos.x, z: this.player.pos.z };
    this.tutorial = new Tutorial({
      steps: INTRO_STEPS,
      done: finished,
      onChange: (step, done) => {
        if (done) {
          this.progress.markTutorial(INTRO_ID);
          this.hud.setTutorial(null);
          this.audio.sfx('achievement');
          this.fx.celebrate('objective');
          this.hud.toast({ title: 'TUTORIAL COMPLETADO', text: 'Ya conoces lo básico. ¡A por el siguiente objetivo!', kind: 'objective' });
          this.#saveNow();
        } else {
          this.audio.sfx('tutorial');
          this.fx.sparks(30, 0.12, 0.08, '#58e6ff', 0.8);
          this.hud.setTutorial(step, this.tutorial.index, this.tutorial.total);
        }
      },
    });
    if (finished) this.hud.setTutorial(null);
    else this.hud.setTutorial(this.tutorial.current, 0, this.tutorial.total);
  }

  /** Avisos únicos (una vez por partida) ante cambios importantes. */
  #hint(event) {
    const h = HINTS.find((x) => x.event === event);
    if (!h || this.progress.hasTutorial(h.id)) return;
    this.progress.markTutorial(h.id);
    this.#notice({ title: h.title, text: h.text, kind: 'objective', sfx: 'tutorial' });
  }

  /** Objetivo no cumplido con más avance. */
  #refreshObjective() {
    const m = this.progress.metrics();
    const done = new Set(this.progress.state.objectives.completed);
    let best = null;
    for (const o of OBJECTIVES) {
      if (done.has(o.id)) continue;
      const ratio = (m[o.metric] ?? 0) / o.target;
      if (!best || ratio > best.ratio) best = { o, ratio };
    }
    this.hud.setObjective(best ? { ...best.o, value: m[best.o.metric] ?? 0 } : null);
  }

  /** ¿Hay algo que se pueda comprar? → la tienda lo anuncia (flecha, brillo y aviso). */
  #refreshShopAlert(silent = false) {
    if (!this.inGame) return;
    const can = Object.keys(UPGRADES).some((id) => this.progress.canBuy(id).ok);
    const was = this.shopAlert;
    this.shopAlert = can;
    this.world.setShopAlert(can);
    if (can && !was && !silent && performance.now() - this.alertAt > 45000 && this.tutorial.current?.id !== 'machine') {
      this.alertAt = performance.now();
      this.#notice({ title: '¡PUEDES COMPRAR!', text: 'Tienes MARKS para una mejora. Ve a la TIENDA.', kind: 'objective', sfx: 'toast' });
    }
  }

  #syncHud() {
    this.hud.setMarks(this.progress.marks);
    this.hud.setPrestige(this.progress.prestige);
  }

  #applyFxSettings() {
    const g = this.game.settings.graphics;
    this.fx.screenFx = g.screenFx !== false;
    this.fx.density = g.quality === 'low' ? 0.5 : g.quality === 'high' ? 1 : 0.8;
  }

  #refreshControlsHint() {
    const s = this.state.current;
    this.hud.setControlsVisible(!!this.game.settings.controls.showControls && s !== INTERACTING && s !== MAIN_MENU);
  }

  // ---------------------------------------------------------------- ajustes y guardado

  #onSettingsChanged() {
    const s = this.game.settings;
    this.game.renderer.apply(s.graphics);
    this.#applyFxSettings();
    this.audio.setVolumes(s.audio);
    this.#refreshControlsHint();
    clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => this.save.saveSettings(s), 300);
  }

  #scheduleSave() {
    if (!this.inGame) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.#saveNow(), 1500);
  }

  #saveNow() {
    clearTimeout(this.saveTimer);
    this.save.saveSettings(this.game.settings);
    return this.save.save({ progress: this.progress.toJSON(), savedAt: Date.now() });
  }
}
