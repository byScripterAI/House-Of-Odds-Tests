# Sonidos personalizables de HOUSE OF ODDS

Todos los sonidos del juego tienen una versión integrada (procedural). Para sustituir cualquiera por el tuyo,
deja un `.mp3` en esta carpeta (`assets/audio/`) con **exactamente** el nombre de la tabla. No hace falta tocar código.

## Cómo funciona

- **Si existe el fichero, se usa; si no, suena el sonido integrado.** Puedes sustituir solo los que quieras.
- **Variantes al azar:** `step_1.mp3`, `step_2.mp3`, `step_3.mp3`… (cualquier sonido admite variantes; se elige una cada vez).
- **Bucles** (música, ambiente, rodillos…): el fichero se repite solo; que no tenga silencio al principio ni al final.
- **Si falta un sonido con «recurre a»**, se usa ese otro (p. ej. `musicNeon` → `musicGame`).
- **Nombres antiguos** (`music.mp3`, `door.mp3`) siguen valiendo: `music` = `musicGame`, `door` = `doorLocked`.
- **Volumen:** normaliza tus mp3 a un nivel parecido; el juego ya mezcla los canales (general, música, efectos, voces).

## Al probar en local

Arranca con `node server.mjs` (o `npm start`): el servidor detecta tus mp3 al instante, solo recarga la página.

## Al subirlo a Vercel (o cualquier alojamiento estático)

1. Deja tus `.mp3` en `assets/audio/` y las voces en `assets/audio/voice/`.
2. Ejecuta **`npm run audio`** una vez: crea `assets/audio/manifest.json` con la lista de ficheros y te avisa de nombres incorrectos.
   (El proyecto ya incluye `vercel.json` con `buildCommand`, así que Vercel también lo regenera solo en cada despliegue.)
3. Sube el proyecto entero, incluida la carpeta `assets/audio`.
4. **Los nombres distinguen mayúsculas en Vercel** (Linux): `Click.mp3` no es `click.mp3`. Usa minúsculas tal cual aparecen aquí.

## Voces de los diálogos

Cada línea hablada por un NPC tiene un identificador (p. ej. `m01_intro__v1`). Su voz es `assets/audio/voice/<identificador>.mp3` (o `assets/audio/voice/<idioma>/<identificador>.mp3` para una voz por idioma). La lista completa está en `docs/DIALOGUE_AUDIO.md`.
La lista completa (personaje, texto, nombre exacto del fichero) está en `docs/DIALOGUE_AUDIO.md`.
Si no hay voz para una línea, el diálogo funciona igual con texto y un sonido de relleno (`npcBlip`).
Si el jugador pasa a la siguiente frase, la voz que sonaba se corta y empieza la de la nueva.

## Interfaz

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `hover.mp3` | Pasar el ratón por un botón (tic muy corto y agudo, 0,05 s). |  | suena el integrado |
| `click.mp3` | Pulsar un botón (clic nítido, 0,1 s). |  | suena el integrado |
| `back.mp3` | Cerrar o volver atrás (tono descendente suave, 0,15 s). |  | suena el integrado |
| `confirm.mp3` | Confirmar o entrar (arpegio ascendente corto, 0,4 s). |  | suena el integrado |
| `error.mp3` | Acción no permitida (zumbido grave breve, 0,25 s). |  | suena el integrado |
| `toast.mp3` | Aparece un aviso (campanita doble, 0,4 s). |  | suena el integrado |
| `tutorial.mp3` | Paso de tutorial completado (ding alegre ascendente, 0,6 s). |  | suena el integrado |
| `marksTick.mp3` | Cada salto del contador de MARKS al subir (clic de moneda, 0,05 s). |  | suena el integrado |
| `menuOpen.mp3` | Se abre un panel o menú (whoosh suave, 0,3 s). |  | suena el integrado |
| `menuClose.mp3` | Se cierra un panel o menú (whoosh inverso, 0,25 s). |  | suena el integrado |
| `tabSwitch.mp3` | Cambiar de pestaña (tic grave y limpio, 0,08 s). |  | suena el integrado |
| `sliderTick.mp3` | Mover un control deslizante (tic mínimo, 0,03 s). |  | suena el integrado |
| `toggle.mp3` | Activar/desactivar un interruptor (clac, 0,1 s). |  | suena el integrado |
| `languageChange.mp3` | Cambiar de idioma (campanilla + whoosh, 0,5 s). |  | suena el integrado |
| `pause.mp3` | Entrar en pausa (descenso de tono, 0,3 s). |  | suena el integrado |
| `resume.mp3` | Salir de la pausa (ascenso de tono, 0,3 s). |  | suena el integrado |

