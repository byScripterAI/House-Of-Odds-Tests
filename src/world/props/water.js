import * as THREE from 'three';

/**
 * AGUA de las goteras: charcos con ondas de verdad, gotas que se forman en el techo y caen, y salpicaduras.
 *
 *  - Charco: un único material (MeshStandard ampliado) con el contorno irregular hecho en el shader, borde
 *    húmedo que oscurece el mármol, superficie casi espejo y ONDAS físicas: cada impacto lanza un frente de
 *    onda que se expande y se amortigua (ecuación de un anillo gaussiano), más un rizado finísimo. Las ondas
 *    tuercen la normal, así que los reflejos de las lámparas y del casino tiemblan como en el agua real.
 *  - ALTA y ULTRA: reflejo plano en tiempo real (la sala se dibuja reflejada a media resolución, solo si hay
 *    un charco a la vista); el resto de calidades refleja el entorno capturado del propio casino.
 *  - Gota: se hincha colgando del techo, se suelta, cae con la gravedad (estirándose con la velocidad) y al
 *    tocar el agua lanza una corona de gotitas y un pequeño chorro de rebote. El número depende de la calidad.
 */

const MAX_HITS = 4;

const VERT_PARS = /* glsl */ `
varying vec2 vPud;
varying vec3 vPudTx;
varying vec3 vPudTy;
varying vec4 vReflUv;
uniform mat4 uReflMat;
`;
const VERT_MAIN = /* glsl */ `
vPud = position.xy;
vPudTx = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
vPudTy = normalize( normalMatrix * vec3( 0.0, 1.0, 0.0 ) );
vReflUv = uReflMat * modelMatrix * vec4( position, 1.0 );
`;

const FRAG_PARS = /* glsl */ `
varying vec2 vPud;
varying vec3 vPudTx;
varying vec3 vPudTy;
varying vec4 vReflUv;
uniform float uTime;
uniform vec4 uHits[${MAX_HITS}];
uniform vec2 uSize;
uniform float uSeed;
uniform float uRound;
uniform sampler2D uReflect;
uniform float uUseRefl;
float pudHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float pudNoise( vec2 p ) {
  vec2 i = floor( p ); vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( pudHash( i ), pudHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( pudHash( i + vec2( 0.0, 1.0 ) ), pudHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
`;

/** Contorno, ondas y rugosidad del agua (va justo tras la rugosidad, que en el shader va antes que la normal). */
const FRAG_SURFACE = /* glsl */ `
float pudShape = length( vPud / uSize );
float pudEdge = mix( ( pudNoise( vPud * 2.4 + uSeed ) - 0.5 ) * 0.36 + ( pudNoise( vPud * 6.3 - uSeed ) - 0.5 ) * 0.14, 0.0, uRound );
float pudD = pudShape + pudEdge;
float pudWater = 1.0 - smoothstep( 0.8, 0.86, pudD );
float pudDamp = 1.0 - smoothstep( 0.86, 1.25, pudD );
vec2 pudGrad = vec2( 0.0 );
for ( int i = 0; i < ${MAX_HITS}; i ++ ) {
  vec4 h = uHits[ i ];
  float age = uTime - h.z;
  if ( age > 0.0 && age < 2.4 ) {
    vec2 dp = vPud - h.xy;
    float r = length( dp ) + 1e-4;
    float front = age * 0.36;
    float band = exp( - pow( ( r - front ) * 9.0, 2.0 ) ) + 0.45 * exp( - pow( ( r - front * 0.62 ) * 11.0, 2.0 ) );
    float amp = exp( - age * 1.9 ) * h.w;
    pudGrad += dp / r * cos( ( r - front ) * 70.0 ) * band * amp * 0.9;
  }
}
// rizado finísimo que se mueve despacio (corrientes de aire)
pudGrad += ( vec2( pudNoise( vPud * 21.0 + uTime * 0.35 ), pudNoise( vPud * 21.0 + 13.0 - uTime * 0.3 ) ) - 0.5 ) * 0.035;
roughnessFactor = mix( mix( roughnessFactor, 0.5, pudDamp ), 0.03, pudWater );
`;
const FRAG_NORMAL = /* glsl */ `
normal = normalize( normal - ( pudGrad.x * vPudTx + pudGrad.y * vPudTy ) * pudWater );
`;
const FRAG_OUT = /* glsl */ `
if ( uUseRefl > 0.5 ) {
  vec4 ruv = vReflUv;
  ruv.xy += pudGrad * 0.5 * ruv.w;
  vec3 refl = texture2DProj( uReflect, ruv ).rgb;
  float cosT = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
  float fres = 0.02 + 0.98 * pow( 1.0 - cosT, 5.0 );
  outgoingLight = mix( outgoingLight, outgoingLight + refl, pudWater * ( 0.22 + 0.78 * fres ) );
}
diffuseColor.a = pudWater * 0.66 + ( pudDamp - pudWater ) * 0.26;
#include <opaque_fragment>
`;

