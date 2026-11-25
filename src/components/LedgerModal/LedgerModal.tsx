import { useEffect, useRef, useState } from 'preact/hooks'

import { assetUrl } from '@/helpers/assets.helpers'
import type { ClueId, StoryManifest } from '@/types'

export interface LedgerModalProps {
  story: StoryManifest
  collectedClues: ClueId[]
  onSaveFolio: (clueId: 'ledger_07' | 'ledger_19') => void
  onClose: () => void
}

export default function LedgerModal({
  story,
  collectedClues,
  onSaveFolio,
  onClose
}: LedgerModalProps) {
  const [selectedFolio, setSelectedFolio] = useState<'ledger_07' | 'ledger_19'>(
    'ledger_07'
  )
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const activeClue = story.clues[selectedFolio]
  const isSaved = collectedClues.includes(selectedFolio)
  const saved07 = collectedClues.includes('ledger_07')
  const saved19 = collectedClues.includes('ledger_19')

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='ledger-modal-title'
      class='fixed inset-0 z-40 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/84 p-4 text-tlc-text backdrop-blur-xs'
    >
      <div class='flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-tlc-line bg-tlc-panel shadow-2xl'>
        <header class='flex items-center justify-between border-b border-tlc-line/60 px-6 py-4'>
          <div>
            <p class='font-console text-xs tracking-[0.18em] text-tlc-amber uppercase'>
              Recepción · Libro físico de guardias
            </p>
            <h2
              id='ledger-modal-title'
              class='mt-1 font-title text-3xl tracking-wide text-tlc-text uppercase'
            >
              Bitácora de Nochebuena
            </h2>
          </div>
          <button
            ref={closeRef}
            type='button'
            onClick={onClose}
            class='rounded border border-tlc-line px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-text hover:text-tlc-text'
          >
            Cerrar (Esc)
          </button>
        </header>

        <div class='grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.1fr_1fr]'>
          <div class='flex flex-col gap-3'>
            <div class='overflow-hidden rounded border border-tlc-line/60 bg-tlc-bg p-3'>
              <img
                src={assetUrl(activeClue.texture)}
                alt='Páginas abiertas de la bitácora con los folios 07 y 19'
                class='h-auto w-full rounded-xs object-contain'
              />
            </div>
            <p class='font-console text-xs text-tlc-secondary'>
              Selecciona cada folio para conservar una copia verificable en el
              registro de pistas de la consola A-06.
            </p>
          </div>

          <div class='flex flex-col justify-between gap-5'>
            <div class='space-y-4'>
              <div
                role='tablist'
                aria-label='Folios de la bitácora'
                class='grid grid-cols-2 gap-2'
              >
                <button
                  type='button'
                  role='tab'
                  aria-selected={selectedFolio === 'ledger_07'}
                  onClick={() => setSelectedFolio('ledger_07')}
                  class={
                    selectedFolio === 'ledger_07'
                      ? 'rounded border border-tlc-amber bg-tlc-amber/15 px-3 py-2.5 text-left font-console text-xs text-tlc-text'
                      : 'rounded border border-tlc-line/70 bg-tlc-bg/60 px-3 py-2.5 text-left font-console text-xs text-tlc-secondary hover:border-tlc-text/40'
                  }
                >
                  <span class='block font-semibold'>Folio 07</span>
                  <span class='mt-0.5 block text-[11px]'>
                    {saved07 ? '✓ Guardado' : 'Sin registrar'}
                  </span>
                </button>

                <button
                  type='button'
                  role='tab'
                  aria-selected={selectedFolio === 'ledger_19'}
                  onClick={() => setSelectedFolio('ledger_19')}
                  class={
                    selectedFolio === 'ledger_19'
                      ? 'rounded border border-tlc-amber bg-tlc-amber/15 px-3 py-2.5 text-left font-console text-xs text-tlc-text'
                      : 'rounded border border-tlc-line/70 bg-tlc-bg/60 px-3 py-2.5 text-left font-console text-xs text-tlc-secondary hover:border-tlc-text/40'
                  }
                >
                  <span class='block font-semibold'>Folio 19</span>
                  <span class='mt-0.5 block text-[11px]'>
                    {saved19 ? '✓ Guardado' : 'Sin registrar'}
                  </span>
                </button>
              </div>

              <article class='rounded border border-tlc-paper/35 bg-[#232b26] p-4'>
                <h3 class='font-console text-xs tracking-wider text-tlc-amber uppercase'>
                  {activeClue.title}
                </h3>
                <p class='mt-2.5 text-base leading-relaxed text-tlc-text'>
                  {activeClue.text}
                </p>
              </article>

              <button
                type='button'
                onClick={() => onSaveFolio(selectedFolio)}
                class={
                  isSaved
                    ? 'w-full rounded border border-tlc-positive/70 bg-tlc-positive/10 px-4 py-2.5 font-console text-xs text-tlc-positive'
                    : 'w-full rounded border border-tlc-amber bg-tlc-amber/15 px-4 py-2.5 font-console text-xs text-tlc-text transition hover:bg-tlc-amber/25'
                }
              >
                {isSaved
                  ? `✓ ${activeClue.title} guardado en registro de pistas`
                  : `Guardar ${activeClue.title} como evidencia`}
              </button>
            </div>

            <div class='rounded border border-tlc-line/50 bg-tlc-bg/65 p-3 font-console text-xs text-tlc-secondary'>
              Evidencias de bitácora guardadas:{' '}
              {(saved07 ? 1 : 0) + (saved19 ? 1 : 0)} / 2
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}
