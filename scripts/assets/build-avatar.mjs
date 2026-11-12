// Convierte un avatar Rocketbox (FBX + TGA) en un GLB optimizado para el juego.
// uso: node build-avatar.mjs <rawDir> <name> <outGlb> [texSize]
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createRequire } from 'node:module';

const [rawDir, name, outGlb, texArg] = process.argv.slice(2);
const SIZE = Number(texArg || 1024);
const here = path.dirname(new URL(import.meta.url).pathname);
const FBX2 = path.join(here, 'node_modules/fbx2gltf/bin/Linux/FBX2glTF');
const tmp = path.join(here, `.tmp-${name}`);
execFileSync(FBX2, ['--binary', '--input', path.join(rawDir, `${name}.fbx`), '--output', tmp], { stdio: 'pipe' });

// TGA → raw RGBA (sharp no lee TGA: decodificador mínimo para TGA sin compresión / RLE)
function readTga(file) {
  const b = fs.readFileSync(file);
  const idLen = b[0];
  const type = b[2];
  const w = b.readUInt16LE(12);
  const h = b.readUInt16LE(14);
  const bpp = b[16] / 8;
  const desc = b[17];
  const topDown = (desc & 0x20) !== 0;
  let p = 18 + idLen;
  const out = Buffer.alloc(w * h * 4);
  const px = (i, src) => {
    out[i * 4] = src[2];
    out[i * 4 + 1] = src[1];
    out[i * 4 + 2] = src[0];
    out[i * 4 + 3] = bpp === 4 ? src[3] : 255;
  };
  if (type === 2 || type === 3) {
    for (let i = 0; i < w * h; i++, p += bpp) px(i, type === 3 ? [b[p], b[p], b[p], 255] : b.subarray(p, p + bpp));
  } else if (type === 10) {
    let i = 0;
    while (i < w * h) {
      const c = b[p++];
      const n = (c & 0x7f) + 1;
      if (c & 0x80) {
        const src = b.subarray(p, p + bpp);
        p += bpp;
        for (let k = 0; k < n; k++) px(i++, src);
      } else for (let k = 0; k < n; k++, p += bpp) px(i++, b.subarray(p, p + bpp));
    }
  } else throw new Error(`TGA tipo ${type} no soportado: ${file}`);
  if (!topDown) {
    const row = w * 4;
    const tmpRow = Buffer.alloc(row);
    for (let y = 0; y < h / 2; y++) {
      const a = y * row;
      const z = (h - 1 - y) * row;
      out.copy(tmpRow, 0, a, a + row);
      out.copy(out, a, z, z + row);
      tmpRow.copy(out, z);
    }
  }
  return { data: out, w, h, bpp };
}

const img = (t) => sharp(t.data, { raw: { width: t.w, height: t.h, channels: 4 } });
const findTex = (suffix) => fs.readdirSync(rawDir).find((f) => f.toLowerCase().endsWith(suffix));