/** Material de charco (cada charco el suyo: comparten programa). `size`: semiejes de la elipse (m). */
export function puddleMaterial({ size = [1, 0.7], seed = 0, round = false, reflection = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.03, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.25 });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -4;
  m.polygonOffsetUnits = -4;
  const uniforms = {
    uTime: { value: 0 },
    uHits: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uSize: { value: new THREE.Vector2(size[0], size[1]) },
    uSeed: { value: seed },
    uRound: { value: round ? 1 : 0 },
    uReflect: { value: reflection?.texture ?? null },
    uReflMat: { value: reflection?.matrix ?? new THREE.Matrix4() },
    uUseRefl: { value: 0 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_SURFACE}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace('#include <opaque_fragment>', FRAG_OUT);
  };
  m.customProgramCacheKey = () => 'puddle-v1';
  let next = 0;
  return {
    material: m,
    uniforms,
    /** Impacto de una gota en (x, y) del plano del charco (coordenadas locales). */
    hit(x, y, time, strength = 1) {
      uniforms.uHits.value[next].set(x, y, time, strength);
      next = (next + 1) % MAX_HITS;
    },
    update(time, reflOn) {
      uniforms.uTime.value = time;
      uniforms.uUseRefl.value = reflOn && uniforms.uReflect.value ? 1 : 0;
    },
  };
}

/**
 * Reflejo plano compartido por todos los charcos (todos están a la misma altura). Dibuja la sala reflejada
 * con un plano de recorte oblicuo (nada de lo que hay bajo el suelo) a media resolución.
 */
