# Informe de entrega y comprobación · The Last Commit

## Resumen de implementación

Se implementó el juego completo **The Last Commit** (hitos 1, 2 y 3) como aplicación estática con **Astro 7.4.13**, **Preact 11.2.0**, **Three.js r187**, **Tailwind CSS v4.3.5** y **TypeScript estricto**, gestionada exclusivamente con **pnpm** (`pnpm-lock.yaml`).

- Los recursos originales de `The_Last_Commit_Kit/` se copiaron sin modificar la carpeta fuente y `The_Last_Commit_Kit/` quedó excluido en `.gitignore`.
- Se integró la estructura de carpetas recomendada por Josh W. Comeau (`src/components/<Componente>/index.ts`, `src/helpers/*.helpers.ts`, `src/hooks/use-*.ts`, `src/constants.ts`, `src/types.ts`, `src/utils.ts`).
- Se instalaron las skills relevantes del ecosistema (`astro`, `tailwind-4-docs`, `threejs-gltf-loading`, `playwright-best-practices`) además de las del kit (`astro-game-shell`, `three-asset-integration`, `web-game-qa`).
- Se configuraron `oxfmt` (con `astro: true` y `sortTailwindcss` apuntando a `./src/styles/global.css`), `oxlint` (con `@stylistic/eslint-plugin`, `jsx-a11y`, `react`, `typescript`, `import`), `husky`, `lint-staged` y `commitlint` (`@commitlint/config-conventional`).

## Decisiones de implementación

1. **Propiedad del bucle de render y rendimiento**: `SceneEngine` (`src/helpers/scene.helpers.ts`) controla `WebGLRenderer`, `GLTFLoader`, `PointerLockControls`, `Raycaster`, iluminación y colisiones XZ. Preact solo recibe actualizaciones de UI cuando cambia el objeto apuntado, el estado narrativo o un diálogo (sin renders por fotograma).
2. **Desaparición A-07 determinista y fuera de campo de visión**: Al cerrar la lectura de `tag_07`, `evaluateA07Disappearance` comprueba `panelRead`, `tag_07` y `playerZ <= -7.55` (`scene.json`). Oculta el grupo `office-a07`, retira su collider AABB, apaga su luz de escritorio, corta `fluorescent-a07.wav` y activa `absence-a07` (`FLOOR_TRACE` y `CABLE_STUB`) exactamente una vez. Al regresar hacia la oficina, la comprobación de visibilidad activa `a07_absence_seen` y muestra «La lámpara estaba encendida hace un momento.».
3. **Semántica accesible y Escape anidado**: Todos los diálogos usan `<dialog open aria-modal="true">` y los avisos en vivo usan `<output aria-live="polite">`. La sincronización síncrona de referencias (`setOverlaySync`, `setPhaseSync`) garantiza el cierre anidado de `Esc` (`Ajustes → Pausa → Juego`) y la restauración previsible del foco.
4. **Control alternativo y accesibilidad**: Además de Pointer Lock + ratón + `WASD` + `E`, se admite giro con `ArrowLeft`/`ArrowRight` cuando el puntero no está capturado, junto con botón explícito de recaptura de puntero, subtítulos de eventos sonoros, silencio completo y modo de movimiento reducido.
5. **Iluminación fiel al manifiesto**: Se utilizan las fuentes definidas en `scene.json` (`HemisphereLight`, 3 `PointLight` fríos en techo, `PointLight` ámbar en el árbol y `PointLight` cálido en A-07) con interpolación suave de `BULBS_07`, `BULBS_19`, `BULBS_26` y apertura progresiva de `DOOR_PIVOT`.
6. **Servidor de vista previa en Playwright**: En Astro 7, `astro preview` inicia un proceso en segundo plano y retorna de inmediato; por ello `playwright.config.ts` sirve `dist/` en primer plano con `pnpm exec vite preview --outDir dist --host 127.0.0.1 --port 4321 --strictPort`.

## Evidencias visuales (Chromium con WebGL 2)

| Evidencia | Archivo | Descripción |
|---|---|---|
| Antes del evento A-07 | `evidence/a07-before.png` | Vista inicial (`23:52`): puesto A-07 visible con lámpara encendida y taza ocre, árbol tenue al fondo del pasillo, subtítulo `[Ventilación de la oficina]`. |
| Después del evento A-07 | `evidence/a07-after.png` | Regreso tras leer folio 07 en recepción (`23:54`): puesto A-07 y su luz desaparecidos, `FLOOR_TRACE` y `CABLE_STUB` visibles, árbol iluminado, aviso «La lámpara estaba encendida hace un momento.» y subtítulo `[Se apaga el fluorescente del A-07]`. |
| Epílogo final | `evidence/ending.png` | Tras restaurar los 3 folios, confirmar el commit, recargar la partida y usar la salida (`00:01`): «La oficina ya sabe que estuviste aquí.» / «Tres guardias de Nochebuena conservadas.». |

