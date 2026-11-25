export type ClueId =
  | 'tag_07'
  | 'tag_19'
  | 'tag_26'
  | 'ledger_07'
  | 'ledger_19'
  | 'note_26'

export type PuzzleId = 'folio-07' | 'folio-19' | 'folio-26'

export type StageId =
  | 'opening'
  | 'folio-07'
  | 'folio-19'
  | 'folio-26'
  | 'confirmed'
  | 'ending'

export type Vec3Tuple = [number, number, number]

export type AabbXZ = [number, number, number, number]

export interface SceneZone {
  id: string
  minXZ: [number, number]
  maxXZ: [number, number]
}

export interface SceneInstanceSpec {
  id: string
  model: string
  position?: Vec3Tuple
  yaw?: number
  parent?: string
  anchor?: string
  stateKey?: 'stationA07' | 'stationB02' | 'traceA07'
  localCollidersXZ?: AabbXZ[]
}

export interface SceneManifest {
  version: number
  units: string
  axes: string
  spawn: {
    position: Vec3Tuple
    lookAt: Vec3Tuple
  }
  avatar: {
    radius: number
    eyeHeight: number
    walkMetersPerSecond: number
  }
  shell: string
  zones: SceneZone[]
  wallCollidersXZ: AabbXZ[]
  instances: SceneInstanceSpec[]
  lighting: {
    ambient: {
      sky: string
      ground: string
      intensity: number
    }
    cool: {
      color: string
      ceilingSources: Vec3Tuple[]
    }
    tree: {
      color: string
      position: Vec3Tuple
    }
    a07: {
      color: string
      position: Vec3Tuple
    }
  }
  interaction: {
    maxDistance: number
    panel: { instance: string; node: string }
    ledger: { instance: string; node: string }
    note: { instance: string; node: string }
    exit: { instance: string; node: string }
    ornamentNodes: string[]
    a07OutsideViewGate: {
      playerZMax: number
      requiresTagRead: boolean
    }
  }
  roomToneAudio: string
  a07Audio: string
}

export interface ClueSpec {
  title: string
  name?: string
  stamp?: string
  station?: string
  folio?: string
  text: string
  texture: string
  model?: string
}

export interface PuzzleOption {
  id: string
  label: string
}

export interface PuzzleSpec {
  id: PuzzleId
  folio: string
  requiredClues: ClueId[]
  prompt: string
  options: PuzzleOption[]
  answer: string
  hint: string
  success: string
}

export interface StoryManifest {
  version: number
  title: string
  lang: string
  tagline: string
  opening: {
    date: string
    time: string
    panelTitle: string
    line: string
    intro: string
    return: string
  }
  stages: Array<{
    id: StageId
    time: string
    requires: string[]
  }>
  clues: Record<ClueId, ClueSpec>
  puzzles: PuzzleSpec[]
  commit: {
    button: string
    success: string
    exitCue: string
  }
  ending: {
    primary: string
    secondary: string
  }
  subtitles: {
    hvac: string
    a07_stop: string
    tree_cue: string
    exit: string
  }
}

export interface AudioAssetSpec {
  id: string
  file: string
  source: string
  loop?: boolean
  gain: number
  role: string
}

export interface AudioManifest {
  version: number
  authoring: string
  assets: AudioAssetSpec[]
}

export interface GameProgress {
  panelRead: boolean
  clues: ClueId[]
  a07Disappeared: boolean
  a07AbsenceSeen: boolean
  restored: Record<PuzzleId, boolean>
  commitConfirmed: boolean
  exitUsed: boolean
}

export interface GameSettings {
  volume: number
  muted: boolean
  sensitivity: number
  subtitles: boolean
  reducedMotion: boolean
}

export interface SaveEnvelope {
  version: 1
  savedAt: string
  progress: GameProgress
}

export interface WorldFlags {
  stationA07Visible: boolean
  traceA07Visible: boolean
  stationB02Visible: boolean
  tag07Visible: boolean
  tag07Interactable: boolean
  tag19Visible: boolean
  tag26Visible: boolean
  exitOpen: boolean
  bulbs07Intensity: number
  bulbs19Intensity: number
  bulbs26Intensity: number
  treeLightIntensity: number
  a07LightIntensity: number
  a07AudioActive: boolean
}

export type InteractableKind =
  | 'panel'
  | 'ledger'
  | 'note'
  | 'tag_07'
  | 'tag_19'
  | 'tag_26'
  | 'exit'

export interface InteractableHover {
  kind: InteractableKind
  label: string
  action: string
  blockedReason?: string
  distance: number
}

export interface ProjectedMarker {
  kind: InteractableKind
  label: string
  x: number
  y: number
  inReach: boolean
  isActive: boolean
  blocked: boolean
}

export interface CctvFeed {
  id: 'cam-01' | 'cam-02' | 'cam-03'
  label: string
  location: string
  dataUrl: string
  status: string
}

export type ActiveOverlay =
  | { type: 'none' }
  | { type: 'panel' }
  | { type: 'ledger' }
  | { type: 'clue'; clueId: ClueId }
  | { type: 'pause' }
  | { type: 'settings'; returnTo: 'menu' | 'pause' }
  | { type: 'achievements' }
  | { type: 'credits' }

export type ScreenPhase =
  | 'menu'
  | 'loading'
  | 'playing'
  | 'ending'
  | 'webgl-error'

export interface DiagnosticSnapshot {
  webgl2: boolean
  renderer: string
  vendor: string
  drawCalls: number
  triangles: number
  loadedModels: number
  instanceCount: number
  audioReady: boolean
  audioDecodedCount: number
  playerPosition: Vec3Tuple
  stageId: StageId
  worldFlags: WorldFlags
  pointerLocked: boolean
}

export interface ManifestBundle {
  scene: SceneManifest
  story: StoryManifest
  audio: AudioManifest
}
