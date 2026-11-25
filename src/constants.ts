import type { AabbXZ, ClueId, PuzzleId, StageId } from '@/types'

export const SAVE_STORAGE_KEY = 'tlc_save_v1'

export const SETTINGS_STORAGE_KEY = 'tlc_settings_v1'

export const ALL_CLUE_IDS: readonly ClueId[] = [
  'tag_07',
  'tag_19',
  'tag_26',
  'ledger_07',
  'ledger_19',
  'note_26'
]

export const ALL_PUZZLE_IDS: readonly PuzzleId[] = [
  'folio-07',
  'folio-19',
  'folio-26'
]

export const STAGE_FALLBACK_TIMES: Record<StageId, string> = {
  opening: '23:52',
  'folio-07': '23:54',
  'folio-19': '23:57',
  'folio-26': '23:59',
  confirmed: '00:00',
  ending: '00:01'
}

// Closed exit door leaf spans world X [-0.66, +0.64] at Z = -12.96
export const CLOSED_DOOR_COLLIDER: AabbXZ = [-0.68, -13.06, 0.7, -12.86]

// Walkable threshold behind the opened exit door
export const OPEN_EXIT_ZONE = {
  id: 'exit-vestibule',
  minXZ: [-0.66, -13.62] as [number, number],
  maxXZ: [0.66, -12.85] as [number, number]
}
