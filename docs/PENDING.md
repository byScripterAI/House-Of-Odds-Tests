# HOUSE OF ODDS — Requisitos consolidados y pendientes (fuente de verdad)

Fuentes: peticiones del usuario (chat) + `docs/NARRATIVE_DESIGN.md` (diseño narrativo y misiones) +
`docs/USER_REQUESTS_2026-11-09.md` + catálogo oficial de máquinas (adjunto original, resumido abajo).
Prioridad absoluta: **perfección, sin fallos, sin cosas feas**. Lo segundo: funcional. Entrega siempre en .zip.


## 0.6.4 BETA — peticiones del 13-11-2026 (00:32)

Hecho:
- Sofá un 25 % más grande (era bajo al lado de los sillones); asientos, colisiones y separaciones ajustados en el
  salón, el ala norte y el conjunto de terciopelo.
- La luz se da en el cuadro eléctrico real de la pared: se abre su puerta, se oye el general por dentro, se encienden
  las luces y se vuelve a cerrar (la cámara lo enseña de cerca). Piloto rojo/verde en la puerta. Fuera la palanca.
- Puertas y rótulos de las salas pegados a la pared: el punto de colocación quedaba 18 cm por delante del muro y se
  veía un hueco. Marcos rehechos con el forro de las jambas dentro del grosor del muro.
- Escombros con textura: papeles impresos y bolas de papel arrugado, naipes, cascotes y polvo de yeso (antes piezas
  blancas lisas).
- Ya no se atraviesan: butaca volcada, taburetes tirados, maceta volcada, cubo con fregona, cubo de la gotera,
  caballete de «suelo mojado», escalera, caja de documentos y cajas del kit de recepción (se retiran con la limpieza,
  la reparación o al usarlas).
- Mostrador de SERVICIOS: la colisión cubre ahora el mueble, las mamparas y la zona del empleado hasta la pared (había
  un hueco entre el mueble y la mampara por el que se podía pasar detrás).

## 0.6.3 BETA — peticiones del 12-11-2026 (21:03)

Hecho:
- RENDIMIENTO. La carga ya no bloquea la página: el casino se construye por pasos cediendo el hilo; después se
  «calienta» (shaders compilados programa a programa o en paralelo si la GPU lo permite, texturas subidas por tandas y la
  sonda de reflejos capturada cara a cara) antes de enseñar el menú, así el primer fotograma no se congela. Menos
  variantes de shader (la sonda ya no obliga a compilarlo todo otra vez sin niebla ni entorno; las luces de compras ya
  no cambian el número de luces al encenderse). Madera, suelo, pared y fieltro eran un material NUEVO en cada pieza:
  ahora uno compartido (de ~550 a ~350 llamadas de dibujo en BAJA). Atrezo de Poly Haven y de Khronos simplificado sin
  cambiar su aspecto (la tierra de cada maceta tenía 41 000 triángulos; las cajas de cartón 17 000), luciérnagas de
  las macetas fuera, letras luminosas con menos vértices, personajes recortados por cámara, sombra a 30 Hz en MEDIA,
  descompresión de modelos en hilos aparte, desenfoques de interfaz quitados en BAJA/MUY BAJA y clientes compilados en
  segundo plano. Triángulos del menú en BAJA: de ~780 000 a ~450 000.
- Calidad automática: detecta el equipo (GPU, núcleos, memoria, prueba de rendimiento y si el navegador avisa de que no
  hay aceleración por hardware) y vuelve a medir una vez con las reglas nuevas. En juego y en el menú, resolución
  dinámica: si no llega a ~50 fps baja un poco la resolución interna y la recupera cuando sobra; si ni así va fluido,
  baja un nivel. Los cinco niveles: MUY BAJA, BAJA, MEDIA, ALTA y ULTRA.
- Parpadeo negro en un lado de la pantalla: era la sacudida de pantalla, que movía el lienzo 3D y dejaba ver el fondo
  negro por un borde. Ahora el lienzo se amplía lo justo mientras tiembla. Además el jugador ya no atraviesa a los
  personajes (la cámara podía meterse en una cabeza).
- Agua de las goteras: gota que se hincha colgando del techo, cae estirándose con estela, corona de gotitas y chorro de
  rebote al caer; charcos con contorno irregular, borde húmedo, superficie casi espejo y ondas físicas que tuercen los
  reflejos. En ALTA y ULTRA, reflejo plano en tiempo real de la sala.
