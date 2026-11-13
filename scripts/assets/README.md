# Herramientas de assets (no se usan en tiempo de ejecución)

Scripts de Node para preparar modelos. Necesitan `@gltf-transform/core`, `@gltf-transform/functions`,
`@gltf-transform/extensions`, `meshoptimizer`, `sharp` y `fbx2gltf` (instálalos en una carpeta aparte).

| Script | Uso |
|---|---|
| `build-avatar.mjs <dirFBX> <nombre> <salida.glb> [tex]` | Avatar Rocketbox (FBX + TGA) → GLB. Accesorios (equipo, herramientas, gafas) con su textura. `DROP=helmet,opacity` quita piezas (p. ej. el casco y la visera de Daniel). |
| `build-anims.mjs <dirFBX> <salida.glb> nombre=archivo[:inplace]…` | Une animaciones Rocketbox en un GLB de clips. |
| `opt-prop.mjs <entrada> <salida.glb> [tex] [simplificar]` | Mueble/atrezo glTF → GLB ligero (texturas WebP, geometría soldada y simplificada). |
| `squeeze.mjs <archivos.glb…>` | Compresión final para la web: geometría y animaciones con EXT_meshopt_compression y texturas WebP. |

El juego carga todo con `src/gfx/gltf.js` (GLTFLoader + MeshoptDecoder de `vendor/three/addons/libs`).

## Modelos propios (Blender) — `scripts/models/`

Modelados a mano por código con Blender (`pip install bpy`, Python 3.13). Cada script genera su GLB en
`assets/models/`; después se comprimen con `squeeze.mjs`.

| Script | Modelo |
|---|---|
| `classic.py` | THE CLASSIC: mueble completo con tapa de mantenimiento abatible (nodo `ServiceDoor`), seta `ResetButton`, piloto `StatusLED`, pulsador `SpinButton` y planos `Screen`/`BetScreen`/`SpinPlate` para las pantallas. |
| `slot.py` | Tragaperras de sala «LUCKY 7» (la usan los clientes). Material `paint`: el juego la pinta de verde, rojo o azul. |
| `slot_sheet.py` | Funda antipolvo con simulación de tela real sobre la forma de la máquina. |
| `furniture.py` | Taburete (respaldo opcional), mesas de blackjack y ruleta, banco capitoné, lámpara de pie, pedestal y la escultura dorada (esfera armilar). `ONLY=stool` genera solo uno. |
| `textures.py` | Texturas pintadas por código (placa electrónica, rejilla, esquema eléctrico, tiras de rodillo, cristales). |
| `lib.py` | Utilidades: cajas biseladas, tornos, extrusiones, molduras barridas, tubos, texto 3D, booleanas y exportación. |

Los nombres de material del GLB son claves (`gold`, `brass`, `lacquer`, `seat`, `felt`…): el juego los sustituye por
sus materiales (`src/world/props/models.js`), así encajan con la luz, la suciedad y la calidad gráfica de la sala.

## Rótulos de neón — `scripts/fonts/neon-font.py`

Aplana los contornos de Cinzel en `assets/fonts/cinzel-neon.json`; `src/world/neon.js` construye con ellos las letras
de canal y los tubos de neón 3D.

## Arquitectura, cuadros y pantalla de carga

- `scripts/models/architecture.py` → pilaster, door_frame_22/40, door_leaves_22/40, pendant, counter, reception,
  wheel, bucket, wetsign (`ONLY=<función>` para una sola). Después `squeeze.mjs`.
- `scripts/art/paintings.py assets/art` → los seis cuadros (WebP 1024×1360).
- `scripts/models/keyart.py assets/ui/keyart.png 1920 64` → render Cycles de la pantalla de carga; convertir a
  `assets/ui/keyart.webp`.
- Atrezo simplificado: `lod.mjs` (gltf-transform + meshoptimizer) por malla con un tope de triángulos.
