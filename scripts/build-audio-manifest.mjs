#!/usr/bin/env node
/**
 * `npm run audio`: crea assets/audio/manifest.json (lista de .mp3 presentes) y regenera SOUNDS.md.
 * Imprescindible en alojamientos estáticos como Vercel (no hay servidor que liste la carpeta).
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAudio, buildManifest, renderSoundsMarkdown, scanAudio } from './audio-manifest.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const found = await scanAudio(ROOT);
const manifest = buildManifest(found);
await writeFile(resolve(ROOT, 'assets/audio/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(ROOT, 'assets/audio/SOUNDS.md'), renderSoundsMarkdown());
console.log(`[audio] manifest.json: ${found.files.length} sonidos, ${found.voice.length} voces.`);
for (const w of auditAudio(found)) console.warn(`[audio] AVISO: ${w}`);
