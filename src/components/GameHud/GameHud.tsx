import type { GameSettings, InteractableHover } from '@/types'

export interface GameHudProps {
  dateLabel: string
  timeLabel: string
  hover: InteractableHover | null
  toastMessage: string | null
  subtitleMessage: string | null
  pointerLocked: boolean
  overlayOpen: boolean
  settings: GameSettings
  onRequestPointerLock: () => void
  onOpenPause: () => void
  onToggleMute: () => void
}

export default function GameHud({
  dateLabel,
  timeLabel,
  hover,
  toastMessage,
  subtitleMessage,
  pointerLocked,
  overlayOpen,
  settings,
  onRequestPointerLock,
  onOpenPause,
  onToggleMute
}: GameHudProps) {
  return (
    <div class='pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-7'>
      <div class='flex items-start justify-between gap-4'>
        <div class='space-y-2'>
          <div class='inline-flex items-center gap-2.5 rounded border border-tlc-line/60 bg-tlc-bg/75 px-3 py-1.5 font-console text-xs text-tlc-text backdrop-blur-xs'>
            <span class='h-1.5 w-1.5 rounded-full bg-tlc-positive' />
            <span>{dateLabel}</span>
            <span class='text-tlc-line'>|</span>
            <span class='text-tlc-amber'>{timeLabel}</span>
          </div>

          {toastMessage && (
            <output
              aria-live='polite'
              class='block max-w-md rounded border border-tlc-line/70 bg-tlc-panel/90 px-4 py-2.5 text-sm text-tlc-text shadow-lg backdrop-blur-xs'
            >
              {toastMessage}
            </output>
          )}
        </div>

        <div class='pointer-events-auto flex items-center gap-2'>
          <button
            type='button'
            onClick={onToggleMute}
            aria-label={settings.muted ? 'Activar audio' : 'Silenciar audio'}
            class='rounded border border-tlc-line/70 bg-tlc-bg/75 px-3 py-1.5 font-console text-xs text-tlc-secondary backdrop-blur-xs transition hover:border-tlc-amber/70 hover:text-tlc-text'
          >
            {settings.muted ? 'Audio: Silenciado' : 'Audio: Activo'}
          </button>
          <button
            type='button'
            onClick={onOpenPause}
            class='rounded border border-tlc-line/70 bg-tlc-bg/75 px-3 py-1.5 font-console text-xs text-tlc-text backdrop-blur-xs transition hover:border-tlc-amber/70'
          >
            Pausa (Esc)
          </button>
        </div>
      </div>

      {!overlayOpen && (
        <div class='flex flex-col items-center justify-center gap-3'>
          <div
            aria-hidden='true'
            class={
              hover
                ? 'h-3 w-3 rounded-full border-2 border-tlc-amber bg-tlc-amber/30 transition-all'
                : 'h-1.5 w-1.5 rounded-full bg-tlc-text/75 shadow-[0_0_6px_rgba(0,0,0,0.9)] transition-all'
            }
          />

          {hover && (
            <output
              aria-live='polite'
              class='block rounded border border-tlc-line/80 bg-tlc-panel/92 px-4 py-2 text-center shadow-lg backdrop-blur-xs'
            >
              <p class='font-console text-xs font-medium tracking-wide text-tlc-amber uppercase'>
                {hover.action}
              </p>
              <p class='mt-0.5 text-sm text-tlc-text'>{hover.label}</p>
              {hover.blockedReason && (
                <p class='mt-1 max-w-xs text-xs text-tlc-secondary'>
                  {hover.blockedReason}
                </p>
              )}
            </output>
          )}
        </div>
      )}

      <div class='flex flex-col items-center gap-3'>
        {settings.subtitles && subtitleMessage && (
          <output
            aria-live='polite'
            class='block rounded border border-tlc-line/60 bg-tlc-bg/85 px-4 py-1.5 font-console text-xs text-tlc-text backdrop-blur-xs'
          >
            {subtitleMessage}
          </output>
        )}

        {!overlayOpen && !pointerLocked && (
          <div class='pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded border border-tlc-amber/70 bg-tlc-panel/92 px-4 py-2.5 text-xs text-tlc-text shadow-lg backdrop-blur-xs'>
            <span>El puntero no está capturado.</span>
            <button
              type='button'
              onClick={onRequestPointerLock}
              class='rounded border border-tlc-amber bg-tlc-amber/15 px-3 py-1 font-console text-xs text-tlc-amber transition hover:bg-tlc-amber/25'
            >
              Capturar puntero y continuar
            </button>
            <span class='hidden text-tlc-secondary sm:inline'>
              (También puedes moverte con WASD, girar con Flechas e interactuar
              con E)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
