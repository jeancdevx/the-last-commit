import {
  ALL_CLUE_IDS,
  ALL_PUZZLE_IDS,
  SAVE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from '@/constants'
import type {
  ClueId,
  GameProgress,
  GameSettings,
  PuzzleId,
  SaveEnvelope
} from '@/types'
import { clamp, isRecord } from '@/utils'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type LoadSaveResult =
  | { status: 'empty' }
  | { status: 'ok'; envelope: SaveEnvelope }
  | { status: 'corrupt'; message: string }

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getDefaultSettings(): GameSettings {
  let reducedMotion = false

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
  }

  return {
    volume: 0.8,
    muted: false,
    sensitivity: 1,
    subtitles: true,
    reducedMotion
  }
}

export function validateProgress(value: unknown): GameProgress | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.panelRead !== 'boolean' ||
    typeof value.a07Disappeared !== 'boolean' ||
    typeof value.a07AbsenceSeen !== 'boolean' ||
    typeof value.commitConfirmed !== 'boolean' ||
    typeof value.exitUsed !== 'boolean' ||
    !Array.isArray(value.clues) ||
    !isRecord(value.restored)
  ) {
    return null
  }

  const validClues: ClueId[] = []

  for (const item of value.clues) {
    if (typeof item !== 'string' || !ALL_CLUE_IDS.includes(item as ClueId)) {
      return null
    }

    if (!validClues.includes(item as ClueId)) {
      validClues.push(item as ClueId)
    }
  }

  const restored = {} as Record<PuzzleId, boolean>

  for (const puzzleId of ALL_PUZZLE_IDS) {
    if (typeof value.restored[puzzleId] !== 'boolean') {
      return null
    }

    restored[puzzleId] = value.restored[puzzleId]
  }

  if (
    value.commitConfirmed &&
    (!restored['folio-07'] || !restored['folio-19'] || !restored['folio-26'])
  ) {
    return null
  }

  if (value.exitUsed && !value.commitConfirmed) {
    return null
  }

  return {
    panelRead: value.panelRead,
    clues: validClues,
    a07Disappeared: value.a07Disappeared,
    a07AbsenceSeen: value.a07AbsenceSeen,
    restored,
    commitConfirmed: value.commitConfirmed,
    exitUsed: value.exitUsed
  }
}

export function loadSave(
  storage: StorageLike | null = getDefaultStorage()
): LoadSaveResult {
  if (!storage) {
    return { status: 'empty' }
  }

  let raw: string | null = null

  try {
    raw = storage.getItem(SAVE_STORAGE_KEY)
  } catch {
    return {
      status: 'corrupt',
      message: 'No se pudo leer el almacenamiento local.'
    }
  }

  if (raw === null) {
    return { status: 'empty' }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      status: 'corrupt',
      message: 'La partida guardada contiene datos dañados.'
    }
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    return {
      status: 'corrupt',
      message: 'La versión de la partida guardada no es compatible.'
    }
  }

  if (typeof parsed.savedAt !== 'string') {
    return {
      status: 'corrupt',
      message: 'La partida guardada está incompleta.'
    }
  }

  const progress = validateProgress(parsed.progress)

  if (!progress) {
    return {
      status: 'corrupt',
      message: 'Los datos de progreso guardados no son válidos.'
    }
  }

  return {
    status: 'ok',
    envelope: {
      version: 1,
      savedAt: parsed.savedAt,
      progress
    }
  }
}

export function saveProgress(
  progress: GameProgress,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) {
    return false
  }

  const envelope: SaveEnvelope = {
    version: 1,
    savedAt: new Date().toISOString(),
    progress
  }

  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(envelope))

    return true
  } catch {
    return false
  }
}

export function clearSave(
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(SAVE_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function loadSettings(
  storage: StorageLike | null = getDefaultStorage()
): GameSettings {
  const defaults = getDefaultSettings()

  if (!storage) {
    return defaults
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY)

    if (!raw) {
      return defaults
    }

    const parsed = JSON.parse(raw) as unknown

    if (!isRecord(parsed)) {
      return defaults
    }

    const volume =
      typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? clamp(parsed.volume, 0, 1)
        : defaults.volume

    const sensitivity =
      typeof parsed.sensitivity === 'number' &&
      Number.isFinite(parsed.sensitivity)
        ? clamp(parsed.sensitivity, 0.35, 2)
        : defaults.sensitivity

    return {
      volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : defaults.muted,
      sensitivity,
      subtitles:
        typeof parsed.subtitles === 'boolean'
          ? parsed.subtitles
          : defaults.subtitles,
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : defaults.reducedMotion
    }
  } catch {
    return defaults
  }
}

export function saveSettings(
  settings: GameSettings,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore quota errors
  }
}
