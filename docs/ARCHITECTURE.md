# HOUSE OF ODDS — Arquitectura

Este documento distingue lo que **ya existe** (Fase 1) de lo que está **diseñado pero pendiente** (marcado con su fase).

## 1. Principios

1. **Sin build.** ES modules nativos + import map. Se edita y se recarga; no hay bundler ni transpilado.
2. **Cero dependencias en tiempo de ejecución.** Three.js y fuentes viven en el repositorio (`vendor/`, `assets/fonts/`). Sin CDN, sin red.
3. **Módulos puros por defecto.** La lógica (estados, economía, azar, guardado) no importa Three.js ni toca el DOM → se prueba con Node.
4. **Guiado por datos.** Máquinas, zonas, mejoras y logros se describen en definiciones registradas; añadir contenido no obliga a tocar el núcleo.
5. **Geometría procedural.** Todo el escenario y las máquinas se construyen con primitivas de Three.js y texturas generadas en canvas.

## 2. Capas y reglas de dependencia

```
        main.js  (cablea; sin lógica)
           │
   ┌───────┼──────────────────────────────┐
   ▼       ▼                              ▼
  ui/    world/ · player/ · machines/    audio/ · save/
   │            │                         │
   └────────────┴──────────┬──────────────┘
                           ▼
              systems/ (economía, desbloqueos, logros)   ← puros
                           ▼
                        core/  ──►  config.js
```

Reglas (varias las comprueba `test/project-integrity.test.js`):

- `core/` **no** importa `ui/` ni `dev/`. *(comprobado)*
- Los módulos puros (`config`, `errors`, `game-states`, `event-bus`, `state-machine`, `rng`, `loop`) **no** importan `three` ni usan `document`. *(comprobado)*
- Los módulos se comunican por el **bus de eventos** o recibiendo `game` por parámetro; no hay estado global ni singletons.
- Ningún `fetch`/`WebSocket`/`XMLHttpRequest` en el código. *(comprobado)*
- Toda importación relativa lleva extensión `.js`. *(comprobado)*

## 3. Núcleo (implementado)

| Módulo | Responsabilidad |
|--------|-----------------|
| `config.js` | Constantes, paleta, vocabulario de economía, perfiles de calidad, ajustes por defecto, `resolveGraphics()` |
| `core/game.js` | Orquestador. Posee bus, máquina de estados, renderer, bucle, RNG y ajustes. Gestiona la escena activa |
| `core/state-machine.js` + `game-states.js` | Estados `boot → main_menu → exploring ⇄ interacting ⇄ paused`, con tabla de transiciones validada |
| `core/event-bus.js` | `on/once/off/emit`; un manejador que falla no rompe a los demás |
| `core/loop.js` | `requestAnimationFrame`, `dt` limitado a 0,1 s, FPS suavizados, se detiene y avisa si `update`/`render` lanzan |
| `core/renderer.js` | `WebGLRenderer`: tono ACES, sombras, tamaño, píxel ratio, pérdida/recuperación de contexto |
| `core/rng.js` | Azar con semilla (mulberry32): `int`, `chance`, `pick`, `weighted`, `shuffle`, `fork` |
| `core/errors.js` | `WebGLUnavailableError`, `InvalidTransitionError` |

**Controlador de escena** — contrato entre `Game` y cualquier escena (el casino de la Fase 3, el fondo del menú…):

```js
{ scene, camera, update(dt, time), onResize?(size), onGraphicsChanged?(settings), dispose?() }
```

**Eventos del bus implementados:** `state:change`, `renderer:resize`, `graphics:changed`, `renderer:contextlost`, `renderer:contextrestored`, `game:fatal`.

## 4. Economía y progresión (diseño, Fase 5)

Vocabulario fijado en `config.js → ECONOMY`:

- **MARKS** — moneda principal. Solo se gasta en desbloqueos y mejoras. Nunca se apuesta ni se pierde.
- **PRESTIGE** — progreso general del casino. Acumulativo, **no gastable**; condiciona qué zonas y contenidos pueden desbloquearse.
- **COLLECTION** — registro de máquinas, símbolos y efectos descubiertos.

