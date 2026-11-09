/**
 * Bus de eventos mínimo para desacoplar módulos (UI, audio, sistemas, mundo).
 *
 * - `on` / `once` devuelven una función para desuscribirse.
 * - Un manejador que lanza una excepción NO impide que se ejecuten los demás.
 * - Es seguro suscribirse/desuscribirse mientras se está emitiendo.
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();

  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`EventBus.on('${event}'): el manejador debe ser una función`);
    }
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`EventBus.once('${event}'): el manejador debe ser una función`);
    }
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    const set = this.#handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.#handlers.delete(event);
  }

  /** @returns {number} cuántos manejadores se invocaron */
  emit(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return 0;
    let called = 0;
    // Copia: permite alterar suscripciones durante la emisión.
    for (const handler of [...set]) {
      if (!set.has(handler)) continue; // desuscrito por un manejador anterior
      called++;
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] Error en manejador de '${event}':`, error);
      }
    }
    return called;
  }

  listenerCount(event) {
    return this.#handlers.get(event)?.size ?? 0;
  }

  clear() {
    this.#handlers.clear();
  }
}
