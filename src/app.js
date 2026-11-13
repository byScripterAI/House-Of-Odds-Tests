import * as THREE from 'three';
import { STATES } from './core/game-states.js';
import { ECONOMY, GAME, QUALITY_ORDER } from './config.js';
import { i18n, t } from './i18n/index.js';
import { ZONE_SOUND } from './audio/audio-engine.js';
import { ZONES } from './data/progression.js';
import { EFFECTS, SYMBOLS } from './data/symbols.js';
import { UPGRADES } from './data/upgrades.js';
import { AudioEngine } from './audio/audio-engine.js';
import { MIN_BET, clampBet, maxBet, stepBet } from './machines/slot-logic.js';
import { BankruptScreen } from './ui/bankrupt.js';
import { Progress } from './systems/progress.js';
import { pickInteractable } from './systems/movement.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { createWorld } from './world/world.js';
import { DECOR_SLOTS, STORY_SPOTS } from './world/layout.js';
import { NpcSystem } from './entities/npc-system.js';
import { characterTemplates } from './entities/character-assets.js';
import { StoryDirector } from './story/director.js';
import { Markers } from './world/markers.js';
import { DECOR_SETS } from './world/props/decor-sets.js';
import { DETECT_VERSION, detectQuality } from './core/hardware.js';
import { nextLuckState, resolveBalancedSpin } from './systems/luck-director.js';
import { DialogueBox } from './ui/dialogue-box.js';
import { QuestLog } from './ui/quest-log.js';
import { Fx } from './ui/fx.js';
import { Hud } from './ui/hud.js';
import { HINTS, INTRO_ID, INTRO_STEPS, Tutorial } from './systems/tutorial.js';
import { CreditsScreen } from './ui/credits.js';
import { MainMenu } from './ui/main-menu.js';
import { ManagerPanel } from './ui/manager-panel.js';
import { PauseMenu } from './ui/pause-menu.js';
import { SettingsMenu } from './ui/settings-menu.js';
import { betaNotice } from './ui/beta-notice.js';
import { confirmDialog, el, retranslate, setUiAudio } from './ui/ui-kit.js';
import { TableHud } from './ui/table-hud.js';
import { TableController } from './games/table-controller.js';

const { MAIN_MENU, EXPLORING, INTERACTING, PAUSED, MANAGER, DIALOGUE, CINEMATIC, TABLE } = STATES;
const EFFECT_BY_ID = new Map(Object.entries(EFFECTS));
const _panelPos = new THREE.Vector3();
const _panelTarget = new THREE.Vector3();
const _blendTarget = new THREE.Vector3();

/**
 * Aplicación: cablea mundo, jugador, cámara, interfaz, audio y guardado.
 * Aquí vive el flujo de pantallas (menú → juego → pausa/mostrador/máquina);
 * la lógica de juego está en systems/ y machines/, y el dibujo en world/.
 */
