import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Cargador glTF compartido. Los modelos del juego van comprimidos (EXT_meshopt_compression para geometría
 * y animaciones, texturas WebP): pesan ~3 veces menos y cargan antes.
 */
let loader = null;
export function gltfLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    // descompresión de la geometría en hilos aparte: la pantalla de carga no se congela mientras llegan modelos
    try {
      const n = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 4) - 1));
      MeshoptDecoder.useWorkers?.(n);
    } catch {
      /* sin workers: se descomprime en el hilo principal */
    }
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}
