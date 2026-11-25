import { ALL_PUZZLE_IDS, STAGE_FALLBACK_TIMES } from '@/constants'
import type {
  ClueId,
  GameProgress,
  PuzzleId,
  StageId,
  StoryManifest,
  WorldFlags
} from '@/types'

export function createInitialProgress(): GameProgress {
  return {
    panelRead: false,
    clues: [],
    a07Disappeared: false,
    a07AbsenceSeen: false,
    restored: {
      'folio-07': false,
      'folio-19': false,
      'folio-26': false
    },
    commitConfirmed: false,
    exitUsed: false
  }
}

export function hasClue(progress: GameProgress, clueId: ClueId): boolean {
  return progress.clues.includes(clueId)
}

export function allFoliosRestored(progress: GameProgress): boolean {
  return (
    progress.restored['folio-07'] &&
    progress.restored['folio-19'] &&
    progress.restored['folio-26']
  )
}

export function deriveStage(
  progress: GameProgress,
  story?: StoryManifest
): { id: StageId; time: string } {
  let id: StageId = 'opening'

  if (progress.commitConfirmed && progress.exitUsed) {
    id = 'ending'
  } else if (progress.commitConfirmed && progress.restored['folio-26']) {
    id = 'confirmed'
  } else if (progress.restored['folio-19']) {
    id = 'folio-26'
  } else if (progress.restored['folio-07']) {
    id = 'folio-19'
  } else if (
    progress.panelRead &&
    hasClue(progress, 'tag_07') &&
    progress.a07AbsenceSeen
  ) {
    id = 'folio-07'
  }

  const time =
    story?.stages.find(item => item.id === id)?.time ?? STAGE_FALLBACK_TIMES[id]

  return { id, time }
}

export function deriveWorldFlags(progress: GameProgress): WorldFlags {
  const stationA07Visible =
    !progress.a07Disappeared || progress.restored['folio-07']
  const traceA07Visible =
    progress.a07Disappeared && !progress.restored['folio-07']
  const stationB02Visible = progress.restored['folio-19']
  const tag19Visible = progress.restored['folio-07']
  const tag26Visible = progress.restored['folio-19']
  const exitOpen = progress.commitConfirmed

  const bulbs07Intensity = progress.restored['folio-07']
    ? 2.2
    : progress.panelRead
      ? 1.65
      : 0.25

  const bulbs19Intensity = progress.restored['folio-19']
    ? 2.2
    : progress.restored['folio-07']
      ? 1.75
      : 0.1

  const bulbs26Intensity = progress.restored['folio-26']
    ? 2.4
    : progress.restored['folio-19']
      ? 1.85
      : 0.1

  const restoredCount = ALL_PUZZLE_IDS.filter(
    id => progress.restored[id]
  ).length
  const treeLightIntensity = progress.commitConfirmed
    ? 3.8
    : progress.panelRead
      ? 1.9 + restoredCount * 0.55
      : 0.7

  return {
    stationA07Visible,
    traceA07Visible,
    stationB02Visible,
    tag07Visible: true,
    tag07Interactable: progress.panelRead,
    tag19Visible,
    tag26Visible,
    exitOpen,
    bulbs07Intensity,
    bulbs19Intensity,
    bulbs26Intensity,
    treeLightIntensity,
    a07LightIntensity: stationA07Visible ? 1.55 : 0,
    a07AudioActive: stationA07Visible
  }
}

export function markPanelRead(progress: GameProgress): {
  progress: GameProgress
  firstTime: boolean
} {
  if (progress.panelRead) {
    return { progress, firstTime: false }
  }

  return {
    progress: {
      ...progress,
      panelRead: true
    },
    firstTime: true
  }
}

export function recordClue(
  progress: GameProgress,
  clueId: ClueId
): {
  progress: GameProgress
  added: boolean
} {
  if (progress.clues.includes(clueId)) {
    return { progress, added: false }
  }

  return {
    progress: {
      ...progress,
      clues: [...progress.clues, clueId]
    },
    added: true
  }
}

