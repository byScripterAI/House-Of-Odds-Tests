/** Errores propios del motor. Módulo puro (sin DOM ni Three.js). */

export class WebGLUnavailableError extends Error {
  constructor(cause) {
    super('WebGL no está disponible en este navegador o equipo.');
    this.name = 'WebGLUnavailableError';
    if (cause) this.cause = cause;
  }
}

export class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Transición de estado no permitida: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}
