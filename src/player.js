import { PLAYER, moveWithCollisions, wishDirection } from './systems/movement.js';

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

const BASE_SENSITIVITY = 0.0022;
const MAX_DELTA = 220; // píxeles por evento; descarta saltos espurios del navegador

/**
 * Primera persona: Pointer Lock, WASD, Shift, colisiones y cabeceo.
 * No conoce la escena: recibe la lista de colisiones y expone posición/orientación.
 */
export class Player {
  /**
   * @param {{canvas: HTMLCanvasElement, getSettings: () => any,
   *          colliders: Array, onLockChange?: (locked: boolean) => void}} opts
   */
  constructor({ canvas, getSettings, colliders, bounds = PLAYER.bounds, onLockChange = () => {} }) {
    this.canvas = canvas;
    this.getSettings = getSettings;
    this.colliders = colliders;
    this.bounds = bounds; // objeto vivo: el mundo lo amplía al expandirse
    this.onLockChange = onLockChange;
    this.pos = { x: 0, z: 6.4 };
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = false;
    this.velocity = { x: 0, z: 0 };
    this.bob = 0;
    this.input = { forward: false, back: false, left: false, right: false, sprint: false };
    this.moving = false;
    this._attached = false;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onMouse = (e) => this._mouse(e);
    this._onLockChangeEvt = () => {
      if (!this.locked) this._clearInput();
      this.onLockChange(this.locked);
    };
    this._onLockError = () => this.onLockChange(false);
    this._onBlur = () => this._clearInput();
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  /** Posición del ojo (m). */
  get eye() {
    const bobY = this.moving ? Math.sin(this.bob) * 0.025 : 0;
    return { x: this.pos.x, y: PLAYER.eyeHeight + bobY, z: this.pos.z };
  }

  attach() {
    if (this._attached) return;
    this._attached = true;
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('pointerlockchange', this._onLockChangeEvt);
    document.addEventListener('pointerlockerror', this._onLockError);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    if (!this._attached) return;
    this._attached = false;
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('pointerlockchange', this._onLockChangeEvt);
    document.removeEventListener('pointerlockerror', this._onLockError);
    window.removeEventListener('blur', this._onBlur);
    this.exitLock();
  }

  /** Solicita Pointer Lock. Debe llamarse desde un gesto del usuario (clic/tecla). */
  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => this.onLockChange(false));
    } catch {
      this.onLockChange(false);
    }
  }

  exitLock() {
    if (this.locked) document.exitPointerLock?.();
  }

  reset(x, z, yaw = 0, pitch = 0) {
    this.pos.x = x;
    this.pos.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.x = this.velocity.z = 0;
    this._clearInput();
  }

  _clearInput() {
    for (const k of Object.keys(this.input)) this.input[k] = false;
  }

  _key(e, down) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (!this.enabled && down) return;
    this.input[action] = down;
    if (down && e.code.startsWith('Arrow')) e.preventDefault();
  }

  _mouse(e) {
    if (!this.enabled || !this.locked) return;
    const s = BASE_SENSITIVITY * (this.getSettings().controls?.mouseSensitivity ?? 1);
    const dx = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementX || 0));
    const dy = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementY || 0));
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * s));
  }

  update(dt) {
    if (!this.enabled) {
      this.velocity.x = this.velocity.z = 0;
      this.moving = false;
      return;
    }
    const wish = wishDirection(this.input, this.yaw);
    const speed = this.input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const k = 1 - Math.exp(-14 * dt);
    this.velocity.x += (wish.x * speed - this.velocity.x) * k;
    this.velocity.z += (wish.z * speed - this.velocity.z) * k;
    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    this.moving = sp > 0.25;
    if (sp > 0.001) {
      moveWithCollisions(this.pos, this.velocity.x * dt, this.velocity.z * dt, this.colliders, this.bounds);
      this.bob += dt * (this.input.sprint ? 12 : 8.5) * Math.min(1, sp / PLAYER.walkSpeed);
    }
  }
}
