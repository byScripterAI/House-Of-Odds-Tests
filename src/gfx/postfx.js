import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

/**
 * GTAO que no cuenta lo transparente: los iconos sobre los PNJ (sprites), cristales, decals, charcos y
 * balizas se dibujaban en el búfer de normales como cuadrados opacos y la oclusión ambiental ponía un
 * «cuadrado negro» detrás. Solo las mallas opacas proyectan oclusión.
 */
class OpaqueGTAOPass extends GTAOPass {
  _overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const m = o.material;
      const see = (x) => x && (x.transparent || x.depthWrite === false);
      const clear = Array.isArray(m) ? m.some(see) : see(m);
      if (o.isPoints || o.isLine || o.isLine2 || o.isSprite || (o.isMesh && clear)) {
        o.visible = false;
        cache.push(o);
      }
    });
  }
}

/**
 * Cadena de post-proceso. Solo se crea cuando algún efecto está activo
 * (niveles ALTA y ULTRA); en el resto de niveles el renderizador dibuja
 * directo a pantalla, sin coste extra.
 *
 *   RenderPass → [GTAO] → [Bloom] → OutputPass (tone mapping + sRGB) → [SMAA]
 *
 * El bloom se limita a lo que brilla de verdad (umbral alto): neones, luces
 * de la máquina, oro pulido. Así el juego «brilla» sin lavar la imagen.
 */
export class PostFX {
  #webgl;
  #composer = null;
  #signature = '';
  #renderPass = null;
  #ao = null;
  #bloom = null;
  #smaa = null;
  #size = { width: 1, height: 1, pixelRatio: 1 };

  constructor(webgl) {
    this.#webgl = webgl;
  }

  /** ¿Hay alguna pasada activa? */
  get active() {
    return this.#composer !== null;
  }

  get passes() {
    return { ao: !!this.#ao, bloom: !!this.#bloom, smaa: !!this.#smaa };
  }

  /**
   * (Re)configura la cadena según los ajustes efectivos.
   * @param {{bloom:boolean, ao:boolean, smaa:boolean}} post
   * @param {{antialias?: boolean}} [opts]
   */
  configure(post, { antialias = false } = {}) {
    const wanted = { bloom: !!post.bloom, ao: !!post.ao, smaa: !!post.smaa };
    const signature = `${wanted.bloom}|${wanted.ao}|${wanted.smaa}|${antialias}`;
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#teardown();
    if (!wanted.bloom && !wanted.ao && !wanted.smaa) return;

    const { width, height, pixelRatio } = this.#size;
    const target = new THREE.WebGLRenderTarget(Math.max(1, Math.round(width * pixelRatio)), Math.max(1, Math.round(height * pixelRatio)), {
      type: THREE.HalfFloatType,
      // MSAA en el buffer intermedio solo si no hay SMAA que lo sustituya.
      samples: antialias && !wanted.smaa ? 4 : 0,
    });
    target.texture.name = 'PostFX.rt';
    const composer = new EffectComposer(this.#webgl, target);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);

    const placeholderScene = new THREE.Scene();
    const placeholderCamera = new THREE.PerspectiveCamera();
    this.#renderPass = new RenderPass(placeholderScene, placeholderCamera);
    composer.addPass(this.#renderPass);

    if (wanted.ao) {
      this.#ao = new OpaqueGTAOPass(placeholderScene, placeholderCamera, width, height);
      this.#ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.#ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.#ao.blendIntensity = 0.85;
      composer.addPass(this.#ao);
    }
    if (wanted.bloom) {
      // umbral alto (HDR): solo brillan bombillas, neones y destellos; las paredes y el techo iluminados no
      this.#bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.35, 1.6);
      composer.addPass(this.#bloom);
    }
    composer.addPass(new OutputPass());
    if (wanted.smaa) {
      this.#smaa = new SMAAPass();
      composer.addPass(this.#smaa);
    }
    this.#composer = composer;
  }

  /** Intensidad del bloom (la sube la FX en jackpots). */
  set bloomStrength(v) {
    if (this.#bloom) this.#bloom.strength = v;
  }

  get bloomStrength() {
    return this.#bloom?.strength ?? 0;
  }

  setSize(width, height, pixelRatio) {
    this.#size = { width, height, pixelRatio };
    if (!this.#composer) return;
    this.#composer.setPixelRatio(pixelRatio);
    this.#composer.setSize(width, height);
  }

  render(scene, camera, dt = 0.016) {
    const composer = this.#composer;
    if (!composer) return false;
    this.#renderPass.scene = scene;
    this.#renderPass.camera = camera;
    if (this.#ao) {
      this.#ao.scene = scene;
      this.#ao.camera = camera;
    }
    composer.render(dt);
    return true;
  }

  #teardown() {
    if (this.#composer) {
      this.#composer.renderTarget1.dispose();
      this.#composer.renderTarget2.dispose();
      for (const pass of this.#composer.passes) pass.dispose?.();
      this.#composer.dispose?.();
    }
    this.#composer = null;
    this.#renderPass = this.#ao = this.#bloom = this.#smaa = null;
  }

  dispose() {
    this.#teardown();
    this.#signature = '';
  }
}
