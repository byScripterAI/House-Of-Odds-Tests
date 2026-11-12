// Comprime un GLB para la web: geometría y animaciones con EXT_meshopt_compression y texturas a WebP.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const file of process.argv.slice(2)) {
  const before = fs.statSync(file).size;
  const doc = await io.read(file);
  const anims = doc.getRoot().listAnimations().length > 0 && doc.getRoot().listMeshes().length === 0;
  if (!anims) await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 84 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: anims ? 'high' : 'medium' }));
  await io.write(file, doc);
  console.log(file.split('/').pop(), (before / 1024).toFixed(0), '→', (fs.statSync(file).size / 1024).toFixed(0), 'KB');
}
