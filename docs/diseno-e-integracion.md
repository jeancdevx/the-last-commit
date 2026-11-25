# Diseño e integración

## Alcance y tono

Terror narrativo 3D en primera persona. Una oficina conocida sufre un cambio imposible. La decoración navideña hecha a mano conserva la evidencia física que falta en la consola. Luz fría en la oficina, luz ámbar en el árbol, habitaciones cotidianas y cambios breves de sonido. El personaje está solo. La preparación visual se basa en objetos cotidianos que se reconocen al volver a pasar.

**Inicio** · 24/12/2026, 23:52.  
**Recorrido** · A-06 / A-07 → pasillo → recepción con árbol y bitácora → salida.  
**Duración prevista** · Prueba de 90–120 segundos y partida completa de 12–15 minutos.  
**Objetivo narrativo** · Restaurar los tres turnos que el cierre interpreta como vacíos, confirmar la bitácora y salir.

## Integración de los GLB

El eje Y es vertical, el piso está en Y=0 y moverse desde la oficina hacia recepción reduce Z. Las dimensiones están en metros. El mapa y los colliders están en `assets/scene.json`. Carga una vez cada modelo y clónalo por instancia. Los materiales cuyo estado se modifica deben tener copias por instancia. Ocultar la mesa significa ocultar el grupo completo y retirar su collider. Nunca mutar el GLB compartido.

| Asset o instancia | Nodos y comportamiento |
|---|---|
| `floor-shell.glb` | Piso, muros, techos, cristales esmerilados, luces de utilería y marcos. Usa los AABB del manifiesto. Las fuentes reales se crean desde `lighting` en el runtime. |
| `workstation.glb` | Reutilizado en A-06, A-07 y B-02. `SCREEN_SURFACE` abre el panel únicamente en A-06. `NOTE_CURRENT` es pista únicamente en A-06. Oculta su mesh en A-07 y B-02. `LAMP_EMITTER` y `MUG` son referencias de luz y utilería. La taza ocre es la referencia visual en A-07. Deja la taza solo en A-07 si quieres distinguir el puesto. |
| `absence.glb` | `FLOOR_TRACE` y `CABLE_STUB` quedan tras borrar A-07. Se desactivan al restaurarlo. |
| `guard-tree.glb` | `ANCHOR_TAG_07`, `ANCHOR_TAG_19`, `ANCHOR_TAG_26` son nodos vacíos. Adjunta cada adorno al ancla correspondiente con posición local cero. `BULBS_07`, `BULBS_19` y `BULBS_26` son objetos con materiales separados. Apaga o atenúa el emisivo mientras la pista esté inactiva. |
| `tag-07.glb`, `tag-19.glb`, `tag-26.glb` | `TAG_FACE_07`, `TAG_FACE_19`, `TAG_FACE_26`. Al mirar cerca del adorno habilitado, muestra «E · Inspeccionar». El texto y la textura de la vista de lectura se encuentran en `story.es.json`. |
| `reception.glb` | `LEDGER_OPEN`. La UI permite leer ambas páginas y guardar cada folio individualmente como evidencia. |
| `exit.glb` | `DOOR_PIVOT` es un nodo vacío que gira la hoja, la barra y el pestillo. Detecta interacción en `DOOR_LEAF` y `PUSH_BAR` o con un volumen cerca de la puerta. Mantén un AABB de la hoja cerrada hasta confirmar. Usa la salida de forma explícita para cerrar la partida. |

Incluye colliders de los puestos visibles y del árbol. Amplía los AABB con el radio del jugador. Limita el movimiento a la unión de las tres zonas y a la salida interactiva. En XZ, conserva el ancho de los marcos al calcular el paso. Respeta una distancia de interacción de 2,25 m y descarta objetos ocultos o tras muros. El orden de prioridad de raycast es objeto interactivo visible y más cercano antes de cualquier ayuda contextual.

## Flujo de estado

