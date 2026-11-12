import { DIALOGUES, allLines } from '../src/story/dialogues.js';
import { QUESTS } from '../src/story/quests.js';
import { DICTIONARIES } from '../src/i18n/index.js';

const es = DICTIONARIES.es;
const en = DICTIONARIES.en;
const clean = (s) => String(s).replaceAll('{MARKS}', 'MARKS').replaceAll('{PRESTIGE}', 'PRESTIGE').replaceAll('|', '/');

/** Markdown con todas las líneas de voz, agrupadas por conversación. */
export function renderDialogueAudio() {
  const lines = allLines();
  const spoken = lines.filter((l) => !l.choice && l.speaker !== 'player');
  const out = [
    '# Voces de los diálogos — HOUSE OF ODDS',
    '',
    '> Documento generado con `npm run dialogues` (no lo edites a mano: se regenera a partir de los datos del juego).',
    '',
    '## Cómo poner las voces',
    '',
    '1. Graba (o genera con IA) cada línea y guárdala como **`.mp3`** con el nombre exacto de la columna «Archivo».',
    '2. Déjalas en `assets/audio/voice/`. Si quieres una voz distinta por idioma, usa subcarpetas:',
    '   `assets/audio/voice/es/…`, `assets/audio/voice/en/…`, `de`, `fr`, `pt`, `zh`. El juego usa primero la del idioma',
    '   activo y, si no existe, la general de `assets/audio/voice/`.',
    '3. Ejecuta `npm run audio` (o arranca el servidor local) para actualizar el manifiesto. En Vercel se hace solo al desplegar.',
    '4. Nombres en **minúsculas** (Vercel distingue mayúsculas). Una línea sin archivo simplemente se lee sin voz.',
    '',
    'Al avanzar o saltar una línea, la voz que estaba sonando se corta y empieza la siguiente.',
    'Las respuestas del jugador no llevan voz.',
    '',
    `**Total: ${spoken.length} líneas con voz** en ${Object.keys(DIALOGUES).length} conversaciones.`,
    '',
  ];
  const byDialogue = new Map();
  for (const l of spoken) byDialogue.set(l.dialogue, [...(byDialogue.get(l.dialogue) ?? []), l]);
  for (const [id, list] of byDialogue) {
    const d = DIALOGUES[id];
    const quest = d.quest ? ` · misión «${es[`quest.${d.quest}.title`] ?? d.quest}»${QUESTS[d.quest]?.type === 'main' ? '' : ''}` : ' · charla repetible';
    out.push(`## \`${id}\`${quest}`, '');
    out.push('| Archivo | Personaje | Texto (ES) | Text (EN) |', '|---|---|---|---|');
    for (const l of list) out.push(`| \`${l.voice}.mp3\` | ${es[`npc.${l.speaker}.name`]} | ${clean(es[l.key])} | ${clean(en[l.key])} |`);
    out.push('');
  }
  return out.join('\n');
}
