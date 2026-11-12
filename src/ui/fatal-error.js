import { WebGLUnavailableError } from '../core/errors.js';
import { t } from '../i18n/index.js';

/**
 * Pantalla de error irrecuperable. Construye el DOM con textContent
 * (nunca innerHTML) para que el texto del error no se interprete como HTML.
 */
export function showFatalError(error) {
  window.__HOO_FATAL = true;

  document.getElementById('boot-screen')?.classList.add('boot--hidden');
  document.querySelector('.fatal')?.remove();

  const isWebGL = error instanceof WebGLUnavailableError;
  const title = t(isWebGL ? 'fatal.webgl.title' : 'fatal.generic.title');
  const text = t(isWebGL ? 'fatal.webgl.text' : 'fatal.generic.text');

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
  summary.textContent = t('fatal.details');
  const pre = document.createElement('pre');
  const cause = error?.cause ? `\n${t('fatal.cause')}: ${error.cause?.message ?? error.cause}` : '';
  pre.textContent = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}${cause}`;
  details.append(summary, pre);

  card.append(h, p, details);
  root.append(card);
  document.body.append(root);
}
