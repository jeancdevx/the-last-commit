import { useEffect, useRef } from 'preact/hooks'

import { assetUrl } from '@/helpers/assets.helpers'
import type { ClueId, ClueSpec } from '@/types'

export interface ClueReaderProps {
  clueId: ClueId
  clue: ClueSpec
  onClose: () => void
}

export default function ClueReader({ clueId, clue, onClose }: ClueReaderProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [clueId])

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='clue-reader-title'
      class='fixed inset-0 z-40 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/82 p-4 text-tlc-text backdrop-blur-xs'
    >
      <div class='w-full max-w-2xl rounded border border-tlc-line bg-tlc-panel shadow-2xl'>
        <header class='flex items-center justify-between border-b border-tlc-line/60 px-6 py-4'>
          <div>
            <p class='font-console text-xs tracking-[0.18em] text-tlc-amber uppercase'>
              Evidencia física registrada
            </p>
            <h2
              id='clue-reader-title'
              class='mt-1 font-title text-3xl tracking-wide text-tlc-text uppercase'
            >
              {clue.title}
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Cerrar lectura'
            class='rounded border border-tlc-line px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-text hover:text-tlc-text'
          >
            Esc
          </button>
        </header>

        <div class='grid gap-6 p-6 sm:grid-cols-[220px_1fr] sm:items-center'>
          <div class='flex items-center justify-center rounded border border-tlc-line/50 bg-tlc-bg/85 p-4'>
            <img
              src={assetUrl(clue.texture)}
              alt={`Vista visual de ${clue.title}`}
              class='max-h-64 w-auto rounded-xs object-contain shadow-md'
            />
          </div>

          <div class='space-y-4'>
            <div class='rounded border border-tlc-paper/30 bg-[#232b26] p-4'>
              <p class='font-console text-xs tracking-wider text-tlc-secondary uppercase'>
                Transcripción
              </p>
              <p class='mt-2 text-base leading-relaxed font-medium text-tlc-text'>
                {clue.text}
              </p>
            </div>

            <dl class='grid grid-cols-2 gap-2 font-console text-xs'>
              {clue.folio && (
                <div class='rounded border border-tlc-line/50 bg-tlc-bg/60 px-3 py-2'>
                  <dt class='text-tlc-secondary'>Folio</dt>
                  <dd class='mt-0.5 text-tlc-amber'>{clue.folio}</dd>
                </div>
              )}
              {clue.station && (
                <div class='rounded border border-tlc-line/50 bg-tlc-bg/60 px-3 py-2'>
                  <dt class='text-tlc-secondary'>Puesto</dt>
                  <dd class='mt-0.5 text-tlc-text'>{clue.station}</dd>
                </div>
              )}
              {clue.name && (
                <div class='rounded border border-tlc-line/50 bg-tlc-bg/60 px-3 py-2'>
                  <dt class='text-tlc-secondary'>Registro</dt>
                  <dd class='mt-0.5 text-tlc-text'>{clue.name}</dd>
                </div>
              )}
              {clue.stamp && (
                <div class='rounded border border-tlc-line/50 bg-tlc-bg/60 px-3 py-2'>
                  <dt class='text-tlc-secondary'>Sello</dt>
                  <dd class='mt-0.5 text-tlc-text'>{clue.stamp}</dd>
                </div>
              )}
            </dl>

            <div class='flex items-center gap-2 text-xs text-tlc-positive'>
              <span aria-hidden='true'>✓</span>
              <span>
                Copia conservada en el registro de pistas de la consola.
              </span>
            </div>
          </div>
        </div>

        <footer class='flex justify-end border-t border-tlc-line/60 px-6 py-4'>
          <button
            ref={closeButtonRef}
            type='button'
            onClick={onClose}
            class='rounded border border-tlc-amber bg-tlc-amber/15 px-5 py-2 font-console text-xs tracking-wide text-tlc-text uppercase transition hover:bg-tlc-amber/25'
          >
            Guardar y cerrar
          </button>
        </footer>
      </div>
    </dialog>
  )
}
