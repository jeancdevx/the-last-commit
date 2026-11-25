import { useEffect, useRef, useState } from 'preact/hooks'

import { loadManifests, withBase } from '@/helpers/assets.helpers'
import { GameAudioEngine } from '@/helpers/audio.helpers'
import { SceneEngine, checkWebGL2Support } from '@/helpers/scene.helpers'
import {
  createInitialProgress,
  deriveWorldFlags
} from '@/helpers/state.helpers'
import { getDefaultSettings, loadSave } from '@/helpers/storage.helpers'
import type { DiagnosticSnapshot } from '@/types'

export default function DiagnosticsApp() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Analizando capacidades y recursos...')
  const [error, setError] = useState<string | null>(null)
  const [gpuInfo, setGpuInfo] = useState(() => checkWebGL2Support())
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null)
  const [manifestSummary, setManifestSummary] = useState<{
    instances: number
    puzzles: number
    audios: number
  } | null>(null)
  const [saveSummary, setSaveSummary] = useState('')

  useEffect(() => {
    let engine: SceneEngine | null = null
    let audio: GameAudioEngine | null = null
    let cancelled = false

    const run = async () => {
      const save = loadSave()

      setSaveSummary(
        save.status === 'ok'
          ? `Partida válida (${save.envelope.savedAt})`
          : save.status === 'corrupt'
            ? `Corrupta: ${save.message}`
            : 'Sin partida guardada'
      )

      try {
        const manifests = await loadManifests()

        if (cancelled) return

        setManifestSummary({
          instances: manifests.scene.instances.length,
          puzzles: manifests.story.puzzles.length,
          audios: manifests.audio.assets.length
        })

        const webgl = checkWebGL2Support()

        setGpuInfo(webgl)

        if (!webgl.supported || !containerRef.current) {
          setStatus('WebGL 2 no disponible en este navegador.')

          return
        }

        const settings = { ...getDefaultSettings(), muted: true }

        audio = new GameAudioEngine(settings)
        await audio.loadManifest(manifests.audio)

        const flags = deriveWorldFlags(createInitialProgress())

        engine = new SceneEngine(
          containerRef.current,
          manifests.scene,
          audio,
          settings,
          flags,
          {
            onLoadProgress: (pct, detail) => {
              if (!cancelled) setStatus(`${pct}% · ${detail}`)
            },
            onHoverChange: () => {},
            onPointerLockChange: () => {},
            onInteract: () => {},
            onAbsenceSeen: () => {},
            onContextLost: () => setError('Contexto WebGL perdido'),
            onContextRestored: () => setError(null)
          }
        )

        await engine.loadAssets()

        if (cancelled) return

        engine.renderSingleFrame()
        setSnapshot(engine.getDiagnostics())
        setStatus('Diagnóstico completado correctamente.')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('Error durante el diagnóstico.')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      engine?.dispose()
      audio?.dispose()
    }
  }, [])

  return (
    <div class='mx-auto max-w-4xl space-y-6 px-6 py-10'>
      <header class='flex flex-wrap items-center justify-between gap-4 border-b border-tlc-line/70 pb-4'>
        <div>
          <p class='font-console text-xs tracking-[0.2em] text-tlc-amber uppercase'>
            Herramienta interna de verificación
          </p>
          <h1 class='mt-1 font-title text-4xl tracking-wide text-tlc-text uppercase'>
            Diagnóstico · The Last Commit
          </h1>
        </div>
        <a
          href={withBase('')}
          class='rounded border border-tlc-amber bg-tlc-amber/15 px-4 py-2 font-console text-xs text-tlc-text transition hover:bg-tlc-amber/25'
        >
          ← Volver al juego
        </a>
      </header>

      <div class='rounded border border-tlc-line/70 bg-tlc-panel p-4 font-console text-xs'>
        <p class='text-tlc-secondary'>
          Estado: <span class='text-tlc-text'>{status}</span>
        </p>
        {error && <p class='mt-2 text-tlc-danger'>Error: {error}</p>}
      </div>

      <div class='grid gap-4 md:grid-cols-2'>
        <section class='rounded border border-tlc-line/70 bg-tlc-panel p-5'>
          <h2 class='font-title text-2xl tracking-wide text-tlc-text uppercase'>
            WebGL 2 y GPU
          </h2>
          <dl class='mt-3 space-y-2 font-console text-xs'>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>WebGL 2</dt>
              <dd
                class={
                  gpuInfo.supported ? 'text-tlc-positive' : 'text-tlc-danger'
                }
              >
                {gpuInfo.supported ? '✓ Disponible' : '✕ No disponible'}
              </dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Renderer</dt>
              <dd class='text-right text-tlc-text'>{gpuInfo.renderer}</dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Vendor</dt>
              <dd class='text-right text-tlc-text'>{gpuInfo.vendor}</dd>
            </div>
            {snapshot && (
              <>
                <div class='flex justify-between gap-3'>
                  <dt class='text-tlc-secondary'>Draw calls</dt>
                  <dd class='text-tlc-amber'>{snapshot.drawCalls}</dd>
                </div>
                <div class='flex justify-between gap-3'>
                  <dt class='text-tlc-secondary'>Triángulos</dt>
                  <dd class='text-tlc-amber'>{snapshot.triangles}</dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section class='rounded border border-tlc-line/70 bg-tlc-panel p-5'>
          <h2 class='font-title text-2xl tracking-wide text-tlc-text uppercase'>
            Recursos y guardado
          </h2>
          <dl class='mt-3 space-y-2 font-console text-xs'>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Instancias (scene.json)</dt>
              <dd class='text-tlc-text'>{manifestSummary?.instances ?? '—'}</dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Modelos GLB cargados</dt>
              <dd class='text-tlc-positive'>{snapshot?.loadedModels ?? '—'}</dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Puzles (story.es.json)</dt>
              <dd class='text-tlc-text'>{manifestSummary?.puzzles ?? '—'}</dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Audios decodificados</dt>
              <dd class='text-tlc-text'>
                {snapshot?.audioDecodedCount ?? '—'} /{' '}
                {manifestSummary?.audios ?? '—'}
              </dd>
            </div>
            <div class='flex justify-between gap-3'>
              <dt class='text-tlc-secondary'>Guardado local</dt>
              <dd class='text-right text-tlc-text'>{saveSummary}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class='space-y-2'>
        <h2 class='font-title text-2xl tracking-wide text-tlc-text uppercase'>
          Vista de comprobación (spawn → A-07)
        </h2>
        <div
          ref={containerRef}
          class='h-72 w-full overflow-hidden rounded border border-tlc-line bg-black'
        />
      </section>
    </div>
  )
}
