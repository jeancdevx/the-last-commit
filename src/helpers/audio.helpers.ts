import { audioUrl } from '@/helpers/assets.helpers'
import type { AudioManifest, GameSettings, Vec3Tuple } from '@/types'

const EXTRA_AUDIO_CLIPS = [
  'voicemail-salas.mp3',
  'voicemail-rojas.mp3',
  'whisper-a07.mp3',
  'power-dip.mp3'
] as const

function createOfficeImpulseResponse(
  ctx: AudioContext,
  durationSeconds = 1.35
): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * durationSeconds)
  const impulse = ctx.createBuffer(2, length, rate)

  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch)

    for (let i = 0; i < length; i += 1) {
      const t = i / length
      const decay = Math.pow(1 - t, 3.1)
      const noise = (Math.random() * 2 - 1) * decay

      data[i] = noise * 0.42
    }

    const taps = [0.011, 0.023, 0.039, 0.061, 0.088]

    for (let k = 0; k < taps.length; k += 1) {
      const idx = Math.floor((taps[k] ?? 0.02) * rate)

      if (idx > 0 && idx < length) {
        const sign = k % 2 === ch ? 1 : -0.82

        data[idx] = (data[idx] ?? 0) + (0.48 - k * 0.06) * sign
      }
    }
  }

  return impulse
}

function createPinkRainBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let ch = 0; ch < 2; ch += 1) {
    const out = buffer.getChannelData(ch)
    let b0 = 0
    let b1 = 0
    let b2 = 0

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1

      b0 = 0.997 * b0 + white * 0.029
      b1 = 0.985 * b1 + white * 0.032
      b2 = 0.95 * b2 + white * 0.048

      const droplet = Math.random() > 0.9988 ? (Math.random() - 0.5) * 0.45 : 0

      out[i] = (b0 + b1 + b2 + white * 0.015) * 0.35 + droplet
    }
  }

  return buffer
}

export class GameAudioEngine {
  private ctx: AudioContext | null = null

  private compressor: DynamicsCompressorNode | null = null

  private masterGain: GainNode | null = null

  private duckGain: GainNode | null = null

  private reverbSend: GainNode | null = null

  private a07Gain: GainNode | null = null

  private a07Panner: PannerNode | null = null

  private droneGain: GainNode | null = null

  private titlePadGain: GainNode | null = null

  private activeVoiceSource: AudioBufferSourceNode | null = null

  private buffers = new Map<string, AudioBuffer>()

  private manifest: AudioManifest | null = null

  private loopsStarted = false

  private stepIndex = 0

  private settings: GameSettings

  private a07Active = true

  private tensionLevel = 0

  private titleAmbientActive = true

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
      this.compressor = this.ctx.createDynamicsCompressor()
      this.compressor.threshold.value = -16
      this.compressor.knee.value = 10
      this.compressor.ratio.value = 3.5
      this.compressor.attack.value = 0.004
      this.compressor.release.value = 0.3

      this.masterGain = this.ctx.createGain()
      this.duckGain = this.ctx.createGain()

      const convolver = this.ctx.createConvolver()

      convolver.buffer = createOfficeImpulseResponse(this.ctx)
      this.reverbSend = this.ctx.createGain()
      this.reverbSend.gain.value = 0.28

      const reverbReturn = this.ctx.createGain()

      reverbReturn.gain.value = 0.72
      this.reverbSend.connect(convolver)
      convolver.connect(reverbReturn)
      reverbReturn.connect(this.compressor)

