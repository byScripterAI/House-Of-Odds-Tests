import { WebGLUnavailableError } from '../core/errors.js';

/**
 * Pantalla de error irrecuperable. Construye el DOM con textContent
 * (nunca innerHTML) para que el texto del error no se interprete como HTML.
 */
export function showFatalError(error) {
  window.__HOO_FATAL = true;

  document.getElementById('boot-screen')?.classList.add('boot--hidden');
  document.querySelector('.fatal')?.remove();

  const isWebGL = error instanceof WebGLUnavailableError;
  const title = isWebGL ? 'Gráficos 3D no disponibles' : 'HOUSE OF ODDS no ha podido continuar';
  const text = isWebGL
    ? 'Tu navegador o tu equipo no permiten WebGL, que el juego necesita. Prueba con una versión reciente de Chrome, Edge o Firefox, activa la aceleración por hardware en los ajustes del navegador y actualiza los controladores de la tarjeta gráfica.'
    : 'Se ha producido un error inesperado. Recarga la página; si se repite, abre la consola del navegador (F12) y revisa el detalle técnico de abajo.';

  const root = document.createElement('section');
  root.className = 'fatal';
  root.setAttribute('role', 'alert');

  const card = document.createElement('div');
  card.className = 'fatal__card';

  const h = document.createElement('h2');
  h.className = 'fatal__title';
  h.textContent = title;

  const p = document.createElement('p');
  p.className = 'fatal__text';
  p.textContent = text;

  const details = document.createElement('details');
  details.className = 'fatal__details';
  const summary = document.createElement('summary');
  summary.textContent = 'Detalle técnico';
  const pre = document.createElement('pre');
  const cause = error?.cause ? `\nCausa: ${error.cause?.message ?? error.cause}` : '';
  pre.textContent = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}${cause}`;
  details.append(summary, pre);

  card.append(h, p, details);
  root.append(card);
  document.body.append(root);
}
