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
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}