- Modelos nuevos hechos a mano (Blender): pilastras art déco, puertas dobles con arquitrabe y remate (2,2 m y 4 m),
  lámparas colgantes, mostrador de servicios con mueble bar de arcos de espejo, recepción, rueda de ruleta, cubo de
  zinc y caballete de «suelo mojado». Marcos de cuadros con moldura e ingletes de verdad, zócalo con paneles moldurados,
  tapajuntas y rodapié con perfil. Cadena y candado en las puertas de las salas cerradas (antes un círculo rojo).
- Cuadros: seis obras art déco distintas pintadas de antemano (metrópolis, pavo real, transatlántico, Montecarlo,
  fuente y marina) en vez de cinco paisajes procedurales casi iguales.
- Pantalla de carga rehecha: render de THE CLASSIC en el casino a oscuras a pantalla completa con acercamiento lento,
  marca a la izquierda, consejo abajo, estado con ficha girando y línea de progreso fina en el borde inferior.
- Menú principal: botones nuevos. La opción elegida crece, se dora, se enmarca entre rombos y dibuja un filete; las demás
  se apagan; todo con una curva larga y suave.

Pendiente / no verificado:
- Sin GPU real aquí: el rendimiento se ha medido en un render por software. Las mejoras de carga están medidas; los
  fotogramas por segundo reales en un PC modesto hay que comprobarlos en ese PC.
- Fichas y cartas siguen siendo procedurales (sus mesas jugables están desactivadas hasta el capítulo de cartas).

## 0.6.2 BETA — peticiones del 11-11-2026 (23:43)

Hecho:
- Menú de pausa: vuelve el resaltado al pasar el ratón (se había perdido al rehacer el del menú principal). Ahora los dos
  menús comparten la misma navegación (`src/ui/menu-nav.js`): una sola opción seleccionada con ratón o flechas, sonido
  y resaltado dorado que se desliza.
- Aviso de sala cerrada/bloqueada rehecho con el estilo de la interfaz: candado en rombo dorado entre filetes,
  «ACCESO CERRADO», nombre en Cinzel y explicación en cursiva (antes rosa/rojo con círculo).
- Rótulos luminosos: los contornos de Cinzel venían solapados (astas y remates por separado) y por eso las letras se
  pisaban y parpadeaban. Contornos unidos y letras de canal nuevas: cara iluminada por LED con canto de latón y un
  resplandor suave en la pared (sin la «doble imagen» del resplandor con letras).
- Sonidos de clientes (ruleta, fichas, máquinas lejanas, vítores) y aplausos de los premios: solo con el casino abierto
  y clientes dentro. Con la sala vacía suena un ambiente de sala vacía. Quitado el aplauso de la reparación de THE CLASSIC.

## 0.6.1 BETA — peticiones del 11-11-2026 (20:28 y 20:33)

La numeración pasa a ser de BETA: 1.6.1 → **0.6.1 BETA** (insignia junto al logo, en la carga y en el pie del menú).

Hecho:
- THE CLASSIC modelada a mano en Blender (scripts/models/classic.py): mueble art déco completo (corona con rayos de sol y
  letras de latón, biseles escalonados, panza de terciopelo, altavoces, bandeja, consola inclinada, LCD de apuesta,
  billetero). **Tapa de mantenimiento** en el lado derecho que se abre y se cierra (bisagra delantera) con placa
  electrónica, mazos de cables, relés, regleta, transformador, fusibles, esquema eléctrico pegado en la tapa, seta RESET
  y piloto rojo/verde. Rodillos **desajustados** (torcidos, hundidos y entre símbolos) mientras está averiada.
- Misión 2 rehecha: «Abre la tapa de mantenimiento» (cinemática: la cámara va al costado y la tapa se abre con la luz de
  servicio encendida) → caja de herramientas → «Pulsa RESET» (la seta se hunde, el piloto pasa a verde, la tapa se
  cierra, la cámara va al frente y los rodillos vuelven a su sitio uno a uno con su golpe mientras la máquina arranca).
- Tragaperras de los clientes «LUCKY 7»: un único modelo pintado de verde, rojo o azul; se encienden cuando vuelve la
  luz. Funda antipolvo con simulación de tela real.
- Modelos nuevos hechos a mano para lo que antes era código: taburetes (con y sin respaldo), mesas de blackjack y de
  ruleta, banco capitoné, lámpara de pie art déco, pedestal de mármol acanalado, escultura dorada (esfera armilar) y
  tablero de herramientas de Daniel con flexo.
