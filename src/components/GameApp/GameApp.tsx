import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import ClueReader from '@/components/ClueReader'
import ConsolePanel from '@/components/ConsolePanel'
import CreditsModal from '@/components/CreditsModal'
import EndingOverlay from '@/components/EndingOverlay'
import GameHud from '@/components/GameHud'
import LedgerModal from '@/components/LedgerModal'
import MenuScreen from '@/components/MenuScreen'
import PauseModal from '@/components/PauseModal'
import SettingsModal from '@/components/SettingsModal'
import { loadManifests, withBase } from '@/helpers/assets.helpers'
import { GameAudioEngine } from '@/helpers/audio.helpers'
import { SceneEngine, checkWebGL2Support } from '@/helpers/scene.helpers'
import {
  confirmCommit,
  createInitialProgress,
  deriveStage,
  deriveWorldFlags,
  evaluateA07Disappearance,
  getGuidanceSummary,
  markA07AbsenceSeen,
  markPanelRead,
  recordClue,
  submitPuzzleAnswer,
  useExit
} from '@/helpers/state.helpers'
import { clearSave, loadSave, saveProgress } from '@/helpers/storage.helpers'
import type { LoadSaveResult } from '@/helpers/storage.helpers'
import { useEphemeralMessage } from '@/hooks/use-ephemeral-message'
import { useGameSettings } from '@/hooks/use-game-settings'
import type {
  ActiveOverlay,
  DiagnosticSnapshot,
  GameProgress,
  InteractableHover,
  InteractableKind,
  ManifestBundle,
  PuzzleId,
  ScreenPhase,
  Vec3Tuple
} from '@/types'

interface QaBridge {
  getPhase: () => ScreenPhase
  getProgress: () => GameProgress
  getDiagnostics: () => DiagnosticSnapshot | null
  teleportAndLook: (position: Vec3Tuple, lookAt: Vec3Tuple) => void
  triggerInteract: () => boolean
  closeOverlay: () => void
  renderFrame: () => void
}

declare global {
  interface Window {
    __TLC_QA__?: QaBridge
  }
}

