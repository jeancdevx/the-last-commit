import { useEffect, useRef } from 'preact/hooks'

import type { GameSettings } from '@/types'

export interface SettingsModalProps {
  settings: GameSettings
  onChange: (next: GameSettings) => void
  onClose: () => void
}

export default function SettingsModal({
  settings,
  onChange,
  onClose
}: SettingsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='settings-modal-title'
      class='fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/85 p-4 text-tlc-text backdrop-blur-xs'
    >
      <div class='w-full max-w-lg rounded border border-tlc-line bg-tlc-panel shadow-2xl'>
        <header class='flex items-center justify-between border-b border-tlc-line/60 px-6 py-4'>
          <h2
            id='settings-modal-title'
            class='font-title text-3xl tracking-wide text-tlc-text uppercase'
          >
            Ajustes y accesibilidad
          </h2>
          <button
            ref={closeRef}
            type='button'
            onClick={onClose}
            class='rounded border border-tlc-line px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-text hover:text-tlc-text'
          >
            Cerrar (Esc)
          </button>
        </header>

        <div class='space-y-5 p-6 text-sm'>
          <div class='space-y-2'>
            <div class='flex items-center justify-between'>
              <label htmlFor='setting-volume' class='font-medium text-tlc-text'>
                Volumen general
              </label>
              <span class='font-console text-xs text-tlc-amber'>
                {settings.muted
                  ? '0%'
                  : `${Math.round(settings.volume * 100)}%`}
              </span>
            </div>
            <input
              id='setting-volume'
              type='range'
              min='0'
              max='1'
              step='0.05'
              value={settings.volume}
              onInput={event =>
                onChange({
                  ...settings,
                  volume: Number((event.target as HTMLInputElement).value),
                  muted: false
                })
              }
              class='w-full accent-[#e2ac65]'
            />
          </div>

          <div class='flex items-center justify-between gap-4 rounded border border-tlc-line/50 bg-tlc-bg/65 px-4 py-3'>
            <div>
              <label htmlFor='setting-muted' class='font-medium text-tlc-text'>
                Silenciar audio
              </label>
              <p class='text-xs text-tlc-secondary'>
                Todas las pistas pueden resolverse sin sonido mediante
                subtítulos.
              </p>
            </div>
            <input
              id='setting-muted'
              type='checkbox'
              checked={settings.muted}
              onChange={event =>
                onChange({
                  ...settings,
                  muted: (event.target as HTMLInputElement).checked
                })
              }
              class='h-4 w-4 accent-[#e2ac65]'
            />
          </div>

          <div class='space-y-2'>
            <div class='flex items-center justify-between'>
              <label
                htmlFor='setting-sensitivity'
                class='font-medium text-tlc-text'
              >
                Sensibilidad de cámara
              </label>
              <span class='font-console text-xs text-tlc-amber'>
                {settings.sensitivity.toFixed(2)}×
              </span>
            </div>
            <input
              id='setting-sensitivity'
              type='range'
              min='0.35'
              max='2'
              step='0.05'
              value={settings.sensitivity}
              onInput={event =>
                onChange({
                  ...settings,
                  sensitivity: Number((event.target as HTMLInputElement).value)
                })
              }
              class='w-full accent-[#e2ac65]'
            />
          </div>

          <div class='flex items-center justify-between gap-4 rounded border border-tlc-line/50 bg-tlc-bg/65 px-4 py-3'>
            <div>
              <label
                htmlFor='setting-subtitles'
                class='font-medium text-tlc-text'
              >
                Subtítulos de eventos sonoros
              </label>
              <p class='text-xs text-tlc-secondary'>
                Indica el zumbido del A-07, el aviso del árbol y el pestillo.
              </p>
            </div>
            <input
              id='setting-subtitles'
              type='checkbox'
              checked={settings.subtitles}
              onChange={event =>
                onChange({
                  ...settings,
                  subtitles: (event.target as HTMLInputElement).checked
                })
              }
              class='h-4 w-4 accent-[#e2ac65]'
            />
          </div>

          <div class='flex items-center justify-between gap-4 rounded border border-tlc-line/50 bg-tlc-bg/65 px-4 py-3'>
            <div>
              <label
                htmlFor='setting-reduced-motion'
                class='font-medium text-tlc-text'
              >
                Movimiento reducido
              </label>
              <p class='text-xs text-tlc-secondary'>
                Desactiva el balanceo al caminar y reduce las transiciones.
              </p>
            </div>
            <input
              id='setting-reduced-motion'
              type='checkbox'
              checked={settings.reducedMotion}
              onChange={event =>
                onChange({
                  ...settings,
                  reducedMotion: (event.target as HTMLInputElement).checked
                })
              }
              class='h-4 w-4 accent-[#e2ac65]'
            />
          </div>
        </div>

        <footer class='flex justify-end border-t border-tlc-line/60 px-6 py-4'>
          <button
            type='button'
            onClick={onClose}
            class='rounded border border-tlc-amber bg-tlc-amber/15 px-5 py-2 font-console text-xs text-tlc-text uppercase transition hover:bg-tlc-amber/25'
          >
            Listo
          </button>
        </footer>
      </div>
    </dialog>
  )
}
