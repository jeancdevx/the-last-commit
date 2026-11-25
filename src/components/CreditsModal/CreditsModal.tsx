import { useEffect, useRef } from 'preact/hooks'

export interface CreditsModalProps {
  onClose: () => void
}

export default function CreditsModal({ onClose }: CreditsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='credits-modal-title'
      class='fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/85 p-4 text-tlc-text backdrop-blur-xs'
    >
      <div class='max-h-[88vh] w-full max-w-xl overflow-y-auto rounded border border-tlc-line bg-tlc-panel p-6 shadow-2xl'>
        <header class='flex items-center justify-between border-b border-tlc-line/60 pb-4'>
          <h2
            id='credits-modal-title'
            class='font-title text-3xl tracking-wide text-tlc-text uppercase'
          >
            Créditos y licencias
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

        <div class='mt-5 space-y-4 text-sm leading-relaxed text-tlc-secondary'>
          <section>
            <h3 class='font-console text-xs tracking-wider text-tlc-amber uppercase'>
              Producción original del kit
            </h3>
            <ul class='mt-2 list-disc space-y-1.5 pl-5'>
              <li>
                <strong class='text-tlc-text'>Modelos 3D (9 GLB):</strong>{' '}
                Producción original con Blender para The Last Commit.
              </li>
              <li>
                <strong class='text-tlc-text'>Texturas y portada:</strong>{' '}
                Generación original del proyecto y composición editorial{' '}
                <code class='font-console text-xs text-tlc-text'>
                  cover.webp
                </code>
                .
              </li>
              <li>
                <strong class='text-tlc-text'>Audio (10 clips):</strong>{' '}
                Síntesis procedural original y motivo de tres notas sin
                grabaciones de terceros.
              </li>
            </ul>
          </section>

          <section>
            <h3 class='font-console text-xs tracking-wider text-tlc-amber uppercase'>
              Tipografías incluidas (SIL OFL)
            </h3>
            <ul class='mt-2 list-disc space-y-1.5 pl-5'>
              <li>
                <strong class='text-tlc-text'>Barlow Condensed Bold</strong> ·
                Google Fonts / Fontsource (OFL)
              </li>
              <li>
                <strong class='text-tlc-text'>IBM Plex Mono Medium</strong> ·
                IBM / Fontsource (OFL)
              </li>
              <li>
                <strong class='text-tlc-text'>Inter Regular y SemiBold</strong>{' '}
                · Rasmus Andersson / Fontsource (OFL)
              </li>
            </ul>
          </section>

          <section>
            <h3 class='font-console text-xs tracking-wider text-tlc-amber uppercase'>
              Tecnología web
            </h3>
            <p class='mt-1.5'>
              Construido con Astro (salida estática), Preact, Three.js, Web
              Audio API y Tailwind CSS. Todos los procesos de consola y commit
              son ficticios y locales al navegador.
            </p>
          </section>
        </div>
      </div>
    </dialog>
  )
}
