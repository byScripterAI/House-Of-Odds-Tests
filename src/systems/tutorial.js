/**
 * Tutorial guiado por eventos. Módulo puro (sin DOM): la app informa de lo que
 * hace el jugador con `report(evento)` y la interfaz se pinta con `onChange`.
 * Los textos viven en i18n (`tut.<id>`, `hint.<x>.title|text`). Los pasos se completan en orden; un evento que ya ocurrió antes de llegar a
 * su paso cuenta igualmente (no hay que repetir lo que ya hiciste).
 */

export const INTRO_ID = 'intro';

export const INTRO_STEPS = Object.freeze([
  { id: 'look', event: 'look' },
  { id: 'move', event: 'move' },
  { id: 'machine', event: 'enterMachine' },
  { id: 'spin', event: 'spin' },
  { id: 'leave', event: 'leaveMachine' },
  { id: 'shop', event: 'openShop' },
  { id: 'buy', event: 'buy' },
]);

/** Avisos únicos que aparecen cuando el juego cambia de forma notable. */
export const HINTS = Object.freeze([
  { id: 'hint-wing', event: 'upgrade:expand-hall' },
  { id: 'hint-star', event: 'upgrade:mod-wild-star' },
  { id: 'hint-zones', event: 'prestige:50' },
]);

export class Tutorial {
  #steps;
  #seen = new Set();
  #index = 0;
  #onChange;
  #done;

  /** @param {{steps?: Array, done?: boolean, onChange?: Function}} opts */
  constructor({ steps = INTRO_STEPS, done = false, onChange = () => {} } = {}) {
    this.#steps = steps;
    this.#done = done;
    this.#onChange = onChange;
  }

  get active() { return !this.#done; }
  get index() { return this.#index; }
  get total() { return this.#steps.length; }
  get current() { return this.#done ? null : this.#steps[this.#index] ?? null; }

  /** Devuelve true si este evento completó uno o más pasos. */
  report(event) {
    if (this.#done) return false;
    this.#seen.add(event);
    let advanced = false;
    while (this.#index < this.#steps.length && this.#seen.has(this.#steps[this.#index].event)) {
      this.#index += 1;
      advanced = true;
    }
    if (this.#index >= this.#steps.length) this.#done = true;
    if (advanced) this.#onChange(this.current, this.#done);
    return advanced;
  }

  skip() {
    this.#done = true;
    this.#onChange(null, true);
  }
}