- Rótulos de neón 3D: letras de canal de metal con tubo de neón de cristal siguiendo el contorno y resplandor en la
  pared; las letras fundidas de «HOUSE OF ODDS» parpadean y se vuelven a encender al restaurar el local (chino: rótulo
  plano, la fuente no tiene esos caracteres).
- Diálogos al ritmo de la voz: el texto termina de escribirse cuando termina la grabación; las palabras largas tardan
  más que las cortas y la puntuación hace pausa (sin grabación, ritmo de lectura con las mismas reglas).
- Efectos: confeti de papel y lámina dorada con cara/envés y aleteo, cañones desde las esquinas, fuegos artificiales con
  cohete y estela, fichas doradas con profundidad, ondas finas y sacudida suave por «trauma» (sin saltos bruscos).
- Rótulos de celebración (IMPECABLE, GRAN APERTURA, misión completada…) y avisos rehechos con el estilo de los menús
  (Cinzel dorado entre filetes, rótulo pequeño en Jost, rombo y filete de acento).
- Pantalla de carga nueva (logo del menú, rayos art déco, marco con esquinas, porcentaje, barra con rombo, pasos,
  consejos rotativos y versión). Aviso BETA al empezar partida nueva.

Pendiente / no hecho en esta tanda:
- Siguen hechos por código: estructura de la sala (paredes, columnas, techos, puertas), mostrador y recepción, lámparas
  colgantes, marcos de cuadros, rueda de ruleta jugable, fichas y cartas, y los desperfectos (cubo, cartel…).
- Sin verificar en GPU real: aspecto del neón con bloom (ALTA/ULTRA), rendimiento con los modelos nuevos en equipos
  modestos.

## v1.6 — peticiones del 11-11-2026 (13:55)

Hecho:
- Cuadrado negro tras el «?» de los PNJ: la oclusión ambiental (ULTRA) contaba los sprites y lo transparente como
  sólidos. Ahora solo las mallas opacas proyectan oclusión.
- Texturas blancas: cinturón de Ethan (linterna, esposas, radio, llaves), herramientas de Daniel y gafas de Isabella
  (los accesorios Rocketbox tenían material propio sin textura). Daniel sin casco ni visera.
- Director de suerte de los desafíos (secreto): frena si el premio sale demasiado pronto, ayuda cada vez más si se
  alarga y garantiza el premio en un tope (trío: mediana ~9 tiradas, máximo 18). Las tiradas forzadas pagan lo normal.
- Iluminación igual en todas las calidades: ya no se quitan luces en las calidades bajas, se AGRUPAN (k-medias por
  potencia: misma energía, menos coste); la sonda se captura con las mismas luces que se dibujan; el bloom solo afecta
  a lo que brilla de verdad (umbral HDR alto); techo, mármol claro y papel menos blancos; metales menos espejo.
  Arreglado: tras cambiar de calidad el entorno apuntaba a una textura liberada (el casino se oscurecía).
- Optimización: personajes y animaciones comprimidos (meshopt + WebP): 37 MB → 14 MB; muebles 6,1 → 3,9 MB; los
  clientes se cargan en segundo plano; shaders precompilados antes del primer fotograma; cambio de calidad con aviso
  «APLICANDO CALIDAD…», cambios seguidos agrupados en una sola reconstrucción y shaders compilados antes de seguir.
- Calidad automática: al primer arranque mide GPU, núcleos, memoria y una prueba de rendimiento de ~100 ms y elige
  MUY BAJA…ULTRA; interruptor en Ajustes (se desactiva al elegir a mano) y vigilante que baja un nivel si el juego va
  a tirones de forma sostenida.
- Recepción con pasillo real para el personal (Isabella ya no atraviesa el mueble); planta que tapaba el cuadro eléctrico.
- Alfombra carmesí rehecha: dibujo propio a escala real (no estirado), grosor, varillas de latón y rollo que se desenrolla.
- Sofía vende 4 conjuntos nuevos: jarrones con flores, galería de óleos con lámpara de cuadro, lámparas art déco y
  sofás de terciopelo (aparecen pieza a pieza con la cámara).
- Arreglado un cuelgue del render por software con sombras (las gafas transparentes proyectaban sombra).

- Modelos reales de Poly Haven (CC0) que pasó el usuario, optimizados (WebP + meshopt): butacas, sofás y mesita del
  salón (sustituyen a los anteriores), mesa de taller y caja de herramientas de Daniel, cuadro eléctrico con armario
  de registro, cajas de cartón y cajones (trastos y kit de recepción), escalera de las reparaciones, lámpara de araña
  de cristal (compra) y otra pequeña sobre el salón, ala norte amueblada con piezas reales, consolas, mesillas,
  jarrones de latón y bustos de mármol (conjunto nuevo de Sofía: «Bustos de mármol»).
