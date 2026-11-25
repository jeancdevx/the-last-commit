# Informe de entrega y comprobación · The Last Commit (Edición v2.0)

## Resumen de implementación

Se implementó el juego completo **The Last Commit** (hitos 1, 2, 3 y edición visual/sonora v2.0 inspirada en *The Last Deploy / halloween.dev*) como aplicación estática con **Astro 7.4.13**, **Preact 11.2.0**, **Three.js r187**, **Tailwind CSS v4.3.5** y **TypeScript estricto**, gestionada exclusivamente con **pnpm** (`pnpm-lock.yaml`).

- Los recursos originales de `The_Last_Commit_Kit/` se copiaron sin modificar la carpeta fuente y `The_Last_Commit_Kit/` quedó excluido en `.gitignore`.
- Se mantuvo la estructura de carpetas de Josh W. Comeau (`src/components/<Componente>/index.ts`, `src/helpers/*.helpers.ts`, `src/hooks/use-*.ts`, `src/constants.ts`, `src/types.ts`, `src/utils.ts`).
- Se instalaron las skills relevantes del ecosistema (`astro`, `tailwind-4-docs`, `threejs-gltf-loading`, `playwright-best-practices`) además de las del kit (`astro-game-shell`, `three-asset-integration`, `web-game-qa`).
- Se configuraron `oxfmt` (con `astro: true` y `sortTailwindcss` apuntando a `./src/styles/global.css`), `oxlint` (con `@stylistic/eslint-plugin`, `jsx-a11y`, `react`, `typescript`, `import`), `husky`, `lint-staged` y `commitlint` (`@commitlint/config-conventional`).

## Dirección artística, narrativa y técnica (Edición v2.0)

1. **Portada viva 3D y dirección editorial**:
   - Menú sin recuadros sobre la oficina 3D renderizada en tiempo real con deriva de cámara lenta y transición fluida hacia los ojos del personaje al pulsar «Jugar».
   - Tipografía editorial combinada: **Instrument Serif** (regular e itálica, `licenses/instrument-serif-OFL.txt`) + **Barlow Condensed** + **IBM Plex Mono** + **Inter**.
   - Selector de **Capítulos** (4 hitos desbloqueables), galería de **Logros** (10 logros con ilustraciones cuadradas originales y toast flotante) y **Créditos** estilo rodillo de cine con pausa manual y soporte para movimiento reducido.
2. **Escenario 3D enriquecido y post-procesado**:
   - Ventanales panorámicos nocturnos con panorama urbano de Nochebuena lluviosa (`public/assets/textures/city-night-panorama.jpg`) y shader GLSL de gotas y estelas refractivas en la pared este de oficina (detrás de A-07) y recepción (detrás del árbol).
   - Post-procesado con `AgXToneMapping`, `RoomEnvironment` PMREM, `UnrealBloomPass` (activo en GPU real; adaptado automáticamente en renderizado por software), grano fílmico, aberración cromática radial, viñeta dinámica y flash de tensión.
   - Monitor A-06 con `CanvasTexture` vivo, reloj digital 3D (`23:52 → 00:01`) sobre el arco del pasillo, pizarra de guardias, notas adhesivas, motas de polvo flotando, conos de luz volumétricos y chispa eléctrica intermitente sobre el cable cortado de A-07.
3. **Desaparición dramatizada de A-07**:
   - Al cerrar el adorno del folio 07 desde recepción (`playerZ <= -7.55`), se ejecuta una sola vez la purga sincronizada de `office-a07` (malla, collider AABB, luz y zumbido), acompañada de caída eléctrica (`power-dip.mp3`), susurro espacial (`whisper-a07.mp3`), chispa sobre `CABLE_STUB`, alerta automática en Correo y Chat `#planta-04` y desbloqueo del logro *Invalidación de caché*.
