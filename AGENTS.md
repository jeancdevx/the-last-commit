# The Last Commit · instrucciones del repositorio

## Producto

Construye un juego web original de terror narrativo 3D en español. La historia comienza el 24 de diciembre de 2026 a las 23:52 en una oficina. El cierre anual trata como vacías las guardias que terminan después de medianoche. Al desaparecer un turno, desaparece su puesto. Tres adornos del árbol y la bitácora permiten reconstruir los registros. El jugador confirma la restauración y sale del edificio.

La primera entrega es la escena de 90–120 segundos del A-07. Completa el arco de tres folios y un final después de verificarla. Usa archivos y pruebas de este repositorio para completar el objetivo autorizado por el prompt.

## Fuentes de verdad

- `public/assets/story.es.json` contiene el guion, pistas, respuestas, ayudas y textos.
- `public/assets/scene.json` contiene instancias, escala, ejes, colisiones y nodos interactivos.
- `public/assets/audio/manifest.json` contiene el banco de sonido.
- `docs/diseno-e-integracion.md` fija el flujo, los estados, la dirección de arte y las condiciones de aceptación.
- `docs/herramientas-gemini.md` contiene configuraciones opcionales. Si no hay descubrimiento de skills, lee los `SKILL.md` incluidos en `.agents/skills/`.
- `docs/creditos-y-fuentes.md` identifica el origen y los avisos que se deben conservar.

## Arquitectura

- Astro con salida estática y TypeScript estricto. Usa Node 24 LTS o una versión compatible con la versión de Astro elegida. Guarda el lockfile.
- `@astrojs/preact` para una isla interactiva que monta el juego. Inicializa Three.js y Web Audio en el navegador. `client:only="preact"` sirve para una isla que depende del navegador. Incluye estado de carga y un aviso recuperable cuando WebGL 2 no está disponible.
- Usa `WebGLRenderer`, `GLTFLoader`, `PointerLockControls` y `Raycaster`. Da al bucle de render propiedad sobre la escena. La interfaz presenta el estado de juego y emite acciones. Evita que el estado de Preact se actualice en cada fotograma.
- Resuelve las rutas de `public/assets` usando la base de Astro. Las rutas de los manifiestos son relativas a `assets/`, excepto el manifiesto de audio, cuyos archivos son relativos a `assets/audio/`.
- Usa modelos GLB incluidos, luces de la escena, fuentes WOFF2 locales y archivos de audio incluidos. Portada, favicon y tarjeta social ya están listos.
- Guarda únicamente progreso, versión y ajustes locales. La consola corporativa, la bitácora y el commit son simulaciones de juego. La aplicación puede publicarse como contenido estático.
- Mantén el estado narrativo independiente del reloj real y del sistema de entrada. Las transiciones del panel, objetos, colisiones, audio y luces se derivan del mismo estado.

## Interacción y presentación

- Escritorio con teclado y ratón. WASD para caminar, E para interactuar, Esc para cerrar la vista actual o abrir pausa. El clic explícito activa audio y captura del puntero.
- Al abrir panel, pista o pausa, libera el puntero y desactiva el movimiento. Restaura el foco de forma previsible. Cuando se necesita recapturar el puntero, ofrece una acción explícita.
- Etiqueta cada control. Ofrece subtítulos, volumen, sensibilidad y movimiento reducido. Las pistas tienen texto HTML y se pueden releer. El reloj avanza por hitos y la lectura puede hacerse al propio ritmo.
- Usa el árbol ámbar y la oficina fría como contraste visual, con cambios de luz graduales. El verde de estado va acompañado de texto o icono. Emplea tipografías y colores del kit. La portada tiene el título como texto accesible.
- A-07 desaparece después de que el jugador lea el folio 07 y esté detrás del marco del pasillo en recepción. Cambian juntos objeto, colisión, luz y audio A-07. Mantén visible el rastro para el regreso.

## Entrega y comprobación

- Implementa y verifica mediante la ruta normal del usuario. Los GLB y el material de portada son parte del producto. `art-source/` es para editar y exportar.
- Prevé fases de inicio, investigación, confirmación, salida, pausa y reinicio. Evita estados donde el jugador no pueda continuar. Un intento incorrecto muestra una ayuda y conserva las pistas. Una partida guardada corrupta permite iniciar de nuevo.
- Define comandos reproducibles para `npm run dev`, `npm run check` y `npm run build`. Añade pruebas enfocadas en la progresión, ausencia A-07, restauración, final y guardado.
- Comprueba al menos el recorrido inicial en Chromium real con WebGL 2 y revisa consola, peticiones y errores de carga. Verifica rutas con una base de subdirectorio. Documenta por separado pruebas manuales, pruebas automatizadas y cualquier verificación pendiente.
- Conserva los recursos originales y sus avisos. Si añades algo externo, registra archivo, autor, ficha, licencia y cambios. Regenera el inventario si cambia un recurso.
