# HOUSE OF ODDS

Casino 3D en primera persona para navegador, con historia, personajes y misiones
(HTML5 + CSS + JavaScript moderno + Three.js + WebGL 2 + Web Audio + LocalStorage). Sin backend.

**Versión 1.4.0** · 6 idiomas (English, Español, Deutsch, Français, Português, 简体中文).

## Ejecutar en tu ordenador

Requisitos: un navegador moderno con WebGL 2 y [Node.js](https://nodejs.org) 18 o superior.

```bash
node server.mjs          # http://127.0.0.1:8080  (si está ocupado, prueba 8081, 8082…)
node server.mjs 3000     # puerto concreto
```

Abre la dirección que imprime. **No abras `index.html` con doble clic** (`file://`): los módulos ES exigen un servidor.
No hace falta `npm install`: Three.js y las tipografías están en `vendor/` y `assets/fonts/`. Funciona sin conexión.

## Publicar en Vercel (u otro alojamiento estático)

Sube la carpeta tal cual. `vercel.json` ya ejecuta `npm run audio` al desplegar para generar
`assets/audio/manifest.json` (la lista de tus .mp3). Si usas otro alojamiento estático, ejecuta antes `npm run audio`.
Los nombres de archivo deben ir en **minúsculas** (los servidores Linux distinguen mayúsculas).

## Controles

| Control | Acción |
|---|---|
| Clic | Capturar el ratón |
| W A S D / flechas · Mayús | Moverse · correr |
| E | Interactuar: hablar con personajes, usar THE CLASSIC, objetos de misión, puertas, mostrador |
| Espacio / E / clic | Tirar en THE CLASSIC (dentro de ella) · Q para salir |
| W / S · ↑ / ↓ | Subir / bajar la apuesta (dentro de la máquina) |
| **J** | Diario de misiones (también en Pausa → Misiones) |
| En una conversación | E / Espacio / clic continuar · 1-4 elegir respuesta · ↑↓ + Intro · TAB saltar |
| ESC | Pausa; cierra paneles |
| F3 / F4 | Diagnóstico / cambiar calidad (con el diagnóstico visible) |

## Cómo se juega (0.6.4 BETA)

- Llegas a un casino venido a menos: **sucio, lleno de trastos, con goteras, grietas y THE CLASSIC averiada**, sin
  clientes ni crupieres. Victoria Hawthorne, la directora,
  te recibe junto a la recepción. A partir de ahí, la historia te guía con un **rastreador de misión** (arriba a la derecha),
  una **brújula** con la distancia (arriba a la izquierda), una **baliza** en el objetivo e **iconos sobre los personajes**:
  **!** misión nueva · **?** quiere hablar contigo · **◆** puedes comprarle algo.
- **Campaña jugable**: *Un nuevo comienzo*, *La primera máquina* (reparas THE CLASSIC con Daniel), *Abrimos las puertas*
  (llamas al equipo de limpieza, das la luz en el cuadro eléctrico, Daniel repara goteras y grietas, giras el cartel a
  ABIERTO y llega la gran reapertura con clientes). Cada paso tiene su secuencia (LLAMANDO… EN CAMINO… LIMPIANDO…,
  palanca y encendido de las luces, REPARANDO…). Secundarias: *La historia de una máquina*,
  *Una mejor primera impresión*. Desafío: *El maestro clásico*. El capítulo 4 aparece como «próximamente».
- Decisiones con consecuencias (relaciones DESCONOCIDO → AMISTAD, decoración, actitud de los personajes), guardadas.
- **Servicios como en la vida real**: Daniel Reed (técnico) presupuesta en MARKS obras, limpieza, luces, ampliaciones y
  mejoras de máquina; Sofia Martínez, la decoración; el mostrador solo informa. Cada compra se presenta con una cinemática:
  la cámara va hasta lo comprado mientras aparece (la alfombra se desenrolla, la estatua emerge, la lámpara desciende…).
- **PNJ**: personajes con nombre en su puesto, crupieres, cajero, clientes habituales y, tras la reapertura, clientes que
  entran, buscan sitio, se sientan, juegan y se van. Te miran cuando te acercas.
- **MARKS** (moneda), **PRESTIGE** (progreso, no se gasta), **COLLECTION** (símbolos y efectos).
- **Apuestas**: cada tirada cuesta lo que apuestas (5 · 10 · 25 · 50 · 100; la caja registradora y la cámara acorazada
  permiten 250 y 500). Sin combinación pierdes la apuesta; una pareja baja (cerezas o campanas) te la devuelve;
  una pareja alta (diamantes, coronas, sietes) paga ×2 y los tríos ×4 (cerezas) … ×25 (sietes) y ×40 (estrellas).
  Las mejoras de multiplicador suben el PRESTIGE, no los pagos. Una compra nunca te deja sin poder apostar (reserva),
  y las misiones nunca te obligan a arriesgar MARKS.
- **BANCA ROTA**: si te quedas sin MARKS para la apuesta mínima y no tienes ninguna misión que te dé MARKS sin apostar,
  la casa te cierra las puertas: la partida se borra y vuelves al menú principal para empezar de nuevo. Si esa misión
  existe, el juego te avisa de que aún puedes salir de esta.

## Gráficos

Cinco niveles reales: **MUY BAJA, BAJA, MEDIA, ALTA, ULTRA**. Cambian finura de los modelos, resolución de texturas,
sombras, número de luces dinámicas, cantidad de PNJ, partículas y post-proceso (bloom, oclusión ambiental y SMAA en
ALTA/ULTRA). La iluminación general y los reflejos salen de una sonda capturada del propio casino y son iguales en
todos los niveles: bajar la calidad no oscurece el casino ni subirla exagera los brillos. Al cambiar algo que exige regenerar el escenario,
el casino se reconstruye en caliente conservando la partida.

## Sonidos y voces propios (.mp3)

- Efectos y música: `assets/audio/<nombre>.mp3` con los nombres de `assets/audio/SOUNDS.md`. Sin archivo, suena la versión procedural.
- **Voces de los diálogos**: `assets/audio/voice/<conversación>__<línea>.mp3` (o por idioma: `assets/audio/voice/es/…`).
  La lista completa de las 103 líneas, con personaje, texto y nombre de archivo, está en
  [`docs/DIALOGUE_AUDIO.md`](docs/DIALOGUE_AUDIO.md). Al avanzar, la voz anterior se corta.
- Después de añadir archivos: `npm run audio` (y `npm run dialogues` regenera el documento de voces).

## Pruebas

```bash
npm test        # o: node --test
```

152 pruebas: lógica de juego, progreso y guardado (con migración de partidas antiguas), misiones (flujo completo,
separación entre misiones, recompensas únicas, datos corruptos), coherencia de todos los diálogos y sus textos en los
6 idiomas, navegación de PNJ (A*), configuración de los 5 niveles gráficos, audio, i18n, servidor e integridad del proyecto.
Las partidas, cinemáticas y niveles gráficos se comprobaron además en Chrome con render por software.
**El rendimiento en GPU real, Firefox y Safari no se ha medido.**

## Documentación

- [`docs/PENDING.md`](docs/PENDING.md) — estado y trabajo pendiente (fuente de verdad).
- [`docs/NARRATIVE_DESIGN.md`](docs/NARRATIVE_DESIGN.md) — diseño narrativo y de misiones.
- [`docs/DIALOGUE_AUDIO.md`](docs/DIALOGUE_AUDIO.md) — todas las líneas de voz.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura.

## Licencias de terceros

- Three.js y sus addons (MIT) — `vendor/three/LICENSE`, `vendor/three/addons/LICENSE`
- Cinzel y Cormorant Garamond (SIL OFL 1.1) — `assets/fonts/LICENSE-*.txt`
