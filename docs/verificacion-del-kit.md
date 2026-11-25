# Verificación del kit

| Control | Resultado |
|---|---|
| Integridad | `python3 tooling/verify-kit.py` verificó hashes y contratos de 9 GLB, 10 instancias, 3 puzles, 6 pistas y 10 audios. |
| GLB | Khronos glTF Validator verificó los 9 archivos binarios. Resultado de cada archivo: 0 errores y 0 advertencias. |
| Fuentes de arte | Blender 4.3.2 exportó los modelos, guardó la escena editable con texturas empaquetadas y produjo `public/assets/art/scene-preview.png`. |
| Compatibilidad web | Se compiló una prueba estática con Astro 7.4.13, integración Preact y una isla `client:only="preact"`. Servida bajo `/tlc/`, Chromium 158 con WebGL 2 por software cargó los 9 GLB, montó las 10 instancias, decodificó los 10 audios y mostró las fuentes y la portada. El fotograma de recepción reportó 116 llamadas de dibujo y 12.442 triángulos. |
| Alcance de esta verificación | La prueba verifica los recursos y su integración con Astro. La partida, los controles, el guardado y el rendimiento en hardware real se comprueban cuando el agente implemente la aplicación según el prompt maestro. |