## Mundo

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `step.mp3` | Pisada sobre mármol (muy suave, 0,12 s). Admite variantes step_1…step_6. |  | suena el integrado |
| `stepCarpet.mp3` | Pisada sobre alfombra (más sorda, 0,12 s). Admite variantes. |  | suena el integrado |
| `doorOpen.mp3` | Abrir una puerta (pomo + chirrido suave, 0,6 s). |  | suena el integrado |
| `doorClose.mp3` | Cerrar una puerta (golpe sordo + pestillo, 0,5 s). |  | suena el integrado |
| `doorLocked.mp3` (o `door.mp3`) | Puerta cerrada con llave: pomo que no cede (0,5 s). |  | suena el integrado |
| `machineEnter.mp3` | Acercarse a una máquina y usarla (whoosh + zumbido eléctrico, 0,6 s). |  | suena el integrado |
| `machineExit.mp3` | Salir de una máquina (whoosh inverso, 0,4 s). |  | suena el integrado |
| `shopOpen.mp3` | Abrir un servicio de pago con un NPC (caja registradora + campanilla, 0,7 s). |  | suena el integrado |
| `farSlot.mp3` | Máquina lejana funcionando (ding + rodillos amortiguados, 1-2 s). Suena de fondo, flojo, al azar. |  | suena el integrado |
| `farChips.mp3` | Fichas lejanas en una mesa (1 s). Suena de fondo, flojo, al azar. |  | suena el integrado |
| `farRoulette.mp3` | Ruleta lejana: bola y rueda amortiguadas (2-3 s). Suena de fondo, flojo, al azar. |  | suena el integrado |
| `farCheer.mp3` | Pequeño vítor lejano de clientes (1-2 s). Suena de fondo, flojo, al azar. |  | suena el integrado |

## Diálogos y misiones

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `dialogOpen.mp3` | Se abre una conversación (campanilla suave + whoosh, 0,4 s). |  | suena el integrado |
| `dialogClose.mp3` | Se cierra una conversación (0,3 s). |  | suena el integrado |
| `dialogText.mp3` | Cada letra del texto del diálogo al aparecer (tic mínimo, 0,02 s). Admite variantes. |  | suena el integrado |
| `dialogAdvance.mp3` | Pasar a la siguiente frase del diálogo (0,1 s). |  | suena el integrado |
| `dialogChoice.mp3` | Elegir una respuesta del jugador (0,2 s). |  | suena el integrado |
| `npcBlip.mp3` | Voz «de relleno» de un NPC cuando no hay voz grabada para esa línea (0,06 s; se reproduce varias veces con tono distinto). |  | suena el integrado |
| `questNew.mp3` | Nueva misión (fanfarria corta ascendente, 0,8 s). |  | suena el integrado |
| `questUpdate.mp3` | Un objetivo de misión avanza (ding doble, 0,4 s). |  | suena el integrado |
| `questComplete.mp3` | Misión completada (fanfarria, 1,5 s). |  | suena el integrado |
| `relationUp.mp3` | Sube la relación con un NPC (nota cálida, 0,6 s). |  | suena el integrado |