1. **Inicio.** A-06 y A-07 están visibles. B-02 todavía no figura. Árbol tenue. Salida cerrada.
2. **Panel leído.** El panel muestra «A-07 · Puesto vacío. Cierre iniciado.» y activa el primer grupo de luces del árbol. El motivo viene desde recepción.
3. **Primer adorno.** Al cerrar la lectura del folio 07, aplica el borrado A-07 una vez cuando el jugador esté en recepción al otro lado del marco. Es requisito para resolver el caso volver lo suficiente para ver la ausencia. El rastro queda y la fuente posicional se corta. La ventilación general permanece.
4. **Folio 07.** El panel habilita la primera pregunta al conocer el adorno y esa página de la bitácora. Con la fecha correcta se recupera A-07. Se vuelve visible el folio 19.
5. **Folio 19.** La segunda pregunta exige comparar folio y hora. Con la fila correcta aparece B-02. Se activa el folio 26 del árbol.
6. **Folio 26.** El jugador combina adorno y nota de A-06. Con el turno correcto se habilita la confirmación. El panel deja ver los tres turnos restaurados.
7. **Commit y salida.** Tras confirmación, suena el pestillo y abre la puerta. Interactuar con la salida muestra el epílogo. Reanudar después de confirmar conserva la puerta abierta.

La posición del avatar puede restablecerse a un punto seguro al reanudar. Conserva pistas, etapa, folios restaurados y la confirmación. Los hitos se derivan del estado. Leer una pista de nuevo es idempotente. El reloj se muestra como texto narrativo y su avance no bloquea al jugador por demora real.

## Interfaz

| Vista | Contenido |
|---|---|
| Menú | Nombre, frase de entrada, Jugar, Continuar cuando aplique, Ajustes, Créditos. Portada en `art/cover.webp`. |
| Juego | Retícula discreta, indicación contextual, subtítulos opcionales y únicamente las ayudas necesarias. |
| Panel | Reloj, estado de los casos, selección y rechazo de una opción, registro de pistas y confirmación. Los mensajes visibles vienen del JSON. |
| Lectura | Título y texto accesible. Vista visual de la etiqueta o página, acción para cerrar y conservar la evidencia. |
| Pausa y ajustes | Reanudar, sensibilidad, volumen, subtítulos y movimiento reducido. |
| Epílogo | Líneas de cierre y acción de volver al menú. La escena final puede usar el plano del pasillo con las luces recuperadas. |

Branding local en `assets/branding/theme.css`. Paleta oscura en UI, texto crema, estados verdes con etiquetas y señales ámbar. Utiliza la marca PNG para material editorial y texto disponible para tecnologías de asistencia. Pon el sonido en segundo plano en las vistas de lectura. Los dos bucles WAV permiten cortes limpios y los MP3 son efectos cortos.

## Metas de la primera versión

- Inicio interactivo, resolución de los tres casos y final mediante el flujo de usuario.
- Pistas resolubles con sonido silenciado y opción de bajar movimiento. Orientación comprobada con jugadores.
- Verifica carga en Chromium con WebGL 2, manejo de bloqueo del puntero y recuperación de una pestaña en segundo plano.
- Meta inicial de menos de 8 MB transferidos para la primera escena. Mide con caché fría. Apunta a 60 fps en el equipo de referencia y mide por separado en un portátil con gráfica integrada.
- El nodo de cámara no se mueve mientras están abiertos el panel o una pista. Al continuar, el jugador recupera el control mediante una acción explícita cuando haga falta.
- Validar dependencias, versiones, URLs con base y empacado estático antes de publicar. No hacen falta cuentas ni servicios de datos para esos flujos.

## Planos y fuentes

`art/scene-preview.png` es un render de la escena editable real en `art-source/floor-04.blend`. `art/cover.webp` corresponde al arte de portada. Ver `docs/creditos-y-fuentes.md` para procedencia y `README.md` para regenerar archivos.
