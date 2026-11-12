// node opt-prop.mjs in.glb out.glb [texSize] [simplifyRatio]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRLightsPunctual } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
const [inp, out, size = '1024', ratio = '1'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_lights_punctual' || e.extensionName === 'KHR_materials_variants') e.dispose();
const steps = [dedup(), weld()];
if (Number(ratio) < 1) { await MeshoptSimplifier.ready; steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratio), error: 0.002 })); }
steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(size), Number(size)], quality: 82 }), prune());
await doc.transform(...steps);
await io.write(out, doc);
console.log(out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
