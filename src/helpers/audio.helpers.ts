import { audioUrl } from '@/helpers/assets.helpers'
import type { AudioManifest, GameSettings, Vec3Tuple } from '@/types'

export class GameAudioEngine {
  private ctx: AudioContext | null = null

  private masterGain: GainNode | null = null

  private duckGain: GainNode | null = null

  private a07Gain: GainNode | null = null

  private a07Panner: PannerNode | null = null

  private buffers = new Map<string, AudioBuffer>()

  private manifest: AudioManifest | null = null

  private loopsStarted = false

  private stepIndex = 0

  private settings: GameSettings

  private a07Active = true

  private ducked = false

  private a07Position: Vec3Tuple = [2.13, 1.29, 2.08]

  private treePosition: Vec3Tuple = [1.44, 1.36, -10.29]

  private disposed = false

  constructor(settings: GameSettings) {
    this.settings = { ...settings }
  }

  public get decodedCount(): number {
    return this.buffers.size
  }

  public get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  public setAnchorPositions(a07: Vec3Tuple, tree: Vec3Tuple): void {
    this.a07Position = a07
    this.treePosition = tree

    if (this.a07Panner && this.ctx) {
      const now = this.ctx.currentTime

      this.a07Panner.positionX.setValueAtTime(a07[0], now)
      this.a07Panner.positionY.setValueAtTime(a07[1], now)
      this.a07Panner.positionZ.setValueAtTime(a07[2], now)
    }
  }

  public async loadManifest(manifest: AudioManifest): Promise<void> {
    this.manifest = manifest

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioCtx) {
      return
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx()
      this.masterGain = this.ctx.createGain()
      this.duckGain = this.ctx.createGain()
      this.duckGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
      this.applyMasterGain(true)
    }