## Máquinas

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `buttonPress.mp3` | Pulsar el botón grande de la máquina (clunk mecánico + clic, 0,2 s). |  | suena el integrado |
| `buttonRelease.mp3` | Soltar el botón de la máquina (clic de retorno, 0,1 s). |  | suena el integrado |
| `lever.mp3` | Palanca de la máquina (resorte + golpe, 0,4 s). |  | suena el integrado |
| `spinStart.mp3` | Inicio del giro: rodillos acelerando (0,7 s). |  | suena el integrado |
| `reelSpin.mp3` | Rodillos girando mientras dura el giro (en bucle; se corta al parar). | sí | suena el integrado |
| `tick.mp3` | Chasquido de cada símbolo que pasa por el rodillo (0,03 s). |  | suena el integrado |
| `reelStop.mp3` | Un rodillo se detiene (golpe seco mecánico, 0,2 s). Se reproduce varias veces por giro con tono creciente. |  | suena el integrado |
| `betUp.mp3` | Subir la apuesta (clic ascendente, 0,08 s). |  | suena el integrado |
| `betDown.mp3` | Bajar la apuesta (clic descendente, 0,08 s). |  | suena el integrado |
| `betMax.mp3` | Apuesta máxima (campanilla + golpe, 0,4 s). |  | suena el integrado |
| `betPlace.mp3` | La apuesta entra en la máquina (monedas cayendo, 0,4 s). |  | suena el integrado |
| `push.mp3` | Te devuelven exactamente lo apostado (ding neutro, 0,4 s). |  | suena el integrado |
| `lose.mp3` | Pierdes la apuesta (descenso suave, nada dramático, 0,5 s). |  | suena el integrado |
| `winSmall.mp3` | Premio normal (arpegio brillante, 0,6 s). |  | suena el integrado |
| `winBig.mp3` | Premio grande (fanfarria corta con brillos, 1,2 s). |  | suena el integrado |
| `jackpot.mp3` | PREMIO GORDO (fanfarria larga, 3-4 s, con campanas y celebración). |  | suena el integrado |
| `coin.mp3` | Una moneda (ding metálico, 0,15 s). |  | suena el integrado |
| `coins.mp3` | Lluvia de monedas cayendo (1,5-2,5 s). |  | suena el integrado |
| `applause.mp3` | Aplausos y vítores del público (2-4 s). |  | suena el integrado |
| `applauseBig.mp3` | Aplausos largos y vítores fuertes para premios enormes (4-6 s). |  | suena el integrado |
| `confetti.mp3` | Pop de confeti (explosión alegre, 0,5 s). |  | suena el integrado |
| `sparkle.mp3` | Brillo mágico (glissando agudo, 0,5 s). |  | suena el integrado |
| `abilityReady.mp3` | La habilidad especial de la máquina está lista (carga + ding, 0,6 s). |  | suena el integrado |
| `abilityUse.mp3` | Usar la habilidad especial (explosión de energía, 0,8 s). |  | suena el integrado |

## Cartas

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `cardShuffle.mp3` | Barajar las cartas (1,5-2,5 s). Admite variantes. |  | suena el integrado |
| `cardDeal.mp3` | Repartir una carta sobre el tapete (0,2 s). Admite variantes cardDeal_1…cardDeal_4. |  | suena el integrado |
| `cardFlip.mp3` | Dar la vuelta a una carta (0,15 s). |  | suena el integrado |
| `chipBet.mp3` | Poner una ficha en la mesa (clac de cerámica, 0,15 s). Admite variantes. |  | suena el integrado |
| `chipStack.mp3` | Recoger o apilar fichas (0,5 s). |  | suena el integrado |
| `blackjack.mp3` | Blackjack: 21 con las dos primeras cartas (fanfarria, 1,2 s). |  | suena el integrado |
| `bust.mp3` | Te pasas de 21 (golpe seco descendente, 0,5 s). |  | suena el integrado |
| `dealerReveal.mp3` | El crupier descubre su carta oculta (redoble + whoosh, 0,6 s). |  | suena el integrado |
| `doubleDown.mp3` | Doblar la apuesta (fichas + golpe, 0,5 s). |  | suena el integrado |

## Ruletas

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `rouletteSpin.mp3` | La rueda de la ruleta girando (en bucle mientras dura la fase de giro). | sí | suena el integrado |
| `rouletteBall.mp3` | La bola corriendo por el borde y rebotando (3-6 s, cada vez más lenta). |  | suena el integrado |
| `rouletteLand.mp3` | La bola cae en su casilla (traqueteo + clic final, 0,8 s). |  | suena el integrado |
| `roulettePlace.mp3` | Colocar una apuesta en el paño (ficha sobre fieltro, 0,15 s). |  | suena el integrado |
| `rouletteWin.mp3` | Aciertas en la ruleta (fanfarria corta, 1 s). |  | suena el integrado |

