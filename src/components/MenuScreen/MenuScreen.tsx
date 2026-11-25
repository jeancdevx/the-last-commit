import { useState } from 'preact/hooks'

import { ACHIEVEMENTS, CHAPTERS } from '@/helpers/achievements.helpers'
import type { ChapterSpec, MetaProgress } from '@/helpers/achievements.helpers'
import { assetUrl, withBase } from '@/helpers/assets.helpers'
import { deriveStage } from '@/helpers/state.helpers'
import type { LoadSaveResult } from '@/helpers/storage.helpers'
import type { GameSettings, StoryManifest } from '@/types'

export interface MenuScreenProps {
  story: StoryManifest | null
  saveState: LoadSaveResult
  meta: MetaProgress
  sceneReady: boolean
  loadPercent: number
  loadDetail: string
  entering: boolean
  settings: GameSettings
  onPlayNew: () => void
  onContinue: () => void
  onSelectChapter: (chapter: ChapterSpec) => void
  onOpenAchievements: () => void
  onOpenSettings: () => void
  onOpenCredits: () => void
  onClearCorruptSave: () => void
  onToggleMute: () => void
  onHoverItem: () => void
}

export default function MenuScreen({
  story,
  saveState,
  meta,
  sceneReady,
  loadPercent,
  loadDetail,
  entering,
  settings,
  onPlayNew,
  onContinue,
  onSelectChapter,
  onOpenAchievements,
  onOpenSettings,
  onOpenCredits,
  onClearCorruptSave,
  onToggleMute,
  onHoverItem
}: MenuScreenProps) {
  const canContinue =
    saveState.status === 'ok' && !saveState.envelope.progress.exitUsed
  const savedStage =
    saveState.status === 'ok'
      ? deriveStage(saveState.envelope.progress, story ?? undefined)
      : null

  const [showChapters, setShowChapters] = useState(false)
  const [hoveredDesc, setHoveredDesc] = useState<string>(
    story?.tagline ??
      'El sistema dice que la oficina está vacía. Tú sigues dentro.'
  )

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen?.()
    }
  }

  return (
    <section
      aria-label='Menú principal de The Last Commit'
      class={`fixed inset-0 z-20 flex h-full w-full flex-col justify-between overflow-hidden select-none ${entering ? 'tlc-title-entering' : ''}`}
    >
      {/* Editorial cover art fades smoothly away once the live 3D office scene is ready */}
      <img
        src={assetUrl('art/cover.webp')}
        alt=''
        aria-hidden='true'
        class={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ease-out ${
          sceneReady ? 'opacity-0' : 'opacity-90'
        }`}
      />

      {/* Cinematic left/bottom gradient scrim over the live 3D office */}
      <div
        aria-hidden='true'
        class='tlc-title-shade pointer-events-none absolute inset-0'
      />

      {/* Fine vertical editorial hairline */}
      <div
        aria-hidden='true'
        class='tlc-title-rule pointer-events-none absolute top-0 bottom-0 left-[clamp(14px,3.6vw,58px)] w-px'
      />

      {/* Top minimal utility icons */}
      <header class='relative z-10 flex items-center justify-between px-[clamp(28px,7.5vw,124px)] pt-[clamp(18px,3vw,34px)]'>
        <div class='flex items-center gap-2.5 font-console text-[11px] tracking-[0.22em] text-tlc-text/65 uppercase'>
          <span class='inline-block h-1.5 w-1.5 rounded-full bg-tlc-amber shadow-[0_0_8px_#e2ac65]' />
          <span>
            {story?.opening.date ?? '24/12/2026'} ·{' '}
            {story?.opening.time ?? '23:52'} · Planta 04
          </span>
        </div>

        <div class='flex items-center gap-2'>
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

          <a
            href={withBase('diagnostico/')}
            class='rounded border border-tlc-text/15 bg-black/45 px-2.5 py-2 font-console text-[11px] tracking-wider text-tlc-text/65 uppercase backdrop-blur-xs transition hover:border-tlc-amber/60 hover:text-tlc-text'
          >
            Diagnóstico
          </a>
        </div>
      </header>

      {/* Main editorial logo & menu / chapter selector / integrated loader */}
      <div class='relative z-10 flex flex-col items-start gap-8 px-[clamp(28px,7.5vw,124px)]'>
        <div class='space-y-1'>
          <span
            aria-hidden='true'
            class='block font-serif text-[clamp(30px,4vw,58px)] leading-none text-tlc-text/85 italic drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]'
          >
            the last
          </span>
          <h1 class='font-title text-[clamp(62px,8vw,118px)] leading-[0.9] tracking-[-0.02em] text-[#f3efe7] lowercase drop-shadow-[0_4px_28px_rgba(0,0,0,0.92)]'>
            <span class='sr-only'>The Last Commit</span>
            <span aria-hidden='true'>
              commit
              <span class='tlc-caret' />
            </span>
          </h1>
        </div>

        {saveState.status === 'corrupt' && (
          <div
            role='alert'
            class='max-w-sm rounded border border-tlc-danger/60 bg-black/75 p-4 text-sm text-tlc-text backdrop-blur-xs'
          >
            <p class='font-console text-xs tracking-wider text-tlc-danger uppercase'>
              Partida guardada dañada
            </p>
            <p class='mt-1 text-xs text-tlc-secondary'>{saveState.message}</p>
            <button
              type='button'
              onClick={onClearCorruptSave}
              class='mt-3 rounded border border-tlc-danger/60 px-3 py-1.5 font-console text-[11px] text-tlc-text transition hover:border-tlc-danger'
            >
              Descartar datos dañados
            </button>
          </div>
        )}

        {!sceneReady ? (
          <div aria-live='polite' class='grid w-[min(320px,82vw)] gap-2.5'>
            <div class='flex items-baseline justify-between gap-3 font-console text-[11px] tracking-[0.16em] text-tlc-text/80 uppercase'>
              <span class='truncate'>{loadDetail}</span>
              <span class='min-w-[4ch] text-right text-tlc-amber tabular-nums'>
                {loadPercent}%
              </span>
            </div>
            <div class='relative h-[3px] w-full overflow-hidden rounded-full bg-tlc-text/15'>
              <div
                class='tlc-loading-sheen relative h-full rounded-full bg-gradient-to-r from-[#c47d3b] to-[#f0bd74] shadow-[0_0_14px_rgba(226,172,101,0.75)] transition-all duration-200'
                style={{ width: `${Math.max(6, loadPercent)}%` }}
              />
            </div>
            <p class='font-console text-[10px] tracking-[0.14em] text-tlc-text/50 uppercase'>
              Preparando iluminación, audio espacial y modelos 3D
            </p>
          </div>
        ) : showChapters ? (
          <div class='flex w-full max-w-md flex-col items-start gap-2'>
            <p class='font-console text-[11px] tracking-[0.22em] text-tlc-amber uppercase'>
              Capítulos · Planta 04 ({meta.chapters.length} / {CHAPTERS.length})
            </p>
            {CHAPTERS.map(chapter => {
              const unlocked = meta.chapters.includes(chapter.id)

              return (
                <button
                  key={chapter.id}
                  type='button'
                  disabled={!unlocked}
                  onClick={() => onSelectChapter(chapter)}
                  onMouseEnter={() => {
                    onHoverItem()
                    setHoveredDesc(
                      unlocked
                        ? chapter.description
                        : 'Alcanza este hito durante tu guardia para desbloquearlo.'
                    )
                  }}
                  class={`tlc-menu-item font-serif text-[clamp(20px,1.8vw,26px)] ${
                    unlocked ? '' : 'cursor-not-allowed opacity-35'
                  }`}
                >
                  <span class='font-console text-[11px] tracking-[0.14em] text-tlc-amber uppercase'>
                    {chapter.kicker}
                  </span>
                  <span>{unlocked ? chapter.title : 'Capítulo bloqueado'}</span>
                  <span class='font-console text-[11px] text-tlc-text/55 tabular-nums'>
                    {unlocked ? chapter.time : '—'}
                  </span>
                </button>
              )
            })}
            <button
              type='button'
              onClick={() => setShowChapters(false)}
              class='tlc-menu-item mt-2 font-console text-xs tracking-[0.18em] text-tlc-secondary uppercase'
            >
              ← Volver al menú
            </button>
          </div>
        ) : (
          <nav
            aria-label='Acciones principales'
            class='flex flex-col items-start gap-0.5'
          >
            {canContinue && savedStage && (
              <button
                type='button'
                onClick={onContinue}
                onMouseEnter={() => {
                  onHoverItem()
                  setHoveredDesc(
                    `Retomar tu guardia en la Planta 04 desde las ${savedStage.time}.`
                  )
                }}
                class='tlc-menu-item is-primary font-serif text-[clamp(24px,2.1vw,32px)]'
              >
                <span>Continuar</span>
                <span class='font-console text-[11px] tracking-[0.12em] text-tlc-amber uppercase tabular-nums'>
                  {savedStage.time}
                </span>
              </button>
            )}

            <button
              type='button'
              onClick={onPlayNew}
              onMouseEnter={() => {
                onHoverItem()
                setHoveredDesc(
                  story?.tagline ??
                    'El sistema dice que la oficina está vacía. Tú sigues dentro.'
                )
              }}
              class={`tlc-menu-item font-serif text-[clamp(24px,2.1vw,32px)] ${canContinue ? '' : 'is-primary'}`}
            >
              <span>{canContinue ? 'Empezar de nuevo' : 'Jugar'}</span>
            </button>

            <button
              type='button'
              onClick={() => setShowChapters(true)}
              onMouseEnter={() => {
                onHoverItem()
                setHoveredDesc(
                  'Rejuega cualquier hito desbloqueado de la guardia de Nochebuena.'
                )
              }}
              class='tlc-menu-item font-serif text-[clamp(20px,1.75vw,26px)]'
            >
              <span>Capítulos</span>
              <span class='font-console text-[11px] tracking-[0.12em] text-tlc-text/50 tabular-nums'>
                {meta.chapters.length}/{CHAPTERS.length}
              </span>
            </button>

            <button
              type='button'
              onClick={onOpenAchievements}
              onMouseEnter={() => {
                onHoverItem()
                setHoveredDesc(
                  'Inspecciona tus logros de Planta 04 y los finales descubiertos.'
                )
              }}
              class='tlc-menu-item font-serif text-[clamp(20px,1.75vw,26px)]'
            >
              <span>Logros</span>
              <span class='font-console text-[11px] tracking-[0.12em] text-tlc-amber tabular-nums'>
                {meta.achievements.length}/{ACHIEVEMENTS.length}
              </span>
            </button>

            <button
              type='button'
              onClick={onOpenSettings}
              onMouseEnter={() => {
                onHoverItem()
                setHoveredDesc(
                  'Volumen, sensibilidad, subtítulos de sonido y movimiento reducido.'
                )
              }}
              class='tlc-menu-item font-serif text-[clamp(20px,1.75vw,26px)]'
            >
              <span>Ajustes</span>
            </button>

            <button
              type='button'
              onClick={onOpenCredits}
              onMouseEnter={() => {
                onHoverItem()
                setHoveredDesc(
                  'Procedencia del kit, voces ElevenLabs y licencias tipográficas OFL.'
                )
              }}
              class='tlc-menu-item font-serif text-[clamp(20px,1.75vw,26px)]'
            >
              <span>Créditos</span>
            </button>
          </nav>
        )}
      </div>

      {/* Editorial bottom bar: live contextual description + atmospheric warning */}
      <footer class='relative z-10 flex flex-wrap items-end justify-between gap-4 px-[clamp(28px,7.5vw,124px)] pb-[clamp(18px,3vw,34px)]'>
        <div class='space-y-2'>
          <p class='max-w-[48ch] font-serif text-[clamp(15px,1.25vw,19px)] leading-snug text-tlc-text/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]'>
            {hoveredDesc}
          </p>
          <p class='flex flex-wrap items-center gap-3 font-console text-[11px] tracking-[0.08em] text-tlc-text/50'>
            <span>WASD caminar</span>
            <span>·</span>
            <span>Ratón mirar</span>
            <span>·</span>
            <span>E interactuar</span>
            <span>·</span>
            <span>Esc pausa</span>
          </p>
        </div>

        <p class='text-right font-console text-[11px] leading-relaxed text-tlc-text/45'>
          Usa auriculares. Juega a solas. Juega a oscuras.
          <br />
          <span class='text-tlc-text/30'>
            {meta.endings.length > 0
              ? `Finales descubiertos: ${meta.endings.length}/3 · Planta 04`
              : '12–15 min · Audio opcional con subtítulos · Planta 04'}
          </span>
        </p>
      </footer>
    </section>
  )
}
