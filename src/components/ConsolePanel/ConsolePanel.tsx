import { useEffect, useRef, useState } from 'preact/hooks'

import {
  CORPORATE_CHAT,
  CORPORATE_EMAILS,
  executeTerminalCommand
} from '@/helpers/osData.helpers'
import {
  allFoliosRestored,
  deriveStage,
  getGuidanceSummary,
  getPuzzleStatus
} from '@/helpers/state.helpers'
import type {
  CctvFeed,
  ClueId,
  GameProgress,
  PuzzleId,
  StoryManifest
} from '@/types'

export interface ConsolePanelProps {
  story: StoryManifest
  progress: GameProgress
  cctvFeeds: CctvFeed[]
  emailsRead: string[]
  onRefreshCctv: () => void
  onSubmitAnswer: (
    puzzleId: PuzzleId,
    optionId: string
  ) => { ok: boolean; message: string }
  onConfirmCommit: () => { ok: boolean; message: string }
  onForceEnding: () => void
  onInspectClue: (clueId: ClueId) => void
  onPlayVoicemail: (file: string, onEnded: () => void) => boolean
  onStopVoicemail: () => void
  onEmailRead: (emailId: string) => void
  onTerminalUsed: () => void
  onCctvOpened: () => void
  onClose: () => void
}

type WorkspaceTab = 'folios' | 'mail' | 'chat' | 'terminal' | 'cctv'

interface TerminalEntry {
  id: number
  command: string
  lines: string[]
  isDanger?: boolean
}

const INITIAL_TERMINAL_LOG: TerminalEntry[] = [
  {
    id: 0,
    command: 'motd',
    lines: [
      'Planta 04 · Terminal de cierre anual v2.6 (a06.planta04.local)',
      'Escribe «help» o pulsa un comando rápido para inspeccionar el repositorio.'
    ]
  }
]

const QUICK_COMMANDS = [
  'git status',
  'git log',
  'tail cierre.log',
  'whoami',
  'git commit --force'
] as const

