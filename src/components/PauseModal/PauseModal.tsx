import { useEffect, useRef } from 'preact/hooks'

export interface PauseModalProps {
  guidance: string
  onResume: () => void
  onOpenSettings: () => void
  onRestart: () => void
  onReturnMenu: () => void
}

export default function PauseModal({
  guidance,
  onResume,
  onOpenSettings,
  onRestart,
  onReturnMenu
}: PauseModalProps) {
  const resumeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    resumeRef.current?.focus()
  }, [])

  return (
    <dialog
      open
      aria-modal='true'
      aria-labelledby='pause-modal-title'
      class='fixed inset-0 z-40 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-[#090e0d]/82 p-4 text-tlc-text backdrop-blur-xs'
    >
      <div class='w-full max-w-md rounded border border-tlc-line bg-tlc-panel p-6 shadow-2xl'>
        <p class='font-console text-xs tracking-[0.2em] text-tlc-amber uppercase'>
          Planta 04 · En pausa
        </p>
        <h2
          id='pause-modal-title'
          class='mt-1 font-title text-4xl tracking-wide text-tlc-text uppercase'
        >
          Pausa
        </h2>

        <p class='mt-3 rounded border border-tlc-line/60 bg-tlc-bg/70 px-3.5 py-2.5 text-xs text-tlc-secondary'>
          Situación actual: {guidance}
        </p>

        <div class='mt-5 flex flex-col gap-2.5'>
          <button
            ref={resumeRef}
            type='button'
            onClick={onResume}
            class='rounded border border-tlc-amber bg-tlc-amber/15 px-4 py-2.5 font-title text-xl tracking-wide text-tlc-text uppercase transition hover:bg-tlc-amber/25'
          >
            Reanudar
          </button>
          <button
            type='button'
            onClick={onOpenSettings}
            class='rounded border border-tlc-line bg-tlc-bg/70 px-4 py-2.5 text-sm font-medium text-tlc-text transition hover:border-tlc-text/60'
          >
            Ajustes
          </button>
          <button
            type='button'
            onClick={onRestart}
            class='rounded border border-tlc-line bg-tlc-bg/70 px-4 py-2.5 text-sm font-medium text-tlc-text transition hover:border-tlc-danger/70 hover:text-tlc-danger'
          >
            Empezar de nuevo
          </button>
          <button
            type='button'
            onClick={onReturnMenu}
            class='rounded border border-tlc-line/60 bg-transparent px-4 py-2 text-xs text-tlc-secondary transition hover:border-tlc-text/50 hover:text-tlc-text'
          >
            Volver al menú principal
          </button>
        </div>

        <dl class='mt-5 grid grid-cols-2 gap-2 border-t border-tlc-line/50 pt-4 font-console text-[11px] text-tlc-secondary'>
          <div>
            <dt class='text-tlc-text'>WASD / Flechas</dt>
            <dd>Caminar y girar</dd>
          </div>
          <div>
            <dt class='text-tlc-text'>Ratón</dt>
            <dd>Mirar alrededor</dd>
          </div>
          <div>
            <dt class='text-tlc-text'>E</dt>
            <dd>Interactuar / leer</dd>
          </div>
          <div>
            <dt class='text-tlc-text'>Esc</dt>
            <dd>Cerrar vista o pausar</dd>
          </div>
        </dl>
      </div>
    </dialog>
  )
}