4. **Escritorio corporativo diegético en A-06 (`ConsolePanel`)**:
   - **Cierre anual**: los 3 folios (`07`, `19`, `26`), registro de pistas re-leíbles, validación con ayudas sin pérdida de evidencias, confirmación del commit y opción de emergencia `--force`.
   - **Correo**: 4 correos internos con notas de voz reales en español generadas con ElevenLabs (`voicemail-salas.mp3`, `voicemail-rojas.mp3`), filtro telefónico paso banda en Web Audio y transcripción accesible en HTML.
   - **Chat `#planta-04`**: hilo en vivo del bot de cierre y mensajes anómalos de I. Salas y M. Rojas según la fase.
   - **Terminal Git**: intérprete interactivo (`help`, `whoami`, `git status`, `git log`, `tail cierre.log`, `git commit --force`).
   - **Cámaras CCTV**: 3 cámaras 3D en directo con visión nocturna corregida a sRGB (`CAM-01`, `CAM-02`, `CAM-03`) y vista ampliada al pulsar.
5. **Múltiples finales y rejugabilidad**:
   - **Final I (Verdadero)**: restaurar los 3 folios, confirmar el commit y atravesar la puerta abierta (`00:01`).
   - **Final II (`--force`)**: forzar el cierre desde la Terminal Git o el botón de emergencia en A-06.
   - **Final III (`Sin registro`)**: insistir repetidamente en la puerta bloqueada tras la purga de A-07.
6. **Diseño sonoro DSP**:
   - `DynamicsCompressorNode` de masterización, `ConvolverNode` con respuesta al impulso procedural de oficina, lluvia procedural contra los ventanales, pad ambiental oscuro para título y créditos, dron sub-grave de tensión y audio espacial HRTF.

## Evidencias visuales (Chromium con WebGL 2)

| Evidencia | Archivo | Descripción |
|---|---|---|
| Menú editorial 3D | `evidence/title-live.png` | Portada viva sobre la oficina 3D iluminada con ventanal lluvioso, reloj digital `23:52`, Capítulos y Logros. |
| Antes del evento A-07 | `evidence/a07-before.png` | Vista inicial (`23:52`): puesto A-07 encendido frente al ventanal nocturno con lluvia en GLSL, árbol tenue al fondo y subtítulo `[Ventilación de la oficina]`. |
| Después del evento A-07 | `evidence/a07-after.png` | Regreso tras leer folio 07 (`23:54`): A-07 purgado, rastro y cable con chispa eléctrica, toast de logro *Invalidación de caché* y aviso de alerta en A-06. |
| Correo corporativo | `evidence/console-mail.png` | Escritorio OS de A-06 mostrando la bandeja de entrada, correo de I. Salas, botón de nota de voz ElevenLabs y transcripción accesible. |
| Circuito cerrado CCTV | `evidence/console-cctv.png` | Vista de las 3 cámaras 3D en visión nocturna (`CAM-01`, `CAM-02`, `CAM-03`) con anomalía en A-07 y logro *Ojo en el circuito*. |
| Epílogo VHS/OSD | `evidence/ending.png` | Final I (`00:01`) tras restaurar los 3 folios, confirmar, recargar y salir por la puerta abierta, con sello OSD, marca `00:01` y logro *La oficina te recuerda*. |
| Galería de logros | `evidence/achievements.png` | Matriz 5×2 de logros (`8 / 10` desbloqueados tras el recorrido), arte cuadrado personalizado, logro secreto oculto y contador de finales/capítulos. |

## Comandos ejecutados y resultados

### Integridad del kit y calidad de código

- `python3 tooling/verify-kit.py` → **OK**: `Kit válido: 9 GLB, 10 instancias, 3 puzles, 6 pistas, 10 audios, 60 archivos públicos.`
- `pnpm format` (`oxfmt --write .`) → **OK**: 59 archivos formateados (incluyendo `.astro` y clases Tailwind CSS ordenadas).
- `pnpm lint` (`oxlint`) → **OK**: `0 warnings and 0 errors` en 53 archivos (142 reglas).
- `ASTRO_TELEMETRY_DISABLED=1 pnpm check` (`astro check && tsc --noEmit`) → **OK**: `0 errors, 0 warnings, 0 hints` en 55 archivos.

