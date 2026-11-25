import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import AchievementToast from '@/components/AchievementToast'
import AchievementsModal from '@/components/AchievementsModal'
import ClueReader from '@/components/ClueReader'
import ConsolePanel from '@/components/ConsolePanel'
import CreditsModal from '@/components/CreditsModal'
import EndingOverlay from '@/components/EndingOverlay'
import GameHud from '@/components/GameHud'
import LedgerModal from '@/components/LedgerModal'
import MenuScreen from '@/components/MenuScreen'
import PauseModal from '@/components/PauseModal'
import SettingsModal from '@/components/SettingsModal'
import {
  ACHIEVEMENTS,
  loadMetaProgress,
  saveMetaProgress
} from '@/helpers/achievements.helpers'
import type {
  AchievementId,
  AchievementSpec,
  ChapterId,
  ChapterSpec,
  EndingId,
  MetaProgress
} from '@/helpers/achievements.helpers'
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
  CctvFeed,
  DiagnosticSnapshot,
  GameProgress,
  InteractableHover,
  InteractableKind,
  ManifestBundle,
  ProjectedMarker,
  PuzzleId,
  ScreenPhase,
  Vec3Tuple
} from '@/types'

interface QaBridge {
  getPhase: () => ScreenPhase
  getProgress: () => GameProgress
  getMeta: () => MetaProgress
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
  const metaRef = useRef<MetaProgress>(loadMetaProgress())
  const phaseRef = useRef<ScreenPhase>('menu')
  const overlayRef = useRef<ActiveOverlay>({ type: 'none' })
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const achTimerRef = useRef<number | null>(null)
  const lockedExitAttemptsRef = useRef(0)

  const [manifests, setManifests] = useState<ManifestBundle | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [phase, setPhase] = useState<ScreenPhase>('menu')
  const [overlay, setOverlay] = useState<ActiveOverlay>({ type: 'none' })
  const [progress, setProgress] = useState<GameProgress>(() =>
    createInitialProgress()
  )
  const [meta, setMeta] = useState<MetaProgress>(() => metaRef.current)
  const [activeAchievement, setActiveAchievement] =
    useState<AchievementSpec | null>(null)
  const [endingId, setEndingId] = useState<EndingId>('true')
  const [settings, setSettings] = useGameSettings()
  const [saveState, setSaveState] = useState<LoadSaveResult>(() => loadSave())
  const [sceneReady, setSceneReady] = useState(false)
  const [enteringGame, setEnteringGame] = useState(false)
  const [loadPercent, setLoadPercent] = useState(0)
  const [loadDetail, setLoadDetail] = useState('Cargando escena 3D...')
  const [webglErrorText, setWebglErrorText] = useState<string | null>(null)
  const [hover, setHover] = useState<InteractableHover | null>(null)
  const [markers, setMarkers] = useState<ProjectedMarker[]>([])
  const [cctvFeeds, setCctvFeeds] = useState<CctvFeed[]>([])
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

  const updateMeta = useCallback(
    (mutator: (current: MetaProgress) => MetaProgress | null) => {
      const next = mutator(metaRef.current)

      if (!next) return

      metaRef.current = next
      setMeta(next)
      saveMetaProgress(next)
    },
    []
  )

  const unlockAchievement = useCallback(
    (id: AchievementId) => {
      if (metaRef.current.achievements.includes(id)) {
        return
      }

      const spec = ACHIEVEMENTS.find(item => item.id === id)

      if (!spec) return

      updateMeta(current => ({
        ...current,
        achievements: [...current.achievements, id]
      }))

      audioRef.current?.playAchievementChime()
      setActiveAchievement(spec)

      if (achTimerRef.current !== null) {
        window.clearTimeout(achTimerRef.current)
      }

      achTimerRef.current = window.setTimeout(() => {
        setActiveAchievement(null)
        achTimerRef.current = null
      }, 4200)
    },
    [updateMeta]
  )

  const unlockChapter = useCallback(
    (id: ChapterId) => {
      if (metaRef.current.chapters.includes(id)) return

      updateMeta(current => ({
        ...current,
        chapters: [...current.chapters, id]
      }))
    },
    [updateMeta]
  )

  const recordEnding = useCallback(
    (id: EndingId) => {
      if (metaRef.current.endings.includes(id)) return

      updateMeta(current => ({
        ...current,
        endings: [...current.endings, id]
      }))
    },
    [updateMeta]
  )

