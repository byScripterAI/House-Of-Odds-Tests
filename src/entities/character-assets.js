import * as THREE from 'three';
import { gltfLoader } from '../gfx/gltf.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTER_MODELS } from './character-list.js';

/**
 * PERSONAJES REALES: avatares Microsoft Rocketbox (licencia MIT, con esqueleto Biped completo,
 * texturas de piel/ropa con mapas normales) y 22 animaciones de captura de movimiento por género
 * (reposo, andar, sentarse, hablar, escuchar, saludar, aplaudir, trabajar en una mesa…).
 * Los archivos están en assets/characters/ (convertidos y optimizados por scripts/characters/).
 *
 * Se cargan una vez durante la pantalla de carga; después cada PNJ es un clon ligero que comparte
 * geometría, materiales y texturas.
 */

export { CHARACTER_MODELS };

const BASE = new URL('../../assets/characters/', import.meta.url).href;
const isFemale = (name) => /Female/.test(name);

const lib = {
  ready: false,
  models: new Map(), // nombre → gltf.scene (plantilla)
  clips: { m: new Map(), f: new Map() },
};

/** Corrige el pelo y las pestañas: tarjetas de doble cara con la normal siempre hacia la cámara. */
function prepareMaterials(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    // la caja de la pose de reposo no sigue a la animación: el recorte por cámara lo hace NpcSystem por personaje
    o.frustumCulled = false;
    const mats = [].concat(o.material);
    for (const m of mats) {
      m.envMapIntensity = 0.55;
      if (/opacity$/i.test(m.name)) {
        m.alphaTest = 0.5;
        m.side = THREE.DoubleSide;
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            '#include <normal_fragment_begin>\n\tif (dot(normal, normalize(vViewPosition)) < 0.0) normal = -normal;',
          );
        };
        m.customProgramCacheKey = () => 'rbx-hair';
        o.userData.hair = true;
      } else if (/glasses$/i.test(m.name)) {
        // gafas: montura y cristales translúcidos que reflejan un poco
        m.roughness = 0.25;
        m.transparent = true;
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
        o.renderOrder = 3;
      } else {
        m.roughness = 1;
      }
      m.needsUpdate = true;
    }
  });
}

async function loadFile(f, onDone) {
  try {
    const gltf = await gltfLoader().loadAsync(f.url);
    if (f.kind === 'anims') {
      for (const c of gltf.animations) {
        // pista auxiliar del exportador sin hueso en los modelos (avisaba en consola al reproducirse)
        c.tracks = c.tracks.filter((tr) => !tr.name.startsWith('MotionExtractionHelper'));
        lib.clips[f.g].set(c.name, c);
      }
    }
    else {
      prepareMaterials(gltf.scene);
      lib.models.set(f.name, gltf.scene);
    }
  } catch (e) {
    console.warn('[characters] no se pudo cargar', f.url, e);
  }
  onDone?.();
}

/**
 * Carga las animaciones y los personajes imprescindibles para empezar (con nombre y personal). `onProgress(0..1)`.
 * Los clientes (solo aparecen tras la reapertura) se cargan después en segundo plano: ver loadCustomers().
 */
export async function loadCharacters(onProgress = () => {}) {
  if (lib.ready) return lib;
  const files = [
    ...['m', 'f'].map((g) => ({ kind: 'anims', g, url: `${BASE}anims_${g}.glb` })),
    ...[...CHARACTER_MODELS.named, ...CHARACTER_MODELS.staff].map((name) => ({ kind: 'model', name, url: `${BASE}${name}.glb` })),
  ];
  let done = 0;
  await Promise.all(files.map((f) => loadFile(f, () => onProgress(++done / files.length))));
  lib.ready = lib.models.size > 0 && lib.clips.m.size > 0;
  return lib;
}

/** Clientes en segundo plano, de dos en dos, sin estorbar a la partida. */
export async function loadCustomers() {
  if (lib.customersLoading) return lib.customersLoading;
  const queue = CHARACTER_MODELS.customers.filter((n) => !lib.models.has(n)).map((name) => ({ kind: 'model', name, url: `${BASE}${name}.glb` }));
  const worker = async () => {
    while (queue.length) await loadFile(queue.shift());
  };
  lib.customersLoading = Promise.all([worker(), worker()]).then(() => {
    lib.customersDone = true;
  });
  return lib.customersLoading;
}

/** Plantillas cargadas (para compilar sus shaders durante la carga, antes de que aparezcan). */
export const characterTemplates = () => [...lib.models.values()];

/** ¿Han terminado de cargar los clientes? (sin personajes reales no hay nada que esperar) */
export const customersReady = () => !lib.ready || !!lib.customersDone;

/** ¿Está cargado este personaje? */
export const hasCharacter = (name) => lib.models.has(name);

export const charactersReady = () => lib.ready;

/** Animaciones disponibles para un modelo (por género). */
export function clipsFor(name) {
  return lib.clips[isFemale(name) ? 'f' : 'm'];
}

/**
 * Instancia un personaje: {group, model, bones, head, jaw, female, eyeHeight, dispose}.
 * `shadows`: proyecta sombra (desactivado en calidades bajas).
 */
export function instantiateCharacter(name, { shadows = true } = {}) {
  let tpl = lib.models.get(name);
  if (!tpl) {
    const female = isFemale(name);
    const alt = CHARACTER_MODELS.customers.find((n) => lib.models.has(n) && isFemale(n) === female);
    tpl = alt ? lib.models.get(alt) : null;
    if (alt) name = alt;
  }
  if (!tpl) return null;
  const model = cloneSkinned(tpl);
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name.replace(/^Bip01_?/, '').replace(/_/g, ' ').trim()] = o;
    if (o.isMesh) {
      const clear = [].concat(o.material).some((m) => m.transparent);
      o.castShadow = shadows && !o.userData.hair && !clear;
      o.receiveShadow = !o.userData.hair && !clear;
    }
  });
  const group = new THREE.Group();
  group.add(model);
  return {
    name,
    group,
    model,
    bones,
    head: bones.Head ?? model,
    neck: bones.Neck ?? null,
    jaw: bones.MJaw ?? null,
    pelvis: bones.Pelvis ?? null,
    female: isFemale(name),
    eyeHeight: isFemale(name) ? 1.58 : 1.68,
    dispose() {
      group.removeFromParent();
      // geometría, materiales y texturas son compartidos con la plantilla: no se liberan aquí
    },
  };
}