- Prueba nueva: todos los `import { … }` propios apuntan a exportaciones que existen (un nombre que faltaba dejaba
  la carga colgada en el navegador).

Pendiente: tragaperras realistas para THE CLASSIC y la sala (sin modelos gratuitos buenos: alternativas propuestas al
usuario) y, con ellas, la misión 2 con panel y rodillos que se desmontan de verdad.

## v1.5 — rediseño visual total + rediseño total de interfaces + inicio deteriorado

Hecho:
- Personajes reales: 33 avatares Microsoft Rocketbox (MIT) con esqueleto y texturas de piel/ropa, 22 animaciones
  de captura de movimiento por género (reposo, andar, sentarse en silla/mesa, hablar, escuchar, saludar, aplaudir,
  trabajar en mesa, agacharse…), mirada al jugador (cuello+cabeza), mandíbula al hablar, pelo corregido.
  Fallback al modelo procedural si no cargan. Carga con barra de progreso real.
- Mobiliario real (Khronos glTF Sample Assets, CC0/CC BY): plantas, butacas adamascadas, Chesterfield, jarrones.
- Materiales horneados en GPU (mármol Nero Marquina en losas de 1,2 m, nogal, seda adamascada, moqueta, yeso,
  latón cepillado, cuero) con UV de mundo (escala real en todas las piezas).
- Iluminación nueva: sonda de entorno capturada del propio casino (reflejos + luz indirecta) igual en todas las
  calidades; compensación de luces en calidades bajas; bloom suave; sin «physical» (reflejos exagerados).
- Arquitectura: techo artesonado con focos, foseado con luz indirecta, cornisa, listelo dorado, zócalo con paneles,
  cenefa de latón en el suelo, lámparas de globo opalino.
- Cuadros con marco real y lienzo rehundido (sin parpadeo) y óleos procedurales; ruletas con rueda real
  (sin cajas rojas/negras solapadas); taburetes nuevos; tragaperras de sala rediseñadas; manchas de humedad realistas.
- Sin clientes ni crupieres antes de la reapertura.
- Capítulo de cartas (blackjack/ruleta jugables) hecho y probado, desactivado con `FEATURES.cardsChapter` hasta
  rehacer su interfaz y traducir sus textos.

- Interfaces y menús rehechos desde cero (sistema de diseño 2.0: Jost/Cinzel/Cormorant, filetes dorados, paneles
  de cristal, teclas, iconos SVG): menú principal, pausa, ajustes con ayuda contextual, HUD (marcadores, brújula,
  rastreador de misión, avisos y puertas bloqueadas), diálogo cinematográfico, diario de misiones, catálogos,
  pantalla de carga, BANCA ROTA y créditos.
- Inicio del juego mucho más deteriorado: trastos por el suelo (papeles, botellas, latas, naipes, fichas, cristales,
  cajas, taburetes y butaca volcados, macetero roto, cascotes de yeso, alfombra enrollada, cuadro caído), manchas,
  telarañas, y DESPERFECTOS aparte: tres goteras con gotas, ondas, salpicaduras, charcos y cubo; manchas de humedad
  en techo y paredes; grietas en suelo y paredes con losas sueltas; papel pintado despegado; parche de contrachapado;
  cable colgando.
- La primera limpieza retira TODOS los trastos del suelo; los desperfectos los arregla Daniel en un paso nuevo de M03
  («Pide a Daniel que repare las goteras y las grietas», conversación nueva en 6 idiomas) ANTES de abrir las puertas.
- Secuencias: limpieza (pantalla negra LLAMANDO… con teléfono 2 s → EN CAMINO… 2 s → LIMPIANDO… con limpieza 2 s →
  vuelta por la sala + IMPECABLE); luces (palanca, 1 s de silencio, encendido con parpadeo de contactores y sonido;
  la instalación vieja deja las luminarias a medio gas y los apliques fundidos se reparan); reparaciones (REPARANDO…
  con martillo/taladro/sierra → ¡COMO NUEVO!). Cámaras de cinemática siempre dentro del casino.
- Sonidos nuevos en el sistema de .mp3 propios: phoneRing, crewArrive, breakerLever, lightsOn, repairWorks.
- Radio de interacción mayor en el equipo de limpieza y el cuadro eléctrico.
- Mármol del suelo rehecho (vetas diagonales largas por losa, filamentos, velo), fundas de tela con trama.