export class App {
  /** @param {{game: import('./core/game.js').Game, uiRoot: HTMLElement, save: import('./save/save-manager.js').SaveManager}} deps */
  constructor({ game, uiRoot, save, world = null }) {
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
    // el mundo llega ya construido desde la pantalla de carga (por pasos); si no, se construye aquí de golpe
    this.world = world ?? createWorld({ renderer: game.renderer.webgl, graphics: game.renderer.settings });
    if (!world) this.world.loadSync();
    // los personajes (aunque aún no estén en la sala) se compilan durante la carga: nada de tirones al aparecer
    this.world.warmExtras = () => characterTemplates();
    this.npcs = new NpcSystem({ world: this.world, graphics: game.renderer.settings });
    // ruido de clientes (ruleta, fichas, vítores…) solo con el casino abierto y gente dentro
    this.audio.lifeGate = () => (this.#crowdPresent() ? this.npcs.crowd : 0);
    this.world.onRebuild = () => {
      this.npcs.reset();
      this.director?.clearPortraits();
      if (this.inGame) this.director?.begin();
    };
    this.player = new Player({
      canvas: game.renderer.webgl.domElement,
      getSettings: () => game.settings,
      colliders: this.world.colliders,
      bounds: this.world.bounds,
      onLockChange: (locked) => this.#onLockChange(locked),
    });
    this.player.reset(this.world.spawn.x, this.world.spawn.z, this.world.spawn.yaw);
    this.rig = new CameraRig(this.world.camera, {
      player: this.player,
      machinePose: () => this.world.machine.cameraPose(),
      focus: this.world.focus,
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
      onAutoQuality: () => this.#autoQuality(),
    });
    this.pauseMenu = new PauseMenu({
      onResume: () => this.#resume(),
      onSettings: () => this.#openSettings(this.pauseMenu),
      onSave: () => this.#manualSave(),
      onQuit: () => this.#quitToMenu(),
      onQuests: () => this.#openQuestLog(true),
    });
    this.manager = new ManagerPanel({
      getProgress: () => this.progress,
      onBuy: (id, origin) => this.#buy(id, origin),
      onClose: () => this.#closeManager(),
    });
    this.dialogue = new DialogueBox({
      onAdvance: () => this.director.advance(),
      onChoose: (id) => this.director.choose(id),
      onSkip: () => this.director.skip(),
      onBlip: () => this.audio.sfx('dialogText'),
    });
    this.questLog = new QuestLog({
      getEngine: () => this.director.engine,
      onTrack: (id) => {
        this.director.engine.setTracked(id);
        this.director.refresh();
      },
      onClose: () => this.#closeQuestLog(),
    });
    this.bankrupt = new BankruptScreen({ onMenu: () => this.#leaveBankrupt() });
    // pantalla en negro para secuencias (llamada al equipo de limpieza…)
    this.blackout = document.createElement('div');
    this.blackout.className = 'blackout';
    this.blackoutKicker = document.createElement('div');
    this.blackoutKicker.className = 'blackout__kicker';
    this.blackoutText = document.createElement('div');
    this.blackoutText.className = 'blackout__text';
    this.blackout.append(this.blackoutKicker, this.blackoutText);
    uiRoot.append(this.blackout);
    // aviso de «aplicando calidad…» mientras se reconstruye el casino
    this.busyVeil = document.createElement('div');
    this.busyVeil.className = 'busy-veil';
    const spin = document.createElement('div');
    spin.className = 'busy-veil__spin';
    this.busyVeil.append(spin, el('div', 'busy-veil__text', () => t('ui.busy.quality')));
    uiRoot.append(this.busyVeil);
    uiRoot.append(this.bankrupt.el);
    uiRoot.append(this.dialogue.el, this.mainMenu.el, this.credits.el, this.settingsMenu.el, this.pauseMenu.el, this.manager.el, this.questLog.el);

    // --- historia ---
    this.markers = new Markers(this.world.scene);
    this.director = new StoryDirector({
      getProgress: () => this.progress,
      world: this.world,
      npcs: this.npcs,
      hud: this.hud,
      audio: this.audio,
      fx: this.fx,
      rig: this.rig,
      dialogue: this.dialogue,
      markers: this.markers,
      renderer: game.renderer.webgl,
      getPlayerPos: () => this.player.pos,
      getPlayerEye: () => this.player.eye,
      getPlayerYaw: () => this.player.yaw,
      enterDialogue: () => this.#enterDialogue(),
      exitDialogue: (o) => this.#exitDialogue(o),
      cinematic: (pose, duration, onStart) => this.#cinematic(pose, duration, onStart),
      openShop: (vendor) => this.#openManager(vendor),
      present: (id) => this.#whenIdle(() => this.#presentPurchase(id)),
      repairHall: () => {
        this.world.holdDamage(true);
        this.#whenIdle(() => this.#presentRepair());
      },
      whenIdle: (fn) => this.#whenIdle(fn),
      after: (sec, fn) => this.#after(sec, fn),
      notice: (n) => this.#notice(n),
      syncHud: () => this.#syncHud(),
      save: () => this.#saveNow(),
    });

    // --- mesas jugables (blackjack, ruleta) ---
    this.tableHud = new TableHud(uiRoot, { onAction: (id) => this.tables.action(id) });
    this.tables = new TableController({
      scene: this.world.scene,
      camera: this.world.camera,
      canvas: game.renderer.webgl.domElement,
      rig: this.rig,
      npcs: this.npcs,
      hud: this.hud,
      ui: this.tableHud,
      audio: this.audio,
      fx: this.fx,
      rng: game.rng,
      director: this.director,
      progress: () => this.progress,
      isActive: () => this.state.current === TABLE,
      onLeave: () => this.#leaveTable(),
      onBankrupt: () => this.#outOfMarks(),
      onSettled: () => this.#scheduleSave(),
    });

    // --- estado interno ---
    this.inGame = false;
    this.afterCinematic = [];
    this.afterTable = [];
    this.timers = []; // temporizadores en TIEMPO DE JUEGO (las secuencias no se desincronizan si bajan los FPS)
    this.cine = null;
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
    this.soundMode = 'menu'; // menu | credits | game | ending
    this.zone = 'main_floor';
    this.current = null; // interactuable apuntado
    this.shopAlert = false;

    i18n.onChange(() => this.#applyLanguage());
    this.#bindMachine();
    this.#bindProgress();
    this.#bindInput();

    // Controlador de escena que Game actualiza y renderiza.
    this.controller = {
      scene: this.world.scene,
      camera: this.world.camera,
      update: (dt, time) => this.#update(dt, time),
      onResize: (size) => this.world.onResize(size),
      onGraphicsChanged: (g) => this.#onGraphicsChanged(g),
      dispose: () => {
        this.npcs.dispose();
        this.world.dispose();
      },
    };
    game.setScene(this.controller);
    this.world.applyProgress(this.progress.loadout());
    this.player.attach();
  }

  /**
   * Cambio de ajustes gráficos. Si hay que reconstruir el casino (otra calidad), se avisa en pantalla, se
   * reconstruye en el siguiente fotograma y los shaders se compilan en paralelo antes de quitar el aviso.
   * Varios cambios seguidos se agrupan en una sola reconstrucción.
   */
  #onGraphicsChanged(g) {
    if (!this.world.needsRebuild(g)) {
      this.world.onGraphicsChanged(g);
      this.npcs.configure(g);
      return;
    }
    this.pendingGraphics = g;
    if (this.rebuilding) return;
    this.rebuilding = true;
    this.busyVeil.classList.add('is-on');
    const run = async () => {
      while (this.pendingGraphics) {
        const next = this.pendingGraphics;
        this.pendingGraphics = null;
        this.world.onGraphicsChanged(next);
        this.npcs.configure(next);
      }
      await this.world.warmup();
      this.rebuilding = false;
      this.busyVeil.classList.remove('is-on');
    };
    // dos fotogramas: el aviso se pinta antes del trabajo pesado
    requestAnimationFrame(() => requestAnimationFrame(() => run()));
  }

  /** Cambio de idioma en caliente: todo se repinta al instante. */
  #applyLanguage() {
    document.documentElement.lang = i18n.lang;
    retranslate(this.uiRoot);
    this.mainMenu.refreshTexts();
    this.pauseMenu.refreshTexts();
    this.settingsMenu.refreshTexts();
    this.hud.refreshTexts();
    if (this.manager.visible) this.manager.refresh();
    this.world.refreshTexts();
    if (this.questLog.visible) this.questLog.refresh();
    if (this.inGame) this.director.refresh();
    this.tables.refreshTexts();
  }

  /** Muestra el menú principal (estado BOOT → MAIN_MENU) y arranca los temporizadores. */
  start() {
    this.#enterMenu();
    setInterval(() => { if (this.inGame && this.#playing()) this.#saveNow(); }, 30000);
  }

  // ---------------------------------------------------------------- bucle

  #playing() {
    const s = this.state.current;
    return s === EXPLORING || s === INTERACTING || s === TABLE;
  }

  /** Ejecuta `fn` dentro de `seconds` segundos de juego. */
  #after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  #runTimers(dt) {
    if (this.cine) {
      this.cine.elapsed += dt;
      if (this.cine.elapsed >= this.cine.duration) this.#endCinematic();
    }
    if (!this.timers.length) return;
    const due = [];
    this.timers = this.timers.filter((x) => {
      x.t -= dt;
      if (x.t <= 0) {
        due.push(x.fn);
        return false;
      }
      return true;
    });
    for (const fn of due) fn();
  }

  #update(dt, time) {
    const s = this.state.current;
    if (s !== PAUSED) this.#runTimers(dt);
    this.#watchPerformance(dt);
    if (s === EXPLORING) {
      this.player.update(dt);
      this.#keepOutOfPeople();
    }
    this.rig.update(dt);
    this.world.update(dt, time, { paused: s === PAUSED });
    if (s !== PAUSED) this.npcs.update(dt, { player: { x: this.player.pos.x, z: this.player.pos.z, y: this.player.eye.y }, camera: this.world.camera });
    this.director.update(dt, { exploring: s === EXPLORING });
    // abre el casino o se va la gente: cambia el ambiente
    if (this.soundMode === 'game' && this.crowdSound !== undefined && this.#crowdPresent() !== this.crowdSound) this.#syncSound();
    if (s !== PAUSED) this.tables.update(dt);
    this.hud.update(dt);
    this.fx.update(dt);
    if (this.#playing() || s === MANAGER || s === DIALOGUE) this.progress.addPlayTime(dt);

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
        this.#syncSound();
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
      // en una mesa el ratón queda libre: lo gestiona TableController (paño y botones)
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
    if (s === TABLE && e.code !== 'Escape' && this.tables.onKey(e)) return;
    switch (e.code) {
      case 'Escape':
        this.#onEscape();
        break;
      case 'KeyE':
      case 'Enter':
      case 'NumpadEnter':
        if (s === DIALOGUE) { e.preventDefault(); this.dialogue.advance(); }
        else if (e.code !== 'KeyE') break;
        else if (s === EXPLORING && this.current) this.#interact(this.current);
        else if (s === INTERACTING) this.#spin();
        break;
      case 'Space':
        if (s === DIALOGUE) { e.preventDefault(); this.dialogue.advance(); }
        else if (s === INTERACTING) { e.preventDefault(); this.#spin(); }
        else if (s === EXPLORING) e.preventDefault();
        break;
      case 'Tab':
        if (s === DIALOGUE) { e.preventDefault(); this.dialogue.skip(); }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        if (s === DIALOGUE) { e.preventDefault(); this.dialogue.moveSelection(e.code === 'ArrowUp' ? -1 : 1); }
        else if (s === INTERACTING) { e.preventDefault(); this.#changeBet(e.code === 'ArrowUp' ? 1 : -1); }
        break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
      case 'Numpad1': case 'Numpad2': case 'Numpad3': case 'Numpad4':
        if (s === DIALOGUE && this.dialogue.hasChoices) this.dialogue.choose(Number(e.code.slice(-1)) - 1);
        break;
      case 'KeyJ':
        if (s === EXPLORING) this.#openQuestLog(false);
        else if (this.questLog.visible) this.#closeQuestLog();
        break;
      case 'KeyQ':
        if (s === INTERACTING) this.#leaveMachine();
        break;
      case 'KeyW':
      case 'KeyS':
        if (s === INTERACTING) this.#changeBet(e.code === 'KeyW' ? 1 : -1);
        break;
      default:
    }
  }

  #onEscape() {
    if (this.credits.visible) { this.credits.close(); return; }
    if (this.settingsMenu.visible) { this.settingsMenu.close(); return; }
    if (this.questLog.visible) { this.#closeQuestLog(); return; }
    const s = this.state.current;
    if (s === CINEMATIC) return;
    if (s === MANAGER) this.#closeManager();
    else if (s === DIALOGUE) this.#pause();
    else if (s === PAUSED) {
      if (performance.now() - this.pausedAt > 250) this.#resume(); // Firefox puede entregar ESC tras soltar el ratón
    } else if (this.#playing()) this.#pause();
  }

  /** Pointer Lock concedido o perdido. Perderlo en pleno juego equivale a pulsar ESC. */
  #onLockChange(locked) {
    if (locked) {
      // una petición de bloqueo que llega tarde (p. ej. al abrir un catálogo justo después de una
      // conversación) no debe esconder el ratón en un menú: se suelta al momento
      const s = this.state.current;
      if (s !== EXPLORING && s !== INTERACTING) {
        this.player.exitLock();
        return;
      }
      this.lockHeld = true;
      this.hud.showLockHint(false);
      return;
    }
    const wasHeld = this.lockHeld;
    this.lockHeld = false;
    if (!this.#playing() || this.state.current === TABLE) return; // en la mesa el ratón va suelto a propósito
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

  /** Música, ambiente y vida lejana según dónde esté el jugador (menú, créditos, juego, final). */
  #setSoundMode(mode) {
    this.soundMode = mode;
    this.#syncSound();
  }

  #syncSound() {
    if (!this.audioUnlocked) return;
    const a = this.audio;
    switch (this.soundMode) {
      case 'menu': a.setMusic('musicMenu'); a.setAmbience('ambienceMenu'); a.ambientLife(false); break;
      case 'credits': a.setMusic('musicCredits'); a.setAmbience(null); a.ambientLife(false); break;
      case 'ending': a.setMusic('musicEnding'); a.setAmbience(null); a.ambientLife(false); break;
      default: {
        const z = ZONE_SOUND[this.zone] ?? ZONE_SOUND.main_floor;
        a.setMusic(z.music);
        // sin clientes, la sala suena vacía (nada de murmullo ni de jugadores)
        this.crowdSound = this.#crowdPresent();
        a.setAmbience(this.crowdSound ? z.ambience : 'ambienceEmpty');
        a.ambientLife(true);
      }
    }
  }

  #enterMenu() {
    this.blackout?.classList.remove('is-on');
    this.world?.holdDamage?.(false);
    this.timers = [];
    this.cine = null;
    this.afterCinematic = [];
    this.afterTable = [];
    this.#setSoundMode('menu');
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
    this.mainMenu.setSaveInfo(this.#saveSummary());
    this.mainMenu.show();
  }

  /** Resumen de la partida guardada para la tarjeta del menú principal (o null). */
  #saveSummary() {
    try {
      const loaded = this.save.load();
      const p = loaded.ok ? loaded.data?.progress : null;
      if (!p) return null;
      const active = Object.entries(p.story?.quests ?? {}).filter(([, q]) => q?.s === 'active').map(([id]) => id);
      const quest = p.story?.tracked ?? active.find((id) => id.startsWith('m')) ?? active[0] ?? null;
      return { quest, marks: p.marks ?? 0, prestige: p.prestige ?? 0, spins: p.stats?.totalActivations ?? 0 };
    } catch {
      return null;
    }
  }

  #beginPlay(raw) {
    this.progress = new Progress(this.bus, raw);
    this.deferHud = false;
    this.heldNotices = [];
    this.world.applyProgress(this.progress.loadout());
    this.hud.setMarks(this.progress.marks, true);
    this.hud.setPrestige(this.progress.prestige);
    if (this.pendingAutoToast) {
      const tier = this.pendingAutoToast;
      this.pendingAutoToast = null;
      this.#after(2.5, () => this.notifyAutoQuality(tier));
    }
    this.player.reset(this.world.spawn.x, this.world.spawn.z, this.world.spawn.yaw);
    this.mainMenu.hide();
    this.mainMenu.setNotice('');
    document.activeElement?.blur?.();
    if (!this.state.tryTransition(EXPLORING)) return;
    this.inGame = true;
    this.zone = 'main_floor';
    this.#setSoundMode('game');
    this.hud.setVisible(true);
    this.hud.setMode('explore');
    this.#refreshControlsHint();
    this.rig.setMode('player', { duration: 2.2 });
    this.player.enabled = true;
    this.audio.sfx('confirm');
    this.#expectLock();
    this.#startTutorial();
    this.director.begin();
    this.#refreshShopAlert(true);
  }

  #continue() {
    const loaded = this.save.load();
    if (!loaded.ok) {
      this.mainMenu.setCanContinue(false);
      this.mainMenu.setNotice(loaded.reason === 'none' ? 'menu.noSaveNotice' : 'menu.corrupt');
      this.audio.sfx('error');
      return;
    }
    const raw = loaded.data?.progress ?? null;
    this.#beginPlay(raw);
    if (loaded.source === 'backup') this.hud.toast({ title: t('toast.backup.title'), text: t('toast.backup.text'), kind: 'error' });
  }

  async #newGame() {
    if (this.save.has()) {
      const ok = await confirmDialog(this.uiRoot, {
        title: t('dialog.new.title'),
        text: t('dialog.new.text'),
        confirm: t('dialog.new.confirm'),
        cancel: t('common.cancel'),
      });
      if (!ok) return;
      this.save.clear();
    }
    // versión de prueba: aviso antes de empezar
    if (GAME.stage) await betaNotice(this.uiRoot);
    this.#beginPlay(null);
    this.#saveNow();
  }

  #openSettings(returnTo) {
    returnTo.hide();
    this.settingsMenu.open(() => returnTo.show());
  }

  #openCredits() {
    this.mainMenu.hide();
    this.#setSoundMode('credits');
    this.credits.open(() => {
      this.#setSoundMode('menu');
      this.mainMenu.show();
    });
  }

