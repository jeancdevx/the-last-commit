# The Last Commit

Juego web de terror narrativo 3D en primera persona en español, construido con **Astro** (salida estática), **Preact**, **Three.js**, **Web Audio API** y **Tailwind CSS v4**.

> *24 de diciembre de 2026 · 23:52. El sistema dice que la oficina está vacía. Tú sigues dentro.*

## Requisitos

- **Node.js** `>= 22.12` (probado en Node 26 / compatible con Node 24 LTS)
- **pnpm** `10.x` (gestor obligatorio del proyecto; el lockfile está en `pnpm-lock.yaml`)
- Navegador de escritorio con **WebGL 2**

## Arranque rápido

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:4321` para jugar o `http://localhost:4321/diagnostico/` para revisar WebGL 2, GPU, modelos GLB, audio y guardado local.

## Scripts principales

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo de Astro |
| `pnpm check` | Verificación estática con `astro check` y `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Linter estricto con `oxlint` + `@stylistic/eslint-plugin` |
| `pnpm format` / `pnpm format:check` | Formateo con `oxfmt` (Astro + orden automático de clases Tailwind CSS) |
| `pnpm test` | Pruebas unitarias con Vitest (progresión, A-07, colisiones, guardado) |
| `pnpm test:e2e` | Pruebas E2E en Chromium real con Playwright (WebGL 2 + capturas) |
| `pnpm build` | Compilación estática en `dist/` |
| `pnpm build:subpath` | Compilación estática con base de subdirectorio `ASTRO_BASE=/tlc/` |
| `pnpm verify:kit` | Validación de hashes y contratos GLB/JSON (`tooling/verify-kit.py`) |

## Estructura del código

El código fuente sigue la estructura recomendada por Josh W. Comeau adaptada a Astro + Preact:

```text
src/
├── components/           # Un directorio por componente con barrel index.ts
│   ├── ClueReader/
│   ├── ConsolePanel/
│   ├── CreditsModal/
│   ├── DiagnosticsApp/
│   ├── EndingOverlay/
│   ├── GameApp/
│   ├── GameHud/
│   ├── LedgerModal/
│   ├── MenuScreen/
│   ├── PauseModal/
│   └── SettingsModal/
├── helpers/              # Lógica de dominio (estado, escena 3D, colisiones, audio, guardado, rutas)
├── hooks/                # Hooks reutilizables (use-ephemeral-message, use-game-settings)
├── layouts/              # Shell HTML estático de Astro (Layout.astro)
├── pages/                # Rutas estáticas (index.astro, diagnostico.astro)
├── styles/               # Entrada Tailwind CSS v4 (global.css)
├── constants.ts          # Constantes globales
├── types.ts              # Contratos TypeScript estrictos
└── utils.ts              # Utilidades puras genéricas
```

## Calidad y hooks Git

- **oxfmt**: formateo de TypeScript, Preact, Astro y ordenación nativa de clases Tailwind CSS (`sortTailwindcss` apuntando a `src/styles/global.css`).
- **oxlint**: reglas de corrección, accesibilidad (`jsx-a11y`), imports y estilo (`@stylistic/eslint-plugin`).
- **Husky + lint-staged + commitlint**: hooks `.husky/pre-commit` y `.husky/commit-msg` con Conventional Commits.

## Documentación e informe

- Diseño e integración: `docs/diseno-e-integracion.md`
- Créditos y licencias: `docs/creditos-y-fuentes.md`
- Informe de entrega, comandos y evidencias QA: `docs/informe-entrega.md`