Pendiente (orden): recepción, mostrador, mesas y máquinas de sala (más detalle); textos del capítulo de cartas en
6 idiomas e interfaz de mesa con el sistema 2.0 (después se activa `FEATURES.cardsChapter`).

## A. Reglas permanentes
- Vocabulario: MARKS (gastable), PRESTIGE (progreso, no gastable), COLLECTION. Sin dinero real ni apuestas reales.
- Sitio estático, funciona en Vercel (sin backend, sin endpoints propios). Three.js vendorizado, sin CDN.
- 6 idiomas (en, es, de, fr, pt, zh-Hans): detección al primer arranque, si no → inglés; se guarda para siempre;
  TODO traducido al instante (menús, diálogos, misiones, NPCs, carteles, créditos…).
- Todo modular y extensible (misiones, máquinas, salas, NPCs, sonidos, idiomas).

## B. Hecho
- v1.0, v1.1 (9 cambios rápidos + créditos animados).
- v1.2: i18n completo (6 idiomas), audio personalizable ampliado + manifiesto para Vercel.
- **v1.3**:
  - Gráficos 5 niveles (MUY BAJA→ULTRA) con post-proceso (bloom/GTAO/SMAA), materiales Lambert/Standard/Physical,
    geometría y texturas escaladas, luces y PNJ según nivel; reconstrucción en caliente.
  - Casino nuevo 28×22 m (layout de datos + constructor modular): sucio al empezar (capa de suciedad procedural por
    shader, manchas, grietas, telarañas, goteras, trastos, neón con letras fundidas, luces que fallan) y limpieza animada;
    pilastras en pared (sin columna delante del mostrador), mostrador de servicios, recepción, salón, mesas de blackjack y
    ruleta detalladas, tragaperras antiguas (fundas), puesto de Daniel, ala norte ampliable, decoración comprable.
  - THE CLASSIC rehecha sin solapes, cavidad real de rodillos, símbolos auto-iluminados (legibles arriba/medio/abajo),
    botón grande, LCD de apuesta (preparado), estados averiada/arranque, acabado vintage.
  - PNJ humanos con esqueleto (una malla por PNJ) y animación procedural (andar, sentarse, jugar, repartir, atender,
    brazos cruzados, trabajar, hablar, parpadear, mirar al jugador); 10 personajes con nombre; navegación A*;
    afluencia por niveles; crupieres y cajero.
  - Diálogos (retrato, cámara, voz por línea, saltar, decisiones) + motor de misiones modular + diario (J) + rastreador,
    brújula, baliza e iconos; M01–M03, S01, S02, X01; servicios por personaje; cinemáticas de compra y de reapertura.
  - `docs/DIALOGUE_AUDIO.md` (98 líneas) generado y comprobado por test.
- **v1.4**:
  - Economía con apuestas en THE CLASSIC: escalones 5·10·25·50·100·250·500 (máx. 100, ampliable con la caja
    registradora +150 y la cámara acorazada +250), W/S o ↑/↓ para subir/bajar, la apuesta se recuerda;
    resultados PERDER (×0) / RECUPERAR (pareja baja ×1) / GANAR (pareja alta ×2, tríos ×4…×40); retorno ≈103 %.
    Panel de apuesta en el HUD, LCD en la máquina, pantalla de resultado y «+/−» flotante.
  - Precios rebalanceados; reserva de seguridad (una compra nunca te deja sin poder apostar).
  - Las misiones se completan sin arriesgar MARKS (tirada de demostración gratuita cuando la historia la pide).
  - BANCA ROTA: animación, borrado del guardado y vuelta al menú principal.

## C. Pendiente (orden de trabajo)
1. **i18n** conectado a toda la interfaz y el mundo (en curso).
2. **Vercel + audio**: manifiesto estático `assets/audio/manifest.json` (+ script `npm run audio`), tolerar 404/HTML,
   `vercel.json`, guía de despliegue.
3. **Sonidos personalizables ampliados** (sistema `assets/audio/*.mp3`): pasos, ambiente (casino en juego y más flojo
   en menú), rodillos, botón de máquina (clic mecánico), aplausos, compras, puertas, música menú / juego / créditos del
   menú / créditos finales, barajar y repartir cartas, ruleta girando y bola, voz/«blip» de NPC, texto de diálogo
   apareciendo, etc. `SOUNDS.md` actualizado. + **voces de diálogo**: un mp3 por línea (`assets/audio/voice/<id>.mp3`),
   al avanzar se corta la anterior; documento `docs/DIALOGUE_AUDIO.md` con TODAS las líneas, personaje y nombre de archivo.
