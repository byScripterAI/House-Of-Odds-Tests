import * as THREE from 'three';

const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Director de cámara. Modos:
 *  - cinematic: órbita lenta alrededor de la máquina (menú principal).
 *  - player:    primera persona (sigue a Player).
 *  - machine:   plano fijo frente a la máquina.
 * Al cambiar de modo se mezcla suavemente (transición amortiguada).
 */
export class CameraRig {
  constructor(camera, { player, machinePose, focus }) {
    this.camera = camera;
    this.player = player;
    this.machinePose = machinePose;
    this.focus = focus; // THREE.Vector3 que mira la órbita
    this.mode = 'cinematic';
    this.transition = 0;
    this.duration = 1;
    this.fromPos = new THREE.Vector3();
    this.fromQuat = new THREE.Quaternion();
    this.time = 0;
    this.shakeAmount = 0;
    this.fovTarget = 62;
    this.focusPose = null;
    this.focusFov = 46;
    this.snap();
  }

  /** Cambia de modo; `instant` evita la mezcla. */
  setMode(mode, { instant = false, duration = 1.1 } = {}) {
    if (mode === this.mode && !instant) return;
    this.mode = mode;
    this.fovTarget = mode === 'machine' ? 52 : mode === 'player' ? 72 : mode === 'focus' ? this.focusFov : 62;
    this.transition = instant ? 0 : duration;
    this.duration = duration;
    // la mezcla parte de donde está la cámara AHORA y sigue al objetivo en vivo
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    if (instant) this.snap();
  }

  /**
   * Encuadre libre (diálogos, cinemáticas de compra…).
   * @param {(time:number) => {position: THREE.Vector3, target: THREE.Vector3}} poseFn
   */
  focusOn(poseFn, { fov = 46, duration = 0.9 } = {}) {
    this.focusPose = poseFn;
    this.focusFov = fov;
    this.mode = '';
    this.setMode('focus', { duration });
  }

  shake(amount = 0.04) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  _pose() {
    if (this.mode === 'player') {
      const eye = this.player.eye;
      _p.set(eye.x, eye.y, eye.z);
      _e.set(this.player.pitch, this.player.yaw, 0);
      _q.setFromEuler(_e);
    } else if (this.mode === 'focus' && this.focusPose) {
      // encuadre de diálogo o cinemática: pose dada desde fuera (se evalúa en vivo)
      const pose = this.focusPose(this.time);
      _p.copy(pose.position);
      _m.lookAt(_p, pose.target, _up);
      _q.setFromRotationMatrix(_m);
    } else if (this.mode === 'machine') {
      const pose = this.machinePose();
      _p.copy(pose.position);
      _p.x += Math.sin(this.time * 0.4) * 0.02;
      _p.y += Math.sin(this.time * 0.55) * 0.012;
      _m.lookAt(_p, pose.target, _up);
      _q.setFromRotationMatrix(_m);
    } else {
      const a = this.time * 0.07 + 0.6;
      _p.set(this.focus.x + Math.sin(a) * 6.8, 2.3 + Math.sin(this.time * 0.11) * 0.35, this.focus.z + 1.3 + Math.cos(a) * 5.4);
      _look.copy(this.focus);
      _m.lookAt(_p, _look, _up);
      _q.setFromRotationMatrix(_m);
    }
  }

  snap() {
    this._pose();
    this.camera.position.copy(_p);
    this.camera.quaternion.copy(_q);
    this.camera.fov = this.fovTarget;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    this._pose();
    if (this.transition > 0) {
      this.transition = Math.max(0, this.transition - dt);
      const x = 1 - this.transition / this.duration;
      const k = x * x * x * (x * (x * 6 - 15) + 10); // smootherstep: velocidad 0 al empezar y al acabar
      this.camera.position.copy(this.fromPos).lerp(_p, k);
      this.camera.quaternion.copy(this.fromQuat).slerp(_q, k);
    } else {
      this.camera.position.copy(_p);
      this.camera.quaternion.copy(_q);
    }
    if (this.shakeAmount > 0.0005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= Math.exp(-7 * dt);
    }
    const f = this.camera.fov;
    const nf = f + (this.fovTarget - f) * (1 - Math.exp(-6 * dt));
    if (Math.abs(nf - f) > 0.001) {
      this.camera.fov = nf;
      this.camera.updateProjectionMatrix();
    }
  }
}