### Compilación estática y rutas base

- `ASTRO_TELEMETRY_DISABLED=1 pnpm build` → **OK**: 2 páginas estáticas (`/index.html`, `/diagnostico/index.html`) en `2.24s`.
- `ASTRO_TELEMETRY_DISABLED=1 pnpm build:subpath` (`ASTRO_BASE=/tlc/`) → **OK**: rutas bajo `/tlc/assets/...` verificadas.
- Tamaño total en disco de `dist/`: `8.1 MB` sin comprimir (incluyendo 9 GLB, 14 pistas de audio con las voces ElevenLabs, panorama nocturno y arte de logros).

### Pruebas automatizadas

- **Unitarias (`pnpm test` · Vitest)**: **18 / 18 pruebas aprobadas** en 4 suites:
  - `tests/unit/state.test.ts` (6 pruebas): estado inicial, puerta de desaparición A-07 fuera de vista e idempotencia, bloqueos, ayudas tras error, rechazo de duplicados/commit anticipado y arco completo de 3 folios.
  - `tests/unit/storage.test.ts` (3 pruebas): guardado/carga con commit confirmado, recuperación de JSON corrupto/manipulado y persistencia de ajustes.
  - `tests/unit/collision.test.ts` (3 pruebas): retirada del collider A-07, pasillo transitable y apertura del collider de salida.
  - `tests/unit/os.test.ts` (6 pruebas): comandos de Terminal Git (`help`, `git status`, `tail cierre.log`, `git commit --force`), visibilidad dinámica de correos/chat anómalos y registro de 10 logros y 4 capítulos.
- **E2E en navegador real (`ASTRO_TELEMETRY_DISABLED=1 pnpm test:e2e` · Playwright + Chromium headless con WebGL 2 SwiftShader)**: **2 / 2 suites aprobadas**:
  - Suite 1 (Hitos 1, 2 y v2.0): portada viva 3D, carga de 9 GLB y 10 instancias, `a07-before.png`, movimiento `KeyW`, consola A-06, lectura de folio 07 y borrado único de A-07, regreso y `a07-after.png`, bitácora (folios 07 y 19), respuesta errónea con ayuda, apps de Correo (nota de voz + transcripción), Chat `#planta-04`, Terminal Git (`git status`), 3 cámaras CCTV (`console-cctv.png`), restauración de los 3 folios, commit, recarga y reanudación con puerta abierta, epílogo (`ending.png`), galería de Logros (`achievements.png`) y Capítulos desbloqueados. **0 errores de consola, 0 errores de página y 0 peticiones HTTP fallidas.**
  - Suite 2 (Hito 3): recuperación de partida corrupta, aviso recuperable ante fallo WebGL 2 (`/?forceWebglError=1`), control de silencio, `Esc` anidado (`Ajustes → Pausa → Juego`) y verificación completa de `/diagnostico/`. **0 peticiones fallidas.**

## Pruebas manuales y verificaciones pendientes

- **Entorno probado**: Linux x86_64, Node `v26.10.0`, pnpm `10.33.2`, Chromium de Playwright en modo headless con ANGLE/SwiftShader (renderizado WebGL 2 por software).
- **Pendiente en hardware físico de escritorio con pantalla y altavoces**:
  - Validación táctil de **Pointer Lock** con ratón físico y ajuste de sensibilidad.
  - Escucha física del audio espacial HRTF, la lluvia procedural y las notas de voz de I. Salas y M. Rojas con auriculares.
  - Medición de FPS reales (`60 fps` objetivo) con `UnrealBloomPass` y sombras suaves activas en GPU dedicada e integrada.
