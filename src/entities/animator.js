/**
 * ANIMACIÓN PROCEDURAL de humanoides.
 *
 * Cada fotograma se calcula una POSE OBJETIVO (rotaciones por hueso + altura de
 * cadera) según la actividad, y el esqueleto se amortigua hacia ella. Las
 * transiciones (levantarse, sentarse, girarse para hablar) salen solas.
 *
 * Convenciones: el personaje mira a +Z; rotation.x negativo en un brazo/pierna
 * lo lleva hacia delante; rotation.z positivo en el brazo izquierdo lo abre.
 */

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'uArmL', 'fArmL', 'handL', 'uArmR', 'fArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

function emptyPose() {
  const p = {};
  for (const b of BONES) p[b] = [0, 0, 0];
  p.hipY = 0;
  p.hipZ = 0;
  return p;
}

/** Pequeño ruido determinista y suave (sin dependencias). */
const wobble = (t, seed) => Math.sin(t * 0.7 + seed) * 0.6 + Math.sin(t * 1.9 + seed * 2.3) * 0.3 + Math.sin(t * 3.7 + seed * 5.1) * 0.1;

export class HumanoidAnimator {
  /**
   * @param {ReturnType<import('./humanoid.js').createHumanoid>} rig
   * @param {{seed?: number, posture?: number}} [opts] posture: 0 erguido … 1 encorvado (edad)
   */
  constructor(rig, { seed = Math.random() * 100, posture = 0 } = {}) {
    this.rig = rig;
    this.seed = seed;
    this.posture = posture;
    this.activity = 'idle';
    this.params = {};
    this.time = seed;
    this.walkPhase = 0;
    this.speed = 0;
    this.blinkT = 2 + (seed % 3);
    this.look = null; // {yaw, pitch} relativos al cuerpo (radianes) o null
    this.talking = false;
    this.cur = emptyPose();
    this.hipBase = rig.bones.hips.position.y;
    this.gestureT = 0;
    this.dealT = 0;
  }

  /** Gesto puntual de reparto (crupieres en modo manual). */
  gesture() {
    this.dealT = 0.6;
  }

  /** Cambia de actividad: idle | walk | sit | sitPlay | sitTable | dealer | clerk | talk | lean | work | wave */
  set(activity, params = {}) {
    this.activity = activity;
    this.params = params;
  }

