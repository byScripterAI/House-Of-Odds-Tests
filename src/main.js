import { Game } from './core/game.js';
import { GAME } from './config.js';
import { i18n, t } from './i18n/index.js';
import { App } from './app.js';
import { SaveManager } from './save/save-manager.js';
import { showFatalError } from './ui/fatal-error.js';
import { DebugOverlay } from './ui/debug-overlay.js';
import { characterTemplates, loadCharacters, loadCustomers } from './entities/character-assets.js';
import { DETECT_VERSION, detectQuality } from './core/hardware.js';
import { loadProps } from './world/props/assets.js';
import { loadModels } from './world/props/models.js';
import { loadNeonFont } from './world/neon.js';
import { loadArt } from './world/props/decor.js';
import { createWorld } from './world/world.js';

/** Punto de entrada. Solo cablea módulos; no contiene lógica de juego. */

const bootScreen = document.getElementById('boot-screen');
const bootFill = document.getElementById('boot-fill');
const bootHead = document.getElementById('boot-head');
const bootPct = document.getElementById('boot-pct');
const bootSteps = [...(document.getElementById('boot-steps')?.children ?? [])];
const bootTip = document.getElementById('boot-tip');
let shownFraction = 0;

/** Barra, porcentaje y pasos (rombos) de la pantalla de carga. Nunca retrocede. */
function setProgress(fraction) {
  shownFraction = Math.max(shownFraction, Math.min(1, fraction));
  const f = shownFraction;
  bootFill.style.transform = `scaleX(${f})`;
  if (bootHead) bootHead.style.left = `${f * 100}%`;
  if (bootPct) bootPct.firstChild.textContent = String(Math.round(f * 100));
  bootSteps.forEach((li, i) => li.classList.toggle('is-on', f >= (i + 0.5) / bootSteps.length - 0.06));
}

/** Consejos que van rotando mientras carga. */
function startTips() {
  if (!bootTip) return () => {};
  const tips = [1, 2, 3, 4, 5].map((n) => t(`boot.tip.${n}`)).filter((x) => !x.startsWith('boot.tip'));
  if (!tips.length) return () => {};
  let i = Math.floor(Math.random() * tips.length);
  const show = () => {
    bootTip.classList.remove('is-in');
    setTimeout(() => {
      bootTip.textContent = tips[i++ % tips.length];
      bootTip.classList.add('is-in');
    }, 350);
  };
  show();
  const id = setInterval(show, 4200);
  return () => clearInterval(id);
}
const bootMessage = document.getElementById('boot-message');
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** @param {string} messageKey clave i18n del texto de carga */
async function onProgress(fraction, messageKey) {
  setProgress(fraction);
  bootMessage.textContent = t(messageKey);
  await nextFrame(); // cede el hilo para que la barra se pinte
}

/** Las texturas de rótulos usan las fuentes: hay que tenerlas cargadas antes de dibujarlas. */
async function loadFonts() {
  if (!document.fonts?.load) return;
  const wanted = ['700 40px Cinzel', '400 40px Cinzel', '400 30px "Cormorant Garamond"', '600 30px "Cormorant Garamond"'];
  await Promise.race([
    Promise.all(wanted.map((f) => document.fonts.load(f).catch(() => []))),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

async function main() {
  window.__HOO_LOADING = true;
  i18n.init(); // idioma guardado, o detectado la primera vez (inglés si no es uno de los 6)
  document.documentElement.lang = i18n.lang;
  const stopTips = startTips();
  const tagline = document.getElementById('boot-tagline');
  if (tagline) tagline.textContent = t('ui.menu.tagline');
  const tipLabel = document.getElementById('boot-tiplabel');
  if (tipLabel) tipLabel.textContent = t('boot.tipLabel');
  const ver = document.getElementById('boot-version');
  if (ver) ver.textContent = `v${GAME.version}${GAME.stage ? ` · ${t('ui.beta.badge')}` : ''}`;
  const save = new SaveManager();
  const settings = save.loadSettings();
  // calidad automática: la primera vez se mide el equipo (un PC modesto no arranca en MEDIA y se atasca)
  let autoDetected = null;
  if (settings.graphics.auto && (!settings.graphics.detected || settings.graphics.detectVersion !== DETECT_VERSION)) {
    const { tier, signals } = detectQuality();
    settings.graphics.quality = tier;
    settings.graphics.detected = tier;
    settings.graphics.detectVersion = DETECT_VERSION;
    if (tier === 'veryLow') settings.graphics.renderScale = Math.min(settings.graphics.renderScale, 0.75);
    save.saveSettings(settings);
    autoDetected = tier;
    console.info('[calidad] detectada', tier, signals);
  }
  const game = new Game({ canvas, settings });
  game.bus.on('game:fatal', showFatalError);

  await onProgress(0.1, 'boot.fonts');
  await loadFonts();
  await game.init({ onProgress: (f, key) => onProgress(0.12 + f * 0.26, key === 'boot.ready' ? 'boot.characters' : key) });
  // personajes con nombre, personal y animaciones (comprimidos): con barra de progreso real
  await onProgress(0.4, 'boot.characters');
  let kc = 0;
  let kp = 0;
  let km = 0;
  const bar = () => setProgress(0.4 + (kc * 0.7 + kp * 0.15 + km * 0.15) * 0.3);
  await Promise.all([loadCharacters((k) => ((kc = k), bar())), loadProps((k) => ((kp = k), bar())), loadModels((k) => ((km = k), bar())), loadNeonFont(), loadArt()]);

  await onProgress(0.7, 'boot.casino');
  // el casino se construye por pasos (la página sigue respondiendo) y luego se «calienta»: shaders, texturas
  // y reflejos listos ANTES de enseñar el menú, así el primer fotograma no se congela
  const world = createWorld({ renderer: game.renderer.webgl, graphics: game.renderer.settings });
  await world.load((f) => setProgress(0.7 + f * 0.16));
  const app = new App({ game, uiRoot, save, world });
  const overlay = new DebugOverlay({ root: uiRoot, game });
  app.start();
  await onProgress(0.86, 'boot.shaders');
  await world.warmup((f) => setProgress(0.86 + f * 0.12));
  game.start();
  // dos fotogramas reales bajo la cortina (sombras, post-proceso, personajes del menú)
  await nextFrame();
  await nextFrame();
  await nextFrame();

  // clientes en segundo plano (solo hacen falta tras la reapertura)
  // (se esperan unos segundos para no competir con el primer vistazo al menú; sus shaders se compilan por trozos)
  setTimeout(() => {
    loadCustomers()
      .then(() => world.warmObjects(characterTemplates()))
      .then(() => app.npcs?.onCustomersLoaded?.());
  }, 4000);

  if (autoDetected) app.notifyAutoQuality?.(autoDetected);

  setProgress(1);
  stopTips();
  window.__HOO_BOOTED = true;
  window.houseOfOdds = { game, app, overlay, save }; // asa de depuración desde la consola
  bootScreen.classList.add('boot--hidden');
}

main().catch(showFatalError);