export function evaluateA07Disappearance(
  progress: GameProgress,
  playerZ: number,
  gate: { playerZMax: number; requiresTagRead: boolean }
): {
  progress: GameProgress
  triggered: boolean
} {
  if (progress.a07Disappeared) {
    return { progress, triggered: false }
  }

  if (!progress.panelRead) {
    return { progress, triggered: false }
  }

  if (gate.requiresTagRead && !hasClue(progress, 'tag_07')) {
    return { progress, triggered: false }
  }

  if (playerZ > gate.playerZMax) {
    return { progress, triggered: false }
  }

  return {
    progress: {
      ...progress,
      a07Disappeared: true
    },
    triggered: true
  }
}

export function markA07AbsenceSeen(progress: GameProgress): {
  progress: GameProgress
  firstTime: boolean
} {
  if (
    !progress.a07Disappeared ||
    progress.a07AbsenceSeen ||
    progress.restored['folio-07']
  ) {
    return { progress, firstTime: false }
  }

  return {
    progress: {
      ...progress,
      a07AbsenceSeen: true
    },
    firstTime: true
  }
}

export interface PuzzleUnlockStatus {
  unlocked: boolean
  restored: boolean
  missingClues: ClueId[]
  blockedMessage: string | null
}

export function getPuzzleStatus(
  progress: GameProgress,
  story: StoryManifest,
  puzzleId: PuzzleId
): PuzzleUnlockStatus {
  const puzzle = story.puzzles.find(item => item.id === puzzleId)

  if (!puzzle) {
    return {
      unlocked: false,
      restored: false,
      missingClues: [],
      blockedMessage: 'Folio no disponible.'
    }
  }

  if (progress.restored[puzzleId]) {
    return {
      unlocked: true,
      restored: true,
      missingClues: [],
      blockedMessage: null
    }
  }

  if (puzzleId === 'folio-07') {
    if (!progress.panelRead) {
      return {
        unlocked: false,
        restored: false,
        missingClues: puzzle.requiredClues,
        blockedMessage: 'Revisa el aviso de cierre en la consola.'
      }
    }

    if (!progress.a07Disappeared) {
      return {
        unlocked: false,
        restored: false,
        missingClues: puzzle.requiredClues.filter(id => !hasClue(progress, id)),
        blockedMessage:
          'Inspecciona el adorno del folio 07 en el árbol de recepción.'
      }
    }

    if (!progress.a07AbsenceSeen) {
      return {
        unlocked: false,
        restored: false,
        missingClues: puzzle.requiredClues.filter(id => !hasClue(progress, id)),
        blockedMessage: 'Regresa a la oficina para comprobar el puesto A-07.'
      }
    }
  }

  if (puzzleId === 'folio-19' && !progress.restored['folio-07']) {
    return {
      unlocked: false,
      restored: false,
      missingClues: puzzle.requiredClues.filter(id => !hasClue(progress, id)),
      blockedMessage: 'Restaura primero el folio 07.'
    }
  }

  if (puzzleId === 'folio-26' && !progress.restored['folio-19']) {
    return {
      unlocked: false,
      restored: false,
      missingClues: puzzle.requiredClues.filter(id => !hasClue(progress, id)),
      blockedMessage: 'Restaura primero el folio 19.'
    }
  }

  const missingClues = puzzle.requiredClues.filter(id => !hasClue(progress, id))

  if (missingClues.length > 0) {
    const missingNames = missingClues
      .map(id => story.clues[id]?.title ?? id)
      .join(' y ')

    return {
      unlocked: false,
      restored: false,
      missingClues,
      blockedMessage: `Falta evidencia física: ${missingNames}.`
    }
  }

  return {
    unlocked: true,
    restored: false,
    missingClues: [],
    blockedMessage: null
  }
}

export interface PuzzleSubmissionResult {
  ok: boolean
  reason:
    | 'restored'
    | 'already_restored'
    | 'missing_clues'
    | 'wrong_answer'
    | 'invalid_puzzle'
  message: string
  progress: GameProgress
}

