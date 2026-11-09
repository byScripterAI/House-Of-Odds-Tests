/**
 * Tutorial guiado por eventos. Módulo puro (sin DOM): la app informa de lo que
 * hace el jugador con `report(evento)` y la interfaz se pinta con `onChange`.
 * Los pasos se completan en orden; un evento que ya ocurrió antes de llegar a
 * su paso cuenta igualmente (no hay que repetir lo que ya hiciste).
 */

export const INTRO_ID = 'intro';

export const INTRO_STEPS = Object.freeze([
  { id: 'look', event: 'look', text: 'Mueve el ratón para mirar a tu alrededor' },
  { id: 'move', event: 'move', text: 'Muévete con W A S D (Mayús para correr)' },
  { id: 'machine', event: 'enterMachine', text: 'Acércate a THE CLASSIC, en el centro, y pulsa E' },
  { id: 'spin', event: 'spin', text: 'Pulsa ESPACIO (o clic) para activar la máquina' },
  { id: 'leave', event: 'leaveMachine', text: 'Pulsa Q para salir de la máquina' },
  { id: 'shop', event: 'openShop', text: 'Ve a la TIENDA (al fondo, a la izquierda) y pulsa E' },
  { id: 'buy', event: 'buy', text: 'Compra tu primera mejora con tus MARKS' },
]);

/** Avisos únicos que aparecen cuando el juego cambia de forma notable. */
export const HINTS = Object.freeze([
  { id: 'hint-wing', event: 'upgrade:expand-hall', title: 'ALA NORTE ABIERTA', text: 'La puerta del fondo del casino ya está abierta: ve a verla.' },
  { id: 'hint-star', event: 'upgrade:mod-wild-star', title: 'COMODÍN ESTELAR', text: 'Ahora puede salir la estrella en los rodillos: cuenta como cualquier símbolo.' },
  { id: 'hint-zones', event: 'prestige:50', title: 'NUEVAS SALAS', text: 'Las cuatro puertas laterales llevarán a nuevas salas en futuras actualizaciones.' },
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
