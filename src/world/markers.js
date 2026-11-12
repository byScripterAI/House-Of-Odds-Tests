import * as THREE from 'three';

/**
 * INDICADORES EN EL MUNDO.
 *  - Icono sobre la cabeza de un personaje: «!» (misión nueva), «?» (te espera para hablar),
 *    «◆» (tiene algo que puedes comprarle). Flotan, laten y siempre se ven (sin profundidad).
 *  - Baliza de objetivo: haz de luz + rombo giratorio + anillo en el suelo donde hay que ir.
 */

const KINDS = {
  quest: { glyph: '!', color: '#ffd24a', glow: '#ff9d00' },
  talk: { glyph: '?', color: '#7df0ff', glow: '#1aa8ff' },
  shop: { glyph: '◆', color: '#7dffb0', glow: '#18c26a' },
};

function iconTexture({ glyph, color, glow }) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, `${glow}cc`);
  g.addColorStop(0.55, `${glow}44`);
  g.addColorStop(1, `${glow}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,6,8,0.85)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = '700 46px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  ctx.fillText(glyph, 64, glyph === '◆' ? 66 : 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Markers {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'markers';
    scene.add(this.group);
    this.textures = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, iconTexture(v)]));
    this.npc = new Map(); // id → sprite
    this.time = 0;

    // baliza
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.5, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    beam.position.y = 3;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0x9df6ff, transparent: true, opacity: 0.95, toneMapped: false }),
    );
    gem.scale.set(1, 1.6, 1);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 40),
      new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.beacon = new THREE.Group();
    this.beacon.add(beam, gem, ring);
    this.beacon.visible = false;
    this.beaconParts = { beam, gem, ring };
    this.group.add(this.beacon);
  }

  /** @param {string} id @param {'quest'|'talk'|'shop'|null} kind */
  setNpc(id, kind) {
    let s = this.npc.get(id);
    if (!kind) {
      if (s) s.visible = false;
      return;
    }
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures[kind], depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
      s.scale.setScalar(0.42);
      s.renderOrder = 10;
      this.group.add(s);
      this.npc.set(id, s);
    }
    s.material.map = this.textures[kind];
    s.userData.kind = kind;
    s.visible = true;
  }

  clearNpcs() {
    for (const s of this.npc.values()) s.visible = false;
  }

  /** @param {{x:number, z:number, y?:number}|null} pos */
  setBeacon(pos) {
    this.beacon.visible = !!pos;
    if (pos) this.beacon.position.set(pos.x, 0, pos.z);
    this.beaconY = pos?.y ?? 1.6;
  }

  /** @param {number} dt @param {(id:string) => THREE.Vector3|null} headOf */
  update(dt, headOf) {
    this.time += dt;
    const t = this.time;
    for (const [id, s] of this.npc) {
      if (!s.visible) continue;
      const head = headOf(id);
      if (!head) {
        s.material.opacity = Math.max(0, s.material.opacity - dt * 4);
        continue;
      }
      s.material.opacity = Math.min(1, s.material.opacity + dt * 3);
      s.position.set(head.x, head.y + 0.42 + Math.sin(t * 2.4 + id.length) * 0.05, head.z);
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      s.scale.setScalar(0.42 * pulse);
    }
    if (this.beacon.visible) {
      const { gem, ring, beam } = this.beaconParts;
      gem.position.y = this.beaconY + Math.sin(t * 2) * 0.08;
      gem.rotation.y = t * 1.8;
      const k = (t * 0.8) % 1;
      ring.scale.setScalar(0.7 + k * 0.8);
      ring.material.opacity = 0.7 * (1 - k);
      beam.material.opacity = 0.09 + Math.sin(t * 3) * 0.03;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}
