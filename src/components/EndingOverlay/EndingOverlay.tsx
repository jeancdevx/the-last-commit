import { useEffect, useRef } from 'preact/hooks'

import type { EndingId } from '@/helpers/achievements.helpers'
import type { StoryManifest } from '@/types'

export interface EndingOverlayProps {
  story: StoryManifest
  endingId: EndingId
  endingsCount: number
  onReturnMenu: () => void
  onPlayAgain: () => void
  onOpenCredits: () => void
}

export default function EndingOverlay({
  story,
  endingId,
  endingsCount,
  onReturnMenu,
  onPlayAgain,
  onOpenCredits
}: EndingOverlayProps) {
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    menuBtnRef.current?.focus()
  }, [])

  const copy =
    endingId === 'force'
      ? {
          kicker: '25/12/2026 · 00:00 · FINAL II / III · CIERRE FORZADO',
          numeral: 'II',
          osdTag: '▶ REC · --FORCE EJECUTADO',
          primary: 'El cierre terminó. Tu puesto tampoco figura ya.',
          secondary: 'Tres guardias de Nochebuena purgadas del registro.',
          accentClass: 'text-tlc-danger',
          statusOk: false
        }
      : endingId === 'loop'
        ? {
            kicker: '24/12/2026 · 23:59 · FINAL III / III · SIN REGISTRO',
            numeral: 'III',
            osdTag: '▶ PAUSE · SALIDA DENEGADA',
            primary: 'La puerta no abre para quien el sistema da por ausente.',
            secondary: 'El edificio sigue esperando la confirmación en A-06.',
            accentClass: 'text-tlc-amber',
            statusOk: false
          }
        : {
            kicker: '25/12/2026 · 00:01 · FINAL I / III · CIERRE COMPLETADO',
            numeral: '00:01',
            osdTag: '▶ PLAY · REGISTRO CONSERVADO',
            primary: story.ending.primary,
            secondary: story.ending.secondary,
            accentClass: 'text-tlc-positive',
            statusOk: true
          }

  return (
    <section
      aria-label='Epílogo de The Last Commit'
      class='tlc-ending-bg fixed inset-0 z-40 flex items-center justify-center overflow-hidden p-6 backdrop-blur-[2px]'
    >
      <div
        aria-hidden='true'
        class='tlc-scanlines tlc-ending-tape pointer-events-none absolute inset-0'
      />

      <span
        aria-hidden='true'
        class='pointer-events-none absolute right-[2vw] bottom-[-8vh] font-serif text-[min(65vh,52vw)] leading-none text-tlc-amber/8 select-none'
      >
        {copy.numeral}
      </span>

      <div
        aria-hidden='true'
        class='tlc-osd-text pointer-events-none absolute inset-0 font-console text-xs tracking-[0.2em] text-tlc-text/75 uppercase'
      >
        <span class='absolute top-6 left-7'>{copy.osdTag}</span>
        <span class='absolute top-6 right-7'>PLANTA 04 · 25/12/2026</span>
        <span class={`absolute bottom-6 left-7 ${copy.accentClass}`}>
          FINALES DESCUBIERTOS · {endingsCount} / 3
        </span>
        <span class='absolute right-7 bottom-6 text-tlc-text/50'>00:01:00</span>
      </div>

      <div class='relative z-10 w-full max-w-2xl px-4 text-center'>
        <p
          class={`font-console text-xs tracking-[0.26em] uppercase ${copy.accentClass}`}
        >
          {copy.kicker}
        </p>

        <h2 class='mt-5 font-serif text-[clamp(36px,5.2vw,66px)] leading-[1.06] text-[#f4f0e8] italic drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]'>
          {copy.primary}
        </h2>

        <p class='mt-4 font-console text-xs tracking-[0.16em] text-tlc-amber uppercase sm:text-sm'>
          {copy.secondary}
        </p>

        <dl class='mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3 border-y border-tlc-text/15 py-4 font-console text-xs'>
          <div>
            <dt class='text-tlc-secondary'>Folio 07</dt>
            <dd
              class={`mt-1 ${copy.statusOk ? 'text-tlc-positive' : 'text-tlc-danger'}`}
            >
              {copy.statusOk ? '✓ I. Salas · A-07' : '✕ A-07 · Purgado'}
            </dd>
          </div>
          <div>
            <dt class='text-tlc-secondary'>Folio 19</dt>
            <dd
              class={`mt-1 ${copy.statusOk ? 'text-tlc-positive' : 'text-tlc-danger'}`}
            >
              {copy.statusOk ? '✓ M. Rojas · B-02' : '✕ B-02 · Ausente'}
            </dd>
          </div>
          <div>
            <dt class='text-tlc-secondary'>Folio 26</dt>
            <dd
              class={`mt-1 ${copy.statusOk ? 'text-tlc-positive' : 'text-tlc-danger'}`}
            >
              {copy.statusOk
                ? '✓ Turno actual · A-06'
                : '✕ A-06 · Sin registro'}
            </dd>
          </div>
        </dl>

        <div class='mt-9 flex flex-wrap items-center justify-center gap-7'>
          <button
            ref={menuBtnRef}
            type='button'
            onClick={onReturnMenu}
            class='tlc-menu-item is-primary font-serif text-2xl'
          >
            Volver al menú
          </button>
          <button
            type='button'
            onClick={onPlayAgain}
            class='tlc-menu-item font-serif text-2xl'
          >
            Jugar de nuevo
          </button>
          <button
            type='button'
            onClick={onOpenCredits}
            class='tlc-menu-item font-serif text-2xl'
          >
            Créditos
          </button>
        </div>
      </div>
    </section>
  )
}
