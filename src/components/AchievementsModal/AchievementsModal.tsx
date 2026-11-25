import { useEffect, useRef } from 'preact/hooks'

import { ACHIEVEMENTS } from '@/helpers/achievements.helpers'
import type { MetaProgress } from '@/helpers/achievements.helpers'
import { assetUrl } from '@/helpers/assets.helpers'

export interface AchievementsModalProps {
  meta: MetaProgress
  onClose: () => void
}

export default function AchievementsModal({
  meta,
  onClose
}: AchievementsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const unlockedCount = meta.achievements.length
  const totalCount = ACHIEVEMENTS.length
  const pct = Math.round((unlockedCount / totalCount) * 100)

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='achievements-modal-title'
      class='fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#050807]/88 p-4 text-tlc-text backdrop-blur-sm'
    >
      <div class='flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-tlc-text/15 bg-[#0e1513] shadow-[0_24px_80px_rgba(0,0,0,0.9)]'>
        <header class='flex items-center justify-between gap-4 px-7 pt-6 pb-4'>
          <div>
            <p class='font-console text-[11px] tracking-[0.22em] text-tlc-amber uppercase'>
              Archivo personal · Planta 04
            </p>
            <h2
              id='achievements-modal-title'
              class='mt-1 font-serif text-4xl text-tlc-text italic'
            >
              Logros descubiertos
            </h2>
          </div>

          <div class='flex items-center gap-5'>
            <div class='text-right font-console text-xs tracking-[0.16em] text-tlc-secondary'>
              <strong class='mr-1 text-2xl font-medium text-tlc-amber tabular-nums'>
                {unlockedCount}
              </strong>
              <span>/ {totalCount}</span>
            </div>
            <button
              ref={closeRef}
              type='button'
              onClick={onClose}
              class='rounded border border-tlc-text/20 px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-amber hover:text-tlc-text'
            >
              Cerrar (Esc)
            </button>
          </div>
        </header>

        <div class='mx-7 h-[2px] overflow-hidden bg-tlc-text/10'>
          <div
            class='h-full bg-tlc-amber shadow-[0_0_12px_rgba(226,172,101,0.7)] transition-all duration-300'
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul class='grid flex-1 grid-cols-2 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-3 md:grid-cols-5'>
          {ACHIEVEMENTS.map(item => {
            const unlocked = meta.achievements.includes(item.id)
            const hiddenSecret = Boolean(item.secret && !unlocked)

            return (
              <li key={item.id} class='group flex flex-col'>
                <div
                  class={`relative mb-2.5 aspect-square overflow-hidden border bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.85)] transition ${
                    unlocked
                      ? 'border-tlc-amber/45 group-hover:border-tlc-amber'
                      : 'border-tlc-text/10'
                  }`}
                >
                  {hiddenSecret ? (
                    <div class='grid h-full w-full place-items-center bg-[#090d0c] font-serif text-4xl text-tlc-text/20 italic'>
                      ?
                    </div>
                  ) : (
                    <img
                      src={assetUrl(item.art)}
                      alt={item.title}
                      class={`h-full w-full object-cover transition duration-500 ${
                        unlocked
                          ? 'group-hover:scale-105'
                          : 'blur-[0.8px] brightness-[0.38] contrast-125 grayscale'
                      }`}
                    />
                  )}
                  <div
                    aria-hidden='true'
                    class='pointer-events-none absolute inset-0 shadow-[inset_0_0_26px_rgba(0,0,0,0.85)]'
                  />
                </div>

                <p
                  class={`text-xs font-semibold ${
                    unlocked ? 'text-tlc-text' : 'text-tlc-text/45'
                  }`}
                >
                  {hiddenSecret ? 'Logro secreto' : item.title}
                </p>
                <p
                  class={`mt-0.5 text-[11px] leading-snug ${
                    unlocked ? 'text-tlc-secondary' : 'text-tlc-text/30'
                  }`}
                >
                  {hiddenSecret
                    ? 'Toma otra decisión durante el cierre anual para descubrirlo.'
                    : item.description}
                </p>
              </li>
            )
          })}
        </ul>

        <footer class='flex flex-wrap items-center justify-between gap-2 border-t border-tlc-text/10 px-7 py-3.5 font-console text-[11px] text-tlc-secondary'>
          <span>Finales registrados: {meta.endings.length} / 3</span>
          <span>Capítulos desbloqueados: {meta.chapters.length} / 4</span>
        </footer>
      </div>
    </dialog>
  )
}
