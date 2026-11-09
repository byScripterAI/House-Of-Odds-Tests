/**
 * Catálogo de sonidos del juego. Solo datos.
 * Para cada nombre, si existe `assets/audio/<nombre>.mp3` el juego lo usa; si no,
 * suena la versión procedural integrada. `loop: true` → se reproduce en bucle.
 */
export const SOUNDS = Object.freeze([
  // interfaz
  { name: 'hover', desc: 'Pasar el ratón por un botón (tic muy corto y agudo, 0,05 s).' },
  { name: 'click', desc: 'Pulsar un botón (clic nítido, 0,1 s).' },
  { name: 'back', desc: 'Cerrar o volver atrás (tono descendente suave, 0,15 s).' },
  { name: 'confirm', desc: 'Confirmar o entrar (arpegio ascendente corto, 0,4 s).' },
  { name: 'error', desc: 'Acción no permitida (zumbido grave breve, 0,25 s).' },
  { name: 'toast', desc: 'Aparece un aviso (campanita doble, 0,4 s).' },
  { name: 'tutorial', desc: 'Paso de tutorial completado (ding alegre ascendente, 0,6 s).' },
  { name: 'marksTick', desc: 'Cada salto del contador de MARKS al subir (clic de moneda, 0,05 s).' },
  // mundo
  { name: 'door', desc: 'Puerta cerrada: golpe sordo doble (0,4 s).' },
  { name: 'step', desc: 'Pisada sobre mármol (muy suave, 0,12 s).' },
  { name: 'machineEnter', desc: 'Acercarse a la máquina y usarla (whoosh + zumbido eléctrico, 0,6 s).' },
  { name: 'machineExit', desc: 'Salir de la máquina (whoosh inverso, 0,4 s).' },
  { name: 'shopOpen', desc: 'Abrir la tienda (caja registradora + campanilla, 0,7 s).' },
  // máquina
  { name: 'spinStart', desc: 'Inicio del giro: palanca + rodillos acelerando (0,7 s).' },
  { name: 'tick', desc: 'Chasquido de cada símbolo que pasa por el rodillo (0,03 s).' },
  { name: 'reelStop', desc: 'Un rodillo se detiene (golpe seco mecánico, 0,2 s). Se reproduce 3 veces por giro con tono creciente.' },
  { name: 'winSmall', desc: 'Premio normal (arpegio brillante, 0,6 s).' },
  { name: 'winBig', desc: 'Premio grande (fanfarria corta con brillos, 1,2 s).' },
  { name: 'jackpot', desc: 'PREMIO GORDO (fanfarria larga, 3-4 s, con campanas y celebración).' },
  { name: 'coin', desc: 'Una moneda (ding metálico, 0,15 s).' },
  { name: 'coins', desc: 'Lluvia de monedas cayendo (1,5-2,5 s).' },
  { name: 'applause', desc: 'Aplausos y vítores del público (2-4 s).' },
  { name: 'confetti', desc: 'Pop de confeti (explosión alegre, 0,5 s).' },
  { name: 'sparkle', desc: 'Brillo mágico (glissando agudo, 0,5 s).' },
  // progreso y compras
  { name: 'buy', desc: 'Comprar una mejora del casino (cha-ching, 0,6 s).' },
  { name: 'buyMachine', desc: 'Comprar una mejora de máquina (cha-ching + chispazo eléctrico, 0,8 s).' },
  { name: 'unlock', desc: 'Desbloquear algo grande, p. ej. una sala (fanfarria ascendente, 1,5 s).' },
  { name: 'objective', desc: 'Objetivo cumplido (campanas ascendentes, 1 s).' },
  { name: 'achievement', desc: 'Logro desbloqueado (fanfarria corta, 1,2 s).' },
  { name: 'prestige', desc: 'Subida de PRESTIGE (nota aguda brillante, 0,5 s).' },
  // música y ambiente (en bucle)
  { name: 'music', desc: 'Música de fondo del casino. En bucle, 1-3 min, sin silencios al final.', loop: true },
  { name: 'ambience', desc: 'Ambiente del casino (murmullo lejano, máquinas). En bucle.', loop: true },
]);

export const SOUND_NAMES = SOUNDS.map((s) => s.name);
export const AUDIO_DIR = 'assets/audio/';
