# HOUSE OF ODDS

Casino arcade 3D para navegador (HTML5 + CSS3 + JavaScript moderno + Three.js + WebGL + Web Audio + LocalStorage). Sin backend.

**Versión 1.1.** Interfaz en español (más idiomas en la hoja de ruta).

## Ejecutar

Requisitos: un navegador moderno con WebGL 2 y [Node.js](https://nodejs.org) 18 o superior (solo para el servidor local y las pruebas).

```bash
node server.mjs          # http://127.0.0.1:8080  (si está ocupado, prueba 8081, 8082…)
node server.mjs 3000     # puerto concreto
```

Abre la dirección que imprime. **No abras `index.html` con doble clic** (`file://`): los módulos ES exigen un servidor.
No hace falta `npm install`: Three.js y las tipografías están en `vendor/` y `assets/fonts/`. Funciona sin conexión.

## Cómo se juega

| Control | Acción |
|---|---|
| Clic | Capturar el ratón (si el navegador lo libera, aparece «HAZ CLIC PARA CONTINUAR») |
| W A S D / flechas | Moverse |
| Mayús | Correr |
| Ratón | Mirar |
| E | Interactuar (máquina, mostrador, puertas) |
| Espacio / E / clic | Activar la máquina (dentro de ella) |
| Q | Salir de la máquina |
| ESC | Pausa; cierra paneles |
| F3 / F4 | Diagnóstico / cambiar calidad (con el overlay visible) |

- **MARKS**: moneda para comprar mejoras en el **mostrador** (esquina norte izquierda). **PRESTIGE**: progreso general del casino (no se gasta; desbloquea mejoras). **COLECCIÓN**: símbolos y efectos descubiertos.
- Cada activación de THE CLASSIC da `base + bonus` MARKS (base siempre > 0). El azar solo decide símbolos, efectos y bonus.
- Hay mejoras del casino (iluminación, alfombra, estatua, lámpara, ampliar sala, caja registradora, cámara acorazada) y de la máquina (rodillos dorados, giro rápido, destellos, comodín estelar, sinergia real, campana de la suerte), objetivos y logros.
- Guardado automático en LocalStorage (con copia de seguridad). Los ajustes se guardan aparte: NUEVA PARTIDA no los borra.

## Sonidos propios (.mp3)

Coloca archivos en `assets/audio/` con los nombres de `assets/audio/SOUNDS.md` (p. ej. `jackpot.mp3`, `music.mp3`). Si el archivo existe, el juego lo usa; si no, suena el sonido procedural integrado. Recarga con Ctrl+F5.

## Qué incluye y qué no

Incluido: arquitectura, menú principal, casino 3D en primera persona (MAIN FLOOR + Ala norte desbloqueable), THE CLASSIC, MARKS/PRESTIGE/COLLECTION, pausa, ajustes (gráficos, audio, controles), guardado, sonido y música procedurales, efectos (focos, destellos, polvo, partículas), pruebas.

**No incluido todavía** (ver [`docs/ROADMAP.md`](docs/ROADMAP.md)): el resto de máquinas, blackjack y ruleta, las salas NEON LOUNGE / GOLDEN ROOM / UNDERGROUND / VIP HALL (sus puertas están cerradas), varios idiomas, final del juego y bancarrota.

## Pruebas

```bash
npm test        # o: node --test
```

Cubren lógica de juego (recompensas, invariante «nunca se pierde MARKS» en 300 000 activaciones), progreso, guardado (checksum, copia, migraciones), movimiento y colisiones, estados, bucle, servidor e integridad del proyecto.
El renderizado y el flujo de pantallas se comprobaron en Chrome (render por software). **El rendimiento en GPU real, Firefox y Safari no se ha medido.**

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura y contratos de extensión.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — requisitos pendientes y orden propuesto.

## Licencias de terceros

- Three.js (MIT) — `vendor/three/LICENSE`
- Cinzel y Cormorant Garamond (SIL OFL 1.1) — `assets/fonts/LICENSE-*.txt`
