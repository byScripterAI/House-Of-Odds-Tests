import * as THREE from 'three';
import { clipsFor } from './character-assets.js';

/**
 * Animador de los personajes reales: mezcla clips de captura de movimiento (AnimationMixer)
 * con capas procedurales encima — mirar al jugador (cabeza y cuello), mandíbula al hablar,
 * altura del asiento y gestos puntuales del crupier.
 *
 * Misma interfaz que el animador procedural antiguo: set(actividad, params), update(dt),
 * gesture(), y las propiedades look / talking / speed / activity / params.
 */

/** Actividad del juego → clips posibles (se elige uno y se varía con el tiempo). */
const ACTIVITY_CLIPS = {
  idle: ['idle', 'idle2', 'look', 'idle'],
  walk: ['walk'],
  sit: ['sitChair', 'sitRelaxed'],
  sitPlay: ['sitTable', 'sitThink'],
  sitTable: ['sitTable', 'sitThink'],
  dealer: ['work'],
  clerk: ['docs', 'idle', 'phone'], // de pie tras el mostrador (el clip «work» se inclina sobre una mesa baja y atravesaba el mueble)
  lean: ['wait', 'phone'],
  work: ['crouch', 'work'],
  wave: ['wave'],
  talk: ['talk', 'talk2'],
  listen: ['listen'],
  cheer: ['cheer', 'clap'],
  clap: ['clap'],
};
const SITTING = new Set(['sit', 'sitPlay', 'sitTable']);
/** Altura de la pelvis del clip sentado (m) — se ajusta al asiento real del mueble. */
const CLIP_SEAT_PELVIS = 0.5;

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _e = new THREE.Euler();

export class ClipAnimator {
  /** @param {ReturnType<typeof import('./character-assets.js').instantiateCharacter>} rig */
  constructor(rig, { seed = Math.random() * 100 } = {}) {
    this.rig = rig;
    this.seed = seed;
    this.mixer = new THREE.AnimationMixer(rig.model);
    this.clips = clipsFor(rig.name);
    this.actions = new Map();
    this.activity = null;
    this.params = {};
    this.speed = 0;
    this.look = null;
    this.talking = false;
    this.lookCur = { yaw: 0, pitch: 0 };
    this.jawT = 0;
    this.time = seed;
    this.current = null;
    this.varyT = 0;
    this.offsetY = 0;
    this.offsetTarget = 0;
    this.dealT = 0;
    // compatibilidad con el código que esperaba el animador procedural
    this.cur = { hipY: 0 };
    this.hipBase = 0;
    this.set('idle');
  }

  #action(name) {
    if (this.actions.has(name)) return this.actions.get(name);
    const clip = this.clips.get(name);
    if (!clip) return null;
    const a = this.mixer.clipAction(clip);
    this.actions.set(name, a);
    return a;
  }

  #play(name, fade = 0.35) {
    const next = this.#action(name) ?? this.#action('idle');
    if (!next || next === this.current) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    // empezar en un punto aleatorio para que dos personajes no se muevan a la vez
    next.time = (this.seed * 7.3 + this.time) % Math.max(0.1, next.getClip().duration);
    next.play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  /** Cambia de actividad (idle, walk, sit, sitPlay, sitTable, dealer, clerk, lean, work, wave, talk, listen, cheer, clap). */
  set(activity, params = {}) {
    const same = activity === this.activity;
    this.activity = activity;
    this.params = params;
    if (same && this.current) return;
    const list = ACTIVITY_CLIPS[activity] ?? ACTIVITY_CLIPS.idle;
    const pick = list[Math.floor((this.seed * 13 + this.time * 3) % list.length)];
    this.#play(pick, activity === 'walk' || this.prevWalk ? 0.25 : 0.45);
    this.prevWalk = activity === 'walk';
    this.varyT = 12 + (this.seed % 10);
    this.offsetTarget = SITTING.has(activity) ? (params.seatY ?? 0.46) + 0.1 - CLIP_SEAT_PELVIS : 0;
  }

  /** Coloca la altura final del asiento al instante (PNJ que ya empiezan sentados). */
  snap() {
    this.offsetY = this.offsetTarget;
    this.mixer.update(0);
  }

  gesture() {
    this.dealT = 0.6;
  }

  update(dt) {
    this.time += dt;
    // variaciones: cambia de clip dentro de la misma actividad para que no se vea en bucle
    this.varyT -= dt;
    if (this.varyT <= 0 && this.activity !== 'walk') {
      const list = ACTIVITY_CLIPS[this.activity] ?? ACTIVITY_CLIPS.idle;
      if (list.length > 1) this.#play(list[Math.floor(Math.random() * list.length)], 0.8);
      this.varyT = 14 + Math.random() * 12;
    }
    // hablar: gestos de conversación mientras habla; al callar, escucha
    if (this.talking && this.activity !== 'talk' && !SITTING.has(this.activity) && this.activity !== 'walk') this.set('talk', this.params);
    else if (!this.talking && this.activity === 'talk' && this.params.auto) this.set('listen', this.params);
    if (this.current && this.activity === 'walk') this.current.setEffectiveTimeScale(Math.max(0.6, Math.min(1.5, this.speed / 1.15)));
    this.mixer.update(dt);

    // altura del asiento (suave)
    this.offsetY += (this.offsetTarget - this.offsetY) * Math.min(1, dt * 5);
    this.rig.model.position.y = this.offsetY;

    const b = this.rig;
    // mirar: reparte el giro entre cuello y cabeza
    const want = this.look ?? { yaw: 0, pitch: 0 };
    const k = Math.min(1, dt * 4);
    this.lookCur.yaw += (THREE.MathUtils.clamp(want.yaw, -1.1, 1.1) - this.lookCur.yaw) * k;
    this.lookCur.pitch += (THREE.MathUtils.clamp(want.pitch, -0.45, 0.4) - this.lookCur.pitch) * k;
    if (Math.abs(this.lookCur.yaw) + Math.abs(this.lookCur.pitch) > 0.002) {
      this.#turn(b.neck, this.lookCur.yaw * 0.4, this.lookCur.pitch * 0.35);
      this.#turn(b.head, this.lookCur.yaw * 0.6, this.lookCur.pitch * 0.65);
    }
    // mandíbula: desactivada (sin sincronía labial real se ve peor que con los gestos de conversación)
    if (b.jaw && this.jawEnabled) {
      const target = this.talking ? 0.5 + 0.5 * Math.sin(this.time * 17) * Math.sin(this.time * 6.1 + 1) : 0;
      this.jawT += (Math.max(0, target) - this.jawT) * Math.min(1, dt * 18);
      if (this.jawT > 0.01) b.jaw.rotateZ(-this.jawT * 0.16);
    }
    if (this.dealT > 0) this.dealT = Math.max(0, this.dealT - dt);
  }

  /** Gira un hueso en espacio de mundo (eje vertical del personaje y eje lateral de la cabeza). */
  #turn(bone, yaw, pitch) {
    if (!bone || !bone.parent) return;
    bone.getWorldQuaternion(_q);
    this.rig.group.getWorldQuaternion(_q2);
    const up = _axisY.set(0, 1, 0).applyQuaternion(_q2);
    const right = _axisX.set(1, 0, 0).applyQuaternion(_q2);
    _qp.setFromAxisAngle(up, yaw);
    _q.premultiply(_qp);
    _qp.setFromAxisAngle(right, -pitch);
    _q.premultiply(_qp);
    bone.parent.getWorldQuaternion(_q2).invert();
    bone.quaternion.copy(_q2.multiply(_q));
    void _e;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rig.model);
  }
}