## Comandos ejecutados y resultados

### Integridad del kit y calidad de código

- `python3 tooling/verify-kit.py` → **OK**: `9 GLB, 10 instancias, 3 puzles, 6 pistas, 10 audios, 49 archivos públicos.`
- `pnpm format` / `pnpm format:check` (`oxfmt`) → **OK**: 49 archivos formateados (incluyendo `.astro` y clases Tailwind CSS ordenadas).
- `pnpm lint` (`oxlint`) → **OK**: `0 warnings and 0 errors` en 43 archivos (142 reglas).
- `ASTRO_TELEMETRY_DISABLED=1 pnpm check` (`astro check && tsc --noEmit`) → **OK**: `0 errors, 0 warnings, 0 hints` en 45 archivos.
- `printf "feat: implement the last commit game\n" | pnpm exec commitlint` → **OK** (exit code 0).

### Compilación estática y rutas base

- `ASTRO_TELEMETRY_DISABLED=1 pnpm build` → **OK**: 2 páginas estáticas (`/index.html`, `/diagnostico/index.html`) en `2.34s`.
- `ASTRO_TELEMETRY_DISABLED=1 pnpm build:subpath` (`ASTRO_BASE=/tlc/`) → **OK**: verificado en `dist/index.html` que `theme.css`, `social-1200x630.jpg` y favicons resuelven bajo `/tlc/assets/...`.
- Tamaño total en disco de `dist/`: `6.7 MB` en `dist/assets` + `788 KB` de código/HTML (`~7.5 MB` total sin comprimir, por debajo de la meta de `8 MB` en caché fría).

### Pruebas automatizadas

- **Unitarias (`pnpm test` · Vitest)**: **12 / 12 pruebas aprobadas** en 3 suites:
  - `tests/unit/state.test.ts` (6 pruebas): estado inicial, puerta de desaparición A-07 fuera de vista e idempotencia, bloqueo sin pistas ni observación de ausencia, pista de ayuda tras respuesta incorrecta conservando evidencias, rechazo de restauración duplicada y commit/salida anticipados, y arco completo de 3 folios hasta el epílogo.
  - `tests/unit/storage.test.ts` (3 pruebas): guardado/carga de partida con commit confirmado, detección y recuperación de JSON corrupto, versión inválida, pistas desconocidas o estados manipulados, y persistencia con límites de ajustes.
  - `tests/unit/collision.test.ts` (3 pruebas): retirada del collider A-07 al desaparecer, recorrido libre oficina → pasillo → recepción y liberación del collider de la puerta de salida tras confirmar commit.
- **E2E en navegador real (`ASTRO_TELEMETRY_DISABLED=1 pnpm test:e2e` · Playwright + Chromium headless con WebGL 2 SwiftShader)**: **2 / 2 suites aprobadas**:
  - Suite 1 (Hitos 1 y 2): portada española y `cover.webp`, carga de 9 GLB y 10 instancias en WebGL 2, captura `a07-before.png`, movimiento real por teclado (`KeyW`), consola A-06 y motivo del árbol, lectura de folio 07 y borrado único de A-07, regreso y captura `a07-after.png`, bitácora (folios 07 y 19), respuesta errónea con ayuda, restauración de los 3 folios (A-07, B-02, A-06), confirmación del commit, recarga de página y reanudación con puerta abierta, salida y captura `ending.png`. **0 errores de consola, 0 errores de página y 0 peticiones HTTP fallidas.**
  - Suite 2 (Hito 3): recuperación de partida guardada corrupta, aviso recuperable ante fallo de WebGL 2 (`/?forceWebglError=1`), control de silencio de audio, cierre `Esc` anidado (`Ajustes → Pausa → Juego`) y carga completa de `/diagnostico/`. **0 peticiones fallidas.**

## Pruebas manuales y verificaciones pendientes

- **Entorno probado**: Linux x86_64, Node `v26.10.0`, pnpm `10.33.2`, Chromium de Playwright en modo headless con ANGLE/SwiftShader (renderizado WebGL 2 por software).
- **Pendiente en hardware físico de escritorio con pantalla y altavoces**:
  - Validación táctil/subjetiva de **Pointer Lock** con ratón físico y ajuste fino de sensibilidad.
  - Escucha física del audio espacial HRTF (`fluorescent-a07.wav` al alejarse por el pasillo y `tree-motif.mp3` desde recepción).
  - Medición de FPS reales (`60 fps` objetivo) en GPU dedicada y portátil con gráfica integrada, dado que las pruebas E2E se ejecutaron sobre SwiftShader por software.