## Progreso

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `buy.mp3` | Comprar una mejora (cha-ching, 0,6 s). |  | suena el integrado |
| `buyMachine.mp3` | Comprar una máquina o mesa (cha-ching + chispazo, 0,8 s). |  | suena el integrado |
| `decorPlace.mp3` | Aparece una pieza de decoración (golpe suave + destello, 0,8 s). |  | suena el integrado |
| `construction.mp3` | Obras: martillazos y taladro (3-5 s). |  | suena el integrado |
| `constructionDone.mp3` | Obra terminada (ding + aplauso corto, 1,5 s). |  | suena el integrado |
| `cleaning.mp3` | Limpieza: fregona, cepillo y aspiradora (2 s). |  | suena el integrado |
| `phoneRing.mp3` | Teléfono antiguo sonando mientras llamas al equipo de limpieza (2 s). |  | suena el integrado |
| `crewArrive.mp3` | El equipo de limpieza llega: puerta, pasos y carritos (2 s). |  | suena el integrado |
| `repairWorks.mp3` | Daniel reparando la sala: martillo, taladro y sierra (3 s). |  | suena el integrado |
| `breakerLever.mp3` | Palanca del cuadro eléctrico: golpe metálico seco (0,5 s). |  | suena el integrado |
| `lightsOn.mp3` | Las luces se encienden: «clonc» de contactores y zumbido que sube (1,5 s). |  | suena el integrado |
| `repair.mp3` | Reparación de una máquina (llave inglesa + chispas + arranque, 2 s). |  | suena el integrado |
| `unlock.mp3` | Desbloquear algo grande, p. ej. una sala (fanfarria ascendente, 1,5 s). |  | suena el integrado |
| `objective.mp3` | Objetivo cumplido (campanas ascendentes, 1 s). |  | suena el integrado |
| `achievement.mp3` | Logro desbloqueado (fanfarria corta, 1,2 s). |  | suena el integrado |
| `prestige.mp3` | Subida de PRESTIGE (nota aguda brillante, 0,5 s). |  | suena el integrado |
| `bankrupt.mp3` | BANCA ROTA: golpe grave + campana apagada (3-4 s). |  | suena el integrado |
| `endingDoor.mp3` | Aparece la puerta del final (retumbar + acorde misterioso, 3 s). |  | suena el integrado |
| `theEnd.mp3` | Se activa la máquina THE END (acorde majestuoso, 4 s). |  | suena el integrado |

## Música

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `musicMenu.mp3` | Música del menú principal. | sí | suena el integrado |
| `musicGame.mp3` (o `music.mp3`) | Música mientras juegas (también vale el nombre antiguo «music»). | sí | suena el integrado |
| `musicNeon.mp3` | Música de NEON LOUNGE (si no existe suena musicGame). | sí | usa `musicGame` |
| `musicGolden.mp3` | Música de GOLDEN ROOM (si no existe suena musicGame). | sí | usa `musicGame` |
| `musicUnderground.mp3` | Música de UNDERGROUND (si no existe suena musicGame). | sí | usa `musicGame` |
| `musicVip.mp3` | Música de VIP HALL (si no existe suena musicGame). | sí | usa `musicGame` |
| `musicCredits.mp3` | Música de los créditos que se ven desde el menú principal. | sí | suena el integrado |
| `musicEnding.mp3` | Música de los créditos finales (THE END). | sí | suena el integrado |
| `musicBankrupt.mp3` | Música de la pantalla de BANCA ROTA. | sí | suena el integrado |

## Ambiente

| Fichero | Qué es | Bucle | Si falta |
|---|---|---|---|
| `ambienceMenu.mp3` | Ambiente del casino en el menú principal (más flojo). | sí | suena el integrado |
| `ambience.mp3` | Ambiente del casino abierto y con clientes (murmullo, máquinas, copas). | sí | suena el integrado |
| `ambienceEmpty.mp3` | Sala vacía (casino cerrado o sin clientes): tono de sala, zumbido de luces, sin gente. | sí | suena el integrado |
| `ambienceNeon.mp3` | Ambiente de NEON LOUNGE (si no existe suena ambience). | sí | usa `ambience` |
| `ambienceGolden.mp3` | Ambiente de GOLDEN ROOM (si no existe suena ambience). | sí | usa `ambience` |
| `ambienceUnderground.mp3` | Ambiente de UNDERGROUND: goteo, eco, zumbido grave (si no existe suena ambience). | sí | usa `ambience` |
| `ambienceVip.mp3` | Ambiente de VIP HALL: casi silencio elegante (si no existe suena ambience). | sí | usa `ambience` |
| `ambienceCorridor.mp3` | Ambiente del pasillo oscuro del final (si no existe suena un zumbido procedural). | sí | suena el integrado |

