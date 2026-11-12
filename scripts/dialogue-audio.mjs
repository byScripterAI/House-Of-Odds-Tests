/**
 * Genera docs/DIALOGUE_AUDIO.md: TODAS las líneas habladas, con personaje,
 * texto (español e inglés) y el nombre exacto del .mp3 de voz.
 *   npm run dialogues
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderDialogueAudio } from './dialogue-audio-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const md = renderDialogueAudio();
await writeFile(resolve(root, 'docs/DIALOGUE_AUDIO.md'), md);
console.log(`docs/DIALOGUE_AUDIO.md actualizado (${md.split('\n').filter((l) => l.startsWith('| `')).length} líneas con voz).`);