  update(dt) {
    this.time += dt;
    if (this.dealT > 0) this.dealT = Math.max(0, this.dealT - dt);
    const t = this.time;
    const p = emptyPose();
    const a = this.activity;
    const s = this.seed;
    let rate = 8;

    // respiración y balanceo comunes
    const breathe = Math.sin(t * 1.6 + s) * 0.018;
    p.chest[0] = -breathe + this.posture * 0.18;
    p.neck[0] = this.posture * 0.15;
    p.spine[0] = this.posture * 0.1;

    const standArms = () => {
      p.uArmL[2] = 0.08 + wobble(t * 0.3, s) * 0.02;
      p.uArmR[2] = -0.08 - wobble(t * 0.3, s + 1) * 0.02;
      p.fArmL[0] = -0.12;
      p.fArmR[0] = -0.12;
    };
    const sitBase = (seatY = 0.46) => {
      p.hipY = seatY + 0.1 - this.hipBase;
      p.hipZ = -0.06;
      p.thighL[0] = p.thighR[0] = -1.5;
      p.shinL[0] = p.shinR[0] = 1.45;
      p.footL[0] = p.footR[0] = 0.05;
      p.thighL[2] = 0.06;
      p.thighR[2] = -0.06;
      p.spine[0] += 0.04;
    };

    switch (a) {
      case 'walk': {
        rate = 18;
        const sp = this.speed;
        this.walkPhase += dt * (3.2 + sp * 2.2);
        const ph = this.walkPhase;
        const amp = Math.min(1, sp / 1.2);
        p.thighL[0] = Math.sin(ph) * 0.5 * amp;
        p.thighR[0] = -Math.sin(ph) * 0.5 * amp;
        p.shinL[0] = Math.max(0, -Math.cos(ph)) * 0.75 * amp + 0.05;
        p.shinR[0] = Math.max(0, Math.cos(ph)) * 0.75 * amp + 0.05;
        p.footL[0] = -p.thighL[0] * 0.3;
        p.footR[0] = -p.thighR[0] * 0.3;
        p.uArmL[0] = -Math.sin(ph) * 0.38 * amp;
        p.uArmR[0] = Math.sin(ph) * 0.38 * amp;
        p.uArmL[2] = 0.07;
        p.uArmR[2] = -0.07;
        p.fArmL[0] = -0.25 - Math.max(0, Math.sin(ph)) * 0.2;
        p.fArmR[0] = -0.25 - Math.max(0, -Math.sin(ph)) * 0.2;
        p.hipY = -Math.abs(Math.cos(ph)) * 0.025 * amp;
        p.hips[1] = Math.sin(ph) * 0.08 * amp;
        p.chest[1] = -Math.sin(ph) * 0.12 * amp;
        p.spine[0] += 0.04 * amp;
        break;
      }
      case 'sit':
        sitBase(this.params.seatY);
        p.uArmL[0] = p.uArmR[0] = -0.55;
        p.fArmL[0] = p.fArmR[0] = -0.75;
        p.uArmL[2] = 0.12;
        p.uArmR[2] = -0.12;
        p.spine[0] -= 0.12; // recostado
        p.head[1] = wobble(t * 0.25, s) * 0.35;
        p.head[0] = wobble(t * 0.2, s + 3) * 0.08;
        if (this.params.crossLegs) {
          p.thighR[0] = -1.55;
          p.thighR[1] = -0.35;
          p.shinR[0] = 1.2;
        }
        break;
      case 'sitPlay': {
        sitBase(this.params.seatY ?? 0.52);
        p.spine[0] += 0.12;
        p.uArmL[0] = -0.85;
        p.fArmL[0] = -0.75;
        p.uArmL[2] = 0.1;
        // pulsa el botón cada ~2,6 s
        const cyc = (t + s) % 2.6;
        const press = cyc < 0.35 ? Math.sin((cyc / 0.35) * Math.PI) : 0;
        p.uArmR[0] = -1.05 - press * 0.12;
        p.fArmR[0] = -0.55 + press * 0.25;
        p.uArmR[2] = -0.05;
        p.head[0] = -0.08 + Math.sin(t * 0.5 + s) * 0.03;
        p.head[1] = cyc > 1.2 && cyc < 2.2 ? Math.sin((cyc - 1.2) * Math.PI) * 0.12 : 0;
        break;
      }
      case 'sitTable': {
        sitBase(this.params.seatY ?? 0.52);
        p.spine[0] += 0.1;
        p.uArmL[0] = p.uArmR[0] = -0.75;
        p.fArmL[0] = p.fArmR[0] = -1.0;
        p.uArmL[2] = 0.18;
        p.uArmR[2] = -0.18;
        p.uArmL[1] = 0.25;
        p.uArmR[1] = -0.25;
        const g = (t * 0.4 + s) % 6;
        if (g < 0.6) p.uArmR[0] = -0.95 - Math.sin((g / 0.6) * Math.PI) * 0.25; // toca la mesa: «carta»
        p.head[1] = wobble(t * 0.2, s) * 0.3;
        p.head[0] = 0.12;
        break;
      }
      case 'dealer': {
        p.spine[0] = 0.08;
        p.uArmL[0] = -0.55;
        p.fArmL[0] = -1.15;
        p.uArmL[2] = 0.18;
        const cyc = (t + s) % 3.4;
        const deal = this.params.manual
          ? (this.dealT > 0 ? Math.sin((1 - this.dealT / 0.6) * Math.PI) : 0)
          : cyc < 0.9 ? Math.sin((cyc / 0.9) * Math.PI) : 0;
        p.uArmR[0] = -0.6 - deal * 0.35;
        p.uArmR[1] = deal * 0.6;
        p.fArmR[0] = -1.1 + deal * 0.5;
        p.uArmR[2] = -0.18;
        p.head[0] = 0.22;
        p.head[1] = deal * 0.25 + wobble(t * 0.2, s) * 0.2;
        break;
      }
      case 'clerk':
        p.spine[0] = 0.06;
        p.uArmL[0] = p.uArmR[0] = -0.42;
        p.fArmL[0] = p.fArmR[0] = -1.05;
        p.uArmL[2] = 0.22;
        p.uArmR[2] = -0.22;
        p.head[1] = wobble(t * 0.25, s) * 0.45;
        if ((t + s) % 9 < 1.4) p.fArmR[0] = -1.35; // escribe en el terminal
        break;
      case 'lean':
        p.uArmL[0] = p.uArmR[0] = -0.45;
        p.uArmL[2] = 0.32;
        p.uArmR[2] = -0.32;
        p.fArmL[0] = p.fArmR[0] = -1.75;
        p.fArmL[1] = -0.5;
        p.fArmR[1] = 0.5;
        p.head[1] = wobble(t * 0.18, s) * 0.55;
        p.thighL[2] = 0.05;
        p.thighR[2] = -0.05;
        break;
      case 'work': {
        p.spine[0] = 0.3;
        p.chest[0] += 0.1;
        p.uArmL[0] = -0.75;
        p.fArmL[0] = -0.9;
        const hit = Math.max(0, Math.sin((t + s) * 5));
        p.uArmR[0] = -0.9 - hit * 0.5;
        p.fArmR[0] = -0.7 - hit * 0.3;
        p.head[0] = 0.3;
        p.thighL[0] = -0.12;
        p.thighR[0] = 0.08;
        break;
      }
      case 'wave': {
        standArms();
        p.uArmR[2] = -2.5;
        p.uArmR[0] = -0.2;
        p.fArmR[2] = Math.sin(t * 9) * 0.45;
        p.fArmR[0] = -0.3;
        break;
      }
      default: {
        // idle / talk
        standArms();
        const shift = wobble(t * 0.15, s);
        p.hips[2] = shift * 0.035;
        p.thighL[2] = shift * 0.03;
        p.thighR[2] = shift * 0.03;
        p.head[1] = wobble(t * 0.2, s + 7) * 0.25;
        p.head[0] = wobble(t * 0.17, s + 2) * 0.06;
        if (this.params.handsBack) {
          p.uArmL[0] = p.uArmR[0] = 0.3;
          p.fArmL[0] = p.fArmR[0] = -0.6;
          p.uArmL[2] = 0.05;
          p.uArmR[2] = -0.05;
        }
        if (this.params.cane) {
          p.uArmR[0] = -0.25;
          p.fArmR[0] = -0.35;
        }
        if (this.params.folder) {
          p.uArmL[0] = -0.3;
          p.fArmL[0] = -1.25;
          p.uArmL[2] = 0.12;
        }
      }
    }

    // gestos al hablar (se suman a cualquier actividad de pie)
    if (this.talking && (a === 'idle' || a === 'talk' || a === 'clerk' || a === 'lean')) {
      const beat = Math.sin(t * 3.1 + s) * 0.5 + Math.sin(t * 1.7) * 0.5;
      const g = (t * 0.6 + s) % 4;
      if (a !== 'lean') {
        p.uArmR[0] = -0.45 - Math.max(0, beat) * 0.35;
        p.fArmR[0] = -0.95 - Math.max(0, beat) * 0.3;
        p.uArmR[2] = -0.12;
        if (g < 2) {
          p.uArmL[0] = -0.35 - Math.max(0, -beat) * 0.3;
          p.fArmL[0] = -0.9;
        }
      }
      p.head[0] += Math.sin(t * 4.3) * 0.04;
      p.head[1] *= 0.3;
    }

    // mirar a un objetivo (cabeza + cuello, limitado)
    if (this.look) {
      const yaw = Math.max(-1.1, Math.min(1.1, this.look.yaw));
      const pitch = Math.max(-0.5, Math.min(0.5, this.look.pitch ?? 0));
      p.head[1] = yaw * 0.65;
      p.neck[1] = yaw * 0.35;
      p.head[0] = -pitch * 0.7 + p.head[0] * 0.3;
    }

    // amortiguado hacia el objetivo
    const k = 1 - Math.exp(-rate * dt);
    const c = this.cur;
    for (const b of BONES) {
      const cb = c[b];
      const pb = p[b];
      cb[0] += (pb[0] - cb[0]) * k;
      cb[1] += (pb[1] - cb[1]) * k;
      cb[2] += (pb[2] - cb[2]) * k;
    }
    c.hipY += (p.hipY - c.hipY) * k;
    c.hipZ += (p.hipZ - c.hipZ) * k;

    const bones = this.rig.bones;
    for (const b of BONES) bones[b].rotation.set(c[b][0], c[b][1], c[b][2]);
    bones.hips.position.y = this.hipBase + c.hipY;
    bones.hips.position.z = c.hipZ;

    // parpadeo
    this.blinkT -= dt;
    let lid = 0.0015;
    if (this.blinkT < 0.14) lid = 0.011 * Math.sin(Math.max(0, this.blinkT) / 0.14 * Math.PI);
    if (this.blinkT <= 0) this.blinkT = 2.2 + ((s * 7.3 + t) % 3.5);
    for (const l of this.rig.lids) l.scale.y = lid;
  }
}
