import { useEffect, useRef } from 'preact/hooks'

import type { StoryManifest } from '@/types'

export interface EndingOverlayProps {
  story: StoryManifest
  onReturnMenu: () => void
  onPlayAgain: () => void
}

export default function EndingOverlay({
  story,
  onReturnMenu,
  onPlayAgain
}: EndingOverlayProps) {
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    menuBtnRef.current?.focus()
  }, [])

  return (
    <section
      aria-label='Epílogo de The Last Commit'
      class='fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-t from-[#0b1110]/92 via-[#0d1413]/72 to-[#0b1110]/65 p-6 backdrop-blur-[2px]'
    >
      <div class='w-full max-w-xl rounded border border-tlc-line bg-tlc-panel/92 p-8 text-center shadow-2xl'>
        <p class='font-console text-xs tracking-[0.25em] text-tlc-positive uppercase'>
          25/12/2026 · 00:01 · Cierre completado
        </p>

        <h2 class='mt-4 font-title text-4xl tracking-wide text-tlc-text uppercase sm:text-5xl'>
          {story.ending.primary}
        </h2>

        <p class='mt-3 text-base text-tlc-amber'>{story.ending.secondary}</p>

        <dl class='mt-6 grid grid-cols-3 gap-2 rounded border border-tlc-line/60 bg-tlc-bg/75 p-4 font-console text-xs'>
          <div>
            <dt class='text-tlc-secondary'>Folio 07</dt>
            <dd class='mt-1 text-tlc-positive'>✓ I. Salas · A-07</dd>
          </div>
          <div>
            <dt class='text-tlc-secondary'>Folio 19</dt>
            <dd class='mt-1 text-tlc-positive'>✓ M. Rojas · B-02</dd>
          </div>
          <div>
            <dt class='text-tlc-secondary'>Folio 26</dt>
            <dd class='mt-1 text-tlc-positive'>✓ Turno actual · A-06</dd>
          </div>
        </dl>

        <div class='mt-7 flex flex-wrap items-center justify-center gap-3'>
          <button
            ref={menuBtnRef}
            type='button'
            onClick={onReturnMenu}
            class='rounded border border-tlc-amber bg-tlc-amber/18 px-6 py-2.5 font-title text-xl tracking-wide text-tlc-text uppercase transition hover:bg-tlc-amber/30'
          >
            Volver al menú
          </button>
          <button
            type='button'
            onClick={onPlayAgain}
            class='rounded border border-tlc-line bg-tlc-bg/80 px-5 py-2.5 font-title text-xl tracking-wide text-tlc-text uppercase transition hover:border-tlc-text/60'
          >
            Jugar de nuevo
          </button>
        </div>
      </div>
    </section>
  )
}