4. **Gráficos configurables MUY BAJO → ULTRA** (5 niveles reales: modelos LOD, sombras, partículas, resolución,
   reflejos, post-proceso…). ULTRA espectacular; MUY BAJO sin sombras y modelos simples.
5. **Casino mucho más grande desde el inicio y expandible hasta ser enorme** (sistema de parcelas/alas modular).
   Al empezar: sucio, algo deteriorado, SIN clientes; mejora con limpieza, reformas, decoración (visual + dinámico,
   coherente con la historia).
6. **Modelos 3D realistas** (estilo juego de Steam, dentro de lo posible con geometría procedural + materiales PBR +
   texturas generadas): arreglar solapes, máquina clásica rehecha, botón mucho más impresionante, mobiliario,
   NPCs humanos realistas. Quitar la columna delante del mostrador. Símbolos legibles (iluminación y orientación).
7. **NPCs**: ambientales (sentados en sillones, jugando máquinas/blackjack/ruleta que el jugador no puede usar,
   crupieres, empleado en el mostrador) con comportamiento realista (rutinas, caminar, sentarse, reaccionar);
   y los 10 NPCs con nombre del documento narrativo, cada uno con su zona y rutina.
8. **Diálogos y misiones** modulares (ver `NARRATIVE_DESIGN.md`): 12 principales, 6 secundarias, 6 de dominio,
   4 eventos; decisiones con variables y consecuencias; relaciones (DESCONOCIDO→AMISTAD); menú de misiones en pausa;
   guardado de todo; recompensas únicas; misiones espaciadas (no todas seguidas) para dar tiempo a jugar/ganar.
   Servicios por NPC con sentido realista: Daniel (técnico) = expansiones y reparaciones (cobra MARKS por obra),
   Sofia = decoración, Victoria presenta TODO al jugador, etc. Tienda-mostrador sustituida/integrada por estos NPCs.
9. ✅ (v1.4) **Economía con apuestas** (mín/máx, subir/bajar/repetir; perder, empatar o x2+), equilibrada con precios de
   obras/mejoras/decoración y con las recompensas de misiones (nada cuesta 50 si una misión da 100).
   Las misiones deben poder completarse sin gastar ni arriesgar MARKS (regla 12 del documento).
   BANCA ROTA (0 MARKS / no poder apostar): animación, borrado del guardado, volver al menú.
10. **Catálogo**: 8 máquinas (THE CLASSIC, NEON RUSH, GOLDEN EMPEROR, THE ABYSS, PHARAOH'S LEGACY, CHERRY BLOSSOM,
    COSMIC ODYSSEY, NIGHTMARE CARNIVAL), 3 blackjack (ROYAL BLACKJACK, DOUBLE DOWN, THE LAST HAND),
    3 ruletas (ROYAL ROULETTE, NEON ROULETTE, FORTUNE'S WHEEL); cada una con su 3D, mecánica, sonido, VFX, UI y
    habilidad especial. Salas: MAIN FLOOR / NEON LOUNGE / GOLDEN ROOM / UNDERGROUND / VIP HALL (distribución del catálogo).
11. **Compras visuales**: cámara viaja a lo comprado, aparece con animación + FX + screenshake + giro lento ~2 s.
12. **Interfaz profesional y más dopamina** (menos «elegante premium»): menús, HUD, avisos de interacción nuevos,
    puertas bloqueadas con requisitos claros (no la notificación fea), diálogo con retrato, etc.
13. **Objetivos claros siempre** (el juego aburre rápido sin meta) — lo cubre el sistema de misiones + guía.
14. **Final THE END**: puerta, pasillo oscuro, máquina THE END, créditos finales, teletransporte, solo la 1.ª vez;
    modular (`endingSeen` + `contentVersion`).
15. Tests, verificación en Chrome, documentación, `.zip`. Informe honesto de qué se verificó y qué no.

## D. Honestidad técnica (a comunicar al entregar)
- «Realista tipo Steam» con geometría procedural en un navegador tiene un techo: se logra un estilo cuidado
  (PBR, texturas generadas, siluetas detalladas), no fotogrametría. Si el usuario aporta modelos .glb, el sistema
  de assets debe poder cargarlos (previsto: `assets/models/`).
- Las voces las pone el usuario (mp3); el juego funciona sin ellas (texto + «blip» procedural).
