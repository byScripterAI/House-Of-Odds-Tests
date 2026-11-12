/**
 * Utilidades (Node) para el sistema de audio personalizable:
 *  - `scanAudio(root)` lista los .mp3 de assets/audio y assets/audio/voice.
 *  - `buildManifest(...)` genera assets/audio/manifest.json (lo que lee el juego).
 *  - `renderSoundsMarkdown()` genera assets/audio/SOUNDS.md a partir del catálogo.
 * Las usan `npm run audio` y el servidor local (que sirve el manifiesto al vuelo).
 */
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SOUNDS, SOUND_ALIASES, SOUND_NAMES } from '../src/audio/sound-list.js';

const isMp3 = (n) => n.toLowerCase().endsWith('.mp3');
export const VOICE_LANGS = Object.freeze(['en', 'es', 'de', 'fr', 'pt', 'zh']);

/** Devuelve { files, voice } con los nombres de fichero .mp3 presentes (ordenados). */
export async function scanAudio(root) {
  const list = async (dir) => {
    try {
      return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile() && isMp3(e.name)).map((e) => e.name).sort();
    } catch {
      return [];
    }
  };
  const voice = await list(resolve(root, 'assets/audio/voice'));
  // voces por idioma (opcional): assets/audio/voice/<idioma>/<id>.mp3 → «<idioma>/<id>.mp3»
  for (const lang of VOICE_LANGS) for (const f of await list(resolve(root, 'assets/audio/voice', lang))) voice.push(`${lang}/${f}`);
  return { files: await list(resolve(root, 'assets/audio')), voice };
}

/** ¿A qué sonido del catálogo corresponde este fichero? (null si a ninguno) */
export function soundForFile(file) {
  const m = /^(.+?)(?:_(\d+))?\.mp3$/i.exec(file);
  if (!m) return null;
  const lower = m[1].toLowerCase();
  const direct = SOUND_NAMES.find((n) => n.toLowerCase() === lower);
  if (direct) return direct;
  const alias = Object.entries(SOUND_ALIASES).find(([legacy]) => legacy.toLowerCase() === lower);
  return alias ? alias[1] : null;
}

export function buildManifest({ files, voice }, now = new Date()) {
  return { generated: now.toISOString(), files, voice };
}

/** Avisos para el usuario: ficheros que el juego no reconoce o con mayúsculas. */
export function auditAudio({ files }) {
  const warnings = [];
  for (const f of files) {
    if (!soundForFile(f)) warnings.push(`«${f}» no coincide con ningún sonido del catálogo (revisa el nombre en SOUNDS.md): se ignorará.`);
    else if (f !== f.toLowerCase()) warnings.push(`«${f}» tiene mayúsculas: funciona, pero en servidores Linux (Vercel) las mayúsculas importan; es mejor usar minúsculas.`);
  }
  return warnings;
}

export function renderSoundsMarkdown() {
  const groups = new Map();
  for (const s of SOUNDS) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  const lines = [
    '# Sonidos personalizables de HOUSE OF ODDS',
    '',
    'Todos los sonidos del juego tienen una versión integrada (procedural). Para sustituir cualquiera por el tuyo,',
    'deja un `.mp3` en esta carpeta (`assets/audio/`) con **exactamente** el nombre de la tabla. No hace falta tocar código.',
    '',
    '## Cómo funciona',
    '',
    '- **Si existe el fichero, se usa; si no, suena el sonido integrado.** Puedes sustituir solo los que quieras.',
    '- **Variantes al azar:** `step_1.mp3`, `step_2.mp3`, `step_3.mp3`… (cualquier sonido admite variantes; se elige una cada vez).',
    '- **Bucles** (música, ambiente, rodillos…): el fichero se repite solo; que no tenga silencio al principio ni al final.',
    '- **Si falta un sonido con «recurre a»**, se usa ese otro (p. ej. `musicNeon` → `musicGame`).',
    '- **Nombres antiguos** (`music.mp3`, `door.mp3`) siguen valiendo: `music` = `musicGame`, `door` = `doorLocked`.',
    '- **Volumen:** normaliza tus mp3 a un nivel parecido; el juego ya mezcla los canales (general, música, efectos, voces).',
    '',
    '## Al probar en local',
    '',
    'Arranca con `node server.mjs` (o `npm start`): el servidor detecta tus mp3 al instante, solo recarga la página.',
    '',
    '## Al subirlo a Vercel (o cualquier alojamiento estático)',
    '',
    '1. Deja tus `.mp3` en `assets/audio/` y las voces en `assets/audio/voice/`.',
    '2. Ejecuta **`npm run audio`** una vez: crea `assets/audio/manifest.json` con la lista de ficheros y te avisa de nombres incorrectos.',
    '   (El proyecto ya incluye `vercel.json` con `buildCommand`, así que Vercel también lo regenera solo en cada despliegue.)',
    '3. Sube el proyecto entero, incluida la carpeta `assets/audio`.',
    '4. **Los nombres distinguen mayúsculas en Vercel** (Linux): `Click.mp3` no es `click.mp3`. Usa minúsculas tal cual aparecen aquí.',
    '',
    '## Voces de los diálogos',
    '',
    'Cada línea hablada por un NPC tiene un identificador (p. ej. `m01_intro__v1`). Su voz es `assets/audio/voice/<identificador>.mp3` (o `assets/audio/voice/<idioma>/<identificador>.mp3` para una voz por idioma). La lista completa está en `docs/DIALOGUE_AUDIO.md`.',
    'La lista completa (personaje, texto, nombre exacto del fichero) está en `docs/DIALOGUE_AUDIO.md`.',
    'Si no hay voz para una línea, el diálogo funciona igual con texto y un sonido de relleno (`npcBlip`).',
    'Si el jugador pasa a la siguiente frase, la voz que sonaba se corta y empieza la de la nueva.',
    '',
  ];
  for (const [group, list] of groups) {
    lines.push(`## ${group}`, '', '| Fichero | Qué es | Bucle | Si falta |', '|---|---|---|---|');
    for (const s of list) {
      const alias = Object.entries(SOUND_ALIASES).find(([, n]) => n === s.name)?.[0];
      const name = `\`${s.name}.mp3\`${alias ? ` (o \`${alias}.mp3\`)` : ''}`;
      lines.push(`| ${name} | ${s.desc.replace(/\|/g, '/')} | ${s.loop ? 'sí' : ''} | ${s.fallback ? `usa \`${s.fallback}\`` : 'suena el integrado'} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
