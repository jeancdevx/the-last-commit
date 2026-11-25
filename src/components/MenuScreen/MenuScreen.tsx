import { assetUrl, withBase } from '@/helpers/assets.helpers'
import { deriveStage } from '@/helpers/state.helpers'
import type { LoadSaveResult } from '@/helpers/storage.helpers'
import type { StoryManifest } from '@/types'

export interface MenuScreenProps {
  story: StoryManifest | null
  saveState: LoadSaveResult
  onPlayNew: () => void
  onContinue: () => void
  onOpenSettings: () => void
  onOpenCredits: () => void
  onClearCorruptSave: () => void
}

export default function MenuScreen({
  story,
  saveState,
  onPlayNew,
  onContinue,
  onOpenSettings,
  onOpenCredits,
  onClearCorruptSave
}: MenuScreenProps) {
  const canContinue =
    saveState.status === 'ok' && !saveState.envelope.progress.exitUsed
  const savedStage =
    saveState.status === 'ok'
      ? deriveStage(saveState.envelope.progress, story ?? undefined)
      : null

  return (
    <section
      aria-label='Menú principal de The Last Commit'
      class='relative flex h-full w-full items-center overflow-hidden bg-tlc-bg'
    >
      <img
        src={assetUrl('art/cover.webp')}
        alt=''
        aria-hidden='true'
        class='pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-85'
      />
      <div
        aria-hidden='true'
        class='pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c1211]/95 via-[#0f1615]/78 to-[#0f1615]/25'
      />
      <div
        aria-hidden='true'
        class='tlc-vignette pointer-events-none absolute inset-0'
      />

      <div class='relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-between px-8 py-10 sm:px-14 sm:py-14'>
        <header class='flex items-center justify-between gap-4'>
          <div class='flex items-center gap-3 font-console text-xs tracking-[0.22em] text-tlc-secondary uppercase'>
            <span class='inline-block h-2 w-2 rounded-full bg-tlc-amber' />
            <span>
              {story?.opening.date ?? '24/12/2026'} ·{' '}
              {story?.opening.time ?? '23:52'} · Planta 04
            </span>
          </div>
          <a
            href={withBase('diagnostico/')}
            class='rounded border border-tlc-line/60 bg-tlc-panel/70 px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-amber/70 hover:text-tlc-text'
          >
            Diagnóstico
          </a>
        </header>

        <div class='max-w-xl space-y-6'>
          <div class='space-y-3'>
            <img
              src={assetUrl('branding/wordmark-light.png')}
              alt=''
              aria-hidden='true'
              class='h-auto w-72 max-w-full opacity-95 sm:w-88'
            />
            <h1 class='sr-only'>{story?.title ?? 'The Last Commit'}</h1>
            <p class='max-w-md text-base leading-relaxed text-tlc-text/90 sm:text-lg'>
              {story?.tagline ??
                'El sistema dice que la oficina está vacía. Tú sigues dentro.'}
            </p>
          </div>

          {saveState.status === 'corrupt' && (
            <div
              role='alert'
              class='rounded border border-tlc-danger/70 bg-tlc-panel/95 p-4 text-sm text-tlc-text shadow-lg'
            >
              <p class='font-semibold text-tlc-danger'>
                Partida guardada dañada
              </p>
              <p class='mt-1 text-tlc-secondary'>{saveState.message}</p>
              <button
                type='button'
                onClick={onClearCorruptSave}
                class='mt-3 rounded border border-tlc-danger/60 bg-tlc-bg/80 px-3 py-1.5 font-console text-xs text-tlc-text transition hover:border-tlc-danger'
              >
                Descartar datos dañados
              </button>
            </div>
          )}

          <nav
            aria-label='Acciones principales'
            class='flex max-w-xs flex-col gap-3 pt-2'
          >
            {canContinue && savedStage && (
              <button
                type='button'
                onClick={onContinue}
                class='group flex items-center justify-between rounded border border-tlc-amber bg-tlc-panel/95 px-5 py-3.5 text-left transition hover:bg-tlc-amber/15'
              >
                <div>
                  <span class='block font-title text-2xl tracking-[0.06em] text-tlc-text uppercase'>
                    Continuar
                  </span>
                  <span class='block font-console text-xs text-tlc-amber'>
                    Turno guardado · {savedStage.time}
                  </span>
                </div>
                <span
                  aria-hidden='true'
                  class='font-console text-sm text-tlc-amber transition group-hover:translate-x-0.5'
                >
                  →
                </span>
              </button>
            )}

            <button
              type='button'
              onClick={onPlayNew}
              class={
                canContinue
                  ? 'rounded border border-tlc-line bg-tlc-panel/85 px-5 py-3 text-left font-title text-xl tracking-[0.06em] text-tlc-text uppercase transition hover:border-tlc-amber/80 hover:bg-tlc-panel'
                  : 'group flex items-center justify-between rounded border border-tlc-amber bg-tlc-panel/95 px-5 py-3.5 text-left transition hover:bg-tlc-amber/15'
              }
            >
              <span class='font-title text-2xl tracking-[0.06em] text-tlc-text uppercase'>
                {canContinue ? 'Empezar de nuevo' : 'Jugar'}
              </span>
              {!canContinue && (
                <span
                  aria-hidden='true'
                  class='font-console text-sm text-tlc-amber transition group-hover:translate-x-0.5'
                >
                  →
                </span>
              )}
            </button>

            <div class='grid grid-cols-2 gap-3 pt-1'>
              <button
                type='button'
                onClick={onOpenSettings}
                class='rounded border border-tlc-line/80 bg-tlc-panel/80 px-4 py-2.5 text-sm font-medium text-tlc-text transition hover:border-tlc-text/50 hover:bg-tlc-panel'
              >
                Ajustes
              </button>
              <button
                type='button'
                onClick={onOpenCredits}
                class='rounded border border-tlc-line/80 bg-tlc-panel/80 px-4 py-2.5 text-sm font-medium text-tlc-text transition hover:border-tlc-text/50 hover:bg-tlc-panel'
              >
                Créditos
              </button>
            </div>
          </nav>
        </div>

        <footer class='flex flex-wrap items-center justify-between gap-4 border-t border-tlc-line/40 pt-4 font-console text-xs text-tlc-secondary'>
          <span>
            Escritorio · WASD mover · Ratón mirar · E interactuar · Esc pausa
          </span>
          <span>12–15 min · Audio opcional con subtítulos</span>
        </footer>
      </div>
    </section>
  )
}
