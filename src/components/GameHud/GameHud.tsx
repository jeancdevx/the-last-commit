import type { GameSettings, InteractableHover, ProjectedMarker } from '@/types'

export interface GameHudProps {
  dateLabel: string
  timeLabel: string
  hover: InteractableHover | null
  markers: ProjectedMarker[]
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
  markers,
  toastMessage,
  subtitleMessage,
  pointerLocked,
  overlayOpen,
  settings,
  onRequestPointerLock,
  onOpenPause,
  onToggleMute
}: GameHudProps) {
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen?.()
    }
  }

  return (
    <div class='pointer-events-none fixed inset-0 z-20 overflow-hidden select-none'>
      {/* 3D-projected Resident Evil style markers on nearby interactables */}
      {!overlayOpen &&
        markers.map(marker => (
          <div
            key={marker.kind}
            aria-hidden='true'
            class={`tlc-re-marker ${marker.isActive ? 'is-active' : ''}`}
            style={{
              transform: `translate3d(${marker.x}vw, ${marker.y}vh, 0)`
            }}
          >
            {marker.isActive && marker.inReach && (
              <span class='tlc-re-key font-console text-xs font-bold'>E</span>
            )}
            <span class='tlc-re-chevron'>
              <svg
                width='11'
                height='11'
                viewBox='0 0 12 12'
                fill='none'
                stroke='currentColor'
                stroke-width='1.8'
              >
                <path d='M3 4.5 6 7.5 9 4.5' />
              </svg>
            </span>
          </div>
        ))}

      {/* Minimal top chrome */}
      <div class='flex items-start justify-between p-5 sm:p-7'>
        <div class='flex items-center gap-2 font-console text-[11px] tracking-[0.18em] text-tlc-text/70 uppercase drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]'>
          <span class='h-1.5 w-1.5 rounded-full bg-tlc-positive/85 shadow-[0_0_6px_#8dde9c]' />
          <span>{dateLabel}</span>
          <span class='text-tlc-text/30'>·</span>
          <span class='text-tlc-amber tabular-nums'>{timeLabel}</span>
        </div>

        <div class='pointer-events-auto flex items-center gap-2'>
          <button
            type='button'
            onClick={onToggleMute}
            aria-label={settings.muted ? 'Activar audio' : 'Silenciar audio'}
            title={settings.muted ? 'Activar audio' : 'Silenciar audio'}
            class='grid h-9 w-9 place-items-center rounded border border-tlc-text/15 bg-black/45 text-tlc-text/80 backdrop-blur-xs transition hover:border-tlc-amber/60 hover:text-tlc-text'
          >
            {settings.muted ? (
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                stroke-width='1.8'
                aria-hidden='true'
              >
                <path d='M11 5 6 9H2v6h4l5 4V5Z' />
                <path d='m22 9-6 6M16 9l6 6' />
              </svg>
            ) : (
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                stroke-width='1.8'
                aria-hidden='true'
              >
                <path d='M11 5 6 9H2v6h4l5 4V5Z' />
                <path d='M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14' />
              </svg>
            )}
          </button>

          <button
            type='button'
            onClick={handleFullscreen}
            aria-label='Pantalla completa'
            title='Pantalla completa'
            class='grid h-9 w-9 place-items-center rounded border border-tlc-text/15 bg-black/45 text-tlc-text/80 backdrop-blur-xs transition hover:border-tlc-amber/60 hover:text-tlc-text'
          >
            <svg
              width='15'
              height='15'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              stroke-width='1.8'
              aria-hidden='true'
            >
              <path d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3' />
            </svg>
          </button>

          <button
            type='button'
            onClick={onOpenPause}
            aria-label='Pausa'
            class='rounded border border-tlc-text/15 bg-black/45 px-3 py-2 font-console text-[11px] tracking-wider text-tlc-text/80 uppercase backdrop-blur-xs transition hover:border-tlc-amber/60 hover:text-tlc-text'
          >
            Esc · Pausa
          </button>
        </div>
      </div>

      {/* Living center reticle + discreet contextual label */}
      {!overlayOpen && (
        <div class='fixed inset-0 flex flex-col items-center justify-center'>
          <div
            aria-hidden='true'
            class={`tlc-reticle relative flex items-center justify-center ${
              hover ? 'is-active' : ''
            } ${hover?.blockedReason ? 'is-blocked' : ''}`}
          >
            <span class='tlc-reticle-ring' />
            <span class='tlc-reticle-dot' />
          </div>

          {hover && (
            <output
              aria-live='polite'
              class='mt-7 block text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.98)]'
            >
              <span class='block font-console text-[11px] tracking-[0.18em] text-tlc-amber uppercase'>
                {hover.action}
              </span>
              <span class='mt-0.5 block font-serif text-xl text-tlc-text'>
                {hover.label}
              </span>
              {hover.blockedReason && (
                <span class='mt-1 block max-w-xs font-body text-xs text-tlc-secondary'>
                  {hover.blockedReason}
                </span>
              )}
            </output>
          )}
        </div>
      )}

      {/* Bottom cinematic thought caption, subtitles & minimal pointer recapture */}
      <div class='fixed inset-x-0 bottom-6 flex flex-col items-center gap-2.5 px-6 text-center'>
        {toastMessage && (
          <output
            aria-live='polite'
            class='tlc-caption block max-w-xl font-serif text-[clamp(20px,2vw,27px)] leading-snug text-[#f2ede4] italic'
          >
            {toastMessage}
          </output>
        )}

        {settings.subtitles && subtitleMessage && (
          <output
            aria-live='polite'
            class='block rounded-full bg-black/55 px-3.5 py-1 font-console text-[11px] tracking-[0.08em] text-tlc-text/85 backdrop-blur-xs'
          >
            {subtitleMessage}
          </output>
        )}

        {!overlayOpen && !pointerLocked && (
          <div class='pointer-events-auto mt-1 flex items-center gap-3 rounded-full border border-tlc-text/15 bg-black/60 px-4 py-1.5 text-[11px] text-tlc-text/75 backdrop-blur-xs'>
            <button
              type='button'
              onClick={onRequestPointerLock}
              class='font-console tracking-wider text-tlc-amber uppercase transition hover:text-tlc-text'
            >
              Clic para capturar ratón
            </button>
            <span class='text-tlc-text/30'>|</span>
            <span class='font-console text-tlc-text/55'>
              WASD · Flechas · E
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