**Regla de oro (invariante comprobable):** una activación de máquina devuelve `reward = base + bonus` con `base > 0` y `bonus ≥ 0`. El azar solo decide símbolos, efectos y `bonus`. No existe ninguna operación que reste MARKS por jugar. En la Fase 5 se añadirá una prueba que ejecute cientos de miles de activaciones con semilla y verifique `reward ≥ base > 0`.

## 5. Contratos de extensión (diseño, Fases 3–5)

**Máquina** (`src/machines/<id>.js`, registrada en `machines/registry.js` y descrita en `data/machines.js`):

```
id, name, zone, unlock{prestige, marks}
createModel(ctx)  → { object3D, interactionPoint, cameraPose, dispose() }
activate(ctx,rng) → { symbols[], base, bonus, effects[] }
```
`machine-base.js` aporta el ciclo (reposo → girando → resultado → reposo), el botón físico y la limpieza de recursos. **THE CLASSIC** es la primera; NEON RUSH, GOLDEN EMPEROR y THE ABYSS añaden un fichero y una línea en el registro.

**Zona** (`src/world/zones/<id>.js`, descrita en `data/zones.js`):

```
id, name, palette, unlock{prestige, marks}
build(ctx) → { group, colliders[], interactables[], lights[], dispose() }
```
MAIN FLOOR, NEON LOUNGE, GOLDEN ROOM, UNDERGROUND y VIP HALL comparten contrato y difieren en paleta, materiales y luces.

**Mejoras, objetivos y logros** son datos (`data/upgrades.js`, `data/achievements.js`) evaluados por `systems/`; no llevan código propio.

## 6. Guardado (diseño, Fase 7)

- Progreso en `houseofodds.save`; copia en `houseofodds.save.bak`; **ajustes en clave aparte** (`houseofodds.settings`) para que NUEVA PARTIDA borre el progreso sin tocar la configuración.
- Esquema con número de versión (`schema`) y cadena de migraciones `v1 → v2 → …`.
- Escritura segura: serializar → validar → guardar copia anterior en `.bak` → escribir. Al cargar: parsear → validar esquema → si falla, intentar la copia → si también falla, **no sobrescribir** y avisar.
- Si LocalStorage no está disponible (modo privado, bloqueado), el juego funciona en memoria y avisa de que no se guardará.

Esquema v1 previsto:

```
schema, savedAt, marks, prestige{points}, unlocked{zones[],machines[],upgrades[]},
machines{<id>:{activations,modifiers[],bestScore}}, collection{machines[],symbols[],effects[]},
objectives{completed[],progress{}}, achievements[], stats{playTimeSec,totalActivations}
```

## 7. Calidad y rendimiento

Tres perfiles (`config.js → QUALITY_PROFILES`). Los interruptores del usuario solo pueden **apagar** lo que el perfil permite (`resolveGraphics`).

| | low | medium | high |
|---|---|---|---|
| Píxel ratio máx. | 1 | 1,5 | 2 |
| Antialiasing | no | sí | sí |
| Sombras | no | 1024 px | 2048 px |
| Efectos (bloom, etc.; Fase 8) | no | no | sí |

Presupuesto de diseño: **como máximo 1–2 luces con sombra por zona**; el resto de luces, sin sombras; reflejos mediante mapa de entorno generado proceduralmente (no `Reflector`); geometría instanciada para repeticiones (lámparas, taburetes, ficha de suelo). `renderer.info` está visible en el overlay (F3) para vigilarlo desde la Fase 3.

## 8. Riesgos y límites conocidos