export function waterReflection(renderer, scene, { y = 0.01, scale = 0.5 } = {}) {
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
  rt.texture.name = 'water-reflection';
  const cam = new THREE.PerspectiveCamera();
  const matrix = new THREE.Matrix4();
  const plane = new THREE.Plane();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const size = new THREE.Vector2();
  const normal = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const target = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const origin = new THREE.Vector3(0, y, 0);
  const hidden = [];
  return {
    texture: rt.texture,
    matrix,
    /** Dibuja el reflejo para la cámara de este fotograma. `skip`: objetos que no se reflejan (los charcos). */
    render(camera, skip = []) {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(64, Math.round(size.x * scale));
      const h = Math.max(64, Math.round(size.y * scale));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      // cámara espejo respecto al plano del suelo
      pos.setFromMatrixPosition(camera.matrixWorld);
      if (pos.y <= y) return false;
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(pos);
      cam.position.copy(pos).setY(2 * y - pos.y);
      target.copy(look).setY(2 * y - look.y);
      cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
      cam.lookAt(target);
      cam.far = camera.far;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      cam.projectionMatrix.elements[8] *= -1;
      cam.projectionMatrix.elements[12] *= -1;
      matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      // plano de recorte oblicuo (Lengyel)
      plane.setFromNormalAndCoplanarPoint(normal, origin).applyMatrix4(cam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const p = cam.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      p[2] = clip.x;
      p[6] = clip.y;
      p[10] = clip.z + 1;
      p[14] = clip.w;
      hidden.length = 0;
      for (const o of skip) {
        if (o.visible) {
          hidden.push(o);
          o.visible = false;
        }
      }
      scene.traverse((o) => {
        if ((o.isPoints || o.userData.noReflect) && o.visible) {
          hidden.push(o);
          o.visible = false;
        }
      });
      const prev = renderer.getRenderTarget();
      const prevNeeds = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
      renderer.shadowMap.needsUpdate = prevNeeds;
      for (const o of hidden) o.visible = true;
      return true;
    },
    dispose() {
      rt.dispose();
    },
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * Gotas de una gotera: gota que se forma colgando del techo, caída con estela y salpicadura (corona de
 * gotitas + chorro de rebote). `onImpact(time)` avisa al charco para lanzar la onda.
 */
export function leakDrops(ctx, { top, landY, period, offset, droplets = 10, onImpact }) {
  const { track } = ctx;
  const group = new THREE.Group();
  group.userData.noReflect = true;
  const water = track(new THREE.MeshStandardMaterial({ color: 0xcfe6f2, emissive: 0x2a3640, emissiveIntensity: 0.6, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.72, envMapIntensity: 2.2 }));
  const dropGeo = track(new THREE.SphereGeometry(0.02, 12, 10));
  const hang = new THREE.Mesh(dropGeo, water);
  hang.position.y = top;
  group.add(hang);
  const drop = new THREE.Mesh(dropGeo, water);
  group.add(drop);
  // estela tenue (la vista «ve» la gota rápida como un trazo)
  const streakMat = track(new THREE.MeshBasicMaterial({ color: 0xbfe0f0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  const streak = new THREE.Mesh(track(new THREE.CylinderGeometry(0.0035, 0.0005, 1, 6, 1, true).translate(0, 0.5, 0)), streakMat);
  group.add(streak);
  // gotitas de la salpicadura (instanciadas: una sola llamada de dibujo)
  const n = Math.max(4, droplets);
  const spray = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.006, 6, 4)), water, n + 1);
  spray.frustumCulled = false;
  group.add(spray);
  const parts = Array.from({ length: n + 1 }, () => ({ x: 0, y: -1, z: 0, vx: 0, vy: 0, vz: 0, s: 1, alive: false, delay: 0 }));
  const G = 9.81;
  const fall = Math.sqrt((2 * (top - landY)) / G);
  let last = -1;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function burst() {
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
      const sp = rnd(0.35, 0.85);
      Object.assign(p, { x: Math.cos(a) * 0.012, y: landY + 0.004, z: Math.sin(a) * 0.012, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rnd(0.55, 1.15), s: rnd(0.55, 1.15), alive: true, delay: 0 });
    }
    // chorro de rebote (gota de Worthington): sube recta un instante después
    Object.assign(parts[n], { x: 0, y: landY, z: 0, vx: rnd(-0.03, 0.03), vz: rnd(-0.03, 0.03), vy: rnd(0.75, 1.0), s: 1.5, alive: true, delay: 0.05 });
  }

  function update(dt, time) {
    const t = (time + offset) % period;
    const cycle = Math.floor((time + offset) / period);
    // 1) la gota se hincha colgando del techo durante el ciclo y se suelta al empezar el siguiente
    const grow = THREE.MathUtils.smoothstep(t, period * 0.15, period * 0.95);
    hang.scale.set(0.45 + grow * 0.6, 0.45 + grow * 0.95, 0.45 + grow * 0.6);
    hang.position.y = top - 0.01 - grow * 0.012;
    // 2) caída
    if (t < fall) {
      drop.visible = streak.visible = true;
      const y = top - 0.03 - 0.5 * G * t * t;
      const v = G * t;
      drop.position.set(0, Math.max(landY, y), 0);
      drop.scale.set(0.9, 1.05 + Math.min(1.6, v * 0.22), 0.9);
      streak.position.set(0, drop.position.y, 0);
      streak.scale.set(1, Math.min(0.5, v * 0.022) + 0.001, 1);
      streakMat.opacity = Math.min(0.22, v * 0.03);
    } else {
      drop.visible = streak.visible = false;
      if (last !== cycle) {
        last = cycle;
        burst();
        onImpact?.(time);
      }
    }
    // 3) salpicadura balística
    let k = 0;
    for (const p of parts) {
      if (p.alive) {
        if (p.delay > 0) p.delay -= dt;
        else {
          p.vy -= G * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < landY) p.alive = false;
        }
      }
      const show = p.alive && p.delay <= 0;
      _m.compose(_v.set(p.x, show ? p.y : -10, p.z), _q.identity(), _s.setScalar(show ? p.s * (1 + Math.max(0, p.vy) * 0.3) : 0.0001));
      spray.setMatrixAt(k++, _m);
    }
    spray.instanceMatrix.needsUpdate = true;
  }

  return { group, update, materials: [water, streakMat] };
}
