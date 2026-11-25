import { useEffect, useRef, useState } from 'preact/hooks'

import {
  allFoliosRestored,
  deriveStage,
  getGuidanceSummary,
  getPuzzleStatus
} from '@/helpers/state.helpers'
import type { ClueId, GameProgress, PuzzleId, StoryManifest } from '@/types'

export interface ConsolePanelProps {
  story: StoryManifest
  progress: GameProgress
  onSubmitAnswer: (
    puzzleId: PuzzleId,
    optionId: string
  ) => { ok: boolean; message: string }
  onConfirmCommit: () => { ok: boolean; message: string }
  onInspectClue: (clueId: ClueId) => void
  onClose: () => void
}

export default function ConsolePanel({
  story,
  progress,
  onSubmitAnswer,
  onConfirmCommit,
  onInspectClue,
  onClose
}: ConsolePanelProps) {
  const defaultPuzzle =
    story.puzzles.find(item => !progress.restored[item.id])?.id ?? 'folio-07'
  const [selectedPuzzleId, setSelectedPuzzleId] =
    useState<PuzzleId>(defaultPuzzle)
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({})
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'hint' | 'info'
    text: string
  } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const stage = deriveStage(progress, story)
  const activePuzzle =
    story.puzzles.find(item => item.id === selectedPuzzleId) ?? story.puzzles[0]
  const activeStatus = getPuzzleStatus(progress, story, activePuzzle.id)
  const readyToCommit = allFoliosRestored(progress)
  const guidance = getGuidanceSummary(progress)
  const selectedOption = selectedOptions[activePuzzle.id] ?? ''

  const handleValidate = () => {
    if (!selectedOption) {
      setFeedback({
        kind: 'hint',
        text: 'Selecciona una opción antes de validar el registro.'
      })

      return
    }

    const result = onSubmitAnswer(activePuzzle.id, selectedOption)

    setFeedback({
      kind: result.ok ? 'ok' : 'hint',
      text: result.message
    })
  }

  const handleCommit = () => {
    const result = onConfirmCommit()

    setFeedback({
      kind: result.ok ? 'ok' : 'hint',
      text: result.message
    })
  }

  const restoredCount = story.puzzles.filter(
    item => progress.restored[item.id]
  ).length

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='console-panel-title'
      class='fixed inset-0 z-30 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/84 p-3 text-tlc-text backdrop-blur-xs sm:p-6'
    >
      <div class='tlc-scanlines flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-tlc-line bg-tlc-panel shadow-2xl'>
        <header class='flex flex-wrap items-center justify-between gap-4 border-b border-tlc-line/70 bg-[#131b18] px-6 py-4'>
          <div>
            <p class='font-console text-xs tracking-[0.2em] text-tlc-secondary uppercase'>
              Puesto A-06 · {story.opening.date} · {stage.time}
            </p>
            <h2
              id='console-panel-title'
              class='mt-1 font-title text-3xl tracking-wide text-tlc-text uppercase'
            >
              {story.opening.panelTitle}
            </h2>
          </div>

          <div class='flex items-center gap-3'>
            <span class='rounded border border-tlc-line/70 bg-tlc-bg/80 px-3 py-1 font-console text-xs text-tlc-amber'>
              Turnos restaurados: {restoredCount} / 3
            </span>
            <button
              ref={closeRef}
              type='button'
              onClick={onClose}
              class='rounded border border-tlc-line px-3 py-1.5 font-console text-xs text-tlc-text transition hover:border-tlc-amber'
            >
              Salir de consola (Esc)
            </button>
          </div>
        </header>

        <div class='border-b border-tlc-line/60 bg-[#141d19] px-6 py-3 font-console text-xs'>
          {progress.commitConfirmed ? (
            <p class='flex items-center gap-2 text-tlc-positive'>
              <span aria-hidden='true'>✓</span>
              <span>
                {story.commit.success} {story.commit.exitCue}
              </span>
            </p>
          ) : !progress.restored['folio-07'] ? (
            <p class='flex items-center gap-2 text-tlc-danger'>
              <span aria-hidden='true'>!</span>
              <span>{story.opening.line}</span>
            </p>
          ) : (
            <p class='flex items-center gap-2 text-tlc-positive'>
              <span aria-hidden='true'>✓</span>
              <span>{guidance}</span>
            </p>
          )}
        </div>

        <div class='grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.45fr_0.95fr]'>
          <section aria-label='Casos de cierre anual' class='space-y-5'>
            <div
              role='tablist'
              aria-label='Folios pendientes'
              class='grid grid-cols-3 gap-2.5'
            >
              {story.puzzles.map(puzzle => {
                const status = getPuzzleStatus(progress, story, puzzle.id)
                const isSelected = puzzle.id === activePuzzle.id
                const stationLabel =
                  puzzle.folio === '07'
                    ? 'A-07'
                    : puzzle.folio === '19'
                      ? 'B-02'
                      : 'A-06'

                return (
                  <button
                    key={puzzle.id}
                    type='button'
                    role='tab'
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedPuzzleId(puzzle.id)
                      setFeedback(null)
                    }}
                    class={
                      isSelected
                        ? 'rounded border border-tlc-amber bg-tlc-amber/15 px-3 py-2.5 text-left transition'
                        : 'rounded border border-tlc-line/70 bg-tlc-bg/65 px-3 py-2.5 text-left transition hover:border-tlc-text/45'
                    }
                  >
                    <div class='flex items-center justify-between font-console text-xs'>
                      <span class='font-semibold text-tlc-text'>
                        Folio {puzzle.folio}
                      </span>
                      <span class='text-tlc-secondary'>{stationLabel}</span>
                    </div>
                    <p
                      class={
                        status.restored
                          ? 'mt-1 font-console text-[11px] text-tlc-positive'
                          : status.unlocked
                            ? 'mt-1 font-console text-[11px] text-tlc-amber'
                            : 'mt-1 font-console text-[11px] text-tlc-secondary'
                      }
                    >
                      {status.restored
                        ? '✓ Restaurado'
                        : status.unlocked
                          ? '● Listo para validar'
                          : '○ Falta evidencia'}
                    </p>
                  </button>
                )
              })}
            </div>

            <div class='rounded border border-tlc-line/70 bg-tlc-bg/75 p-5'>
              <div class='flex items-center justify-between gap-3'>
                <h3 class='font-title text-2xl tracking-wide text-tlc-text uppercase'>
                  Folio {activePuzzle.folio}
                </h3>
                <span
                  class={
                    activeStatus.restored
                      ? 'rounded border border-tlc-positive/60 bg-tlc-positive/10 px-2.5 py-0.5 font-console text-xs text-tlc-positive'
                      : activeStatus.unlocked
                        ? 'rounded border border-tlc-amber/60 bg-tlc-amber/10 px-2.5 py-0.5 font-console text-xs text-tlc-amber'
                        : 'rounded border border-tlc-line px-2.5 py-0.5 font-console text-xs text-tlc-secondary'
                  }
                >
                  {activeStatus.restored
                    ? '✓ Estado: Restaurado'
                    : activeStatus.unlocked
                      ? 'En revisión'
                      : 'Bloqueado'}
                </span>
              </div>

              {activeStatus.restored ? (
                <div class='mt-4 rounded border border-tlc-positive/50 bg-tlc-positive/10 p-4 text-sm text-tlc-positive'>
                  <p class='font-medium'>✓ {activePuzzle.success}</p>
                </div>
              ) : !activeStatus.unlocked ? (
                <div class='mt-4 space-y-3'>
                  <p class='text-sm text-tlc-secondary'>
                    {activeStatus.blockedMessage}
                  </p>
                  <p class='rounded border border-tlc-line/60 bg-tlc-panel/80 px-3.5 py-2.5 font-console text-xs text-tlc-amber'>
                    Guía: {guidance}
                  </p>
                </div>
              ) : (
                <div class='mt-4 space-y-4'>
                  <p class='text-sm font-medium text-tlc-text'>
                    {activePuzzle.prompt}
                  </p>

                  <fieldset class='space-y-2.5'>
                    <legend class='sr-only'>{activePuzzle.prompt}</legend>
                    {activePuzzle.options.map(option => {
                      const checked = selectedOption === option.id
                      const inputId = `option-${activePuzzle.id}-${option.id}`

                      return (
                        <label
                          key={option.id}
                          htmlFor={inputId}
                          class={
                            checked
                              ? 'flex cursor-pointer items-center gap-3 rounded border border-tlc-amber bg-tlc-amber/12 px-4 py-3 font-console text-sm text-tlc-text'
                              : 'flex cursor-pointer items-center gap-3 rounded border border-tlc-line/65 bg-tlc-panel/70 px-4 py-3 font-console text-sm text-tlc-secondary transition hover:border-tlc-text/50 hover:text-tlc-text'
                          }
                        >
                          <input
                            id={inputId}
                            type='radio'
                            name={`puzzle-${activePuzzle.id}`}
                            value={option.id}
                            checked={checked}
                            onChange={() =>
                              setSelectedOptions(prev => ({
                                ...prev,
                                [activePuzzle.id]: option.id
                              }))
                            }
                            class='h-4 w-4 accent-[#e2ac65]'
                          />
                          <span>{option.label}</span>
                        </label>
                      )
                    })}
                  </fieldset>

                  <button
                    type='button'
                    onClick={handleValidate}
                    class='rounded border border-tlc-amber bg-tlc-amber/18 px-5 py-2.5 font-console text-xs tracking-wide text-tlc-text uppercase transition hover:bg-tlc-amber/30'
                  >
                    Validar folio {activePuzzle.folio}
                  </button>
                </div>
              )}

              {feedback && (
                <output
                  aria-live='polite'
                  class={
                    feedback.kind === 'ok'
                      ? 'mt-4 block rounded border border-tlc-positive/60 bg-tlc-positive/10 px-4 py-3 text-sm text-tlc-positive'
                      : 'mt-4 block rounded border border-tlc-danger/60 bg-tlc-danger/10 px-4 py-3 text-sm text-tlc-danger'
                  }
                >
                  {feedback.text}
                </output>
              )}
            </div>

            <div class='rounded border border-tlc-line/70 bg-tlc-bg/75 p-5'>
              <div class='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h3 class='font-title text-xl tracking-wide text-tlc-text uppercase'>
                    Cierre y confirmación
                  </h3>
                  <p class='mt-1 text-xs text-tlc-secondary'>
                    {progress.commitConfirmed
                      ? `${story.commit.success} ${story.commit.exitCue}`
                      : readyToCommit
                        ? 'Los tres turnos han sido reconstruidos. Confirma para liberar la salida.'
                        : 'Restaura los tres folios para habilitar la confirmación de salida.'}
                  </p>
                </div>

                <button
                  type='button'
                  onClick={handleCommit}
                  disabled={!readyToCommit || progress.commitConfirmed}
                  class={
                    progress.commitConfirmed
                      ? 'rounded border border-tlc-positive/70 bg-tlc-positive/15 px-4 py-2.5 font-console text-xs text-tlc-positive'
                      : readyToCommit
                        ? 'rounded border border-tlc-positive bg-tlc-positive/18 px-5 py-2.5 font-console text-xs font-medium tracking-wide text-tlc-text uppercase transition hover:bg-tlc-positive/30'
                        : 'cursor-not-allowed rounded border border-tlc-line/50 bg-tlc-panel/60 px-4 py-2.5 font-console text-xs text-tlc-secondary opacity-60'
                  }
                >
                  {progress.commitConfirmed
                    ? '✓ Restauración confirmada'
                    : story.commit.button}
                </button>
              </div>
            </div>
          </section>

          <aside
            aria-label='Registro de pistas recopiladas'
            class='flex flex-col rounded border border-tlc-line/70 bg-tlc-bg/70 p-4'
          >
            <div class='flex items-center justify-between border-b border-tlc-line/50 pb-3'>
              <h3 class='font-title text-xl tracking-wide text-tlc-text uppercase'>
                Registro de pistas
              </h3>
              <span class='font-console text-xs text-tlc-secondary'>
                {progress.clues.length} / 6
              </span>
            </div>

            {progress.clues.length === 0 ? (
              <p class='mt-4 text-sm text-tlc-secondary'>
                Todavía no hay evidencias registradas. Recorre recepción para
                inspeccionar el árbol y la bitácora.
              </p>
            ) : (
              <ul class='mt-3 space-y-2.5 overflow-y-auto'>
                {progress.clues.map(clueId => {
                  const clue = story.clues[clueId]

                  return (
                    <li
                      key={clueId}
                      class='rounded border border-tlc-line/60 bg-tlc-panel/80 p-3'
                    >
                      <div class='flex items-start justify-between gap-2'>
                        <p class='font-console text-xs font-medium text-tlc-amber'>
                          {clue.title}
                        </p>
                        <button
                          type='button'
                          onClick={() => onInspectClue(clueId)}
                          class='shrink-0 rounded border border-tlc-line/70 px-2 py-0.5 font-console text-[11px] text-tlc-secondary transition hover:border-tlc-amber hover:text-tlc-text'
                        >
                          Ver
                        </button>
                      </div>
                      <p class='mt-1.5 text-xs leading-relaxed text-tlc-text/90'>
                        {clue.text}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </dialog>
  )
}
