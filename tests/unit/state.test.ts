import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  confirmCommit,
  createInitialProgress,
  deriveStage,
  deriveWorldFlags,
  evaluateA07Disappearance,
  getPuzzleStatus,
  markA07AbsenceSeen,
  markPanelRead,
  recordClue,
  submitPuzzleAnswer,
  useExit
} from '@/helpers/state.helpers'
import type { SceneManifest, StoryManifest } from '@/types'

const story = JSON.parse(
  readFileSync(resolve('public/assets/story.es.json'), 'utf-8')
) as StoryManifest

const scene = JSON.parse(
  readFileSync(resolve('public/assets/scene.json'), 'utf-8')
) as SceneManifest

const gate = scene.interaction.a07OutsideViewGate

describe('narrative state machine', () => {
  it('starts in opening stage with A-07 visible, B-02 hidden, exit locked', () => {
    const progress = createInitialProgress()
    const stage = deriveStage(progress, story)
    const flags = deriveWorldFlags(progress)

    expect(stage).toEqual({ id: 'opening', time: '23:52' })
    expect(flags.stationA07Visible).toBe(true)
    expect(flags.traceA07Visible).toBe(false)
    expect(flags.stationB02Visible).toBe(false)
    expect(flags.exitOpen).toBe(false)
    expect(flags.a07AudioActive).toBe(true)
    expect(flags.tag07Interactable).toBe(false)
  })

  it('triggers A-07 disappearance only once and only beyond reception frame after tag_07', () => {
    let state = createInitialProgress()

    // Cannot fire before reading panel or tag_07
    const early = evaluateA07Disappearance(state, -10, gate)

    expect(early.triggered).toBe(false)

    state = markPanelRead(state).progress

    const noTag = evaluateA07Disappearance(state, -10, gate)

    expect(noTag.triggered).toBe(false)

    state = recordClue(state, 'tag_07').progress

    // Still inside office/corridor in view -> must NOT disappear
    const inCorridor = evaluateA07Disappearance(state, -4, gate)

    expect(inCorridor.triggered).toBe(false)

    // In reception beyond gate (z <= -7.55) -> fires once
    const vanished = evaluateA07Disappearance(state, -9.2, gate)

    expect(vanished.triggered).toBe(true)
    expect(vanished.progress.a07Disappeared).toBe(true)

    const flags = deriveWorldFlags(vanished.progress)

    expect(flags.stationA07Visible).toBe(false)
    expect(flags.traceA07Visible).toBe(true)
    expect(flags.a07LightIntensity).toBe(0)
    expect(flags.a07AudioActive).toBe(false)

    // Re-evaluating is strictly idempotent (fires only once)
    const secondTry = evaluateA07Disappearance(vanished.progress, -10, gate)

    expect(secondTry.triggered).toBe(false)
  })

  it('blocks puzzles when clues or absence sighting are missing', () => {
    let state = markPanelRead(createInitialProgress()).progress

    state = recordClue(state, 'tag_07').progress
    state = evaluateA07Disappearance(state, -9.5, gate).progress

    // Still hasn't returned to see the absence
    const blockedNoSight = submitPuzzleAnswer(
      state,
      story,
      'folio-07',
      'next-day'
    )

    expect(blockedNoSight.ok).toBe(false)
    expect(blockedNoSight.reason).toBe('missing_clues')

    state = markA07AbsenceSeen(state).progress

    // Missing ledger_07
    const statusMissingLedger = getPuzzleStatus(state, story, 'folio-07')

    expect(statusMissingLedger.unlocked).toBe(false)
    expect(statusMissingLedger.missingClues).toEqual(['ledger_07'])

    const blockedNoLedger = submitPuzzleAnswer(
      state,
      story,
      'folio-07',
      'next-day'
    )

    expect(blockedNoLedger.ok).toBe(false)
    expect(blockedNoLedger.reason).toBe('missing_clues')
  })

  it('returns hint on wrong answer while preserving discovered clues', () => {
    let state = markPanelRead(createInitialProgress()).progress

    state = recordClue(state, 'tag_07').progress
    state = evaluateA07Disappearance(state, -9.5, gate).progress
    state = markA07AbsenceSeen(state).progress
    state = recordClue(state, 'ledger_07').progress

    const wrong = submitPuzzleAnswer(state, story, 'folio-07', 'same-day')

    expect(wrong.ok).toBe(false)
    expect(wrong.reason).toBe('wrong_answer')
    expect(wrong.message).toBe(story.puzzles[0].hint)
    expect(wrong.progress.clues).toEqual(['tag_07', 'ledger_07'])
    expect(wrong.progress.restored['folio-07']).toBe(false)
  })

  it('rejects duplicate restore attempts and early commit/exit', () => {
    let state = markPanelRead(createInitialProgress()).progress

    state = recordClue(state, 'tag_07').progress
    state = evaluateA07Disappearance(state, -9.5, gate).progress
    state = markA07AbsenceSeen(state).progress
    state = recordClue(state, 'ledger_07').progress

    // Early commit before all 3 folios
    const earlyCommit = confirmCommit(state, story)

    expect(earlyCommit.ok).toBe(false)
    expect(earlyCommit.reason).toBe('incomplete')

    // Early exit before commit
    const earlyExit = useExit(state)

    expect(earlyExit.ok).toBe(false)
    expect(earlyExit.reason).toBe('locked')

    // Restore folio 07
    const restored07 = submitPuzzleAnswer(state, story, 'folio-07', 'next-day')

    expect(restored07.ok).toBe(true)

    const flagsAfter07 = deriveWorldFlags(restored07.progress)

    expect(flagsAfter07.stationA07Visible).toBe(true)
    expect(flagsAfter07.traceA07Visible).toBe(false)
    expect(flagsAfter07.tag19Visible).toBe(true)

    // Restoring folio 07 a second time is rejected cleanly
    const duplicate = submitPuzzleAnswer(
      restored07.progress,
      story,
      'folio-07',
      'next-day'
    )

    expect(duplicate.ok).toBe(false)
    expect(duplicate.reason).toBe('already_restored')
  })

  it('completes all three folios, confirms commit, opens exit, and reaches ending', () => {
    let state = markPanelRead(createInitialProgress()).progress

    state = recordClue(state, 'tag_07').progress
    state = evaluateA07Disappearance(state, -9.5, gate).progress
    state = markA07AbsenceSeen(state).progress
    state = recordClue(state, 'ledger_07').progress

    expect(deriveStage(state, story)).toEqual({ id: 'folio-07', time: '23:54' })

    state = submitPuzzleAnswer(state, story, 'folio-07', 'next-day').progress

    expect(deriveStage(state, story)).toEqual({ id: 'folio-19', time: '23:57' })

    state = recordClue(state, 'tag_19').progress
    state = recordClue(state, 'ledger_19').progress
    state = submitPuzzleAnswer(state, story, 'folio-19', 'row-19').progress

    expect(deriveStage(state, story)).toEqual({ id: 'folio-26', time: '23:59' })
    expect(deriveWorldFlags(state).stationB02Visible).toBe(true)
    expect(deriveWorldFlags(state).tag26Visible).toBe(true)

    state = recordClue(state, 'tag_26').progress
    state = recordClue(state, 'note_26').progress
    state = submitPuzzleAnswer(state, story, 'folio-26', 'a06-25').progress

    const committed = confirmCommit(state, story)

    expect(committed.ok).toBe(true)
    expect(deriveStage(committed.progress, story)).toEqual({
      id: 'confirmed',
      time: '00:00'
    })
    expect(deriveWorldFlags(committed.progress).exitOpen).toBe(true)

    const exited = useExit(committed.progress)

    expect(exited.ok).toBe(true)
    expect(deriveStage(exited.progress, story)).toEqual({
      id: 'ending',
      time: '00:01'
    })
  })
})