| Riesgo | Mitigación / estado |
|---|---|
| Calidad «Unreal/Unity» sin assets modelados | Imposible igualarla con geometría procedural pura. Se persigue un estilo **estilizado y atmosférico**: iluminación dramática, materiales emisivos, niebla, mapas de entorno, bloom en *high*, tipografía y UI cuidadas |
| Rendimiento en equipos modestos | Perfiles de calidad, `renderScale`, presupuesto de sombras, instanciado. Se medirá en la Fase 9 |
| Pointer Lock: ESC lo libera siempre y el navegador consume esa pulsación | El menú de pausa se abre por el evento `pointerlockchange`, no por `keydown` |
| Pointer Lock: algunos navegadores rechazan re-bloquear justo después de ESC | Si falla, mostrar «haz clic para continuar» (Fase 6; hay que verificarlo en cada navegador) |
| Audio: los navegadores bloquean el sonido hasta un gesto del usuario | Pantalla inicial «pulsa para entrar» antes del menú (Fase 2); la música arranca tras ese gesto |
| «Salir al menú del navegador»: una página no puede cerrarse sola | Intentar `window.close()`; si no, salir de pantalla completa y mostrar pantalla de despedida |
| `antialias` no cambia con el contexto ya creado | El overlay lo marca como «requiere reiniciar el renderizador»; la Fase 6 recreará el renderer |
| Cambiar `shadowMap.enabled` exige recompilar materiales | Cada escena lo hace en `onGraphicsChanged` (ya implementado en la de diagnóstico) |
| Three.js cambia de API entre versiones (p. ej. `PCFSoftShadowMap` retirado en r186) | Versión fijada en `vendor/three/VERSION`; no se actualiza sin repasar las notas de versión |
| LocalStorage ≈ 5 MB, puede estar desactivado | El guardado es pequeño (JSON) y tiene modo en memoria (§6) |

## 9. Alcance por versión

- **v1.0 (Fases 2–9):** menú principal completo; MAIN FLOOR ampliable en etapas; THE CLASSIC con modificadores y símbolo especial; MARKS / PRESTIGE / COLLECTION funcionales; mejoras de instalaciones, iluminación y decoración; objetivos y logros; pausa, ajustes y guardado; audio procedural; puertas a las demás zonas visibles pero bloqueadas.
- **v1.1:** NEON LOUNGE + NEON RUSH.
- **v1.2:** GOLDEN ROOM + GOLDEN EMPEROR.
- **v1.3:** UNDERGROUND + THE ABYSS.
- **v1.4:** VIP HALL.

## 10. Estructura de ficheros

Leyenda: ✅ existe · ⏳ fase en la que se crea.

```
house-of-odds/
├─ index.html                      ✅
├─ server.mjs · package.json       ✅
├─ README.md · docs/ARCHITECTURE.md ✅
├─ test/                           ✅  (node:test)
├─ vendor/three/                   ✅  three r187 (MIT)
├─ assets/
│  ├─ fonts/                       ✅  Cinzel · Cormorant Garamond (OFL)
│  ├─ favicon.svg                  ✅
│  ├─ audio/ · textures/           ⏳ 8 (el sonido y las texturas son procedurales; solo se añade lo que haga falta)
├─ styles/                         ✅  main · menus · hud
└─ src/
   ├─ main.js · app.js · config.js ✅  arranque · cableado y flujo de pantallas · configuración
   ├─ player.js · camera.js        ✅  primera persona + Pointer Lock · director de cámara
   ├─ core/        game · state-machine · game-states · event-bus · loop · renderer · rng · errors   ✅
   ├─ ui/          ui-kit · main-menu · pause-menu · settings-menu · hud · manager-panel · fatal-error · debug-overlay   ✅
   ├─ world/       world (MAIN FLOOR, Ala norte, colisiones, interactuables) · procedural-textures   ✅
   ├─ machines/    classic (THE CLASSIC 3D) · slot-logic (puro) · symbol-art   ✅
   ├─ data/        symbols · upgrades · progression (objetivos, logros, zonas)   ✅
   ├─ systems/     progress (MARKS/PRESTIGE/COLLECTION) · movement (colisiones e interacción, puro)   ✅
   ├─ save/        save-manager (checksum, copia de seguridad, migraciones)   ✅
   └─ audio/       audio-engine (SFX, música y ambiente procedurales)   ✅
```
