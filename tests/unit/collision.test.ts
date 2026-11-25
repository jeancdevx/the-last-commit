import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildActiveColliders,
  collidesWithAnyAabb,
  resolveMovementXZ
} from '@/helpers/collision.helpers'
import {
  createInitialProgress,
  deriveWorldFlags
} from '@/helpers/state.helpers'
import type { SceneManifest } from '@/types'

const manifest = JSON.parse(
  readFileSync(resolve('public/assets/scene.json'), 'utf-8')
) as SceneManifest

describe('XZ AABB collisions and dynamic world colliders', () => {
  it('blocks walking through A-07 initially and frees space once A-07 disappears', () => {
    const initialFlags = deriveWorldFlags(createInitialProgress())
    const initialColliders = buildActiveColliders(manifest, initialFlags)

    expect(
      collidesWithAnyAabb(1.55, 2.0, initialColliders, manifest.avatar.radius)
    ).toBe(true)

    const disappearedFlags = deriveWorldFlags({
      ...createInitialProgress(),
      panelRead: true,
      clues: ['tag_07'],
      a07Disappeared: true
    })
    const afterColliders = buildActiveColliders(manifest, disappearedFlags)

    expect(
      collidesWithAnyAabb(1.55, 2.0, afterColliders, manifest.avatar.radius)
    ).toBe(false)
  })

  it('allows walking cleanly from office through corridor to reception', () => {
    const flags = deriveWorldFlags(createInitialProgress())
    const colliders = buildActiveColliders(manifest, flags)

    // Walk along corridor center X = 0 from office (z = 2) into reception (z = -9)
    const walk = resolveMovementXZ(0, 2, 0, -11, manifest, colliders, false)

    expect(walk.moved).toBe(true)
    expect(walk.z).toBeLessThan(-8.5)
  })

  it('keeps exit doorway blocked until commitConfirmed opens it', () => {
    const lockedFlags = deriveWorldFlags(createInitialProgress())
    const lockedColliders = buildActiveColliders(manifest, lockedFlags)
    const blocked = resolveMovementXZ(
      0,
      -12.2,
      0,
      -1.2,
      manifest,
      lockedColliders,
      false
    )

    expect(blocked.z).toBeGreaterThan(-12.75)

    const openFlags = deriveWorldFlags({
      ...createInitialProgress(),
      panelRead: true,
      a07Disappeared: true,
      a07AbsenceSeen: true,
      restored: {
        'folio-07': true,
        'folio-19': true,
        'folio-26': true
      },
      commitConfirmed: true
    })
    const openColliders = buildActiveColliders(manifest, openFlags)
    const passed = resolveMovementXZ(
      0,
      -12.2,
      0,
      -1.2,
      manifest,
      openColliders,
      true
    )

    expect(passed.z).toBeLessThan(-13.1)
  })
})
