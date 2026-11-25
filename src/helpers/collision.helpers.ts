import { CLOSED_DOOR_COLLIDER, OPEN_EXIT_ZONE } from '@/constants'
import type { AabbXZ, SceneManifest, WorldFlags } from '@/types'

export function buildActiveColliders(
  manifest: SceneManifest,
  flags: WorldFlags
): AabbXZ[] {
  const colliders: AabbXZ[] = [...manifest.wallCollidersXZ]

  for (const instance of manifest.instances) {
    if (!instance.localCollidersXZ || !instance.position) {
      continue
    }

    if (instance.stateKey === 'stationA07' && !flags.stationA07Visible) {
      continue
    }

    if (instance.stateKey === 'stationB02' && !flags.stationB02Visible) {
      continue
    }

    const [px, , pz] = instance.position
    const yaw = instance.yaw ?? 0
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)

    for (const [minX, minZ, maxX, maxZ] of instance.localCollidersXZ) {
      const corners: Array<[number, number]> = [
        [minX, minZ],
        [minX, maxZ],
        [maxX, minZ],
        [maxX, maxZ]
      ]
      let wxMin = Infinity
      let wzMin = Infinity
      let wxMax = -Infinity
      let wzMax = -Infinity

      for (const [lx, lz] of corners) {
        const wx = px + lx * cos + lz * sin
        const wz = pz - lx * sin + lz * cos

        if (wx < wxMin) wxMin = wx

        if (wx > wxMax) wxMax = wx

        if (wz < wzMin) wzMin = wz

        if (wz > wzMax) wzMax = wz
      }

      colliders.push([wxMin, wzMin, wxMax, wzMax])
    }
  }

  if (!flags.exitOpen) {
    colliders.push(CLOSED_DOOR_COLLIDER)
  }

  return colliders
}

export function isPointInsideWalkableZones(
  x: number,
  z: number,
  manifest: SceneManifest,
  exitOpen: boolean,
  radius: number
): boolean {
  const zones = exitOpen ? [...manifest.zones, OPEN_EXIT_ZONE] : manifest.zones

  for (const zone of zones) {
    const [minX, minZ] = zone.minXZ
    const [maxX, maxZ] = zone.maxXZ
    const insideX = x >= minX + radius * 0.4 && x <= maxX - radius * 0.4
    const insideZ = z >= minZ - radius * 0.15 && z <= maxZ + radius * 0.15

    if (insideX && insideZ) {
      return true
    }
  }

  return false
}

export function collidesWithAnyAabb(
  x: number,
  z: number,
  colliders: readonly AabbXZ[],
  radius: number
): boolean {
  for (const [minX, minZ, maxX, maxZ] of colliders) {
    if (
      x > minX - radius &&
      x < maxX + radius &&
      z > minZ - radius &&
      z < maxZ + radius
    ) {
      return true
    }
  }

  return false
}

export function resolveMovementXZ(
  currentX: number,
  currentZ: number,
  deltaX: number,
  deltaZ: number,
  manifest: SceneManifest,
  colliders: readonly AabbXZ[],
  exitOpen: boolean
): { x: number; z: number; moved: boolean } {
  const radius = manifest.avatar.radius
  const distance = Math.hypot(deltaX, deltaZ)

  if (distance < 1e-6) {
    return { x: currentX, z: currentZ, moved: false }
  }

  const maxStep = 0.08
  const steps = Math.max(1, Math.ceil(distance / maxStep))
  const stepX = deltaX / steps
  const stepZ = deltaZ / steps

  let x = currentX
  let z = currentZ

  for (let i = 0; i < steps; i += 1) {
    const tryX = x + stepX

    if (
      isPointInsideWalkableZones(tryX, z, manifest, exitOpen, radius) &&
      !collidesWithAnyAabb(tryX, z, colliders, radius)
    ) {
      x = tryX
    }

    const tryZ = z + stepZ

    if (
      isPointInsideWalkableZones(x, tryZ, manifest, exitOpen, radius) &&
      !collidesWithAnyAabb(x, tryZ, colliders, radius)
    ) {
      z = tryZ
    }
  }

  const moved = Math.hypot(x - currentX, z - currentZ) > 1e-5

  return { x, z, moved }
}