  #pause() {
    const fromDialogue = this.state.current === DIALOGUE;
    if (!this.state.tryTransition(PAUSED)) return;
    if (fromDialogue) {
      this.dialogue.hide();
      this.audio.stopVoice();
    }
    this.pausedAt = performance.now();
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.showLockHint(false);
    this.hud.setPrompt(null);
    this.pauseMenu.setStatus('');
    const cur = this.director.current();
    const col = this.progress.state.collection;
    this.pauseMenu.setInfo({
      title: cur?.title ?? '',
      objective: cur?.text ?? null,
      marks: this.progress.marks,
      prestige: this.progress.prestige,
      collection: `${col.symbols.length + col.effects.length}/${Object.keys(SYMBOLS).length + EFFECT_BY_ID.size}`,
    });
    this.pauseMenu.show();
    this.audio.sfx('back');
  }

  #resume() {
    const prev = this.state.previous;
    const back = prev === INTERACTING || prev === DIALOGUE || prev === TABLE ? prev : EXPLORING;
    this.pauseMenu.hide();
    if (!this.state.tryTransition(back)) return;
    if (back === DIALOGUE) {
      this.dialogue.show();
      return;
    }
    if (back === TABLE) {
      document.activeElement?.blur?.();
      return; // ratón libre: no se pide el bloqueo
    }
    this.player.enabled = back === EXPLORING;
    this.#refreshControlsHint();
    document.activeElement?.blur?.();
    this.#expectLock();
  }

  // ---------------------------------------------------------------- presentación de compras

  /**
   * La cámara viaja hasta lo comprado, aparece con su animación (alfombra que se desenrolla,
   * estatua que emerge, lámpara que desciende, luces que se encienden…), con sonido, partículas
   * y sacudida, y gira despacio alrededor unos segundos antes de devolverte el control.
   */
  /** Texto en la pantalla negra de secuencias (o null para quitarla). */
  #blackoutText(key, kicker = '') {
    if (!key) {
      this.blackout.classList.remove('is-on');
      return;
    }
    this.blackoutKicker.textContent = kicker;
    this.blackoutText.textContent = t(key);
    this.blackoutText.classList.remove('is-pop');
    void this.blackoutText.offsetWidth;
    this.blackoutText.classList.add('is-pop');
    this.blackout.classList.add('is-on');
  }

  /** Daniel repara goteras, grietas y humedades: pantalla negra «REPARANDO…» y la sala, como nueva. */
  #presentRepair() {
    const PRE = 3.4;
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3(-1.5, 0.9, 0.5);
    const B = this.world.bounds;
    const a0 = Math.atan2(this.player.pos.x - target.x, this.player.pos.z - target.z);
    this.world.holdDamage(true);
    this.#cinematic(
      (time) => {
        const tt = Math.max(0, time - PRE);
        const a = a0 + tt * 0.28;
        pos.set(target.x + Math.sin(a) * 7, 3.4 - Math.min(1, tt / 4) * 0.6, target.z + Math.cos(a) * 7);
        pos.x = Math.max(B.minX + 0.6, Math.min(B.maxX - 0.6, pos.x));
        pos.z = Math.max(B.minZ + 0.6, Math.min(B.maxZ - 0.6, pos.z));
        pos.y = Math.min(4.6, pos.y);
        return { position: pos, target };
      },
      PRE + 4.2,
      () => {
        this.#blackoutText('ui.seq.repairing', t('npc.daniel.name'));
        this.audio.sfx('repairWorks');
        this.#after(PRE - 0.35, () => this.world.holdDamage(false));
        this.#after(PRE, () => this.#blackoutText(null));
        this.#after(PRE + 0.6, () => {
          this.audio.sfx('sparkle');
          this.audio.sfx('constructionDone');
          this.fx.celebrate('buy');
          this.fx.sparks(60, 0.5, 0.5, '#ffd76a', 1.3);
          this.fx.ring(0.5, 0.5, '#ffd76a', 520);
          this.fx.bigText(t('fx.hallRepaired'), { size: 0.8, ms: 2600, kicker: t('npc.daniel.name') });
        });
      },
    );
  }

  #presentPurchase(id) {
    const up = UPGRADES[id];
    const S = DECOR_SLOTS.statue;
    const C = this.world.focus;
    const spec = {
      'decor-carpet': { kind: 'carpet', x: 0, y: 0.4, z: 4.6, r: 6.5, h: 3.2 },
      'decor-statue': { kind: 'statue', x: S.x, y: 1.7, z: S.z, r: 4.2, h: 2.0 },
      'decor-chandelier': { kind: 'chandelier', x: C.x, y: 3.6, z: C.z, r: 5.5, h: 0.9 },
      'expand-hall': { kind: 'wing', x: 0, y: 2.2, z: -11.5, r: 6.5, h: 2.2 },
    }[id] ?? (DECOR_SETS[id] ? { kind: `set:${id}`, ...DECOR_SETS[id].focus } : null) ?? (up.group === 'lighting' || up.group === 'clean'
      ? { kind: up.group, x: 0, y: 1.5, z: 1.5, r: 7.5, h: 2.6 }
      : { kind: 'machine', x: C.x, y: 1.5, z: C.z, r: 3.4, h: 1.9 });
    const isMachine = up.branch === 'machine';
    const color = isMachine ? '#58e6ff' : '#ffd76a';
    // limpieza: pantalla en negro LLAMANDO… → EN CAMINO… → LIMPIANDO… (2 s cada una) y luego el resultado
    // luces: se abre el cuadro eléctrico de la pared, «clac» del general y se encienden de golpe
    const PRE = spec.kind === 'clean' ? 6.2 : spec.kind === 'lighting' ? 2.6 : 0;
    const ARRIVE = PRE + (spec.kind === 'lighting' ? 0 : 1.1);
    if (['carpet', 'statue', 'chandelier', 'machine'].includes(spec.kind) || spec.kind.startsWith('set:')) this.world.reveal(spec.kind, ARRIVE);
    if (spec.kind !== 'clean' && spec.kind !== 'lighting') this.world.applyProgress(this.progress.loadout(), { animate: spec.kind === 'wing' });
    const a0 = Math.atan2(this.player.pos.x - spec.x, this.player.pos.z - spec.z);
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3(spec.x, spec.y, spec.z);
    const B = this.world.bounds;
    const ceiling = 4.6; // por debajo de las vigas del artesonado
    this.#cinematic(
      (time) => {
        const tt = Math.max(0, time - PRE);
        const a = a0 + tt * 0.3;
        pos.set(spec.x + Math.sin(a) * spec.r, spec.y + spec.h * (1 - Math.min(1, tt / 4) * 0.25), spec.z + Math.cos(a) * spec.r);
        // dentro del casino: la cámara nunca atraviesa paredes ni techo
        pos.x = Math.max(B.minX + 0.6, Math.min(B.maxX - 0.6, pos.x));
        pos.z = Math.max(B.minZ + 0.6, Math.min(B.maxZ - 0.6, pos.z));
        pos.y = Math.max(0.8, Math.min(ceiling, pos.y));
        if (spec.kind === 'lighting') {
          // primero el cuadro eléctrico de cerca (se abre, se acciona el general, se cierra) y luego la sala
          const bk = STORY_SPOTS.breaker;
          const k = Math.max(0, Math.min(1, (time - PRE + 0.2) / 0.9));
          const e = k * k * (3 - 2 * k);
          _panelPos.set(bk.x + 0.75, 1.62, bk.z + 1.55);
          _panelTarget.set(bk.x + 0.05, 1.5, bk.z);
          pos.lerpVectors(_panelPos, pos, e);
          _blendTarget.lerpVectors(_panelTarget, target, e);
          return { position: pos, target: _blendTarget };
        }
        return { position: pos, target };
      },
      PRE + 4.4,
      () => {
        if (spec.kind === 'clean') {
          this.#blackoutText('ui.seq.calling', t('ui.seq.crew'));
          this.audio.sfx('phoneRing');
          this.#after(2.05, () => {
            this.#blackoutText('ui.seq.onWay', t('ui.seq.crew'));
            this.audio.sfx('crewArrive');
          });
          this.#after(4.1, () => {
            this.#blackoutText('ui.seq.cleaning', t('ui.seq.crew'));
            this.audio.sfx('cleaning');
          });
          // tras el negro el casino ya está limpio (los trastos retirados)
          this.#after(5.9, () => this.world.applyProgress(this.progress.loadout(), { animate: false }));
          this.#after(PRE, () => this.#blackoutText(null));
        } else if (spec.kind === 'lighting') {
          // se abre el cuadro eléctrico de la pared, «clac» del general y se vuelve a cerrar
          this.world.operateBreaker(2.5);
          this.audio.sfx('doorOpen');
          this.#after(0.85, () => this.audio.sfx('breakerLever'));
          this.#after(2.0, () => this.audio.sfx('doorClose'));
          this.#after(1.3, () => {
            this.world.applyProgress(this.progress.loadout(), { animate: false });
            this.world.lightsFlicker();
            this.audio.sfx('lightsOn');
            this.fx.flash('#fff1cf', 0.32);
          });
        }
        this.#after(ARRIVE, () => {
          if (spec.kind !== 'clean' && spec.kind !== 'lighting') this.audio.sfx(spec.kind === 'machine' ? 'buyMachine' : 'decorPlace');
          this.audio.sfx('sparkle');
          this.fx.celebrate(id === 'expand-hall' ? 'big' : 'buy');
          if (spec.kind !== 'lighting') this.fx.shake(10, 0.35);
          this.rig.shake(0.05);
          this.fx.sparks(60, 0.5, 0.5, color, 1.3);
          this.fx.ring(0.5, 0.5, color, 520);
          this.fx.bigText(id === 'expand-hall' ? t('fx.wingOpen') : spec.kind === 'clean' ? t('fx.cleaned') : spec.kind === 'lighting' ? t('fx.lightsOn') : t(`upgrade.${id}.name`), { size: id === 'expand-hall' ? 0.95 : 0.75, ms: 2600, kicker: t('fx.k.installed') });
          this.hud.toast({ title: t('toast.upgradeInstalled'), text: t(`upgrade.${id}.name`), kind: 'reward' });
          if (id === 'expand-hall') this.audio.sfx('unlock');
        });
      },
    );
  }

  // ---------------------------------------------------------------- conversaciones, cinemáticas y diario

  /** La historia abre una conversación (desde el juego o desde la máquina). */
  #enterDialogue() {
    if (!this.state.tryTransition(DIALOGUE)) return false;
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setPrompt(null);
    this.hud.showLockHint(false);
    this.hud.setDialogueMode(true);
    this.#refreshControlsHint();
    return true;
  }

  #exitDialogue({ keepFocus = false } = {}) {
    if (this.state.current !== DIALOGUE) return;
    this.hud.setDialogueMode(false);
    if (keepFocus) return; // enlaza con la siguiente conversación sin soltar la cámara
    this.state.tryTransition(EXPLORING);
    this.player.enabled = true;
    this.rig.setMode('player', { duration: 0.7 });
    this.#refreshControlsHint();
    document.activeElement?.blur?.();
    this.#expectLock();
  }

  /** Secuencia de cámara: `pose(t)` durante `duration` s (tiempo de juego); luego vuelve al jugador. */
  #cinematic(pose, duration, onStart) {
    const from = this.state.current;
    if (from !== DIALOGUE && from !== EXPLORING && from !== MANAGER) {
      onStart?.();
      return;
    }
    if (!this.state.tryTransition(CINEMATIC)) {
      onStart?.();
      return;
    }
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setPrompt(null);
    this.hud.setDialogueMode(true);
    const t0 = this.rig.time;
    this.rig.focusOn((time) => pose(time - t0), { fov: 60, duration: 1.1 });
    this.cine = { elapsed: 0, duration };
    onStart?.();
  }

  #endCinematic() {
    this.cine = null;
    if (this.state.current !== CINEMATIC) return;
    this.hud.setDialogueMode(false);
    this.state.tryTransition(EXPLORING);
    this.player.enabled = true;
    this.rig.setMode('player', { duration: 1.2 });
    this.#refreshControlsHint();
    this.#expectLock();
    const next = this.afterCinematic.splice(0);
    next.forEach((fn, i) => this.#after(0.3 + i * 0.3, fn));
  }

  /** Ejecuta `fn` cuando no haya una cinemática en curso (encadena presentaciones y eventos). */
  #whenIdle(fn) {
    if (this.state.current === CINEMATIC) this.afterCinematic.push(fn);
    else if (this.state.current === TABLE || (this.state.current === PAUSED && this.state.previous === TABLE)) this.afterTable.push(fn);
    else fn();
  }

  #openQuestLog(fromPause) {
    if (!this.director.engine) return;
    if (!fromPause) {
      if (!this.state.tryTransition(PAUSED)) return;
      this.pausedAt = performance.now();
      this.player.enabled = false;
      this.player.exitLock();
      this.hud.setPrompt(null);
      this.hud.showLockHint(false);
    }
    this.questLogFromPause = fromPause;
    this.pauseMenu.hide();
    this.questLog.open();
    this.audio.sfx('menuOpen');
  }

  #closeQuestLog() {
    this.questLog.hide();
    this.audio.sfx('menuClose');
    if (this.questLogFromPause) this.pauseMenu.show();
    else this.#resume();
  }

  #manualSave() {
    const ok = this.#saveNow();
    if (!ok) this.pauseMenu.setStatus('pause.saveFailed');
    else if (!this.save.persistent) this.pauseMenu.setStatus('pause.saveMemory');
    else this.pauseMenu.setStatus('pause.saved');
    this.audio.sfx(ok ? 'confirm' : 'error');
  }

  #quitToMenu() {
    this.tables.forfeit(); // una ronda a medias se resuelve antes de guardar
    this.#saveNow();
    this.pauseMenu.hide();
    if (this.state.previous === INTERACTING || this.state.current === PAUSED) this.rig.setMode('cinematic');
    this.#enterMenu();
  }

  // ---------------------------------------------------------------- interacción

  #interact(item) {
    if (this.director.interact(item)) return;
    if (item.id === 'machine') return this.#enterMachine();
    if (item.id === 'counter') return this.#openManager('counter');
    if (item.game) return this.#enterTable(item.game);
    this.audio.sfx('doorLocked');
    if (item.id === 'wing') {
      this.hud.toast({ title: t('toast.wing.title'), text: t('toast.wing.text'), kind: 'locked' });
    } else if (item.zone) {
      const z = ZONES[item.zone];
      this.hud.toast({ title: t(`zone.${z.id}`), text: t('toast.zone.soon', { prestige: z.unlock.prestige, marks: z.unlock.marks }), kind: 'locked' });
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
    this.progress.setBet(clampBet(this.progress.bet, this.progress.loadout(), Math.max(MIN_BET, this.progress.marks)));
    this.#refreshBet();
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

  /** Sentarse en una mesa jugable (si está abierta o la misión pide practicar). */
  #enterTable(game) {
    const access = this.director.tableAccess(game);
    if (!access.ok) {
      this.audio.sfx('doorLocked');
      this.hud.toast({ title: game === 'blackjack' ? 'ROYAL BLACKJACK' : 'ROYAL ROULETTE', text: access.text, kind: 'locked' });
      return;
    }
    if (!this.state.tryTransition(TABLE)) return;
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setPrompt(null);
    this.hud.showLockHint(false);
    this.hud.setMode('table');
    this.#refreshControlsHint();
    this.tables.enter(game, access);
  }

  #leaveTable() {
    if (!this.state.tryTransition(EXPLORING)) return;
    document.body.style.cursor = '';
    this.player.enabled = true;
    this.lastYaw = this.player.yaw;
    this.hud.setMode('explore');
    this.#refreshControlsHint();
    this.rig.setMode('player', { duration: 0.9 });
    this.audio.sfx('machineExit');
    this.#saveNow();
    this.#expectLock();
    for (const fn of this.afterTable.splice(0)) fn();
  }

  #openManager(vendor = 'counter') {
    if (!this.state.tryTransition(MANAGER)) return;
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setPrompt(null);
    this.hud.showLockHint(false);
    this.manager.open(vendor);
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
    this.fx.sparks(isMachine ? 70 : 50, origin.x, origin.y, isMachine ? '#58e6ff' : '#ffd76a', 1.2);
    this.fx.ring(origin.x, origin.y, isMachine ? '#58e6ff' : '#ffd76a', 260);
    this.fx.coins(isMachine ? 18 : 30);
    // presentación: se cierra el panel y la cámara viaja a lo comprado mientras aparece
    if (this.state.current === MANAGER) {
      this.manager.hide();
      this.#saveNow();
    }
    this.#presentPurchase(id);
    this.#hint(`upgrade:${id}`);
    this.#tut('buy');
    this.director.onBuy(id);
    this.#refreshShopAlert();
    this.#saveNow();
    return result;
  }

  // ---------------------------------------------------------------- máquina

  #spin() {
    if (this.state.current !== INTERACTING) return;
    const machine = this.world.machine;
    if (machine.busy || !machine.powered) return;
    const loadout = this.progress.loadout();
    const free = this.director.freeSpin();
    const bet = this.progress.bet;
    if (!free && !this.progress.canAfford(bet)) {
      if (this.progress.marks < MIN_BET) return this.#outOfMarks();
      const lower = this.progress.setBet(clampBet(bet, loadout, this.progress.marks));
      this.audio.sfx('error');
      this.hud.toast({ title: t('hud.bet'), text: t('hud.noFunds', { n: lower }), kind: 'error' });
      this.#refreshBet();
      return;
    }
    // desafíos: el director de suerte equilibra (en secreto) lo que tarda en salir el premio pedido
    const ch = free ? null : this.director.challengeWin();
    const luck = this.progress.state.luck;
    const challenge = ch ? { tier: ch.tier, spins: luck?.key === ch.key ? luck.spins : 0 } : null;
    const { result } = resolveBalancedSpin(this.game.rng, loadout, bet, challenge);
    if (ch) this.progress.state.luck = nextLuckState(luck, ch.key);
    this.lastSpin = { result, free };
    this.deferHud = true; // el saldo visible cambia cuando se detienen los rodillos
    this.progress.recordSpin(result, { free }); // el progreso se guarda ya: nunca depende de la animación
    if (!machine.spin(result, { rng: this.game.rng })) {
      this.deferHud = false;
      this.#syncHud();
      return;
    }
    this.audio.sfx('buttonPress');
    this.audio.sfx('betPlace');
    this.audio.sfx('spinStart');
    this.fx.shake(4, 0.18);
    this.fx.sparks(22, 0.5, 0.78, '#ffd76a', 0.9);
    this.rig.shake(0.015);
    this.#syncHud();
    this.#tut('spin');
  }

  /** Subir/bajar la apuesta (W/S o ↑/↓ en la máquina). */
  #changeBet(dir) {
    if (this.state.current !== INTERACTING || this.world.machine.busy || this.director.freeSpin()) return;
    const loadout = this.progress.loadout();
    const before = this.progress.bet;
    const next = this.progress.setBet(stepBet(before, dir, loadout, Math.max(MIN_BET, this.progress.marks)));
    this.audio.sfx(next === before ? 'error' : dir > 0 ? 'betUp' : 'betDown');
    this.#refreshBet();
    this.#scheduleSave();
  }

  /** Panel de apuesta del HUD y LCD de la máquina. */
  #refreshBet() {
    const loadout = this.progress.loadout();
    const free = this.director.freeSpin();
    const bet = this.progress.bet;
    const max = maxBet(loadout);
    const cap = Math.max(MIN_BET, this.progress.marks);
    this.hud.setBet({ bet, max, free, canLower: bet > MIN_BET, canRaise: stepBet(bet, +1, loadout, cap) > bet });
    this.world.machine.setBet(free ? t('hud.freeSpin').split(/[—:：]/)[0].trim() : `${t('hud.bet')} ${bet}`, free ? '' : t('hud.betMax', { n: max }));
  }

  /** BANCA ROTA: sin MARKS para la apuesta mínima → partida borrada y vuelta al menú. */
  /**
   * Sin MARKS para la apuesta mínima. Si alguna misión pendiente da MARKS sin apostar (hablar, visitar,
   * reparar…), la partida sigue y se avisa de cómo salir del bache; si no, BANCA ROTA.
   */
  #outOfMarks() {
    if (this.director.canRecoverWithoutBetting()) {
      this.audio.sfx('error');
      this.hud.toast({ title: t('ui.broke.title'), text: t('ui.broke.text'), kind: 'error' });
      return;
    }
    this.#goBankrupt();
  }

  #goBankrupt() {
    if (this.bankrupt.visible) return;
    if (this.tables.active) {
      this.tables.forfeit();
      document.body.style.cursor = '';
    }
    const p = this.progress;
    const stats = { spins: p.state.stats.totalActivations, best: p.state.machines.classic.bestScore, prestige: p.prestige };
    this.save.clear();
    this.inGame = false;
    this.timers = [];
    this.state.tryTransition(PAUSED);
    this.player.enabled = false;
    this.player.exitLock();
    this.hud.setVisible(false);
    this.audio.stopVoice();
    this.audio.setMusic('musicBankrupt');
    this.audio.setAmbience(null);
    this.audio.ambientLife(false);
    this.audio.sfx('bankrupt');
    this.bankrupt.open(stats);
  }

  #leaveBankrupt() {
    this.bankrupt.hide();
    this.progress = new Progress(this.bus, null);
    this.rig.setMode('cinematic', { instant: true });
    this.#enterMenu();
  }

  #bindMachine() {
    const m = {};
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
      const spin = this.lastSpin;
      const net = spin?.free ? result.payout : result.net;
      this.hud.popNet(net, net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
      if (result.outcome !== 'win') this.audio.sfx(result.outcome === 'push' ? 'push' : 'lose');
      this.#flushCollected();
      this.#celebrate(result);
      const held = this.heldNotices.splice(0);
      held.forEach((n, i) => setTimeout(() => this.#notice(n), 900 + i * 900));
      this.director.onSpin(result);
      this.#refreshBet();
      // sin MARKS para seguir apostando (y sin tirada invitada pendiente) → BANCA ROTA
      if (this.progress.marks < MIN_BET && !this.director.freeSpin()) this.#after(1.4, () => this.#outOfMarks());
      this.#refreshShopAlert();
    };
    this.world.bindMachine(m);
  }

  /** Premio del giro: cuanto mayor, más sonido, partículas y sacudida. */
  /** ¿Hay clientes en el casino? (abierto y con gente: aplausos y bullicio tienen sentido). */
  #crowdPresent() {
    return this.npcs?.crowd >= 1 && this.npcs.npcs?.some((n) => n.kind === 'customer' || n.kind === 'regular');
  }

  #celebrate(result) {
    const names = result.effects.filter((id) => EFFECT_BY_ID.has(id)).map((id) => t(`effect.${id}`));
    const label = names.join(' · ').toUpperCase();
    switch (result.tier) {
      case 'jackpot':
        this.audio.sfx('jackpot');
        if (this.#crowdPresent()) this.audio.sfx('applause', 2);
        this.audio.sfx('coins', 3);
        this.fx.celebrate('jackpot');
        this.fx.bigText(t('fx.jackpot'), { size: 1.3, glow: '#ff6a7e', ms: 3400, kicker: t('fx.k.prize'), sub: label });
        this.rig.shake(0.09);
        break;
      case 'big':
        this.audio.sfx('winBig');
        if (this.#crowdPresent()) this.audio.sfx('applause');
        this.audio.sfx('coins', 1);
        this.fx.celebrate('big');
        this.fx.bigText(label || t('fx.prize'), { size: 0.85, ms: 2200, kicker: t('fx.k.prize') });
        this.rig.shake(0.045);
        break;
      case 'small':
        this.audio.sfx('winSmall');
        this.audio.sfx('coin');
        this.fx.celebrate('small');
        this.fx.bigText(label, { size: 0.55, ms: 1500 });
        this.rig.shake(0.02);
        break;
      default:
        this.audio.sfx('coin');
        this.fx.sparks(18, 0.93, 0.08, '#ffd76a', 0.7);
    }

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
      this.director.onProgress();
    });
    b.on('progress:changed', () => this.#scheduleSave());
    b.on('objective:completed', ({ id, reward }) => {
      this.#notice({ title: t('toast.objectiveDone'), text: `${t(`objective.${id}.name`)} · +${reward} ${ECONOMY.currency.label}`, kind: 'objective', sfx: 'objective', fx: 'objective' });
    });
    b.on('achievement:unlocked', ({ id }) => {
      this.#notice({ title: t('toast.achievement'), text: t(`achievement.${id}.name`), kind: 'achievement', sfx: 'achievement', fx: 'objective' });
    });
    b.on('collection:discovered', ({ kind, id }) => {
      this.collected[kind === 'symbols' ? 'symbols' : 'effects'].push(t(kind === 'symbols' ? `symbol.${id}` : `effect.${id}`));
      if (!this.deferHud) setTimeout(() => this.#flushCollected(), 0);
    });
  }

  /** Agrupa los descubrimientos de un mismo giro en un único aviso por tipo. */
  #flushCollected() {
    const { symbols, effects } = this.collected;
    if (symbols.length) this.#notice({ title: t('toast.collection'), text: t('toast.newSymbols', { n: symbols.length, list: symbols.join(', ') }), sfx: 'sparkle' });
    if (effects.length) this.#notice({ title: t('toast.collection'), text: t('toast.newEffects', { n: effects.length, list: effects.join(', ') }), sfx: 'sparkle' });
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
    // La guía la dan ahora las misiones (rastreador + brújula + iconos): el tutorial antiguo queda cerrado.
    const finished = true;
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
          this.hud.toast({ title: t('toast.tutorialDone.title'), text: t('toast.tutorialDone.text'), kind: 'objective' });
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
    const base = h.id.replace('-', '.');
    this.#notice({ title: t(`${base}.title`), text: t(`${base}.text`), kind: 'objective', sfx: 'tutorial' });
  }

  #refreshObjective() {
    this.director.refresh();
  }

  /** ¿Hay algo que se pueda comprar? → la tienda lo anuncia (flecha, brillo y aviso). */
  #refreshShopAlert(silent = false) {
    if (!this.inGame) return;
    const can = Object.keys(UPGRADES).some((id) => this.progress.canBuy(id).ok);
    const was = this.shopAlert;
    this.shopAlert = can;
    this.world.setShopAlert(false);
    this.director.refresh();
    if (can && !was && !silent && performance.now() - this.alertAt > 45000 && this.director.engine?.isDone('m02')) {
      this.alertAt = performance.now();
      this.#notice({ title: t('toast.canBuy.title'), text: t('toast.canBuy.text'), kind: 'objective', sfx: 'toast' });
    }
  }

  #syncHud() {
    this.hud.setMarks(this.progress.marks);
    this.hud.setPrestige(this.progress.prestige);
  }

  #applyFxSettings() {
    const g = this.game.settings.graphics;
    this.fx.screenFx = g.screenFx !== false;
    this.fx.density = Math.min(1, this.game.renderer.settings.particleScale);
  }

  #refreshControlsHint() {
    const s = this.state.current;
    this.hud.setControlsVisible(!!this.game.settings.controls.showControls && s !== INTERACTING && s !== TABLE && s !== MAIN_MENU);
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

  /** Vuelve a medir el equipo y aplica la calidad que le corresponde (ajustes → calidad automática). */
  #autoQuality() {
    const { tier } = detectQuality();
    const g = this.game.settings.graphics;
    g.auto = true;
    g.detected = tier;
    g.detectVersion = DETECT_VERSION;
    g.quality = tier;
    this.game.renderer.setDynamicScale(1);
    this.#onSettingsChanged();
    this.notifyAutoQuality(tier);
  }

  /** Aviso de la calidad elegida automáticamente. */
  notifyAutoQuality(tier) {
    // en el menú principal el HUD no se ve: el aviso espera a que empiece la partida
    if (!this.inGame) {
      this.pendingAutoToast = tier;
      return;
    }
    this.hud.toast({ title: t('ui.settings.autoQuality'), text: t('ui.toast.autoQuality', { q: t(`settings.quality.${tier}`) }), kind: 'info' });
  }

  /**
   * Vigilante de rendimiento (solo con calidad automática): si el juego va a tirones de forma sostenida,
   * baja un nivel y lo avisa. Nunca sube solo (evita que oscile).
   */
  #watchPerformance(dt) {
    void dt;
    const g = this.game.settings.graphics;
    const r = this.game.renderer;
    if (!g.auto || this.rebuilding || document.hidden) {
      this.perf = null;
      if (!g.auto && r.dynamicScale !== 1) r.setDynamicScale(1);
      return;
    }
    const now = performance.now();
    const p = (this.perf ??= { t0: now, frames: 0, slow: 0, good: 0 });
    p.frames += 1;
    const elapsed = (now - p.t0) / 1000;
    if (elapsed < 2) return;
    const fps = p.frames / elapsed;
    p.t0 = now;
    p.frames = 0;
    if (elapsed > 5) return; // venía de una pausa larga (pestaña oculta, alerta…): no cuenta
    // 1) RESOLUCIÓN DINÁMICA (como en consola): si no llega a ~50 fps baja un poco la resolución interna y la
    //    recupera cuando sobra. La calidad (luces, sombras, materiales) no se toca.
    if (fps < 48) {
      r.setDynamicScale(r.dynamicScale - (fps < 30 ? 0.15 : 0.08));
      p.good = 0;
    } else if (fps > 57 && r.dynamicScale < 1 && ++p.good >= 3) {
      r.setDynamicScale(r.dynamicScale + 0.05);
      p.good = 1;
    }
    // 2) si ni con la resolución al mínimo va fluido, baja un nivel de calidad (nunca sube solo)
    p.slow = fps < 26 && r.dynamicScale <= 0.62 ? p.slow + 1 : 0;
    if (p.slow >= 3 && g.quality !== 'veryLow') {
      p.slow = 0;
      const i = QUALITY_ORDER.indexOf(g.quality);
      const next = QUALITY_ORDER[Math.max(0, i - 1)];
      g.quality = next;
      g.detected = next;
      r.setDynamicScale(0.85);
      this.#onSettingsChanged();
      if (this.inGame) this.hud.toast({ title: t('ui.settings.autoQuality'), text: t('ui.toast.qualityLowered', { q: t(`settings.quality.${next}`) }), kind: 'info' });
      else this.pendingAutoToast = next;
    }
  }

  /**
   * El jugador no atraviesa a la gente: si se acerca demasiado a un personaje se le aparta con suavidad.
   * (Antes la cámara podía meterse dentro de una cabeza y media pantalla se veía negra un instante.)
   */
  #keepOutOfPeople() {
    const p = this.player.pos;
    for (const n of this.npcs.npcs) {
      if (n.rig?.group && !n.rig.group.visible) continue;
      const dx = p.x - n.pos.x;
      const dz = p.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 0.55;
      if (d < min && d > 1e-4) {
        p.x = n.pos.x + (dx / d) * min;
        p.z = n.pos.z + (dz / d) * min;
      }
    }
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
