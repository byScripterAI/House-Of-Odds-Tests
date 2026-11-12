/**
 * Catálogo de sonidos del juego. Solo datos.
 *
 * Para cada nombre, si existe `assets/audio/<nombre>.mp3` el juego lo usa; si no,
 * suena la versión procedural integrada (o nada, en los sonidos opcionales).
 *  - Variantes: `<nombre>_1.mp3`, `<nombre>_2.mp3`… → se elige una al azar cada vez
 *    (ideal para pasos, cartas, fichas…).
 *  - `loop: true` → se reproduce en bucle (música, ambiente, rodillos girando…).
 *  - `fallback`: si no hay fichero con ese nombre se prueba con este otro (p. ej.
 *    `musicNeon` → `musicGame`).
 * Las VOCES de los diálogos son otra cosa: `assets/audio/voice/<id>.mp3` (ver docs/DIALOGUE_AUDIO.md).
 */

const S = (group, name, desc, extra = {}) => Object.freeze({ group, name, desc, ...extra });

export const SOUNDS = Object.freeze([
  // ---- interfaz ----
  S('Interfaz', 'hover', 'Pasar el ratón por un botón (tic muy corto y agudo, 0,05 s).'),
  S('Interfaz', 'click', 'Pulsar un botón (clic nítido, 0,1 s).'),
  S('Interfaz', 'back', 'Cerrar o volver atrás (tono descendente suave, 0,15 s).'),
  S('Interfaz', 'confirm', 'Confirmar o entrar (arpegio ascendente corto, 0,4 s).'),
  S('Interfaz', 'error', 'Acción no permitida (zumbido grave breve, 0,25 s).'),
  S('Interfaz', 'toast', 'Aparece un aviso (campanita doble, 0,4 s).'),
  S('Interfaz', 'tutorial', 'Paso de tutorial completado (ding alegre ascendente, 0,6 s).'),
  S('Interfaz', 'marksTick', 'Cada salto del contador de MARKS al subir (clic de moneda, 0,05 s).'),
  S('Interfaz', 'menuOpen', 'Se abre un panel o menú (whoosh suave, 0,3 s).'),
  S('Interfaz', 'menuClose', 'Se cierra un panel o menú (whoosh inverso, 0,25 s).'),
  S('Interfaz', 'tabSwitch', 'Cambiar de pestaña (tic grave y limpio, 0,08 s).'),
  S('Interfaz', 'sliderTick', 'Mover un control deslizante (tic mínimo, 0,03 s).'),
  S('Interfaz', 'toggle', 'Activar/desactivar un interruptor (clac, 0,1 s).'),
  S('Interfaz', 'languageChange', 'Cambiar de idioma (campanilla + whoosh, 0,5 s).'),
  S('Interfaz', 'pause', 'Entrar en pausa (descenso de tono, 0,3 s).'),
  S('Interfaz', 'resume', 'Salir de la pausa (ascenso de tono, 0,3 s).'),

  // ---- mundo ----
  S('Mundo', 'step', 'Pisada sobre mármol (muy suave, 0,12 s). Admite variantes step_1…step_6.'),
  S('Mundo', 'stepCarpet', 'Pisada sobre alfombra (más sorda, 0,12 s). Admite variantes.'),
  S('Mundo', 'doorOpen', 'Abrir una puerta (pomo + chirrido suave, 0,6 s).'),
  S('Mundo', 'doorClose', 'Cerrar una puerta (golpe sordo + pestillo, 0,5 s).'),
  S('Mundo', 'doorLocked', 'Puerta cerrada con llave: pomo que no cede (0,5 s).'),
  S('Mundo', 'machineEnter', 'Acercarse a una máquina y usarla (whoosh + zumbido eléctrico, 0,6 s).'),
  S('Mundo', 'machineExit', 'Salir de una máquina (whoosh inverso, 0,4 s).'),
  S('Mundo', 'shopOpen', 'Abrir un servicio de pago con un NPC (caja registradora + campanilla, 0,7 s).'),
  S('Mundo', 'farSlot', 'Máquina lejana funcionando (ding + rodillos amortiguados, 1-2 s). Suena de fondo, flojo, al azar.'),
  S('Mundo', 'farChips', 'Fichas lejanas en una mesa (1 s). Suena de fondo, flojo, al azar.'),
  S('Mundo', 'farRoulette', 'Ruleta lejana: bola y rueda amortiguadas (2-3 s). Suena de fondo, flojo, al azar.'),
  S('Mundo', 'farCheer', 'Pequeño vítor lejano de clientes (1-2 s). Suena de fondo, flojo, al azar.'),

  // ---- diálogos, misiones y NPCs ----
  S('Diálogos y misiones', 'dialogOpen', 'Se abre una conversación (campanilla suave + whoosh, 0,4 s).'),
  S('Diálogos y misiones', 'dialogClose', 'Se cierra una conversación (0,3 s).'),
  S('Diálogos y misiones', 'dialogText', 'Cada letra del texto del diálogo al aparecer (tic mínimo, 0,02 s). Admite variantes.'),
  S('Diálogos y misiones', 'dialogAdvance', 'Pasar a la siguiente frase del diálogo (0,1 s).'),
  S('Diálogos y misiones', 'dialogChoice', 'Elegir una respuesta del jugador (0,2 s).'),
  S('Diálogos y misiones', 'npcBlip', 'Voz «de relleno» de un NPC cuando no hay voz grabada para esa línea (0,06 s; se reproduce varias veces con tono distinto).'),
  S('Diálogos y misiones', 'questNew', 'Nueva misión (fanfarria corta ascendente, 0,8 s).'),
  S('Diálogos y misiones', 'questUpdate', 'Un objetivo de misión avanza (ding doble, 0,4 s).'),
  S('Diálogos y misiones', 'questComplete', 'Misión completada (fanfarria, 1,5 s).'),
  S('Diálogos y misiones', 'relationUp', 'Sube la relación con un NPC (nota cálida, 0,6 s).'),

  // ---- máquinas tragaperras ----
  S('Máquinas', 'buttonPress', 'Pulsar el botón grande de la máquina (clunk mecánico + clic, 0,2 s).'),
  S('Máquinas', 'buttonRelease', 'Soltar el botón de la máquina (clic de retorno, 0,1 s).'),
  S('Máquinas', 'lever', 'Palanca de la máquina (resorte + golpe, 0,4 s).'),
  S('Máquinas', 'spinStart', 'Inicio del giro: rodillos acelerando (0,7 s).'),
  S('Máquinas', 'reelSpin', 'Rodillos girando mientras dura el giro (en bucle; se corta al parar).', { loop: true }),
  S('Máquinas', 'tick', 'Chasquido de cada símbolo que pasa por el rodillo (0,03 s).'),
  S('Máquinas', 'reelStop', 'Un rodillo se detiene (golpe seco mecánico, 0,2 s). Se reproduce varias veces por giro con tono creciente.'),
  S('Máquinas', 'betUp', 'Subir la apuesta (clic ascendente, 0,08 s).'),
  S('Máquinas', 'betDown', 'Bajar la apuesta (clic descendente, 0,08 s).'),
  S('Máquinas', 'betMax', 'Apuesta máxima (campanilla + golpe, 0,4 s).'),
  S('Máquinas', 'betPlace', 'La apuesta entra en la máquina (monedas cayendo, 0,4 s).'),
  S('Máquinas', 'push', 'Te devuelven exactamente lo apostado (ding neutro, 0,4 s).'),
  S('Máquinas', 'lose', 'Pierdes la apuesta (descenso suave, nada dramático, 0,5 s).'),
  S('Máquinas', 'winSmall', 'Premio normal (arpegio brillante, 0,6 s).'),
  S('Máquinas', 'winBig', 'Premio grande (fanfarria corta con brillos, 1,2 s).'),
  S('Máquinas', 'jackpot', 'PREMIO GORDO (fanfarria larga, 3-4 s, con campanas y celebración).'),
  S('Máquinas', 'coin', 'Una moneda (ding metálico, 0,15 s).'),
  S('Máquinas', 'coins', 'Lluvia de monedas cayendo (1,5-2,5 s).'),
  S('Máquinas', 'applause', 'Aplausos y vítores del público (2-4 s).'),
  S('Máquinas', 'applauseBig', 'Aplausos largos y vítores fuertes para premios enormes (4-6 s).'),
  S('Máquinas', 'confetti', 'Pop de confeti (explosión alegre, 0,5 s).'),
  S('Máquinas', 'sparkle', 'Brillo mágico (glissando agudo, 0,5 s).'),
  S('Máquinas', 'abilityReady', 'La habilidad especial de la máquina está lista (carga + ding, 0,6 s).'),
  S('Máquinas', 'abilityUse', 'Usar la habilidad especial (explosión de energía, 0,8 s).'),

  // ---- cartas y fichas (blackjack) ----
  S('Cartas', 'cardShuffle', 'Barajar las cartas (1,5-2,5 s). Admite variantes.'),
  S('Cartas', 'cardDeal', 'Repartir una carta sobre el tapete (0,2 s). Admite variantes cardDeal_1…cardDeal_4.'),
  S('Cartas', 'cardFlip', 'Dar la vuelta a una carta (0,15 s).'),
  S('Cartas', 'chipBet', 'Poner una ficha en la mesa (clac de cerámica, 0,15 s). Admite variantes.'),
  S('Cartas', 'chipStack', 'Recoger o apilar fichas (0,5 s).'),
  S('Cartas', 'blackjack', 'Blackjack: 21 con las dos primeras cartas (fanfarria, 1,2 s).'),
  S('Cartas', 'bust', 'Te pasas de 21 (golpe seco descendente, 0,5 s).'),
  S('Cartas', 'dealerReveal', 'El crupier descubre su carta oculta (redoble + whoosh, 0,6 s).'),
  S('Cartas', 'doubleDown', 'Doblar la apuesta (fichas + golpe, 0,5 s).'),

  // ---- ruletas ----
  S('Ruletas', 'rouletteSpin', 'La rueda de la ruleta girando (en bucle mientras dura la fase de giro).', { loop: true }),
  S('Ruletas', 'rouletteBall', 'La bola corriendo por el borde y rebotando (3-6 s, cada vez más lenta).'),
  S('Ruletas', 'rouletteLand', 'La bola cae en su casilla (traqueteo + clic final, 0,8 s).'),
  S('Ruletas', 'roulettePlace', 'Colocar una apuesta en el paño (ficha sobre fieltro, 0,15 s).'),
  S('Ruletas', 'rouletteWin', 'Aciertas en la ruleta (fanfarria corta, 1 s).'),

  // ---- compras, obras y progreso ----
  S('Progreso', 'buy', 'Comprar una mejora (cha-ching, 0,6 s).'),
  S('Progreso', 'buyMachine', 'Comprar una máquina o mesa (cha-ching + chispazo, 0,8 s).'),
  S('Progreso', 'decorPlace', 'Aparece una pieza de decoración (golpe suave + destello, 0,8 s).'),
  S('Progreso', 'construction', 'Obras: martillazos y taladro (3-5 s).'),
  S('Progreso', 'constructionDone', 'Obra terminada (ding + aplauso corto, 1,5 s).'),
  S('Progreso', 'cleaning', 'Limpieza: fregona, cepillo y aspiradora (2 s).'),
  S('Progreso', 'phoneRing', 'Teléfono antiguo sonando mientras llamas al equipo de limpieza (2 s).'),
  S('Progreso', 'crewArrive', 'El equipo de limpieza llega: puerta, pasos y carritos (2 s).'),
  S('Progreso', 'repairWorks', 'Daniel reparando la sala: martillo, taladro y sierra (3 s).'),
  S('Progreso', 'breakerLever', 'Palanca del cuadro eléctrico: golpe metálico seco (0,5 s).'),
  S('Progreso', 'lightsOn', 'Las luces se encienden: «clonc» de contactores y zumbido que sube (1,5 s).'),
  S('Progreso', 'repair', 'Reparación de una máquina (llave inglesa + chispas + arranque, 2 s).'),
  S('Progreso', 'unlock', 'Desbloquear algo grande, p. ej. una sala (fanfarria ascendente, 1,5 s).'),
  S('Progreso', 'objective', 'Objetivo cumplido (campanas ascendentes, 1 s).'),
  S('Progreso', 'achievement', 'Logro desbloqueado (fanfarria corta, 1,2 s).'),
  S('Progreso', 'prestige', 'Subida de PRESTIGE (nota aguda brillante, 0,5 s).'),
  S('Progreso', 'bankrupt', 'BANCA ROTA: golpe grave + campana apagada (3-4 s).'),
  S('Progreso', 'endingDoor', 'Aparece la puerta del final (retumbar + acorde misterioso, 3 s).'),
  S('Progreso', 'theEnd', 'Se activa la máquina THE END (acorde majestuoso, 4 s).'),

  // ---- música (en bucle, 1-3 min, sin silencios al final) ----
  S('Música', 'musicMenu', 'Música del menú principal.', { loop: true }),
  S('Música', 'musicGame', 'Música mientras juegas (también vale el nombre antiguo «music»).', { loop: true }),
  S('Música', 'musicNeon', 'Música de NEON LOUNGE (si no existe suena musicGame).', { loop: true, fallback: 'musicGame' }),
  S('Música', 'musicGolden', 'Música de GOLDEN ROOM (si no existe suena musicGame).', { loop: true, fallback: 'musicGame' }),
  S('Música', 'musicUnderground', 'Música de UNDERGROUND (si no existe suena musicGame).', { loop: true, fallback: 'musicGame' }),
  S('Música', 'musicVip', 'Música de VIP HALL (si no existe suena musicGame).', { loop: true, fallback: 'musicGame' }),
  S('Música', 'musicCredits', 'Música de los créditos que se ven desde el menú principal.', { loop: true }),
  S('Música', 'musicEnding', 'Música de los créditos finales (THE END).', { loop: true }),
  S('Música', 'musicBankrupt', 'Música de la pantalla de BANCA ROTA.', { loop: true }),

  // ---- ambiente (en bucle) ----
  S('Ambiente', 'ambienceMenu', 'Ambiente del casino en el menú principal (más flojo).', { loop: true }),
  S('Ambiente', 'ambience', 'Ambiente del casino abierto y con clientes (murmullo, máquinas, copas).', { loop: true }),
  S('Ambiente', 'ambienceEmpty', 'Sala vacía (casino cerrado o sin clientes): tono de sala, zumbido de luces, sin gente.', { loop: true }),
  S('Ambiente', 'ambienceNeon', 'Ambiente de NEON LOUNGE (si no existe suena ambience).', { loop: true, fallback: 'ambience' }),
  S('Ambiente', 'ambienceGolden', 'Ambiente de GOLDEN ROOM (si no existe suena ambience).', { loop: true, fallback: 'ambience' }),
  S('Ambiente', 'ambienceUnderground', 'Ambiente de UNDERGROUND: goteo, eco, zumbido grave (si no existe suena ambience).', { loop: true, fallback: 'ambience' }),
  S('Ambiente', 'ambienceVip', 'Ambiente de VIP HALL: casi silencio elegante (si no existe suena ambience).', { loop: true, fallback: 'ambience' }),
  S('Ambiente', 'ambienceCorridor', 'Ambiente del pasillo oscuro del final (si no existe suena un zumbido procedural).', { loop: true }),
]);

export const SOUND_NAMES = SOUNDS.map((s) => s.name);
export const SOUND_BY_NAME = Object.freeze(Object.fromEntries(SOUNDS.map((s) => [s.name, s])));

/** Nombres antiguos (v1.0/v1.1) que siguen funcionando si ya tenías el fichero. */
export const SOUND_ALIASES = Object.freeze({ door: 'doorLocked', music: 'musicGame' });

export const AUDIO_DIR = 'assets/audio/';
export const VOICE_DIR = 'assets/audio/voice/';
export const MANIFEST_FILE = 'manifest.json';