  const syncEngineWorld = useCallback(
    (next: GameProgress, immediate = false) => {
      const engine = engineRef.current
      const bundle = manifestsRef.current

      if (engine && bundle) {
        const flags = deriveWorldFlags(next)
        const stage = deriveStage(next, bundle.story)
        const shouldWatchAbsence =
          next.a07Disappeared &&
          !next.a07AbsenceSeen &&
          !next.restored['folio-07']

        engine.applyWorldFlags(
          flags,
          stage.id,
          stage.time,
          immediate,
          shouldWatchAbsence
        )
      }
    },
    []
  )

  const commitProgress = useCallback(
    (next: GameProgress, immediate = false) => {
      progressRef.current = next
      setProgress(next)
      saveProgress(next)
      setSaveState(loadSave())
      syncEngineWorld(next, immediate)

      if (next.clues.length >= 6) {
        unlockAchievement('archivist')
      }
    },
    [syncEngineWorld, unlockAchievement]
  )

  const refreshCctv = useCallback(() => {
    const feeds = engineRef.current?.captureCctvFeeds() ?? []

    setCctvFeeds(feeds)
  }, [])

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

      if (next.type === 'credits') {
        audioRef.current?.setTitleAmbient(true)
      }
    },
    [setOverlaySync]
  )

  const closeOverlay = useCallback(() => {
    const current = overlayRef.current
    const bundle = manifestsRef.current

    if (current.type === 'panel') {
      audioRef.current?.stopVoicemail()
    }

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
        audioRef.current?.playPowerDip()
        subtitle.show(bundle.story.subtitles.a07_stop, 5600)
        toast.show(
          'Un chispazo recorre el pasillo. El zumbido de la oficina acaba de callarse.',
          5600
        )
      }
    }

    setOverlaySync({ type: 'none' })
    audioRef.current?.setDucked(false)

    if (phaseRef.current === 'playing') {
      audioRef.current?.setTitleAmbient(false)
      engineRef.current?.setMovementEnabled(true)
    }

    if (
      (phaseRef.current === 'menu' || phaseRef.current === 'ending') &&
      lastFocusedRef.current &&
      document.contains(lastFocusedRef.current)
    ) {
      lastFocusedRef.current.focus()
      lastFocusedRef.current = null
    }
  }, [commitProgress, setOverlaySync, subtitle, toast])

  const triggerEnding = useCallback(
    (id: EndingId, finalProgress?: GameProgress) => {
      audioRef.current?.stopVoicemail()
      audioRef.current?.playOneShot('exit')
      audioRef.current?.setTitleAmbient(true)

      if (finalProgress) {
        commitProgress(finalProgress, false)
      }

      setEndingId(id)
      recordEnding(id)

      if (id === 'true') {
        unlockAchievement('true_ending')
      } else if (id === 'force') {
        unlockAchievement('force_push')
      }

      setOverlaySync({ type: 'none' })
      setPhaseSync('ending')
      engineRef.current?.setEndingCamera(true)
    },
    [
      commitProgress,
      recordEnding,
      setOverlaySync,
      setPhaseSync,
      unlockAchievement
    ]
  )

  const handleInteract = useCallback(
    (kind: InteractableKind) => {
      const bundle = manifestsRef.current

      if (!bundle) return

      const currentProgress = progressRef.current
      const flags = deriveWorldFlags(currentProgress)

      if (kind === 'panel') {
        audioRef.current?.playOneShot('ui-click', undefined, false)
        unlockAchievement('first_login')

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
          audioRef.current?.playOneShot('ui-click', undefined, false)
          lockedExitAttemptsRef.current += 1

          if (
            lockedExitAttemptsRef.current >= 4 &&
            currentProgress.a07Disappeared
          ) {
            lockedExitAttemptsRef.current = 0
            triggerEnding('loop')

            return
          }

          toast.show(result.message)

          return
        }

        lockedExitAttemptsRef.current = 0
        triggerEnding('true', result.progress)
      }
    },
    [
      commitProgress,
      openOverlay,
      subtitle,
      toast,
      triggerEnding,
      unlockAchievement
    ]
  )

  const handleAbsenceSeen = useCallback(() => {
    const bundle = manifestsRef.current

    if (!bundle) return

    const { progress: next, firstTime } = markA07AbsenceSeen(
      progressRef.current
    )

    if (firstTime) {
      commitProgress(next, false)
      audioRef.current?.playNotificationPing()
      unlockAchievement('cache_invalidation')
      unlockChapter('absence')
      toast.show(
        `${bundle.story.opening.return} Nueva alerta en el correo y chat de A-06.`,
        6800
      )
    }
  }, [commitProgress, toast, unlockAchievement, unlockChapter])

  const disposeRuntime = useCallback(() => {
    engineRef.current?.dispose()
    engineRef.current = null
    audioRef.current?.dispose()
    audioRef.current = null
    setSceneReady(false)
    setPointerLocked(false)
    setHover(null)
    setMarkers([])
  }, [])

  const mountLiveScene = useCallback(
    async (bundle: ManifestBundle) => {
      if (engineRef.current) {
        return true
      }

      const params = new URLSearchParams(window.location.search)
      const forceWebglError = params.get('forceWebglError') === '1'
      const webgl = forceWebglError
        ? { supported: false, renderer: 'simulated', vendor: 'simulated' }
        : checkWebGL2Support()

      if (!webgl.supported) {
        setSceneReady(true)

        return false
      }

      await new Promise<void>(resolve =>
        window.requestAnimationFrame(() => resolve())
      )

      const host = canvasHostRef.current

      if (!host) {
        return false
      }

      try {
        const audio = new GameAudioEngine(settings)

        audio.setAnchorPositions(
          bundle.scene.lighting.a07.position,
          bundle.scene.lighting.tree.position
        )
        audioRef.current = audio

        const initialFlags = deriveWorldFlags(createInitialProgress())
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
            onMarkersChange: nextMarkers => setMarkers(nextMarkers),
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

        engine.setTitleMode(true)
        setSceneReady(true)

        return true
      } catch {
        disposeRuntime()
        setSceneReady(true)

        return false
      }
    },
    [disposeRuntime, handleAbsenceSeen, handleInteract, setPhaseSync, settings]
  )

  const enterGameplay = useCallback(
    async (initialProgress: GameProgress) => {
      const bundle = manifestsRef.current

      if (!bundle) {
        return
      }

      const params = new URLSearchParams(window.location.search)
      const forceWebglError = params.get('forceWebglError') === '1'

      if (forceWebglError || !checkWebGL2Support().supported) {
        setWebglErrorText(
          'Este navegador no ofrece un contexto WebGL 2 activo. Activa la aceleración por hardware o prueba en un navegador de escritorio compatible.'
        )
        setPhaseSync('webgl-error')

        return
      }

      if (!engineRef.current) {
        setPhaseSync('loading')

        const ok = await mountLiveScene(bundle)

        if (!ok || !engineRef.current) {
          setWebglErrorText(
            'No se pudo iniciar el contexto WebGL 2 para la escena 3D.'
          )
          setPhaseSync('webgl-error')

          return
        }
      }

      lockedExitAttemptsRef.current = 0
      setEnteringGame(true)
      await audioRef.current?.unlock()
      audioRef.current?.setTitleAmbient(false)
      audioRef.current?.playOneShot('ui-click', undefined, false)

      commitProgress(initialProgress, true)
      engineRef.current.startGameplayFromTitle()

      const waitMs = settings.reducedMotion ? 0 : 320

      if (waitMs > 0) {
        await new Promise<void>(resolve => window.setTimeout(resolve, waitMs))
      }

      setEnteringGame(false)
      setOverlaySync({ type: 'none' })
      setPhaseSync('playing')
      toast.show(
        initialProgress.panelRead
          ? getGuidanceSummary(initialProgress)
          : bundle.story.opening.intro,
        6200
      )
      subtitle.show(bundle.story.subtitles.hvac, 4200)
    },
    [
      commitProgress,
      mountLiveScene,
      setOverlaySync,
      setPhaseSync,
      settings.reducedMotion,
      subtitle,
      toast
    ]
  )

  // Preload manifests + boot live 3D office backdrop directly behind the title screen
  useEffect(() => {
    let active = true

    loadManifests()
      .then(bundle => {
        if (!active) return

        manifestsRef.current = bundle
        setManifests(bundle)
        void mountLiveScene(bundle)
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
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      getMeta: () => metaRef.current,
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
      if (achTimerRef.current !== null) {
        window.clearTimeout(achTimerRef.current)
      }

      disposeRuntime()
    }
  }, [disposeRuntime])

  const handlePlayNew = () => {
    clearSave()

    const fresh = createInitialProgress()

    setSaveState({ status: 'empty' })
    void enterGameplay(fresh)
  }

  const handleContinue = () => {
    const loaded = loadSave()

    if (loaded.status === 'ok') {
      void enterGameplay(loaded.envelope.progress)
    } else {
      handlePlayNew()
    }
  }

  const handleSelectChapter = (chapter: ChapterSpec) => {
    void enterGameplay(chapter.buildProgress())
  }

  const handleReturnToMenu = () => {
    audioRef.current?.stopVoicemail()
    audioRef.current?.setTitleAmbient(true)
    setOverlaySync({ type: 'none' })
    setSaveState(loadSave())
    setPhaseSync('menu')
    audioRef.current?.setDucked(false)
    syncEngineWorld(createInitialProgress(), true)
    engineRef.current?.setTitleMode(true)
  }

  const handleClearCorruptSave = () => {
    clearSave()
    setSaveState({ status: 'empty' })
  }

  const handleSaveLedgerFolio = (clueId: 'ledger_07' | 'ledger_19') => {
    audioRef.current?.playOneShot('ui-click', undefined, false)

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

      if (puzzleId === 'folio-07') {
        unlockAchievement('folio_07')
        unlockChapter('second_shift')
      } else if (puzzleId === 'folio-19') {
        unlockAchievement('folio_19')
        unlockChapter('last_commit')
      }
    } else {
      audioRef.current?.playOneShot('ui-click', undefined, false)
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
      audioRef.current?.playOneShot('ui-click', undefined, false)
    }

    return { ok: result.ok, message: result.message }
  }

  const handlePlayVoicemail = useCallback(
    (file: string, onEnded: () => void) => {
      void audioRef.current?.unlock()
      unlockAchievement('voice_from_past')

      return audioRef.current?.playVoicemail(file, onEnded) ?? false
    },
    [unlockAchievement]
  )

  const handleStopVoicemail = useCallback(() => {
    audioRef.current?.stopVoicemail()
  }, [])

  const handleEmailRead = useCallback(
    (emailId: string) => {
      if (metaRef.current.emailsRead.includes(emailId)) return

      updateMeta(current => ({
        ...current,
        emailsRead: [...current.emailsRead, emailId]
      }))
    },
    [updateMeta]
  )

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
      {/* Always-mounted 3D office backdrop for seamless live title -> gameplay sweep */}
      <div
        ref={canvasHostRef}
        class={
          phase === 'webgl-error' ? 'hidden' : 'fixed inset-0 z-0 h-full w-full'
        }
      />

      {activeAchievement && (
        <AchievementToast achievement={activeAchievement} />
      )}

      {phase === 'menu' && (
        <MenuScreen
          story={manifests?.story ?? null}
          saveState={saveState}
          meta={meta}
          sceneReady={sceneReady}
          loadPercent={loadPercent}
          loadDetail={loadDetail}
          entering={enteringGame}
          settings={settings}
          onPlayNew={handlePlayNew}
          onContinue={handleContinue}
          onSelectChapter={handleSelectChapter}
          onOpenAchievements={() => openOverlay({ type: 'achievements' })}
          onOpenSettings={() =>
            openOverlay({ type: 'settings', returnTo: 'menu' })
          }
          onOpenCredits={() => openOverlay({ type: 'credits' })}
          onClearCorruptSave={handleClearCorruptSave}
          onToggleMute={() =>
            setSettings(prev => ({ ...prev, muted: !prev.muted }))
          }
          onHoverItem={() => audioRef.current?.playHoverTick()}
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
          <h2 class='font-serif text-4xl text-tlc-text italic'>
            Cargando la oficina
          </h2>
          <div class='h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-tlc-text/15'>
            <div
              class='tlc-loading-sheen relative h-full bg-gradient-to-r from-[#c47d3b] to-[#f0bd74] transition-all duration-200'
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
              onClick={() => void enterGameplay(progressRef.current)}
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
          markers={markers}
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
          cctvFeeds={cctvFeeds}
          emailsRead={meta.emailsRead}
          onRefreshCctv={refreshCctv}
          onSubmitAnswer={handleSubmitPuzzle}
          onConfirmCommit={handleConfirmCommit}
          onForceEnding={() => triggerEnding('force')}
          onInspectClue={clueId => setOverlaySync({ type: 'clue', clueId })}
          onPlayVoicemail={handlePlayVoicemail}
          onStopVoicemail={handleStopVoicemail}
          onEmailRead={handleEmailRead}
          onTerminalUsed={() => unlockAchievement('git_archaeologist')}
          onCctvOpened={() => unlockAchievement('cctv_watcher')}
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

      {overlay.type === 'achievements' && (
        <AchievementsModal meta={meta} onClose={closeOverlay} />
      )}

      {overlay.type === 'credits' && (
        <CreditsModal
          reducedMotion={settings.reducedMotion}
          onClose={closeOverlay}
        />
      )}

      {phase === 'ending' && manifests && overlay.type !== 'credits' && (
        <EndingOverlay
          story={manifests.story}
          endingId={endingId}
          endingsCount={meta.endings.length}
          onReturnMenu={handleReturnToMenu}
          onPlayAgain={handlePlayNew}
          onOpenCredits={() => openOverlay({ type: 'credits' })}
        />
      )}
    </div>
  )
}
