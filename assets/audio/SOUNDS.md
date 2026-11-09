# Sonidos del juego (carpeta assets/audio)

Coloca aquí archivos **.mp3** con EXACTAMENTE estos nombres. Si el archivo existe, el juego lo usa; si no existe, suena el sonido procedural que ya trae.
Los cambios se aplican al recargar la página (Ctrl+F5). Los marcados como bucle deben empalmar sin corte.

| Archivo | Descripción |
|---|---|
| `hover.mp3` | Pasar el ratón por un botón (tic muy corto y agudo, 0,05 s). |
| `click.mp3` | Pulsar un botón (clic nítido, 0,1 s). |
| `back.mp3` | Cerrar o volver atrás (tono descendente suave, 0,15 s). |
| `confirm.mp3` | Confirmar o entrar (arpegio ascendente corto, 0,4 s). |
| `error.mp3` | Acción no permitida (zumbido grave breve, 0,25 s). |
| `toast.mp3` | Aparece un aviso (campanita doble, 0,4 s). |
| `tutorial.mp3` | Paso de tutorial completado (ding alegre ascendente, 0,6 s). |
| `marksTick.mp3` | Cada salto del contador de MARKS al subir (clic de moneda, 0,05 s). |
| `door.mp3` | Puerta cerrada: golpe sordo doble (0,4 s). |
| `step.mp3` | Pisada sobre mármol (muy suave, 0,12 s). |
| `machineEnter.mp3` | Acercarse a la máquina y usarla (whoosh + zumbido eléctrico, 0,6 s). |
| `machineExit.mp3` | Salir de la máquina (whoosh inverso, 0,4 s). |
| `shopOpen.mp3` | Abrir la tienda (caja registradora + campanilla, 0,7 s). |
| `spinStart.mp3` | Inicio del giro: palanca + rodillos acelerando (0,7 s). |
| `tick.mp3` | Chasquido de cada símbolo que pasa por el rodillo (0,03 s). |
| `reelStop.mp3` | Un rodillo se detiene (golpe seco mecánico, 0,2 s). Se reproduce 3 veces por giro con tono creciente. |
| `winSmall.mp3` | Premio normal (arpegio brillante, 0,6 s). |
| `winBig.mp3` | Premio grande (fanfarria corta con brillos, 1,2 s). |
| `jackpot.mp3` | PREMIO GORDO (fanfarria larga, 3-4 s, con campanas y celebración). |
| `coin.mp3` | Una moneda (ding metálico, 0,15 s). |
| `coins.mp3` | Lluvia de monedas cayendo (1,5-2,5 s). |
| `applause.mp3` | Aplausos y vítores del público (2-4 s). |
| `confetti.mp3` | Pop de confeti (explosión alegre, 0,5 s). |
| `sparkle.mp3` | Brillo mágico (glissando agudo, 0,5 s). |
| `buy.mp3` | Comprar una mejora del casino (cha-ching, 0,6 s). |
| `buyMachine.mp3` | Comprar una mejora de máquina (cha-ching + chispazo eléctrico, 0,8 s). |
| `unlock.mp3` | Desbloquear algo grande, p. ej. una sala (fanfarria ascendente, 1,5 s). |
| `objective.mp3` | Objetivo cumplido (campanas ascendentes, 1 s). |
| `achievement.mp3` | Logro desbloqueado (fanfarria corta, 1,2 s). |
| `prestige.mp3` | Subida de PRESTIGE (nota aguda brillante, 0,5 s). |
| `music.mp3` | Música de fondo del casino. En bucle, 1-3 min, sin silencios al final. **(bucle)** |
| `ambience.mp3` | Ambiente del casino (murmullo lejano, máquinas). En bucle. **(bucle)** |

Consejos: mono o estéreo, 44,1 kHz, volumen normalizado (los efectos cortos pueden ir algo más bajos que la música). Los sonidos `tick`, `reelStop` y `marksTick` se reproducen con tono creciente automáticamente.
