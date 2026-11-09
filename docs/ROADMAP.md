# ROADMAP — requisitos pendientes (recogidos del encargo)

## Decisión de diseño pendiente (contradice v1.0)
En v1.0 **ninguna máquina resta MARKS** (regla original). El encargo nuevo pide «BANCA ROTA»: quedarse sin MARKS suficientes para «apostar» borra la partida.
Esto exige **apuestas con MARKS** (ficticias) en máquinas, blackjack y ruleta, y cambia la economía: hay que decidir apuesta mínima, qué pasa con el progreso (¿se borra todo?), y garantizar que no sea inevitable perder (p. ej. el jugador nunca queda sin forma de ganar MARKS salvo que apueste mal). Hasta confirmarlo, v1.0 no implementa bancarrota.

## Orden propuesto (cada paso entregable y probado)
1. **i18n (6 idiomas)**: EN, ES, DE, FR, PT, ZH-CN. Detectar `navigator.languages`; si no es uno de los 6 → EN; guardar en LocalStorage y mantener hasta cambio manual en Ajustes. Todo texto del juego sale de `src/i18n/<lang>.js` mediante `t(key, params)`; añadir test que exija que los 6 idiomas tengan las mismas claves. Los textos de datos (mejoras, objetivos, logros, símbolos, zonas) pasan a claves. Para ZH-CN hace falta una fuente con glifos CJK (no incluida; la fuente del sistema o un subconjunto OFL).
2. **Créditos animados**: texto con distintos colores/tamaños que baja; botón superior para volver; al terminar vuelve al menú. Contenido en la sección «Créditos» del encargo (traducible salvo nombres).
3. **Catálogo** (8 máquinas, 3 blackjack, 3 ruletas; ver `docs/CATALOG.md` si se añade): cada una con modelo 3D, sonidos, efectos y mecánica propios; se desbloquean con MARKS; distribución por salas (MAIN FLOOR, NEON LOUNGE, GOLDEN ROOM, UNDERGROUND, VIP HALL). Registro de máquinas (`machines/registry.js`) para añadir nuevas sin tocar el núcleo.
4. **Salas** NEON LOUNGE, GOLDEN ROOM, UNDERGROUND, VIP HALL con interior y sus puertas.
5. **Final del juego («THE END»)**: al completar objetivos, compras y desbloqueos *existentes*, aparece una puerta marcada; tras ella un pasillo oscuro y la máquina THE END; al usarla, créditos finales; después vuelta al casino y la puerta desaparece. Guardar `endingSeen` + `contentVersion`: si una actualización añade contenido, se vuelve a poder progresar, y **el final no se repite** (solo la primera vez).
6. **Bancarrota** (según la decisión de arriba).
