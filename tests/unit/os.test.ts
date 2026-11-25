import { describe, expect, it } from 'vitest'

import {
  ACHIEVEMENTS,
  CHAPTERS,
  createDefaultMeta
} from '@/helpers/achievements.helpers'
import {
  CORPORATE_CHAT,
  CORPORATE_EMAILS,
  executeTerminalCommand
} from '@/helpers/osData.helpers'
import { createInitialProgress } from '@/helpers/state.helpers'

describe('Corporate OS Terminal & Data (v2.0)', () => {
  it('lists available commands on help', () => {
    const res = executeTerminalCommand('help', createInitialProgress())

    expect(res.triggerForceEnding).toBeUndefined()
    expect(res.lines.some(line => line.includes('git status'))).toBe(true)
    expect(res.lines.some(line => line.includes('git commit --force'))).toBe(
      true
    )
  })

  it('reflects live folio progress in git status and tail cierre.log', () => {
    const progress = createInitialProgress()

    progress.a07Disappeared = true
    progress.restored['folio-07'] = true

    const status = executeTerminalCommand('git status', progress)
    const log = executeTerminalCommand('tail cierre.log', progress)

    expect(status.lines.some(line => line.includes('restaurado ✓'))).toBe(true)
    expect(log.lines.some(line => line.includes('PURGE:'))).toBe(true)
    expect(log.lines.some(line => line.includes('RESTORE: folio 07'))).toBe(
      true
    )
  })

  it('triggers force ending on git commit --force only before clean commit', () => {
    const initial = createInitialProgress()
    const forced = executeTerminalCommand('git commit --force', initial)

    expect(forced.triggerForceEnding).toBe(true)

    const confirmed = { ...initial, commitConfirmed: true }
    const afterCommit = executeTerminalCommand('git commit --force', confirmed)

    expect(afterCommit.triggerForceEnding).toBeUndefined()
  })

  it('reveals anomaly mail and chat messages once A-07 disappears', () => {
    const before = createInitialProgress()
    const after = { ...before, a07Disappeared: true }

    const mailsBefore = CORPORATE_EMAILS.filter(
      e => !e.unlockWhen || e.unlockWhen(before)
    )
    const mailsAfter = CORPORATE_EMAILS.filter(
      e => !e.unlockWhen || e.unlockWhen(after)
    )

    expect(mailsAfter.length).toBeGreaterThan(mailsBefore.length)
    expect(
      CORPORATE_CHAT.some(
        msg => msg.isAnomaly && msg.visibleWhen && msg.visibleWhen(after)
      )
    ).toBe(true)
  })
})

describe('Achievements & Chapters registry (v2.0)', () => {
  it('defines 10 unique achievements and 4 playable chapters', () => {
    const ids = new Set(ACHIEVEMENTS.map(a => a.id))

    expect(ACHIEVEMENTS).toHaveLength(10)
    expect(ids.size).toBe(10)
    expect(CHAPTERS).toHaveLength(4)

    const defaults = createDefaultMeta()

    expect(defaults.chapters).toEqual(['prologue'])
    expect(defaults.achievements).toEqual([])
    expect(defaults.endings).toEqual([])
  })

  it('builds valid GameProgress snapshots for every chapter', () => {
    for (const chapter of CHAPTERS) {
      const progress = chapter.buildProgress()

      expect(typeof progress.panelRead).toBe('boolean')
      expect(Array.isArray(progress.clues)).toBe(true)
    }

    const last = CHAPTERS.find(c => c.id === 'last_commit')!
    const lastProgress = last.buildProgress()

    expect(lastProgress.restored['folio-07']).toBe(true)
    expect(lastProgress.restored['folio-19']).toBe(true)
    expect(lastProgress.restored['folio-26']).toBe(false)
  })
})