export default function ConsolePanel({
  story,
  progress,
  cctvFeeds,
  emailsRead,
  onRefreshCctv,
  onSubmitAnswer,
  onConfirmCommit,
  onForceEnding,
  onInspectClue,
  onPlayVoicemail,
  onStopVoicemail,
  onEmailRead,
  onTerminalUsed,
  onCctvOpened,
  onClose
}: ConsolePanelProps) {
  const defaultPuzzle =
    story.puzzles.find(item => !progress.restored[item.id])?.id ?? 'folio-07'
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('folios')
  const [selectedPuzzleId, setSelectedPuzzleId] =
    useState<PuzzleId>(defaultPuzzle)
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({})
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'hint' | 'info'
    text: string
  } | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string>('ops-closing')
  const [playingVoiceFile, setPlayingVoiceFile] = useState<string | null>(null)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalHistory, setTerminalHistory] =
    useState<TerminalEntry[]>(INITIAL_TERMINAL_LOG)
  const [enlargedCamId, setEnlargedCamId] = useState<CctvFeed['id'] | null>(
    null
  )
  const [confirmForcePrompt, setConfirmForcePrompt] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const terminalBottomRef = useRef<HTMLDivElement>(null)
  const nextTerminalIdRef = useRef(1)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      onStopVoicemail()
    }
  }, [onStopVoicemail])

  const stage = deriveStage(progress, story)
  const activePuzzle =
    story.puzzles.find(item => item.id === selectedPuzzleId) ?? story.puzzles[0]
  const activeStatus = getPuzzleStatus(progress, story, activePuzzle.id)
  const readyToCommit = allFoliosRestored(progress)
  const guidance = getGuidanceSummary(progress)
  const selectedOption = selectedOptions[activePuzzle.id] ?? ''

  const visibleEmails = CORPORATE_EMAILS.filter(
    email => !email.unlockWhen || email.unlockWhen(progress)
  )
  const activeEmail =
    visibleEmails.find(email => email.id === selectedEmailId) ??
    visibleEmails[0]
  const unreadEmailsCount = visibleEmails.filter(
    email => !emailsRead.includes(email.id)
  ).length

  const visibleChat = CORPORATE_CHAT.filter(
    msg => !msg.visibleWhen || msg.visibleWhen(progress)
  )

  const handleSelectTab = (tab: WorkspaceTab) => {
    if (tab !== 'mail' && playingVoiceFile) {
      onStopVoicemail()
      setPlayingVoiceFile(null)
    }

    setWorkspaceTab(tab)

    if (tab === 'mail' && activeEmail) {
      onEmailRead(activeEmail.id)
    }

    if (tab === 'cctv') {
      onRefreshCctv()
      onCctvOpened()
    }
  }

  const handleSelectEmail = (emailId: string) => {
    if (playingVoiceFile) {
      onStopVoicemail()
      setPlayingVoiceFile(null)
    }

    setSelectedEmailId(emailId)
    onEmailRead(emailId)
  }

  const handleToggleVoice = (file: string) => {
    if (playingVoiceFile === file) {
      onStopVoicemail()
      setPlayingVoiceFile(null)

      return
    }

    const started = onPlayVoicemail(file, () => {
      setPlayingVoiceFile(prev => (prev === file ? null : prev))
    })

    if (started) {
      setPlayingVoiceFile(file)
    }
  }

  const runTerminal = (raw: string) => {
    const trimmed = raw.trim()

    if (!trimmed) return

    const result = executeTerminalCommand(trimmed, progress)
    const entryId = nextTerminalIdRef.current

    nextTerminalIdRef.current += 1
    setTerminalHistory(prev => [
      ...prev,
      {
        id: entryId,
        command: trimmed,
        lines: result.lines,
        isDanger: Boolean(result.triggerForceEnding)
      }
    ])
    setTerminalInput('')
    onTerminalUsed()

    window.setTimeout(() => {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 30)

    if (result.triggerForceEnding) {
      window.setTimeout(() => {
        onForceEnding()
      }, 650)
    }
  }

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

  const tabClass = (tab: WorkspaceTab) =>
    workspaceTab === tab
      ? 'relative rounded border border-tlc-amber bg-tlc-amber/15 px-3 py-1.5 font-console text-xs text-tlc-text transition'
      : 'relative rounded border border-tlc-line/70 bg-tlc-bg/60 px-3 py-1.5 font-console text-xs text-tlc-secondary transition hover:border-tlc-text/40 hover:text-tlc-text'

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='console-panel-title'
      class='fixed inset-0 z-30 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#050807]/84 p-3 text-tlc-text backdrop-blur-sm sm:p-6'
    >
      <div class='tlc-scanlines flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-tlc-line/80 bg-[#0f1614] shadow-[0_24px_80px_rgba(0,0,0,0.9)]'>
        {/* Corporate OS Workstation Titlebar */}
        <div class='flex items-center justify-between gap-3 border-b border-tlc-line/60 bg-[#0a100e] px-4 py-2.5 font-console text-[11px] text-tlc-secondary'>
          <div class='flex items-center gap-2.5'>
            <span class='inline-flex gap-1.5' aria-hidden='true'>
              <span class='h-2.5 w-2.5 rounded-full bg-tlc-danger/75' />
              <span class='h-2.5 w-2.5 rounded-full bg-tlc-amber/75' />
              <span class='h-2.5 w-2.5 rounded-full bg-tlc-positive/75' />
            </span>
            <span class='text-tlc-text/85'>
              planta-04@a06:~/escritorio-cierre
            </span>
          </div>

          <div class='flex items-center gap-3'>
            <span class='hidden text-tlc-amber tabular-nums sm:inline'>
              {story.opening.date} · {stage.time}
            </span>
            <button
              ref={closeRef}
              type='button'
              onClick={onClose}
              class='rounded border border-tlc-line/70 px-2.5 py-1 text-[11px] text-tlc-text transition hover:border-tlc-amber'
            >
              Salir (Esc)
            </button>
          </div>
        </div>

        {/* Workspace header + OS App Dock */}
        <header class='flex flex-wrap items-center justify-between gap-4 border-b border-tlc-line/60 bg-[#121b18] px-6 py-3.5'>
          <div>
            <h2
              id='console-panel-title'
              class='font-title text-2xl tracking-wide text-tlc-text uppercase sm:text-3xl'
            >
              {story.opening.panelTitle}
            </h2>
            <p class='mt-0.5 font-console text-xs text-tlc-secondary'>
              Turnos restaurados:{' '}
              <strong class='text-tlc-amber'>{restoredCount} / 3</strong>
            </p>
          </div>

          <nav
            aria-label='Aplicaciones del escritorio A-06'
            class='flex flex-wrap items-center gap-1.5'
          >
            <button
              type='button'
              onClick={() => handleSelectTab('folios')}
              class={tabClass('folios')}
            >
              Cierre anual
            </button>

            <button
              type='button'
              onClick={() => handleSelectTab('mail')}
              class={tabClass('mail')}
            >
              <span>Correo</span>
              {unreadEmailsCount > 0 && (
                <span class='ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tlc-danger px-1 text-[10px] font-semibold text-white'>
                  {unreadEmailsCount}
                </span>
              )}
            </button>

            <button
              type='button'
              onClick={() => handleSelectTab('chat')}
              class={tabClass('chat')}
            >
              Chat #planta-04
              {progress.a07Disappeared && !progress.restored['folio-07'] && (
                <span
                  aria-hidden='true'
                  class='ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tlc-amber'
                />
              )}
            </button>

            <button
              type='button'
              onClick={() => handleSelectTab('terminal')}
              class={tabClass('terminal')}
            >
              Terminal Git
            </button>

            <button
              type='button'
              onClick={() => handleSelectTab('cctv')}
              class={tabClass('cctv')}
            >
              Cámaras CCTV ({cctvFeeds.length || 3})
            </button>
          </nav>
        </header>

        {/* System Status Ticker */}
        <div class='border-b border-tlc-line/50 bg-[#0d1412] px-6 py-2 font-console text-xs'>
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

        {/* APP: CÁMARAS CCTV */}
        {workspaceTab === 'cctv' && (
          <div class='flex-1 space-y-4 overflow-y-auto bg-[#080c0b] p-6'>
            <div class='flex flex-wrap items-center justify-between gap-2'>
              <p class='font-console text-xs tracking-wider text-tlc-secondary uppercase'>
                Circuito cerrado · Planta 04 · Visión nocturna · Pulsa una
                cámara para ampliar
              </p>
              <button
                type='button'
                onClick={onRefreshCctv}
                class='rounded border border-tlc-line/70 px-3 py-1 font-console text-xs text-tlc-text transition hover:border-tlc-amber'
              >
                Actualizar cámaras
              </button>
            </div>

            <div
              class={
                enlargedCamId
                  ? 'grid gap-4'
                  : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
              }
            >
              {cctvFeeds
                .filter(feed => !enlargedCamId || feed.id === enlargedCamId)
                .map(feed => (
                  <figure
                    key={feed.id}
                    class='relative aspect-video overflow-hidden rounded border border-tlc-line/70 bg-black'
                  >
                    <button
                      type='button'
                      onClick={() =>
                        setEnlargedCamId(prev =>
                          prev === feed.id ? null : feed.id
                        )
                      }
                      aria-label={
                        enlargedCamId === feed.id
                          ? `Reducir ${feed.label}`
                          : `Ampliar ${feed.label}`
                      }
                      class='block h-full w-full cursor-pointer text-left'
                    >
                      <img
                        src={feed.dataUrl}
                        alt={`Cámara ${feed.label} · ${feed.location}`}
                        class='h-full w-full object-cover contrast-115 saturate-60'
                      />
                    </button>
                    <div
                      aria-hidden='true'
                      class='tlc-cctv-scan pointer-events-none absolute inset-0'
                    />
                    <figcaption class='pointer-events-none absolute inset-0 flex flex-col justify-between p-3 font-console text-[11px] text-[#eef2ed] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'>
                      <div class='flex items-center justify-between'>
                        <span>
                          {feed.label} · {feed.location}
                        </span>
                        <span class='tlc-rec-blink text-[#ff4b42]'>● REC</span>
                      </div>
                      <div class='flex items-center justify-between gap-2 text-[10px]'>
                        <span class='truncate text-tlc-amber'>
                          {feed.status}
                        </span>
                        <span class='shrink-0 tabular-nums'>
                          {story.opening.date} {stage.time}
                        </span>
                      </div>
                    </figcaption>
                  </figure>
                ))}
            </div>
          </div>
        )}

        {/* APP: CORREO CORPORATIVO + NOTAS DE VOZ ELEVENLABS */}
        {workspaceTab === 'mail' && (
          <div class='grid flex-1 overflow-hidden lg:grid-cols-[0.9fr_1.4fr]'>
            <aside
              aria-label='Bandeja de entrada'
              class='overflow-y-auto border-b border-tlc-line/60 bg-[#0b110f] p-4 lg:border-r lg:border-b-0'
            >
              <p class='mb-3 font-console text-[11px] tracking-[0.18em] text-tlc-secondary uppercase'>
                Bandeja de entrada ({visibleEmails.length})
              </p>
              <ul class='space-y-2'>
                {visibleEmails.map(email => {
                  const isSelected = email.id === activeEmail?.id
                  const isUnread = !emailsRead.includes(email.id)

                  return (
                    <li key={email.id}>
                      <button
                        type='button'
                        onClick={() => handleSelectEmail(email.id)}
                        class={
                          isSelected
                            ? 'w-full rounded border border-tlc-amber bg-tlc-amber/12 p-3 text-left'
                            : 'w-full rounded border border-tlc-line/55 bg-tlc-panel/60 p-3 text-left hover:border-tlc-text/40'
                        }
                      >
                        <div class='flex items-center justify-between gap-2'>
                          <span class='truncate text-xs font-semibold text-tlc-text'>
                            {email.from}
                          </span>
                          {isUnread && (
                            <span class='h-2 w-2 shrink-0 rounded-full bg-tlc-danger' />
                          )}
                        </div>
                        <p class='mt-1 truncate font-console text-[11px] text-tlc-amber'>
                          {email.subject}
                        </p>
                        <div class='mt-1.5 flex items-center justify-between font-console text-[10px] text-tlc-secondary'>
                          <span>{email.date}</span>
                          {email.voiceClip && (
                            <span class='text-tlc-positive'>● Audio</span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>

            {activeEmail && (
              <article class='flex-1 space-y-5 overflow-y-auto bg-[#0f1614] p-6'>
                <header class='border-b border-tlc-line/55 pb-4'>
                  <p class='font-console text-[11px] tracking-[0.14em] text-tlc-amber uppercase'>
                    {activeEmail.date}
                  </p>
                  <h3 class='mt-1 font-serif text-2xl text-tlc-text italic'>
                    {activeEmail.subject}
                  </h3>
                  <p class='mt-1 font-console text-xs text-tlc-secondary'>
                    De: <span class='text-tlc-text'>{activeEmail.from}</span> (
                    {activeEmail.role})
                  </p>
                </header>

                <div class='space-y-3 text-sm leading-relaxed text-tlc-text/90'>
                  {activeEmail.body.map(paragraph => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                {activeEmail.voiceClip && (
                  <div class='rounded border border-tlc-amber/45 bg-[#0a100e] p-4'>
                    <div class='flex flex-wrap items-center justify-between gap-3'>
                      <div>
                        <p class='font-console text-[11px] tracking-[0.14em] text-tlc-amber uppercase'>
                          Adjunto de voz · {activeEmail.voiceClip.duration}
                        </p>
                        <p class='mt-0.5 font-console text-xs text-tlc-text'>
                          {activeEmail.voiceClip.label}
                        </p>
                      </div>

                      <button
                        type='button'
                        onClick={() =>
                          handleToggleVoice(activeEmail.voiceClip!.file)
                        }
                        class={
                          playingVoiceFile === activeEmail.voiceClip.file
                            ? 'rounded border border-tlc-danger bg-tlc-danger/15 px-3.5 py-2 font-console text-xs text-tlc-text transition hover:bg-tlc-danger/25'
                            : 'rounded border border-tlc-amber bg-tlc-amber/15 px-3.5 py-2 font-console text-xs text-tlc-text transition hover:bg-tlc-amber/25'
                        }
                      >
                        {playingVoiceFile === activeEmail.voiceClip.file
                          ? '■ Detener audio'
                          : '▶ Escuchar nota de voz'}
                      </button>
                    </div>

                    <blockquote class='mt-3 border-l-2 border-tlc-amber/60 pl-3 font-serif text-base leading-relaxed text-tlc-text/85 italic'>
                      {activeEmail.voiceClip.transcript}
                    </blockquote>
                  </div>
                )}
              </article>
            )}
          </div>
        )}

        {/* APP: CHAT CORPORATIVO #PLANTA-04 */}
        {workspaceTab === 'chat' && (
          <div class='flex flex-1 flex-col overflow-hidden bg-[#0b110f]'>
            <div class='border-b border-tlc-line/50 px-6 py-3 font-console text-xs text-tlc-secondary'>
              Canal interno{' '}
              <span class='text-tlc-text'>#planta-04-guardia</span> · Historial
              en vivo del cierre anual
            </div>
            <ul class='flex-1 space-y-3 overflow-y-auto p-6'>
              {visibleChat.map(msg => (
                <li
                  key={msg.id}
                  class={
                    msg.isAnomaly
                      ? 'rounded border border-tlc-danger/55 bg-tlc-danger/8 p-4'
                      : 'rounded border border-tlc-line/55 bg-tlc-panel/65 p-4'
                  }
                >
                  <div class='flex items-baseline justify-between gap-2 font-console text-xs'>
                    <div class='flex items-center gap-2'>
                      <span
                        class={
                          msg.isAnomaly
                            ? 'font-semibold text-tlc-danger'
                            : msg.isSystem
                              ? 'font-semibold text-tlc-amber'
                              : 'font-semibold text-tlc-text'
                        }
                      >
                        {msg.sender}
                      </span>
                      <span class='text-[10px] text-tlc-secondary'>
                        {msg.handle}
                      </span>
                    </div>
                    <span class='text-[11px] text-tlc-secondary tabular-nums'>
                      {msg.time}
                    </span>
                  </div>
                  <p class='mt-2 text-sm leading-relaxed text-tlc-text/90'>
                    {msg.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* APP: TERMINAL GIT INTERACTIVA */}
        {workspaceTab === 'terminal' && (
          <div class='flex flex-1 flex-col overflow-hidden bg-[#070b0a] font-console text-xs'>
            <div class='flex flex-wrap items-center gap-2 border-b border-tlc-line/50 bg-[#0b110f] px-5 py-3'>
              <span class='text-[11px] text-tlc-secondary'>
                Comandos rápidos:
              </span>
              {QUICK_COMMANDS.map(cmd => (
                <button
                  key={cmd}
                  type='button'
                  onClick={() => runTerminal(cmd)}
                  class={
                    cmd.includes('--force')
                      ? 'rounded border border-tlc-danger/60 bg-tlc-danger/10 px-2.5 py-1 text-[11px] text-tlc-danger transition hover:bg-tlc-danger/25'
                      : 'rounded border border-tlc-line/70 bg-tlc-panel/70 px-2.5 py-1 text-[11px] text-tlc-text transition hover:border-tlc-amber'
                  }
                >
                  {cmd}
                </button>
              ))}
            </div>

            <div class='flex-1 space-y-4 overflow-y-auto p-5'>
              {terminalHistory.map(entry => (
                <div key={entry.id} class='space-y-1'>
                  <p class='text-tlc-amber'>
                    <span class='text-tlc-positive'>guardia@a06</span>:
                    <span class='text-tlc-secondary'>~/cierre</span>${' '}
                    {entry.command}
                  </p>
                  {entry.lines.map((line, idx) => (
                    <pre
                      key={`${entry.id}-${idx}`}
                      class={`font-console whitespace-pre-wrap ${
                        entry.isDanger
                          ? 'text-tlc-danger'
                          : line.includes('✓') || line.includes('RESTORE')
                            ? 'text-tlc-positive'
                            : 'text-tlc-text/85'
                      }`}
                    >
                      {line}
                    </pre>
                  ))}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>

            <form
              onSubmit={event => {
                event.preventDefault()
                runTerminal(terminalInput)
              }}
              class='flex items-center gap-2 border-t border-tlc-line/60 bg-[#0b110f] px-5 py-3'
            >
              <label htmlFor='tlc-terminal-input' class='text-tlc-positive'>
                $
              </label>
              <input
                id='tlc-terminal-input'
                type='text'
                value={terminalInput}
                onInput={event =>
                  setTerminalInput((event.target as HTMLInputElement).value)
                }
                placeholder='Escribe un comando (help, git status, git log, tail cierre.log)...'
                autocomplete='off'
                class='flex-1 bg-transparent text-tlc-text outline-none placeholder:text-tlc-secondary/60'
              />
              <button
                type='submit'
                class='rounded border border-tlc-amber/70 bg-tlc-amber/15 px-3 py-1 text-[11px] text-tlc-text transition hover:bg-tlc-amber/25'
              >
                Ejecutar
              </button>
            </form>
          </div>
        )}

        {/* APP: CIERRE ANUAL (FOLIOS + REGISTRO DE PISTAS) */}
        {workspaceTab === 'folios' && (
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
                          : 'rounded border border-tlc-line/65 bg-tlc-bg/65 px-3 py-2.5 text-left transition hover:border-tlc-text/45'
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

              <div class='rounded border border-tlc-line/65 bg-tlc-bg/75 p-5'>
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

                {feedback && !activeStatus.restored && (
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

              <div class='rounded border border-tlc-line/65 bg-tlc-bg/75 p-5'>
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

                {progress.a07Disappeared &&
                  !readyToCommit &&
                  !progress.commitConfirmed && (
                    <div class='mt-4 border-t border-tlc-line/40 pt-3'>
                      {confirmForcePrompt ? (
                        <div class='flex flex-wrap items-center justify-between gap-2 rounded border border-tlc-danger/60 bg-tlc-danger/10 px-3 py-2 font-console text-[11px]'>
                          <span class='text-tlc-danger'>
                            ¿Forzar cierre con --force y purgar los turnos no
                            restaurados?
                          </span>
                          <div class='flex gap-2'>
                            <button
                              type='button'
                              onClick={onForceEnding}
                              class='rounded border border-tlc-danger bg-tlc-danger/25 px-2.5 py-1 text-tlc-text hover:bg-tlc-danger/40'
                            >
                              Sí, forzar cierre
                            </button>
                            <button
                              type='button'
                              onClick={() => setConfirmForcePrompt(false)}
                              class='rounded border border-tlc-line px-2.5 py-1 text-tlc-secondary hover:text-tlc-text'
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type='button'
                          onClick={() => setConfirmForcePrompt(true)}
                          class='font-console text-[11px] text-tlc-danger/80 underline decoration-tlc-danger/40 underline-offset-4 transition hover:text-tlc-danger'
                        >
                          Opción de emergencia: forzar cierre (--force) sin
                          restaurar
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </section>

            <aside
              aria-label='Registro de pistas recopiladas'
              class='flex flex-col rounded border border-tlc-line/65 bg-tlc-bg/70 p-4'
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
                        class='rounded border border-tlc-line/55 bg-tlc-panel/80 p-3'
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
        )}
      </div>
    </dialog>
  )
}