async function jpg(file, size, q = 86) {
  return img(readTga(path.join(rawDir, file))).removeAlpha().resize(size, size, { kernel: 'lanczos3' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
}
/** especular (3ds Max) → mapa metallic/roughness de glTF (G = rugosidad, B = metal 0). */
async function roughFromSpec(file, size) {
  const t = readTga(path.join(rawDir, file));
  for (let i = 0; i < t.w * t.h; i++) {
    const s = (t.data[i * 4] * 0.3 + t.data[i * 4 + 1] * 0.59 + t.data[i * 4 + 2] * 0.11) / 255;
    const r = Math.max(0.28, Math.min(0.92, 0.9 - s * 0.75));
    t.data[i * 4] = 255;
    t.data[i * 4 + 1] = Math.round(r * 255);
    t.data[i * 4 + 2] = 0;
  }
  return img(t).removeAlpha().resize(size / 2, size / 2).jpeg({ quality: 82 }).toBuffer();
}

const io = new NodeIO();
const doc = await io.read(`${tmp}.glb`);
const root = doc.getRoot();
for (const t of root.listTextures()) t.dispose();
const tex = (name, buf, mime) => doc.createTexture(name).setImage(buf).setMimeType(mime);

// accesorios: los que comparten material se separan por altura (casco arriba, herramientas a la cintura)
const DROP = new Set((process.env.DROP || '').split(',').filter(Boolean));
const hasTex = (part) => !!findTex(`_${part}_color.tga`) || !!findTex(`_${part}_opacity_color.tga`);
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const mn = mat.getName().toLowerCase();
    if (!/_helmet$/.test(mn) || !hasTex('tools')) continue;
    const pos = prim.getAttribute('POSITION');
    let minZ = Infinity;
    const v = [];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); minZ = Math.min(minZ, v[2]); }
    if (minZ < 1.3) {
      const tools = root.listMaterials().find((x) => x.getName().toLowerCase().endsWith('_tools')) ?? mat.clone().setName(mat.getName().replace(/_helmet$/i, '_tools'));
      prim.setMaterial(tools);
    }
  }
}
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const part = prim.getMaterial().getName().toLowerCase().replace(/^[mf]\d+_/, '');
    if (DROP.has(part)) { mesh.removePrimitive(prim); prim.dispose(); }
  }
}
for (const m of root.listMaterials()) {
  const n = m.getName().toLowerCase();
  m.setMetallicFactor(0).setRoughnessFactor(1).setBaseColorFactor([1, 1, 1, 1]).setEmissiveFactor([0, 0, 0]);
  m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null);
  const part = n.endsWith('_body') ? 'body' : n.endsWith('_head') ? 'head' : n.endsWith('_opacity') ? 'opacity' : null;
  if (part === 'body' || part === 'head') {
    const c = findTex(`_${part}_color.tga`);
    const nm = findTex(`_${part}_normal.tga`);
    const sp = findTex(`_${part}_specular.tga`);
    if (c) m.setBaseColorTexture(tex(`${name}_${part}_c`, await jpg(c, SIZE), 'image/jpeg'));
    if (nm) m.setNormalTexture(tex(`${name}_${part}_n`, await jpg(nm, SIZE, 90), 'image/jpeg'));
    if (sp) m.setMetallicRoughnessTexture(tex(`${name}_${part}_r`, await roughFromSpec(sp, SIZE), 'image/jpeg'));
  } else if (part === 'opacity') {
    // ojo: «_glasses_opacity_color.tga» también acaba en «_opacity_color.tga»: el pelo es el que no lleva más partes
    const c = fs.readdirSync(rawDir).find((f) => /^[mf]\d+_opacity_color\.tga$/i.test(f)) ?? findTex('_opacity_color.tga');
    if (c) {
      // el color bajo las zonas transparentes es basura (azul): se rellena con el color vecino
      const t = readTga(path.join(rawDir, c));
      const half = { width: SIZE / 2, height: SIZE / 2 };
      const small = await img(t).resize(half.width, half.height).raw().toBuffer();
      const n = half.width * half.height;
      const pre = Buffer.alloc(n * 4);
      for (let i = 0; i < n; i++) {
        const a = small[i * 4 + 3] / 255;
        pre[i * 4] = small[i * 4] * a;
        pre[i * 4 + 1] = small[i * 4 + 1] * a;
        pre[i * 4 + 2] = small[i * 4 + 2] * a;
        pre[i * 4 + 3] = small[i * 4 + 3];
      }
      let fill = pre;
      for (const sigma of [2, 6, 16]) {
        const bl = await sharp(pre, { raw: { ...half, channels: 4 } }).blur(sigma).raw().toBuffer();
        const out2 = Buffer.from(fill);
        for (let i = 0; i < n; i++) {
          if (fill === pre ? small[i * 4 + 3] > 240 : out2[i * 4 + 3] === 255) continue;
          const a = bl[i * 4 + 3] / 255;
          if (a < 0.02) continue;
          out2[i * 4] = Math.min(255, bl[i * 4] / a);
          out2[i * 4 + 1] = Math.min(255, bl[i * 4 + 1] / a);
          out2[i * 4 + 2] = Math.min(255, bl[i * 4 + 2] / a);
          out2[i * 4 + 3] = 255;
        }
        fill = out2;
      }
      for (let i = 0; i < n; i++) {
        if (small[i * 4 + 3] > 240) for (let k = 0; k < 3; k++) fill[i * 4 + k] = small[i * 4 + k];
        fill[i * 4 + 3] = small[i * 4 + 3];
      }
      const buf = await sharp(fill, { raw: { ...half, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
      m.setBaseColorTexture(tex(`${name}_opacity`, buf, 'image/png'));
    }
    m.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    m.setRoughnessFactor(0.75);
  } else {
    // accesorios con textura propia: equipo, herramientas, casco, gafas…
    const acc = n.replace(/^[mf]\d+_/, '');
    const c = findTex(`_${acc}_color.tga`);
    const co = findTex(`_${acc}_opacity_color.tga`);
    const nm = findTex(`_${acc}_normal.tga`);
    const sp = findTex(`_${acc}_specular.tga`);
    const sz = Math.min(SIZE, 1024);
    if (c) m.setBaseColorTexture(tex(`${name}_${acc}_c`, await jpg(c, sz), 'image/jpeg'));
    if (co) {
      // gafas: montura opaca y cristales translúcidos (el alfa de la textura)
      const t = readTga(path.join(rawDir, co));
      const buf = await img(t).resize(sz / 2, sz / 2).png({ compressionLevel: 9 }).toBuffer();
      m.setBaseColorTexture(tex(`${name}_${acc}_c`, buf, 'image/png'));
      m.setAlphaMode('BLEND').setDoubleSided(true);
    }
    if (nm) m.setNormalTexture(tex(`${name}_${acc}_n`, await jpg(nm, sz, 90), 'image/jpeg'));
    if (sp) m.setMetallicRoughnessTexture(tex(`${name}_${acc}_r`, await roughFromSpec(sp, sz), 'image/jpeg'));
    if (!c && !co) console.warn('sin textura para', n);
  }
}
for (const a of root.listAnimations()) a.dispose();
await doc.transform(prune(), dedup());
await io.write(outGlb, doc);
fs.rmSync(`${tmp}.glb`, { force: true });
console.log(outGlb, (fs.statSync(outGlb).size / 1024).toFixed(0), 'KB');