    await Promise.all(
      manifest.assets.map(async asset => {
        try {
          const response = await fetch(audioUrl(asset.file))

          if (!response.ok) {
            return
          }

          const arrayBuffer = await response.arrayBuffer()

          if (!this.ctx || this.disposed) {
            return
          }

          const decoded = await this.ctx.decodeAudioData(arrayBuffer)

          this.buffers.set(asset.id, decoded)
        } catch {
          // Keep gameplay fully functional without audio decoding
        }
      })
    )
  }

  public async unlock(): Promise<void> {
    if (!this.ctx || this.disposed) {
      return
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        return
      }
    }

    this.startLoops()
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next }
    this.applyMasterGain(false)
  }

  public setDucked(ducked: boolean): void {
    this.ducked = ducked

    if (!this.ctx || !this.duckGain) {
      return
    }

    const now = this.ctx.currentTime
    const target = ducked ? 0.34 : 1

    this.duckGain.gain.cancelScheduledValues(now)
    this.duckGain.gain.setTargetAtTime(target, now, 0.14)
  }

  public setA07Active(active: boolean, immediate = false): void {
    this.a07Active = active

    if (!this.ctx || !this.a07Gain) {
      return
    }

    const asset = this.manifest?.assets.find(item => item.id === 'a07')
    const baseGain = asset?.gain ?? 0.45
    const target = active ? baseGain : 0
    const now = this.ctx.currentTime

    this.a07Gain.gain.cancelScheduledValues(now)

    if (immediate) {
      this.a07Gain.gain.setValueAtTime(target, now)
    } else {
      this.a07Gain.gain.setTargetAtTime(target, now, active ? 0.35 : 0.18)
    }
  }

  public updateListener(
    pos: Vec3Tuple,
    forward: Vec3Tuple,
    up: Vec3Tuple
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') {
      return
    }

    const listener = this.ctx.listener
    const now = this.ctx.currentTime

    if ('positionX' in listener) {
      listener.positionX.setValueAtTime(pos[0], now)
      listener.positionY.setValueAtTime(pos[1], now)
      listener.positionZ.setValueAtTime(pos[2], now)
      listener.forwardX.setValueAtTime(forward[0], now)
      listener.forwardY.setValueAtTime(forward[1], now)
      listener.forwardZ.setValueAtTime(forward[2], now)
      listener.upX.setValueAtTime(up[0], now)
      listener.upY.setValueAtTime(up[1], now)
      listener.upZ.setValueAtTime(up[2], now)
    }
  }

  public playOneShot(id: string, positional?: Vec3Tuple): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return
    }

    const buffer = this.buffers.get(id)

    if (!buffer) {
      return
    }

    const spec = this.manifest?.assets.find(item => item.id === id)
    const source = this.ctx.createBufferSource()
    const gainNode = this.ctx.createGain()

    source.buffer = buffer
    gainNode.gain.value = spec?.gain ?? 0.48
    source.connect(gainNode)

    if (positional) {
      const panner = this.ctx.createPanner()

      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1.4
      panner.maxDistance = 18
      panner.rolloffFactor = 1.15
      panner.positionX.value = positional[0]
      panner.positionY.value = positional[1]
      panner.positionZ.value = positional[2]
      gainNode.connect(panner)
      panner.connect(this.masterGain)
    } else {
      gainNode.connect(this.masterGain)
    }

    source.start()
  }

  public playTreeCue(): void {
    this.playOneShot('tree-cue', this.treePosition)
  }

  public playFootstep(): void {
    const ids = ['steps-01', 'steps-02', 'steps-03']
    const id = ids[this.stepIndex % ids.length] ?? 'steps-01'

    this.stepIndex += 1
    this.playOneShot(id)
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend()
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  public dispose(): void {
    this.disposed = true

    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }

    this.buffers.clear()
    this.masterGain = null
    this.duckGain = null
    this.a07Gain = null
    this.a07Panner = null
    this.loopsStarted = false
  }

  private applyMasterGain(immediate: boolean): void {
    if (!this.ctx || !this.masterGain) {
      return
    }

    const now = this.ctx.currentTime
    const target = this.settings.muted ? 0 : this.settings.volume

    this.masterGain.gain.cancelScheduledValues(now)

    if (immediate) {
      this.masterGain.gain.setValueAtTime(target, now)
    } else {
      this.masterGain.gain.setTargetAtTime(target, now, 0.08)
    }
  }

  private startLoops(): void {
    if (this.loopsStarted || !this.ctx || !this.duckGain) {
      return
    }

    const hvacBuffer = this.buffers.get('hvac')
    const a07Buffer = this.buffers.get('a07')

    if (!hvacBuffer && !a07Buffer) {
      return
    }

    this.loopsStarted = true

    if (hvacBuffer) {
      const hvacSpec = this.manifest?.assets.find(item => item.id === 'hvac')
      const source = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()

      source.buffer = hvacBuffer
      source.loop = true
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
      gain.gain.setTargetAtTime(
        hvacSpec?.gain ?? 0.32,
        this.ctx.currentTime,
        0.5
      )
      source.connect(gain)
      gain.connect(this.duckGain)
      source.start()
    }

    if (a07Buffer) {
      const a07Spec = this.manifest?.assets.find(item => item.id === 'a07')
      const source = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      const panner = this.ctx.createPanner()

      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1.15
      panner.maxDistance = 11
      panner.rolloffFactor = 1.45
      panner.positionX.value = this.a07Position[0]
      panner.positionY.value = this.a07Position[1]
      panner.positionZ.value = this.a07Position[2]

      source.buffer = a07Buffer
      source.loop = true
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
      gain.gain.setTargetAtTime(
        this.a07Active ? (a07Spec?.gain ?? 0.45) : 0,
        this.ctx.currentTime,
        0.45
      )
      source.connect(gain)
      gain.connect(panner)
      panner.connect(this.duckGain)
      source.start()
      this.a07Gain = gain
      this.a07Panner = panner
    }

    this.setDucked(this.ducked)
  }
}
