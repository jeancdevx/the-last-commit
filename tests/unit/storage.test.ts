import { describe, expect, it } from 'vitest'

import { SAVE_STORAGE_KEY } from '@/constants'
import { createInitialProgress } from '@/helpers/state.helpers'
import {
  clearSave,
  loadSave,
  loadSettings,
  saveProgress,
  saveSettings
} from '@/helpers/storage.helpers'
import type { StorageLike } from '@/helpers/storage.helpers'

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()

  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: key => {
      map.delete(key)
    }
  }
}

describe('local storage persistence and corrupt-save recovery', () => {
  it('saves and reloads a valid confirmed-commit state', () => {
    const storage = createMemoryStorage()
    const progress = {
      ...createInitialProgress(),
      panelRead: true,
      clues: [
        'tag_07',
        'ledger_07',
        'tag_19',
        'ledger_19',
        'tag_26',
        'note_26'
      ] as const,
      a07Disappeared: true,
      a07AbsenceSeen: true,
      restored: {
        'folio-07': true,
        'folio-19': true,
        'folio-26': true
      },
      commitConfirmed: true
    }

    expect(
      saveProgress({ ...progress, clues: [...progress.clues] }, storage)
    ).toBe(true)

    const loaded = loadSave(storage)

    expect(loaded.status).toBe('ok')

    if (loaded.status === 'ok') {
      expect(loaded.envelope.progress.commitConfirmed).toBe(true)
      expect(loaded.envelope.progress.clues).toHaveLength(6)
    }
  })

  it('detects corrupt JSON, wrong versions, and inconsistent saves safely', () => {
    const storage = createMemoryStorage()

    storage.setItem(SAVE_STORAGE_KEY, '{not-valid-json')
    expect(loadSave(storage).status).toBe('corrupt')

    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({ version: 99, savedAt: '2026-12-24', progress: {} })
    )
    expect(loadSave(storage).status).toBe('corrupt')

    // Tampered save: commitConfirmed without restoring all folios
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: '2026-12-24T23:55:00Z',
        progress: {
          ...createInitialProgress(),
          commitConfirmed: true
        }
      })
    )
    expect(loadSave(storage).status).toBe('corrupt')

    // Unknown clue ID
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: '2026-12-24T23:55:00Z',
        progress: {
          ...createInitialProgress(),
          clues: ['nonexistent_clue']
        }
      })
    )
    expect(loadSave(storage).status).toBe('corrupt')

    clearSave(storage)
    expect(loadSave(storage).status).toBe('empty')
  })

  it('clamps and persists user accessibility settings', () => {
    const storage = createMemoryStorage()

    saveSettings(
      {
        volume: 0.45,
        muted: true,
        sensitivity: 1.5,
        subtitles: true,
        reducedMotion: true
      },
      storage
    )

    const loaded = loadSettings(storage)

    expect(loaded).toEqual({
      volume: 0.45,
      muted: true,
      sensitivity: 1.5,
      subtitles: true,
      reducedMotion: true
    })
  })
})