export function submitPuzzleAnswer(
  progress: GameProgress,
  story: StoryManifest,
  puzzleId: PuzzleId,
  optionId: string
): PuzzleSubmissionResult {
  const puzzle = story.puzzles.find(item => item.id === puzzleId)

  if (!puzzle) {
    return {
      ok: false,
      reason: 'invalid_puzzle',
      message: 'Registro no encontrado.',
      progress
    }
  }

  if (progress.restored[puzzleId]) {
    return {
      ok: false,
      reason: 'already_restored',
      message: `El folio ${puzzle.folio} ya fue restaurado.`,
      progress
    }
  }

  const status = getPuzzleStatus(progress, story, puzzleId)

  if (!status.unlocked) {
    return {
      ok: false,
      reason: 'missing_clues',
      message: status.blockedMessage ?? 'Aún falta evidencia para este folio.',
      progress
    }
  }

  if (optionId !== puzzle.answer) {
    return {
      ok: false,
      reason: 'wrong_answer',
      message: puzzle.hint,
      progress
    }
  }

  return {
    ok: true,
    reason: 'restored',
    message: puzzle.success,
    progress: {
      ...progress,
      restored: {
        ...progress.restored,
        [puzzleId]: true
      }
    }
  }
}

export interface CommitResult {
  ok: boolean
  reason: 'confirmed' | 'incomplete' | 'already_confirmed'
  message: string
  progress: GameProgress
}

export function confirmCommit(
  progress: GameProgress,
  story: StoryManifest
): CommitResult {
  if (progress.commitConfirmed) {
    return {
      ok: false,
      reason: 'already_confirmed',
      message: story.commit.success,
      progress
    }
  }

  if (!allFoliosRestored(progress)) {
    return {
      ok: false,
      reason: 'incomplete',
      message:
        'Debes restaurar los tres folios (07, 19 y 26) antes de confirmar la restauración.',
      progress
    }
  }

  return {
    ok: true,
    reason: 'confirmed',
    message: story.commit.success,
    progress: {
      ...progress,
      commitConfirmed: true
    }
  }
}

export interface ExitResult {
  ok: boolean
  reason: 'exited' | 'locked'
  message: string
  progress: GameProgress
}

export function useExit(progress: GameProgress): ExitResult {
  if (!progress.commitConfirmed) {
    return {
      ok: false,
      reason: 'locked',
      message:
        'El pestillo no cede. Completa la restauración en la consola de A-06.',
      progress
    }
  }

  return {
    ok: true,
    reason: 'exited',
    message: 'Salida completada.',
    progress: {
      ...progress,
      exitUsed: true
    }
  }
}

export function getGuidanceSummary(progress: GameProgress): string {
  if (!progress.panelRead) {
    return 'Revisa la consola en el puesto A-06.'
  }

  if (!hasClue(progress, 'tag_07')) {
    return 'Algo sonó junto al árbol en recepción. Inspecciona el adorno del folio 07.'
  }

  if (!progress.a07Disappeared) {
    return 'Cierra la lectura en recepción y mira hacia el pasillo.'
  }

  if (!progress.a07AbsenceSeen) {
    return 'Regresa a la oficina para revisar el puesto A-07.'
  }

  if (!progress.restored['folio-07']) {
    if (!hasClue(progress, 'ledger_07')) {
      return 'Consulta el folio 07 en la bitácora del mostrador de recepción.'
    }

    return 'Restaura el folio 07 desde la consola de A-06.'
  }

  if (!progress.restored['folio-19']) {
    if (!hasClue(progress, 'tag_19')) {
      return 'Se encendió un nuevo tramo en el árbol. Inspecciona el adorno del folio 19.'
    }

    if (!hasClue(progress, 'ledger_19')) {
      return 'Comprueba el folio 19 en la bitácora de recepción.'
    }

    return 'Restaura el folio 19 en la consola de A-06.'
  }

  if (!progress.restored['folio-26']) {
    if (!hasClue(progress, 'tag_26')) {
      return 'El tercer grupo de luces brilla en el árbol. Inspecciona el folio 26.'
    }

    if (!hasClue(progress, 'note_26')) {
      return 'Lee la nota del turno actual junto al monitor de A-06.'
    }

    return 'Recupera el turno activo (folio 26) en la consola de A-06.'
  }

  if (!progress.commitConfirmed) {
    return 'Los tres turnos figuran en la consola. Elige «Confirmar restauración».'
  }

  if (!progress.exitUsed) {
    return 'La salida de recepción está abierta.'
  }

  return 'Tres guardias de Nochebuena conservadas.'
}
