// Une animaciones Rocketbox (FBX) en un único GLB de clips para el juego.
// uso: node build-anims.mjs <rawAnimDir> <out.glb> <name=file[:inplace]> ...
import { Document, NodeIO } from '@gltf-transform/core';
import { resample, prune } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [rawDir, outGlb, ...specs] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const FBX2 = path.join(here, 'node_modules/fbx2gltf/bin/Linux/FBX2glTF');
const io = new NodeIO();
const out = new Document();
const buffer = out.createBuffer();
const outScene = out.createScene('rig');
const nodes = new Map(); // nombre → nodo del documento de salida
const FACE = /^Bip01 (M|R|L)(?!\s)(?!Thigh|Calf|Foot|Toe|Clavicle|UpperArm|Forearm|Hand|Finger)/; // huesos faciales (MJaw, RCheek…)

function cloneHierarchy(srcNode, parent) {
  const name = srcNode.getName();
  let n = nodes.get(name);
  if (!n) {
    n = out.createNode(name).setTranslation(srcNode.getTranslation()).setRotation(srcNode.getRotation()).setScale(srcNode.getScale());
    nodes.set(name, n);
    if (parent) parent.addChild(n);
    else outScene.addChild(n);
  }
  for (const c of srcNode.listChildren()) cloneHierarchy(c, n);
}

let total = 0;
for (const spec of specs) {
  const [clip, rest] = spec.split('=');
  const [file, flag] = rest.split(':');
  const tmp = path.join(here, `.anim-${clip}`);
  execFileSync(FBX2, ['--binary', '--input', path.join(rawDir, `${file}.fbx`), '--output', tmp], { stdio: 'pipe' });
  const doc = await io.read(`${tmp}.glb`);
  const root = doc.getRoot();
  const pelvisRoot = root.listNodes().find((n) => n.getName() === 'Bip01');
  const top = root.listScenes()[0].listChildren();
  for (const t of top) cloneHierarchy(t, null);
  const src = root.listAnimations()[0];
  if (!src) throw new Error(`sin animación: ${file}`);
  const anim = out.createAnimation(clip);
  for (const ch of src.listChannels()) {
    const target = ch.getTargetNode();
    const name = target.getName();
    const p = ch.getTargetPath();
    if (FACE.test(name) || /Footsteps/.test(name)) continue;
    // solo rotaciones (más la traslación de la pelvis / raíz para la altura al sentarse)
    if (p === 'scale') continue;
    if (p === 'translation' && name !== 'Bip01 Pelvis' && name !== 'Bip01') continue;
    const s = ch.getSampler();
    const input = s.getInput().getArray().slice();
    let output = s.getOutput().getArray().slice();
    if (p === 'translation' && flag === 'inplace') {
      // sin desplazamiento horizontal: el juego mueve al personaje
      const first = [output[0], output[2]];
      for (let i = 0; i < output.length; i += 3) {
        output[i] = first[0];
        output[i + 2] = first[1];
      }
    }
    const acc = (arr, type) => out.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
    const sampler = out.createAnimationSampler().setInput(acc(input, 'SCALAR')).setOutput(acc(output, p === 'rotation' ? 'VEC4' : 'VEC3')).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(nodes.get(name)).setTargetPath(p).setSampler(sampler));
  }
  void pelvisRoot;
  fs.rmSync(`${tmp}.glb`, { force: true });
  total++;
}
await out.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }));
await io.write(outGlb, out);
console.log(outGlb, total, 'clips', (fs.statSync(outGlb).size / 1024).toFixed(0), 'KB');
