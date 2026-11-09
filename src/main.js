import { Game } from './core/game.js';
import { App } from './app.js';
import { SaveManager } from './save/save-manager.js';
import { showFatalError } from './ui/fatal-error.js';
import { DebugOverlay } from './ui/debug-overlay.js';

/** Punto de entrada. Solo cablea módulos; no contiene lógica de juego. */

const bootScreen = document.getElementById('boot-screen');
const bootFill = document.getElementById('boot-fill');
const bootMessage = document.getElementById('boot-message');
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function onProgress(fraction, message) {
  bootFill.style.transform = `scaleX(${fraction})`;
  bootMessage.textContent = message;
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
  const save = new SaveManager();
  const game = new Game({ canvas, settings: save.loadSettings() });
  game.bus.on('game:fatal', showFatalError);

  await onProgress(0.1, 'Cargando tipografías…');
  await loadFonts();
  await game.init({ onProgress });

  await onProgress(0.9, 'Construyendo el casino…');
  const app = new App({ game, uiRoot, save });
  const overlay = new DebugOverlay({ root: uiRoot, game });

  app.start();
  game.start();

  window.__HOO_BOOTED = true;
  window.houseOfOdds = { game, app, overlay, save }; // asa de depuración desde la consola
  bootScreen.classList.add('boot--hidden');
}

main().catch(showFatalError);