      this.duckGain.connect(this.compressor)
      this.compressor.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
      this.applyMasterGain(true)
    }

    const decodeClip = async (id: string, file: string) => {
      try {
        const response = await fetch(audioUrl(file))

        if (!response.ok) return

        const arrayBuffer = await response.arrayBuffer()

        if (!this.ctx || this.disposed) return

        const decoded = await this.ctx.decodeAudioData(arrayBuffer)

        this.buffers.set(id, decoded)
      } catch {
        // Keep game playable without audio decoding
      }
    }

    await Promise.all([
      ...manifest.assets.map(asset => decodeClip(asset.id, asset.file)),
      ...EXTRA_AUDIO_CLIPS.map(file => decodeClip(file, file))
    ])
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

  public setTitleAmbient(active: boolean): void {
    this.titleAmbientActive = active

    if (!this.ctx || !this.titlePadGain) return

    const now = this.ctx.currentTime

    this.titlePadGain.gain.cancelScheduledValues(now)
    this.titlePadGain.gain.setTargetAtTime(active ? 0.055 : 0, now, 0.9)
  }

  public setDucked(ducked: boolean): void {
    this.ducked = ducked

    if (!this.ctx || !this.duckGain) {
      return
    }

    const now = this.ctx.currentTime
    const target = ducked ? 0.36 : 1

    this.duckGain.gain.cancelScheduledValues(now)
    this.duckGain.gain.setTargetAtTime(target, now, 0.16)
  }

  public setTension(level: number): void {
    this.tensionLevel = Math.min(1, Math.max(0, level))

    if (!this.ctx || !this.droneGain) {
      return
    }

    const now = this.ctx.currentTime
    const target = this.tensionLevel * 0.052

    this.droneGain.gain.cancelScheduledValues(now)
    this.droneGain.gain.setTargetAtTime(target, now, 0.85)
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
      this.a07Gain.gain.setTargetAtTime(target, now, active ? 0.38 : 0.16)
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

  public playOneShot(
    id: string,
    positional?: Vec3Tuple,
    sendToReverb = true,
    gainOverride?: number
  ): void {
    if (!this.ctx || !this.compressor || this.ctx.state !== 'running') {
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

    if (id.startsWith('steps-')) {
      source.playbackRate.value = 0.94 + Math.random() * 0.12
    }

    gainNode.gain.value = gainOverride ?? spec?.gain ?? 0.52
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
      panner.connect(this.compressor)

      if (sendToReverb && this.reverbSend) {
        panner.connect(this.reverbSend)
      }
    } else {
      gainNode.connect(this.compressor)

      if (sendToReverb && this.reverbSend) {
        gainNode.connect(this.reverbSend)
      }
    }

    source.start()
  }

  public playVoicemail(file: string, onEnded?: () => void): boolean {
    if (!this.ctx || !this.compressor) {
      return false
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }

    this.stopVoicemail()

    const buffer = this.buffers.get(file)

    if (!buffer) {
      return false
    }

    const source = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    // Subtle telephone/voicemail bandpass filter for authentic diegetic feel
    filter.type = 'bandpass'
    filter.frequency.value = 1450
    filter.Q.value = 0.72
    gain.gain.value = 0.9

    source.buffer = buffer
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.compressor)

    if (this.reverbSend) {
      gain.connect(this.reverbSend)
    }

    source.onended = () => {
      if (this.activeVoiceSource === source) {
        this.activeVoiceSource = null
      }

      onEnded?.()
    }

    this.activeVoiceSource = source
    source.start()

    return true
  }

  public stopVoicemail(): void {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop()
      } catch {
        // Already stopped
      }

      this.activeVoiceSource = null
    }
  }

  public playPowerDip(): void {
    this.playOneShot('power-dip.mp3', this.a07Position, true, 0.72)
    window.setTimeout(() => {
      if (!this.disposed) {
        this.playOneShot('whisper-a07.mp3', this.a07Position, true, 0.42)
      }
    }, 850)
  }

  public playNotificationPing(): void {
    if (!this.ctx || !this.compressor || this.ctx.state !== 'running') {
      return
    }

    const now = this.ctx.currentTime
    const freqs = [587.33, 880]

    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.compressor) return

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, now + idx * 0.09)
      gain.gain.setValueAtTime(0.055, now + idx * 0.09)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.24)
      osc.connect(gain)
      gain.connect(this.compressor)
      osc.start(now + idx * 0.09)
      osc.stop(now + idx * 0.09 + 0.26)
    })
  }

  public playAchievementChime(): void {
    if (!this.ctx || !this.compressor || this.ctx.state !== 'running') {
      return
    }

    const now = this.ctx.currentTime
    const notes = [440, 554.37, 659.25]

    notes.forEach((f, idx) => {
      if (!this.ctx || !this.compressor) return

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, now + idx * 0.08)
      gain.gain.setValueAtTime(0.06, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.42)
      osc.connect(gain)
      gain.connect(this.compressor)

      if (this.reverbSend) {
        gain.connect(this.reverbSend)
      }

      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.45)
    })
  }

  public playHoverTick(): void {
    if (!this.ctx || !this.compressor || this.ctx.state !== 'running') {
      return
    }

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(640, now)
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.032)
    gain.gain.setValueAtTime(0.035, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.036)
    osc.connect(gain)
    gain.connect(this.compressor)
    osc.start(now)
    osc.stop(now + 0.04)
  }

  public playTreeCue(): void {
    this.playOneShot('tree-cue', this.treePosition, true)
  }

  public playFootstep(): void {
    const ids = ['steps-01', 'steps-02', 'steps-03']
    const id = ids[this.stepIndex % ids.length] ?? 'steps-01'

    this.stepIndex += 1
    this.playOneShot(id, undefined, true)
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
    this.stopVoicemail()

    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }

    this.buffers.clear()
    this.compressor = null
    this.masterGain = null
    this.duckGain = null
    this.reverbSend = null
    this.a07Gain = null
    this.a07Panner = null
    this.droneGain = null
    this.titlePadGain = null
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

    this.loopsStarted = true

    if (hvacBuffer) {
      const hvacSpec = this.manifest?.assets.find(item => item.id === 'hvac')
      const source = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()

      source.buffer = hvacBuffer
      source.loop = true
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
      gain.gain.setTargetAtTime(
        hvacSpec?.gain ?? 0.3,
        this.ctx.currentTime,
        0.55
      )
      source.connect(gain)
      gain.connect(this.duckGain)
      source.start()
    }

    // Gentle procedural Christmas Eve rain against the panoramic office windows
    const rainSource = this.ctx.createBufferSource()
    const rainFilter = this.ctx.createBiquadFilter()
    const rainGain = this.ctx.createGain()

    rainSource.buffer = createPinkRainBuffer(this.ctx, 5)
    rainSource.loop = true
    rainFilter.type = 'bandpass'
    rainFilter.frequency.value = 1150
    rainFilter.Q.value = 0.55
    rainGain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    rainGain.gain.setTargetAtTime(0.085, this.ctx.currentTime, 0.9)
    rainSource.connect(rainFilter)
    rainFilter.connect(rainGain)
    rainGain.connect(this.duckGain)
    rainSource.start()

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

    // Subtle procedural sub-bass tension drone (swells when A-07 vanishes)
    const droneFilter = this.ctx.createBiquadFilter()

    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 115

    const droneGain = this.ctx.createGain()

    droneGain.gain.value = this.tensionLevel * 0.052

    const oscA = this.ctx.createOscillator()
    const oscB = this.ctx.createOscillator()

    oscA.type = 'sine'
    oscB.type = 'triangle'
    oscA.frequency.value = 49
    oscB.frequency.value = 73.4

    oscA.connect(droneFilter)
    oscB.connect(droneFilter)
    droneFilter.connect(droneGain)
    droneGain.connect(this.duckGain)
    oscA.start()
    oscB.start()
    this.droneGain = droneGain

    // Moody dark ambient synth pad for Title Screen & Film Credits
    const padFilter = this.ctx.createBiquadFilter()

    padFilter.type = 'lowpass'
    padFilter.frequency.value = 340

    const padGain = this.ctx.createGain()

    padGain.gain.value = this.titleAmbientActive ? 0.055 : 0

    for (const freq of [110, 130.81, 164.81, 246.94]) {
      const osc = this.ctx.createOscillator()

      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(padFilter)
      osc.start()
    }

    padFilter.connect(padGain)
    padGain.connect(this.duckGain)
    this.titlePadGain = padGain

    this.setDucked(this.ducked)
  }
}