export default function GameApp() {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SceneEngine | null>(null)
  const audioRef = useRef<GameAudioEngine | null>(null)
  const manifestsRef = useRef<ManifestBundle | null>(null)
  const progressRef = useRef<GameProgress>(createInitialProgress())
  const phaseRef = useRef<ScreenPhase>('menu')
  const overlayRef = useRef<ActiveOverlay>({ type: 'none' })
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  const [manifests, setManifests] = useState<ManifestBundle | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [phase, setPhase] = useState<ScreenPhase>('menu')
  const [overlay, setOverlay] = useState<ActiveOverlay>({ type: 'none' })
  const [progress, setProgress] = useState<GameProgress>(() =>
    createInitialProgress()
  )
  const [settings, setSettings] = useGameSettings()
  const [saveState, setSaveState] = useState<LoadSaveResult>(() => loadSave())
  const [loadPercent, setLoadPercent] = useState(0)
  const [loadDetail, setLoadDetail] = useState('Preparando la oficina...')
  const [webglErrorText, setWebglErrorText] = useState<string | null>(null)
  const [hover, setHover] = useState<InteractableHover | null>(null)
  const [pointerLocked, setPointerLocked] = useState(false)

  const toast = useEphemeralMessage(5200)
  const subtitle = useEphemeralMessage(4600)

  const setPhaseSync = useCallback((next: ScreenPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const setOverlaySync = useCallback((next: ActiveOverlay) => {
    overlayRef.current = next
    setOverlay(next)
  }, [])

  const commitProgress = useCallback(
    (next: GameProgress, immediate = false) => {
      progressRef.current = next
      setProgress(next)
      saveProgress(next)
      setSaveState(loadSave())

      const engine = engineRef.current
      const bundle = manifestsRef.current

      if (engine && bundle) {
        const flags = deriveWorldFlags(next)
        const stage = deriveStage(next, bundle.story)
        const shouldWatchAbsence =
          next.a07Disappeared &&
          !next.a07AbsenceSeen &&
          !next.restored['folio-07']

        engine.applyWorldFlags(flags, stage.id, immediate, shouldWatchAbsence)
      }
    },
    []
  )

  const openOverlay = useCallback(
    (next: ActiveOverlay) => {
      if (
        overlayRef.current.type === 'none' &&
        document.activeElement instanceof HTMLElement
      ) {
        lastFocusedRef.current = document.activeElement
      }

      setOverlaySync(next)
      engineRef.current?.setMovementEnabled(false)
      audioRef.current?.setDucked(
        next.type === 'panel' ||
          next.type === 'ledger' ||
          next.type === 'clue' ||
          next.type === 'pause' ||
          next.type === 'settings'
      )
    },
    [setOverlaySync]
  )

  const closeOverlay = useCallback(() => {
    const current = overlayRef.current
    const bundle = manifestsRef.current

    if (current.type === 'settings' && current.returnTo === 'pause') {
      setOverlaySync({ type: 'pause' })

      return
    }

    if (current.type === 'clue' && current.clueId === 'tag_07' && bundle) {
      const playerZ = engineRef.current?.playerPosition[2] ?? 0
      const result = evaluateA07Disappearance(
        progressRef.current,
        playerZ,
        bundle.scene.interaction.a07OutsideViewGate
      )

      if (result.triggered) {
        commitProgress(result.progress, false)
        subtitle.show(bundle.story.subtitles.a07_stop, 5200)
      }
    }

    setOverlaySync({ type: 'none' })
    audioRef.current?.setDucked(false)

    if (phaseRef.current === 'playing') {
      engineRef.current?.setMovementEnabled(true)
    }

    if (
      phaseRef.current === 'menu' &&
      lastFocusedRef.current &&
      document.contains(lastFocusedRef.current)
    ) {
      lastFocusedRef.current.focus()
      lastFocusedRef.current = null
    }
  }, [commitProgress, setOverlaySync, subtitle])

  const handleInteract = useCallback(
    (kind: InteractableKind) => {
      const bundle = manifestsRef.current

      if (!bundle) return

      const currentProgress = progressRef.current
      const flags = deriveWorldFlags(currentProgress)

      if (kind === 'panel') {
        audioRef.current?.playOneShot('ui-click')

        const { progress: next, firstTime } = markPanelRead(currentProgress)

        if (firstTime) {
          commitProgress(next, false)
          audioRef.current?.playTreeCue()
          subtitle.show(bundle.story.subtitles.tree_cue, 5500)
        }

        openOverlay({ type: 'panel' })

        return
      }

      if (kind === 'ledger') {
        audioRef.current?.playOneShot('paper')
        openOverlay({ type: 'ledger' })

        return
      }

      if (kind === 'note') {
        audioRef.current?.playOneShot('paper')

        const { progress: next } = recordClue(currentProgress, 'note_26')

        commitProgress(next, false)
        openOverlay({ type: 'clue', clueId: 'note_26' })

        return
      }

      if (kind === 'tag_07') {
        if (!flags.tag07Interactable) {
          toast.show('Revisa primero la consola en el puesto A-06.')

          return
        }

        audioRef.current?.playOneShot('paper')

        const { progress: next } = recordClue(currentProgress, 'tag_07')

        commitProgress(next, false)
        openOverlay({ type: 'clue', clueId: 'tag_07' })

        return
      }

      if (kind === 'tag_19') {
        if (!flags.tag19Visible) return

        audioRef.current?.playOneShot('paper')

        const { progress: next } = recordClue(currentProgress, 'tag_19')

        commitProgress(next, false)
        openOverlay({ type: 'clue', clueId: 'tag_19' })

        return
      }

      if (kind === 'tag_26') {
        if (!flags.tag26Visible) return

        audioRef.current?.playOneShot('paper')

        const { progress: next } = recordClue(currentProgress, 'tag_26')

        commitProgress(next, false)
        openOverlay({ type: 'clue', clueId: 'tag_26' })

        return
      }

      if (kind === 'exit') {
        const result = useExit(currentProgress)

        if (!result.ok) {
          audioRef.current?.playOneShot('ui-click')
          toast.show(result.message)

          return
        }

        audioRef.current?.playOneShot('exit')
        commitProgress(result.progress, false)
        setOverlaySync({ type: 'none' })
        setPhaseSync('ending')
        engineRef.current?.setEndingCamera(true)
      }
    },
    [commitProgress, openOverlay, setOverlaySync, setPhaseSync, subtitle, toast]
  )

  const handleAbsenceSeen = useCallback(() => {
    const bundle = manifestsRef.current

    if (!bundle) return

    const { progress: next, firstTime } = markA07AbsenceSeen(
      progressRef.current
    )

    if (firstTime) {
      commitProgress(next, false)
      toast.show(bundle.story.opening.return, 6200)
    }
  }, [commitProgress, toast])

  const disposeRuntime = useCallback(() => {
    engineRef.current?.dispose()
    engineRef.current = null
    audioRef.current?.dispose()
    audioRef.current = null
    setPointerLocked(false)
    setHover(null)
  }, [])

  const bootSession = useCallback(
    async (initialProgress: GameProgress) => {
      const bundle = manifestsRef.current

      if (!bundle) {
        return
      }

      disposeRuntime()
      setOverlaySync({ type: 'none' })
      setWebglErrorText(null)
      setLoadPercent(0)
      setLoadDetail('Comprobando WebGL 2...')
      setPhaseSync('loading')

      const params = new URLSearchParams(window.location.search)
      const forceWebglError = params.get('forceWebglError') === '1'
      const webgl = forceWebglError
        ? { supported: false, renderer: 'simulated', vendor: 'simulated' }
        : checkWebGL2Support()

      if (!webgl.supported) {
        setWebglErrorText(
          'Este navegador no ofrece un contexto WebGL 2 activo. Activa la aceleración por hardware o prueba en un navegador de escritorio compatible.'
        )
        setPhaseSync('webgl-error')

        return
      }

      await new Promise<void>(resolve =>
        window.requestAnimationFrame(() => resolve())
      )

      const host = canvasHostRef.current

      if (!host) {
        setWebglErrorText('No se pudo montar el lienzo 3D.')
        setPhaseSync('webgl-error')

        return
      }

      try {
        const audio = new GameAudioEngine(settings)

        audio.setAnchorPositions(
          bundle.scene.lighting.a07.position,
          bundle.scene.lighting.tree.position
        )
        audioRef.current = audio

        const initialFlags = deriveWorldFlags(initialProgress)
        const engine = new SceneEngine(
          host,
          bundle.scene,
          audio,
          settings,
          initialFlags,
          {
            onLoadProgress: (pct, detail) => {
              setLoadPercent(pct)
              setLoadDetail(detail)
            },
            onHoverChange: nextHover => setHover(nextHover),
            onPointerLockChange: locked => setPointerLocked(locked),
            onInteract: kind => handleInteract(kind),
            onAbsenceSeen: () => handleAbsenceSeen(),
            onContextLost: () => {
              setWebglErrorText(
                'Se perdió el contexto gráfico WebGL 2. Puedes reintentar sin perder tu progreso guardado.'
              )
              setPhaseSync('webgl-error')
            },
            onContextRestored: () => {
              setWebglErrorText(null)
              setPhaseSync('playing')
            }
          }
        )

        engineRef.current = engine

        await Promise.all([
          engine.loadAssets(),
          audio.loadManifest(bundle.audio)
        ])

        await audio.unlock()
        commitProgress(initialProgress, true)
        engine.resetCameraToSpawn()
        engine.setMovementEnabled(true)
        setPhaseSync('playing')
        toast.show(
          initialProgress.panelRead
            ? getGuidanceSummary(initialProgress)
            : bundle.story.opening.intro,
          6200
        )
        subtitle.show(bundle.story.subtitles.hvac, 4200)
      } catch (err) {
        disposeRuntime()
        setWebglErrorText(
          err instanceof Error
            ? `No se pudo iniciar la escena 3D: ${err.message}`
            : 'No se pudo iniciar la escena 3D.'
        )
        setPhaseSync('webgl-error')
      }
    },
    [
      commitProgress,
      disposeRuntime,
      handleAbsenceSeen,
      handleInteract,
      setOverlaySync,
      setPhaseSync,
      settings,
      subtitle,
      toast
    ]
  )

  useEffect(() => {
    let active = true

    loadManifests()
      .then(bundle => {
        if (!active) return

        manifestsRef.current = bundle
        setManifests(bundle)
      })
      .catch(err => {
        if (!active) return

        setManifestError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los datos.'
        )
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    audioRef.current?.updateSettings(settings)
    engineRef.current?.updateSettings(settings)
  }, [settings])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat) {
        return
      }

      if (overlayRef.current.type !== 'none') {
        event.preventDefault()
        closeOverlay()

        return
      }

      if (phaseRef.current === 'playing') {
        event.preventDefault()
        openOverlay({ type: 'pause' })
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        audioRef.current?.suspend()
      } else if (phaseRef.current === 'playing') {
        audioRef.current?.resume()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [closeOverlay, openOverlay])

  useEffect(() => {
    window.__TLC_QA__ = {
      getPhase: () => phaseRef.current,
      getProgress: () => progressRef.current,
      getDiagnostics: () => engineRef.current?.getDiagnostics() ?? null,
      teleportAndLook: (position, lookAt) => {
        engineRef.current?.teleportAndLook(position, lookAt)
      },
      triggerInteract: () => engineRef.current?.triggerInteract() ?? false,
      closeOverlay: () => closeOverlay(),
      renderFrame: () => engineRef.current?.renderSingleFrame()
    }

    return () => {
      delete window.__TLC_QA__
    }
  }, [closeOverlay])

  useEffect(() => {
    return () => {
      disposeRuntime()
    }
  }, [disposeRuntime])

  const handlePlayNew = () => {
    clearSave()

    const fresh = createInitialProgress()

    setSaveState({ status: 'empty' })
    void bootSession(fresh)
  }

  const handleContinue = () => {
    const loaded = loadSave()

    if (loaded.status === 'ok') {
      void bootSession(loaded.envelope.progress)
    } else {
      handlePlayNew()
    }
  }

  const handleReturnToMenu = () => {
    disposeRuntime()
    setOverlaySync({ type: 'none' })
    setSaveState(loadSave())
    setPhaseSync('menu')
  }

  const handleClearCorruptSave = () => {
    clearSave()
    setSaveState({ status: 'empty' })
  }

  const handleSaveLedgerFolio = (clueId: 'ledger_07' | 'ledger_19') => {
    audioRef.current?.playOneShot('ui-click')

    const { progress: next } = recordClue(progressRef.current, clueId)

    commitProgress(next, false)
  }

  const handleSubmitPuzzle = (puzzleId: PuzzleId, optionId: string) => {
    const bundle = manifestsRef.current

    if (!bundle) {
      return { ok: false, message: 'Datos no cargados.' }
    }

    const result = submitPuzzleAnswer(
      progressRef.current,
      bundle.story,
      puzzleId,
      optionId
    )

    if (result.ok) {
      audioRef.current?.playOneShot('restore')
      commitProgress(result.progress, false)
      toast.show(result.message, 5200)
    } else {
      audioRef.current?.playOneShot('ui-click')
    }

    return { ok: result.ok, message: result.message }
  }

  const handleConfirmCommit = () => {
    const bundle = manifestsRef.current

    if (!bundle) {
      return { ok: false, message: 'Datos no cargados.' }
    }

    const result = confirmCommit(progressRef.current, bundle.story)

    if (result.ok) {
      audioRef.current?.playOneShot('exit')
      commitProgress(result.progress, false)
      subtitle.show(bundle.story.subtitles.exit, 5500)
      toast.show(bundle.story.commit.exitCue, 6200)
    } else {
      audioRef.current?.playOneShot('ui-click')
    }

    return { ok: result.ok, message: result.message }
  }

  const handleRequestPointerLock = () => {
    void audioRef.current?.unlock()
    engineRef.current?.requestPointerLock()
  }

  if (manifestError) {
    return (
      <div class='flex h-full w-full flex-col items-center justify-center gap-4 bg-tlc-bg p-6 text-center'>
        <h1 class='font-title text-4xl text-tlc-danger uppercase'>
          Error al cargar los datos del juego
        </h1>
        <p class='max-w-md text-sm text-tlc-secondary'>{manifestError}</p>
        <button
          type='button'
          onClick={() => window.location.reload()}
          class='rounded border border-tlc-amber bg-tlc-amber/15 px-5 py-2 font-console text-xs text-tlc-text uppercase'
        >
          Reintentar
        </button>
      </div>
    )
  }

  const stage = deriveStage(progress, manifests?.story)
  const guidance = getGuidanceSummary(progress)

  return (
    <div class='relative h-full w-full overflow-hidden bg-tlc-bg'>
      <div
        ref={canvasHostRef}
        class={
          phase === 'playing' || phase === 'loading' || phase === 'ending'
            ? 'fixed inset-0 z-0 h-full w-full'
            : 'hidden'
        }
      />

      {phase === 'menu' && (
        <MenuScreen
          story={manifests?.story ?? null}
          saveState={saveState}
          onPlayNew={handlePlayNew}
          onContinue={handleContinue}
          onOpenSettings={() =>
            openOverlay({ type: 'settings', returnTo: 'menu' })
          }
          onOpenCredits={() => openOverlay({ type: 'credits' })}
          onClearCorruptSave={handleClearCorruptSave}
        />
      )}

      {phase === 'loading' && (
        <section
          aria-live='polite'
          aria-label='Cargando escena 3D'
          class='fixed inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-tlc-bg/96 px-6 text-center'
        >
          <p class='font-console text-xs tracking-[0.22em] text-tlc-amber uppercase'>
            Planta 04 · Inicializando WebGL 2
          </p>
          <h2 class='font-title text-4xl tracking-wide text-tlc-text uppercase'>
            Cargando la oficina
          </h2>
          <div class='h-2 w-full max-w-sm overflow-hidden rounded-full border border-tlc-line bg-tlc-panel'>
            <div
              class='h-full bg-tlc-amber transition-all duration-200'
              style={{ width: `${Math.max(4, loadPercent)}%` }}
            />
          </div>
          <p class='font-console text-xs text-tlc-secondary'>
            {loadPercent}% · {loadDetail}
          </p>
        </section>
      )}

      {phase === 'webgl-error' && (
        <section
          role='alert'
          class='fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-tlc-bg px-6 text-center'
        >
          <p class='font-console text-xs tracking-[0.2em] text-tlc-danger uppercase'>
            WebGL 2 no disponible
          </p>
          <h2 class='font-title text-4xl tracking-wide text-tlc-text uppercase'>
            No se pudo iniciar la escena 3D
          </h2>
          <p class='max-w-lg text-sm leading-relaxed text-tlc-secondary'>
            {webglErrorText}
          </p>
          <div class='flex flex-wrap justify-center gap-3 pt-2'>
            <button
              type='button'
              onClick={() => void bootSession(progressRef.current)}
              class='rounded border border-tlc-amber bg-tlc-amber/15 px-5 py-2.5 font-console text-xs text-tlc-text uppercase transition hover:bg-tlc-amber/25'
            >
              Reintentar
            </button>
            <button
              type='button'
              onClick={handleReturnToMenu}
              class='rounded border border-tlc-line bg-tlc-panel px-5 py-2.5 font-console text-xs text-tlc-text uppercase transition hover:border-tlc-text/60'
            >
              Volver al menú
            </button>
            <a
              href={withBase('diagnostico/')}
              class='rounded border border-tlc-line/70 px-5 py-2.5 font-console text-xs text-tlc-secondary uppercase transition hover:border-tlc-amber hover:text-tlc-text'
            >
              Abrir diagnóstico
            </a>
          </div>
        </section>
      )}

      {phase === 'playing' && manifests && (
        <GameHud
          dateLabel={manifests.story.opening.date}
          timeLabel={stage.time}
          hover={hover}
          toastMessage={toast.message}
          subtitleMessage={subtitle.message}
          pointerLocked={pointerLocked}
          overlayOpen={overlay.type !== 'none'}
          settings={settings}
          onRequestPointerLock={handleRequestPointerLock}
          onOpenPause={() => openOverlay({ type: 'pause' })}
          onToggleMute={() =>
            setSettings(prev => ({ ...prev, muted: !prev.muted }))
          }
        />
      )}

      {phase === 'playing' && overlay.type === 'panel' && manifests && (
        <ConsolePanel
          story={manifests.story}
          progress={progress}
          onSubmitAnswer={handleSubmitPuzzle}
          onConfirmCommit={handleConfirmCommit}
          onInspectClue={clueId => setOverlaySync({ type: 'clue', clueId })}
          onClose={closeOverlay}
        />
      )}

      {phase === 'playing' && overlay.type === 'ledger' && manifests && (
        <LedgerModal
          story={manifests.story}
          collectedClues={progress.clues}
          onSaveFolio={handleSaveLedgerFolio}
          onClose={closeOverlay}
        />
      )}

      {phase === 'playing' && overlay.type === 'clue' && manifests && (
        <ClueReader
          clueId={overlay.clueId}
          clue={manifests.story.clues[overlay.clueId]}
          onClose={closeOverlay}
        />
      )}

      {phase === 'playing' && overlay.type === 'pause' && (
        <PauseModal
          guidance={guidance}
          onResume={closeOverlay}
          onOpenSettings={() =>
            setOverlaySync({ type: 'settings', returnTo: 'pause' })
          }
          onRestart={handlePlayNew}
          onReturnMenu={handleReturnToMenu}
        />
      )}

      {overlay.type === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={closeOverlay}
        />
      )}

      {overlay.type === 'credits' && <CreditsModal onClose={closeOverlay} />}

      {phase === 'ending' && manifests && (
        <EndingOverlay
          story={manifests.story}
          onReturnMenu={handleReturnToMenu}
          onPlayAgain={handlePlayNew}
        />
      )}
    </div>
  )
}
