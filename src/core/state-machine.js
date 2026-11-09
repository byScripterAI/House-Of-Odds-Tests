import { InvalidTransitionError } from './errors.js';

/**
 * Máquina de estados con tabla de transiciones explícita.
 *
 * Orden de una transición A → B:
 *   1. valida que B esté permitido desde A (si no, InvalidTransitionError)
 *   2. handlers[A].exit(B, payload)
 *   3. current = B, previous = A
 *   4. handlers[B].enter(payload, A)
 *   5. bus.emit('state:change', { from: A, to: B, payload })
 *
 * Si un manejador pide otra transición mientras se ejecuta una, se encola y se
 * procesa al terminar la actual (nunca se anidan).
 * Si un manejador lanza, la excepción se propaga pero la máquina queda
 * utilizable (el estado ya cambió y el bloqueo se libera).
 */
export class StateMachine {
  #transitions;
  #handlers;
  #bus;
  #current;
  #previous = null;
  #busy = false;
  #queue = [];

  /**
   * @param {object} options
   * @param {Record<string, readonly string[]>} options.transitions
   * @param {string} options.initial
   * @param {import('./event-bus.js').EventBus} [options.bus]
   */
  constructor({ transitions, initial, bus = null }) {
    if (!transitions || !Object.hasOwn(transitions, initial)) {
      throw new Error(`StateMachine: estado inicial desconocido '${initial}'`);
    }
    this.#transitions = transitions;
    this.#current = initial;
    this.#bus = bus;
    this.#handlers = new Map();
  }

  get current() {
    return this.#current;
  }

  get previous() {
    return this.#previous;
  }

  /**
   * Registra manejadores para un estado.
   * @param {string} state
   * @param {{enter?: Function, exit?: Function, update?: Function}} handlers
   */
  register(state, handlers) {
    if (!Object.hasOwn(this.#transitions, state)) {
      throw new Error(`StateMachine.register: estado desconocido '${state}'`);
    }
    this.#handlers.set(state, handlers);
  }

  can(to) {
    return this.#transitions[this.#current]?.includes(to) ?? false;
  }

  /** Cambia de estado; lanza InvalidTransitionError si no está permitido. */
  transition(to, payload) {
    this.#queue.push({ to, payload });
    if (this.#busy) return;
    this.#busy = true;
    try {
      while (this.#queue.length > 0) {
        const next = this.#queue.shift();
        this.#run(next.to, next.payload);
      }
    } finally {
      this.#busy = false;
      this.#queue.length = 0;
    }
  }

  /**
   * Como `transition`, pero devuelve false en vez de lanzar si no está permitido.
   * Si se llama desde dentro de un manejador (transición en curso), la petición
   * se encola y no se puede validar todavía: devuelve true y, si resulta
   * inválida, el error saldrá de la transición externa.
   */
  tryTransition(to, payload) {
    if (!this.#busy && !this.can(to)) return false;
    this.transition(to, payload);
    return true;
  }

  /** Delegado por Game cada frame al manejador `update` del estado actual. */
  update(dt) {
    this.#handlers.get(this.#current)?.update?.(dt);
  }

  #run(to, payload) {
    const from = this.#current;
    if (!this.can(to)) throw new InvalidTransitionError(from, to);

    this.#handlers.get(from)?.exit?.(to, payload);
    this.#previous = from;
    this.#current = to;
    this.#handlers.get(to)?.enter?.(payload, from);
    this.#bus?.emit('state:change', { from, to, payload });
  }
}
