# Herramientas para Gemini Neon

El prompt y los assets funcionan en cualquier cliente de Gemini que pueda leer y editar un workspace y ejecutar la terminal. Para configurar el cliente, usa solo el ejemplo de la plataforma donde corre tu agente. La integración de herramientas es opcional. El proyecto necesita Node, npm y un navegador gráfico de escritorio para validar la partida.

| Herramienta | Uso en The Last Commit | Prioridad |
|---|---|---|
| Skills del proyecto en `.agents/skills/` | `astro-game-shell`, `three-asset-integration` y `web-game-qa` cubren arquitectura, montaje y pruebas del juego. | Incluidas en el ZIP. |
| Astro Docs MCP | Consultar directivas de cliente, Preact, rutas base y deploy estático en la documentación oficial. | Recomendado. [Astro Docs MCP](https://docs.astro.build/en/guides/build-with-ai/) |
| Navegador integrado o Chrome DevTools MCP | Abrir el servidor local, revisar pantalla real, errores WebGL, peticiones, consola, capturas y rendimiento. Usar un perfil de prueba. | Elegir uno. [Antigravity Browser](https://antigravity.google/docs/browser/) · [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) |
| Playwright Test | Pruebas repetibles de regresión. Ejecutar mediante terminal y guardar scripts con el proyecto. | Recomendado. Complementa la revisión gráfica. [Playwright Test](https://playwright.dev/docs/intro) |
| Playwright MCP | Alternativa para interacciones exploratorias en navegador si el cliente carece de control gráfico. | Opcional. Instalar por separado solo si se elige esta vía. [Playwright MCP](https://github.com/microsoft/playwright-mcp) |
| Blender CLI y Khronos glTF Validator | Regenerar modelos si cambia el arte y revisar la compatibilidad del formato. El runtime carga los GLB listos. | Opcional al editar arte. [Blender en terminal](https://docs.blender.org/api/main/info_tips_and_tricks.html) · [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) |

## Si Gemini Neon se ejecuta en Gemini CLI

1. Abre Gemini CLI en la raíz. `GEMINI.md` importa `AGENTS.md`. `/skills list` muestra las skills del workspace. Si el cliente usa un contexto distinto, pídele que lea ambos archivos.
2. Para los MCP, fusiona `tooling/gemini-cli.settings.example.json` en `.gemini/settings.json` conservando la configuración existente. Puedes activar solamente la entrada `astro-docs`. La configuración remota usa Streamable HTTP.
3. `/mcp` muestra los servidores descubiertos. Permite el acceso al navegador según las autorizaciones de tu entorno. Verifica con una página local de prueba.
4. Para agregar solo Astro desde terminal:

```sh
gemini mcp add --transport http --scope project astro-docs https://mcp.docs.astro.build/mcp
```

[Contexto GEMINI.md](https://geminicli.com/docs/cli/gemini-md/) · [Skills en Gemini CLI](https://geminicli.com/docs/cli/skills/) · [MCP en Gemini CLI](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html)

## Si Gemini Neon se ejecuta en Google Antigravity

1. Abre esta carpeta como proyecto. Antigravity detecta `AGENTS.md`, `GEMINI.md` y `.agents/skills/` en el workspace.
2. Fusiona la configuración que necesites de `tooling/antigravity.mcp.example.json` en `.agents/mcp_config.json`. Si la superficie usa el configurador del IDE, añade las mismas entradas allí.
3. Usa el navegador integrado si está disponible en tu superficie. En la App o CLI compatibles, `/browser` permite inspeccionar el servidor local. En un workspace remoto, usa el puerto reenviado y verifica renderizado y Pointer Lock en el navegador que realmente usará la persona.
4. Si deseas controlar Chromium con Playwright MCP, puedes reemplazar la entrada de Chrome DevTools por esta:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--isolated"]
    }
  }
}
```

[Descubrimiento de personalizaciones](https://antigravity.google/docs/customization-discovery) · [MCP en Antigravity](https://antigravity.google/docs/mcp) · [Comando de navegador](https://antigravity.google/docs/commands/browser)

## Si es otro cliente llamado Neon

Adjunta la carpeta o dale acceso al workspace. Pega `PROMPT_MAESTRO_GEMINI.md` y pide que lea el contexto de `AGENTS.md`. Si admite MCP, usa el endpoint de Astro y el transporte HTTP que le corresponda. Si no admite MCP ni descubre skills, los Markdown siguen siendo legibles y el agente puede validar con terminal, documentación y un navegador de escritorio. Los archivos de ejemplo sirven para configurar el cliente que ya usas.

## Verificación mínima

Abrir el servidor del juego, comprobar que la consola queda sin errores, capturar A-07 antes y después del borrado, completar los folios y ejecutar las pruebas desde el proyecto. Para evaluar WebGL, audio espacial y movimiento, comprueba también un navegador gráfico en tu equipo y registra el resultado. Los servidores de ejemplo se proponen como ayuda y requieren verificación en el cliente concreto.
