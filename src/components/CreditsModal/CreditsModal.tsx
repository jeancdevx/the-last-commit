import { useEffect, useRef, useState } from 'preact/hooks'

export interface CreditsModalProps {
  reducedMotion?: boolean
  onClose: () => void
}

export default function CreditsModal({
  reducedMotion = false,
  onClose
}: CreditsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const rollRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(reducedMotion)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) {
      return
    }

    let rafId = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)

      last = now

      const el = rollRef.current

      if (el) {
        el.scrollTop += dt * 38
      }

      rafId = window.requestAnimationFrame(step)
    }

    rafId = window.requestAnimationFrame(step)

    return () => window.cancelAnimationFrame(rafId)
  }, [paused, reducedMotion])

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='credits-modal-title'
      class='fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col border-0 bg-[#040606] p-0 text-tlc-text'
    >
      <header class='relative z-10 flex items-center justify-between border-b border-tlc-text/10 bg-[#040606]/90 px-7 py-4 backdrop-blur-xs'>
        <h2
          id='credits-modal-title'
          class='font-console text-xs tracking-[0.26em] text-tlc-secondary uppercase'
        >
          Créditos · The Last Commit
        </h2>
        <div class='flex items-center gap-3'>
          {!reducedMotion && (
            <button
              type='button'
              onClick={() => setPaused(prev => !prev)}
              class='rounded border border-tlc-text/20 px-3 py-1 font-console text-[11px] text-tlc-secondary transition hover:border-tlc-amber hover:text-tlc-text'
            >
              {paused ? 'Reanudar rodillo' : 'Pausar'}
            </button>
          )}
          <button
            ref={closeRef}
            type='button'
            onClick={onClose}
            class='rounded border border-tlc-text/20 px-3 py-1 font-console text-[11px] text-tlc-text transition hover:border-tlc-amber'
          >
            Cerrar (Esc)
          </button>
        </div>
      </header>

      <div
        ref={rollRef}
        onWheel={() => setPaused(true)}
        class='flex-1 overflow-y-auto px-6 text-center'
      >
        <div class='mx-auto max-w-xl space-y-16 py-20'>
          <section class='space-y-3'>
            <p class='font-serif text-3xl text-tlc-text/80 italic'>the last</p>
            <p class='font-title text-6xl tracking-tight text-tlc-text lowercase'>
              commit
            </p>
            <p class='pt-2 font-console text-[11px] tracking-[0.22em] text-tlc-amber uppercase'>
              24 de diciembre de 2026 · Planta 04
            </p>
          </section>

          <section class='space-y-3'>
            <h3 class='font-console text-[11px] tracking-[0.28em] text-tlc-secondary uppercase'>
              Producción y kit original
            </h3>
            <p class='text-sm leading-relaxed text-tlc-text/90'>
              Modelos 3D (9 GLB originales en Blender), texturas de utilería,
              portada editorial{' '}
              <code class='font-console text-xs'>cover.webp</code> y banco base
              de 10 efectos de síntesis procedural.
            </p>
          </section>

          <section class='space-y-3'>
            <h3 class='font-console text-[11px] tracking-[0.28em] text-tlc-secondary uppercase'>
              Edición v2.0 · Dirección visual y sonora
            </h3>
            <ul class='space-y-2 text-sm text-tlc-text/85'>
              <li>
                Panorama nocturno de ciudad lluviosa y arte de logros generados
                para el proyecto
              </li>
              <li>
                Notas de voz de I. Salas, M. Rojas y efectos de caída eléctrica
                generados con ElevenLabs
              </li>
              <li>
                Motor WebGL 2, post-procesado AgX/Bloom/Grain, lluvia en GLSL,
                reverb DSP de oficina y cámaras CCTV en directo
              </li>
            </ul>
          </section>

          <section class='space-y-3'>
            <h3 class='font-console text-[11px] tracking-[0.28em] text-tlc-secondary uppercase'>
              Tipografías incluidas (SIL OFL)
            </h3>
            <ul class='space-y-2 text-sm text-tlc-text/85'>
              <li>Barlow Condensed Bold · Google Fonts / Fontsource</li>
              <li>IBM Plex Mono Medium · IBM / Fontsource</li>
              <li>Inter Regular y SemiBold · Rasmus Andersson / Fontsource</li>
              <li>Instrument Serif Regular e Italic · Rodrigo Fuenzalida</li>
            </ul>
          </section>

          <section class='space-y-3'>
            <h3 class='font-console text-[11px] tracking-[0.28em] text-tlc-secondary uppercase'>
              Tecnología web
            </h3>
            <p class='text-sm text-tlc-secondary'>
              Astro · Preact · Three.js · Web Audio API · Tailwind CSS v4 ·
              Playwright · Vitest
            </p>
          </section>

          <section class='pt-8 pb-24'>
            <p class='font-serif text-2xl text-tlc-amber italic'>
              Gracias por no dejar a nadie atrás después de medianoche.
            </p>
          </section>
        </div>
      </div>
    </dialog>
  )
}
