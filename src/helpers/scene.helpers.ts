import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

import { assetUrl } from '@/helpers/assets.helpers'
import type { GameAudioEngine } from '@/helpers/audio.helpers'
import {
  buildActiveColliders,
  resolveMovementXZ
} from '@/helpers/collision.helpers'
import type {
  AabbXZ,
  DiagnosticSnapshot,
  GameSettings,
  InteractableHover,
  InteractableKind,
  SceneManifest,
  StageId,
  Vec3Tuple,
  WorldFlags
} from '@/types'

interface InteractableEntry {
  kind: InteractableKind
  object: THREE.Object3D
  label: string
  action: string
  isVisible: () => boolean
  getBlockedReason: () => string | undefined
}

export interface SceneEngineCallbacks {
  onLoadProgress: (percent: number, detail: string) => void
  onHoverChange: (hover: InteractableHover | null) => void
  onPointerLockChange: (locked: boolean) => void
  onInteract: (kind: InteractableKind) => void
  onAbsenceSeen: () => void
  onContextLost: () => void
  onContextRestored: () => void
}

function cloneMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    if (node instanceof THREE.Mesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map(mat => mat.clone())
      } else if (node.material) {
        node.material = node.material.clone()
      }
    }
  })
}

function setEmissiveIntensity(
  node: THREE.Object3D | null | undefined,
  intensity: number
): void {
  if (!node) {
    return
  }

  node.traverse(child => {
    if (child instanceof THREE.Mesh) {
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material]

      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissiveIntensity = intensity
        }
      }
    }
  })
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse(node => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose()

      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material]

      for (const mat of mats) {
        if (!mat) continue

        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) {
            value.dispose()
          }
        }

        mat.dispose()
      }
    }
  })
}

export function checkWebGL2Support(): {
  supported: boolean
  renderer: string
  vendor: string
} {
  if (typeof document === 'undefined') {
    return { supported: false, renderer: 'unavailable', vendor: 'unavailable' }
  }

  try {
    const testCanvas = document.createElement('canvas')
    const gl = testCanvas.getContext('webgl2')

    if (!gl) {
      return { supported: false, renderer: 'none', vendor: 'none' }
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER))
    const vendor = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR))

    const lose = gl.getExtension('WEBGL_lose_context')

    lose?.loseContext()

    return { supported: true, renderer, vendor }
  } catch {
    return { supported: false, renderer: 'error', vendor: 'error' }
  }
}

export class SceneEngine {
  private container: HTMLElement

  private manifest: SceneManifest

  private audio: GameAudioEngine

  private callbacks: SceneEngineCallbacks

  private renderer: THREE.WebGLRenderer

  private scene: THREE.Scene

  private camera: THREE.PerspectiveCamera

  private controls: PointerLockControls

  private raycaster = new THREE.Raycaster()

  private centerNdc = new THREE.Vector2(0, 0)

  private clock = new THREE.Timer()

  private instances = new Map<string, THREE.Object3D>()

  private wallOccluders: THREE.Object3D[] = []

  private interactables: InteractableEntry[] = []

  private activeColliders: AabbXZ[] = []

  private bulbs07: THREE.Object3D | null = null

  private bulbs19: THREE.Object3D | null = null

  private bulbs26: THREE.Object3D | null = null

  private doorPivot: THREE.Object3D | null = null

  private treeLight: THREE.PointLight | null = null

  private a07Light: THREE.PointLight | null = null

  private keysPressed = new Set<string>()

  private settings: GameSettings

  private worldFlags: WorldFlags

  private stageId: StageId = 'opening'

  private movementEnabled = false

  private endingMode = false

  private checkAbsenceSight = false

  private loadedModelCount = 0

  private gpuRenderer = 'WebGL 2'

  private gpuVendor = 'unknown'

  private currentHoverKey = ''

  private currentHover: InteractableHover | null = null

  private lastRaycastAt = 0

  private walkDistanceAccum = 0

  private bobPhase = 0

  private currentBulbs07 = 0.25

  private currentBulbs19 = 0.1

  private currentBulbs26 = 0.1

  private currentTreeLight = 0.7

  private currentA07Light = 1.55

  private currentDoorAngle = 0

  private disposed = false

  private rafActive = false

  private forwardVec = new THREE.Vector3()

  private rightVec = new THREE.Vector3()

  private upVec = new THREE.Vector3(0, 1, 0)

  private moveVec = new THREE.Vector3()

  private lookTargetVec = new THREE.Vector3()

  private a07WorldPos = new THREE.Vector3(1.55, 0.95, 2.0)

  constructor(
    container: HTMLElement,
    manifest: SceneManifest,
    audio: GameAudioEngine,
    settings: GameSettings,
    initialFlags: WorldFlags,
    callbacks: SceneEngineCallbacks
  ) {
    this.container = container
    this.manifest = manifest
    this.audio = audio
    this.settings = { ...settings }
    this.worldFlags = { ...initialFlags }
    this.callbacks = callbacks

    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      powerPreference: 'high-performance'
    })

    if (!gl) {
      throw new Error('WEBGL2_UNAVAILABLE')
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')

    this.gpuRenderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER))
    this.gpuVendor = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR))

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    )
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.domElement.className = 'block h-full w-full outline-none'
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Escena 3D de la oficina en The Last Commit'
    )
    container.replaceChildren(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0f1514')
    this.scene.fog = new THREE.FogExp2('#0f1514', 0.022)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.06, 42)
    this.controls = new PointerLockControls(
      this.camera,
      this.renderer.domElement
    )
    this.controls.pointerSpeed = this.settings.sensitivity
    this.scene.add(this.controls.object)

    this.resetCameraToSpawn()
    this.setupLighting()
    this.bindEvents()
  }

  public get playerPosition(): Vec3Tuple {
    const pos = this.controls.object.position

    return [pos.x, pos.y, pos.z]
  }

  public get isPointerLocked(): boolean {
    return this.controls.isLocked
  }

  public async loadAssets(): Promise<void> {
    const loader = new GLTFLoader()
    const uniquePaths = Array.from(
      new Set([
        this.manifest.shell,
        ...this.manifest.instances.map(item => item.model)
      ])
    )
    const cache = new Map<string, GLTF>()

    this.callbacks.onLoadProgress(5, 'Cargando geometría de la planta...')

    let completed = 0

    await Promise.all(
      uniquePaths.map(async relativePath => {
        const gltf = await loader.loadAsync(assetUrl(relativePath))

        cache.set(relativePath, gltf)
        completed += 1

        const pct = Math.round(10 + (completed / uniquePaths.length) * 80)

        this.callbacks.onLoadProgress(pct, `Modelo listo: ${relativePath}`)
      })
    )

    if (this.disposed) {
      return
    }

    this.loadedModelCount = cache.size

    const shellGltf = cache.get(this.manifest.shell)

    if (!shellGltf) {
      throw new Error('No se cargó floor-shell.glb')
    }

    const shellRoot = shellGltf.scene.clone(true)

    shellRoot.name = 'SCENE_shell'
    this.scene.add(shellRoot)
    this.wallOccluders.push(shellRoot)

    for (const spec of this.manifest.instances) {
      if (spec.parent) {
        continue
      }

      const gltf = cache.get(spec.model)

      if (!gltf) continue

      const root = gltf.scene.clone(true)

      cloneMaterials(root)
      root.name = `SCENE_${spec.id}`

      if (spec.position) {
        root.position.set(spec.position[0], spec.position[1], spec.position[2])
      }

      if (typeof spec.yaw === 'number') {
        root.rotation.y = spec.yaw
      }

      this.configureInstance(spec.id, root)
      this.scene.add(root)
      this.instances.set(spec.id, root)
    }

    for (const spec of this.manifest.instances) {
      if (!spec.parent || !spec.anchor) {
        continue
      }

      const parentRoot = this.instances.get(spec.parent)
      const gltf = cache.get(spec.model)

      if (!parentRoot || !gltf) continue

      const anchor = parentRoot.getObjectByName(spec.anchor)

      if (!anchor) continue

      const root = gltf.scene.clone(true)

      cloneMaterials(root)
      root.name = `SCENE_${spec.id}`
      root.position.set(0, 0, 0)

      if (typeof spec.yaw === 'number') {
        root.rotation.y = spec.yaw
      }

      anchor.add(root)
      this.instances.set(spec.id, root)
    }

    this.registerInteractables()
    this.applyWorldFlags(this.worldFlags, this.stageId, true, false)

    this.callbacks.onLoadProgress(100, 'Planta 04 lista.')
    this.startLoop()
  }

  public applyWorldFlags(
    flags: WorldFlags,
    stageId: StageId,
    immediate = false,
    checkAbsenceSight = false
  ): void {
    this.worldFlags = { ...flags }
    this.stageId = stageId
    this.checkAbsenceSight = checkAbsenceSight
    this.activeColliders = buildActiveColliders(this.manifest, flags)

    const a07 = this.instances.get('office-a07')
    const b02 = this.instances.get('office-b02')
    const trace = this.instances.get('absence-a07')
    const tag07 = this.instances.get('tag-07')
    const tag19 = this.instances.get('tag-19')
    const tag26 = this.instances.get('tag-26')

    if (a07) a07.visible = flags.stationA07Visible

    if (b02) b02.visible = flags.stationB02Visible

    if (trace) trace.visible = flags.traceA07Visible

    if (tag07) tag07.visible = flags.tag07Visible

    if (tag19) tag19.visible = flags.tag19Visible

    if (tag26) tag26.visible = flags.tag26Visible

    this.audio.setA07Active(flags.a07AudioActive, immediate)

    if (immediate || this.settings.reducedMotion) {
      this.currentBulbs07 = flags.bulbs07Intensity
      this.currentBulbs19 = flags.bulbs19Intensity
      this.currentBulbs26 = flags.bulbs26Intensity
      this.currentTreeLight = flags.treeLightIntensity
      this.currentA07Light = flags.a07LightIntensity
      this.currentDoorAngle = flags.exitOpen ? 1.32 : 0

      setEmissiveIntensity(this.bulbs07, this.currentBulbs07)
      setEmissiveIntensity(this.bulbs19, this.currentBulbs19)
      setEmissiveIntensity(this.bulbs26, this.currentBulbs26)

      if (this.treeLight) this.treeLight.intensity = this.currentTreeLight

      if (this.a07Light) this.a07Light.intensity = this.currentA07Light

      if (this.doorPivot) this.doorPivot.rotation.y = this.currentDoorAngle
    }

    this.updateRaycast(true)
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next }
    this.controls.pointerSpeed = next.sensitivity

    if (next.reducedMotion) {
      this.controls.object.position.y = this.manifest.avatar.eyeHeight
    }
  }

  public setMovementEnabled(enabled: boolean): void {
    this.movementEnabled = enabled

    if (!enabled) {
      this.keysPressed.clear()

      if (this.controls.isLocked) {
        this.controls.unlock()
      }

      this.setHover(null)
    } else {
      this.updateRaycast(true)
    }
  }

  public setEndingCamera(active: boolean): void {
    this.endingMode = active

    if (active) {
      this.setMovementEnabled(false)
      this.controls.object.position.set(-0.73, 1.62, -3.49)
      this.camera.lookAt(0.45, 1.34, -10.4)
    } else {
      this.resetCameraToSpawn()
    }
  }

  public requestPointerLock(): void {
    if (!this.movementEnabled || this.disposed) {
      return
    }

    try {
      this.controls.lock()
    } catch {
      // Browsers may reject pointer lock outside a direct gesture
    }
  }

  public unlockPointer(): void {
    if (this.controls.isLocked) {
      this.controls.unlock()
    }
  }

  public resetCameraToSpawn(): void {
    const [sx, sy, sz] = this.manifest.spawn.position
    const [lx, ly, lz] = this.manifest.spawn.lookAt

    this.controls.object.position.set(sx, sy, sz)
    this.camera.lookAt(lx, ly, lz)
    this.keysPressed.clear()
    this.bobPhase = 0
    this.walkDistanceAccum = 0
  }

  public teleportAndLook(position: Vec3Tuple, lookAt: Vec3Tuple): void {
    this.controls.object.position.set(position[0], position[1], position[2])
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
    this.updateRaycast(true)
    this.checkAbsenceVisibility()
    this.renderer.render(this.scene, this.camera)
  }

  public triggerInteract(): boolean {
    this.updateRaycast(true)

    if (!this.currentHover) {
      return false
    }

    this.callbacks.onInteract(this.currentHover.kind)

    return true
  }

  public renderSingleFrame(): void {
    if (!this.disposed) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  public getDiagnostics(): DiagnosticSnapshot {
    const pos = this.controls.object.position

    return {
      webgl2: true,
      renderer: this.gpuRenderer,
      vendor: this.gpuVendor,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      loadedModels: this.loadedModelCount,
      instanceCount: this.instances.size,
      audioReady: this.audio.isReady,
      audioDecodedCount: this.audio.decodedCount,
      playerPosition: [
        Number(pos.x.toFixed(2)),
        Number(pos.y.toFixed(2)),
        Number(pos.z.toFixed(2))
      ],
      stageId: this.stageId,
      worldFlags: { ...this.worldFlags },
      pointerLocked: this.controls.isLocked
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.rafActive = false
    this.renderer.setAnimationLoop(null)
    this.unbindEvents()
    this.controls.dispose()
    disposeObject3D(this.scene)
    this.renderer.dispose()
    this.instances.clear()
    this.wallOccluders = []
    this.interactables = []
  }

  private configureInstance(id: string, root: THREE.Object3D): void {
    if (id === 'office-a06' || id === 'office-a07' || id === 'office-b02') {
      const note = root.getObjectByName('NOTE_CURRENT')
      const screen = root.getObjectByName('SCREEN_SURFACE')
      const lamp = root.getObjectByName('LAMP_EMITTER')
      const mugParts = ['MUG', 'Mug_base', 'Mug_handle']

      if (note) {
        note.visible = id === 'office-a06'
      }

      for (const name of mugParts) {
        const part = root.getObjectByName(name)

        if (part) {
          part.visible = id === 'office-a07'
        }
      }

      if (id === 'office-a06') {
        setEmissiveIntensity(screen, 0.95)
        setEmissiveIntensity(lamp, 0.45)
      } else if (id === 'office-a07') {
        setEmissiveIntensity(screen, 0.12)
        setEmissiveIntensity(lamp, 1.75)
      } else {
        setEmissiveIntensity(screen, 0.18)
        setEmissiveIntensity(lamp, 0.7)
      }
    }

    if (id === 'tree') {
      this.bulbs07 = root.getObjectByName('BULBS_07') ?? null
      this.bulbs19 = root.getObjectByName('BULBS_19') ?? null
      this.bulbs26 = root.getObjectByName('BULBS_26') ?? null
    }

    if (id === 'exit') {
      this.doorPivot = root.getObjectByName('DOOR_PIVOT') ?? null
    }
  }

  private registerInteractables(): void {
    this.interactables = []

    const a06 = this.instances.get('office-a06')

    if (a06) {
      const screen = a06.getObjectByName(this.manifest.interaction.panel.node)

      if (screen) {
        this.interactables.push({
          kind: 'panel',
          object: screen,
          label: 'Consola de cierre · A-06',
          action: 'E · Abrir consola',
          isVisible: () => a06.visible,
          getBlockedReason: () => undefined
        })
      }

      const note = a06.getObjectByName(this.manifest.interaction.note.node)

      if (note) {
        this.interactables.push({
          kind: 'note',
          object: note,
          label: 'Nota del turno actual · A-06',
          action: 'E · Leer nota',
          isVisible: () => a06.visible && note.visible,
          getBlockedReason: () => undefined
        })
      }
    }

    const ledgerRoot = this.instances.get(
      this.manifest.interaction.ledger.instance
    )

    if (ledgerRoot) {
      const ledgerNode = ledgerRoot.getObjectByName(
        this.manifest.interaction.ledger.node
      )

      if (ledgerNode) {
        this.interactables.push({
          kind: 'ledger',
          object: ledgerNode,
          label: 'Bitácora de guardias',
          action: 'E · Consultar bitácora',
          isVisible: () => ledgerRoot.visible,
          getBlockedReason: () => undefined
        })
      }
    }

    const tagSpecs: Array<{
      id: string
      kind: 'tag_07' | 'tag_19' | 'tag_26'
      node: string
      label: string
      isVisible: () => boolean
      getBlockedReason: () => string | undefined
    }> = [
      {
        id: 'tag-07',
        kind: 'tag_07',
        node: 'TAG_FACE_07',
        label: 'Adorno · Folio 07',
        isVisible: () => this.worldFlags.tag07Visible,
        getBlockedReason: () =>
          this.worldFlags.tag07Interactable
            ? undefined
            : 'Revisa primero la consola en A-06.'
      },
      {
        id: 'tag-19',
        kind: 'tag_19',
        node: 'TAG_FACE_19',
        label: 'Adorno · Folio 19',
        isVisible: () => this.worldFlags.tag19Visible,
        getBlockedReason: () => undefined
      },
      {
        id: 'tag-26',
        kind: 'tag_26',
        node: 'TAG_FACE_26',
        label: 'Adorno · Folio 26',
        isVisible: () => this.worldFlags.tag26Visible,
        getBlockedReason: () => undefined
      }
    ]

    for (const tag of tagSpecs) {
      const root = this.instances.get(tag.id)

      if (!root) continue

      const target = root.getObjectByName(tag.node) ?? root

      this.interactables.push({
        kind: tag.kind,
        object: target,
        label: tag.label,
        action: 'E · Inspeccionar',
        isVisible: tag.isVisible,
        getBlockedReason: tag.getBlockedReason
      })
    }

    const exitRoot = this.instances.get(this.manifest.interaction.exit.instance)

    if (exitRoot) {
      const leaf = exitRoot.getObjectByName('DOOR_LEAF')
      const pushBar = exitRoot.getObjectByName('PUSH_BAR')

      for (const part of [leaf, pushBar]) {
        if (!part) continue

        this.interactables.push({
          kind: 'exit',
          object: part,
          label: this.worldFlags.exitOpen
            ? 'Salida de la planta (Abierta)'
            : 'Puerta de salida',
          action: 'E · Salir del edificio',
          isVisible: () => exitRoot.visible,
          getBlockedReason: () =>
            this.worldFlags.exitOpen
              ? undefined
              : 'Cerrada por el proceso anual. Restaura y confirma los tres folios.'
        })
      }
    }
  }

  private setupLighting(): void {
    const { ambient, cool, tree, a07 } = this.manifest.lighting

    const hemi = new THREE.HemisphereLight(
      ambient.sky,
      ambient.ground,
      ambient.intensity * 1.35
    )

    this.scene.add(hemi)

    const coolColor = new THREE.Color(cool.color)

    for (const [x, y, z] of cool.ceilingSources) {
      const light = new THREE.PointLight(coolColor, 7.6, 15, 1.45)

      light.position.set(x, y, z)
      this.scene.add(light)
    }

    this.treeLight = new THREE.PointLight(
      new THREE.Color(tree.color),
      this.currentTreeLight,
      11,
      1.5
    )
    this.treeLight.position.set(
      tree.position[0],
      tree.position[1],
      tree.position[2]
    )
    this.scene.add(this.treeLight)

    this.a07Light = new THREE.PointLight(
      new THREE.Color(a07.color),
      this.currentA07Light,
      5.5,
      1.65
    )
    this.a07Light.position.set(
      a07.position[0],
      a07.position[1],
      a07.position[2]
    )
    this.scene.add(this.a07Light)
  }

  private startLoop(): void {
    if (this.rafActive || this.disposed) {
      return
    }

    this.rafActive = true
    this.clock.reset()
    this.renderer.setAnimationLoop(() => {
      if (this.disposed) {
        return
      }

      this.clock.update()

      const dt = Math.min(this.clock.getDelta(), 0.08)

      this.stepSimulation(dt)
      this.renderer.render(this.scene, this.camera)
    })
  }

  private stepSimulation(dt: number): void {
    const smoothRate = this.settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.8)
    const doorRate = this.settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6)

    this.currentBulbs07 +=
      (this.worldFlags.bulbs07Intensity - this.currentBulbs07) * smoothRate
    this.currentBulbs19 +=
      (this.worldFlags.bulbs19Intensity - this.currentBulbs19) * smoothRate
    this.currentBulbs26 +=
      (this.worldFlags.bulbs26Intensity - this.currentBulbs26) * smoothRate
    this.currentTreeLight +=
      (this.worldFlags.treeLightIntensity - this.currentTreeLight) * smoothRate
    this.currentA07Light +=
      (this.worldFlags.a07LightIntensity - this.currentA07Light) * smoothRate

    setEmissiveIntensity(this.bulbs07, this.currentBulbs07)
    setEmissiveIntensity(this.bulbs19, this.currentBulbs19)
    setEmissiveIntensity(this.bulbs26, this.currentBulbs26)

    if (this.treeLight) {
      this.treeLight.intensity = this.currentTreeLight
    }

    if (this.a07Light) {
      this.a07Light.intensity = this.currentA07Light
    }

    const targetDoorAngle = this.worldFlags.exitOpen ? 1.32 : 0

    this.currentDoorAngle +=
      (targetDoorAngle - this.currentDoorAngle) * doorRate

    if (this.doorPivot) {
      this.doorPivot.rotation.y = this.currentDoorAngle
    }

    if (this.movementEnabled && !this.endingMode) {
      this.stepMovement(dt)
      this.checkAbsenceVisibility()

      const now = performance.now()

      if (now - this.lastRaycastAt >= 65) {
        this.lastRaycastAt = now
        this.updateRaycast(false)
      }
    }

    this.camera.getWorldDirection(this.forwardVec)
    const camPos = this.controls.object.position

    this.audio.updateListener(
      [camPos.x, camPos.y, camPos.z],
      [this.forwardVec.x, this.forwardVec.y, this.forwardVec.z],
      [0, 1, 0]
    )
  }

  private stepMovement(dt: number): void {
    const turnSpeed = 1.65 * this.settings.sensitivity

    if (this.keysPressed.has('ArrowLeft')) {
      this.controls.object.rotation.y += turnSpeed * dt
    }

    if (this.keysPressed.has('ArrowRight')) {
      this.controls.object.rotation.y -= turnSpeed * dt
    }

    let forwardInput = 0
    let strafeInput = 0

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) {
      forwardInput += 1
    }

    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) {
      forwardInput -= 1
    }

    if (this.keysPressed.has('KeyD')) {
      strafeInput += 1
    }

    if (this.keysPressed.has('KeyA')) {
      strafeInput -= 1
    }

    const baseEyeY = this.manifest.avatar.eyeHeight

    if (forwardInput === 0 && strafeInput === 0) {
      if (!this.settings.reducedMotion) {
        this.controls.object.position.y +=
          (baseEyeY - this.controls.object.position.y) * Math.min(1, dt * 8)
      }

      return
    }

    this.camera.getWorldDirection(this.forwardVec)
    this.forwardVec.y = 0

    if (this.forwardVec.lengthSq() < 1e-6) {
      this.forwardVec.set(0, 0, -1)
    } else {
      this.forwardVec.normalize()
    }

    this.rightVec.crossVectors(this.forwardVec, this.upVec).normalize()

    this.moveVec
      .set(0, 0, 0)
      .addScaledVector(this.forwardVec, forwardInput)
      .addScaledVector(this.rightVec, strafeInput)

    if (this.moveVec.lengthSq() > 1) {
      this.moveVec.normalize()
    }

    const speed = this.manifest.avatar.walkMetersPerSecond
    const dx = this.moveVec.x * speed * dt
    const dz = this.moveVec.z * speed * dt
    const currentPos = this.controls.object.position

    const result = resolveMovementXZ(
      currentPos.x,
      currentPos.z,
      dx,
      dz,
      this.manifest,
      this.activeColliders,
      this.worldFlags.exitOpen
    )

    if (result.moved) {
      const stepDist = Math.hypot(
        result.x - currentPos.x,
        result.z - currentPos.z
      )

      currentPos.x = result.x
      currentPos.z = result.z
      this.walkDistanceAccum += stepDist

      if (this.walkDistanceAccum >= 0.62) {
        this.walkDistanceAccum = 0
        this.audio.playFootstep()
      }

      if (!this.settings.reducedMotion) {
        this.bobPhase += stepDist * 4.4
        currentPos.y = baseEyeY + Math.sin(this.bobPhase) * 0.022
      } else {
        currentPos.y = baseEyeY
      }
    }
  }

  private checkAbsenceVisibility(): void {
    if (!this.checkAbsenceSight) {
      return
    }

    const pos = this.controls.object.position

    if (pos.z > 1.25) {
      this.checkAbsenceSight = false
      this.callbacks.onAbsenceSeen()

      return
    }

    if (pos.z > -1.8) {
      this.camera.getWorldDirection(this.forwardVec)
      this.lookTargetVec.copy(this.a07WorldPos).sub(pos).normalize()

      if (this.forwardVec.dot(this.lookTargetVec) > 0.52) {
        this.checkAbsenceSight = false
        this.callbacks.onAbsenceSeen()
      }
    }
  }

  private updateRaycast(force: boolean): void {
    if (!this.movementEnabled && !force) {
      this.setHover(null)

      return
    }

    const maxDistance = this.manifest.interaction.maxDistance

    this.raycaster.far = maxDistance + 0.5
    this.raycaster.setFromCamera(this.centerNdc, this.camera)

    const wallHits = this.raycaster.intersectObjects(this.wallOccluders, true)
    const wallDist = wallHits[0]?.distance ?? Infinity

    let closest: InteractableHover | null = null

    for (const entry of this.interactables) {
      if (!entry.isVisible()) {
        continue
      }

      const hits = this.raycaster.intersectObject(entry.object, true)
      const hit = hits[0]

      if (!hit) {
        continue
      }

      if (hit.distance > maxDistance) {
        continue
      }

      if (hit.distance > wallDist + 0.06) {
        continue
      }

      if (!closest || hit.distance < closest.distance) {
        const blockedReason = entry.getBlockedReason()
        const label =
          entry.kind === 'exit'
            ? this.worldFlags.exitOpen
              ? 'Salida de la planta (Abierta)'
              : 'Puerta de salida'
            : entry.label

        closest = {
          kind: entry.kind,
          label,
          action: blockedReason ? 'E · Comprobar' : entry.action,
          blockedReason,
          distance: hit.distance
        }
      }
    }

    this.setHover(closest)
  }

  private setHover(next: InteractableHover | null): void {
    const key = next
      ? `${next.kind}|${next.label}|${next.blockedReason ?? ''}`
      : ''

    if (key === this.currentHoverKey) {
      return
    }

    this.currentHoverKey = key
    this.currentHover = next
    this.callbacks.onHoverChange(next)
  }

  private handleResize = (): void => {
    if (this.disposed) return

    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.movementEnabled) {
      return
    }

    if (
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight'
    ) {
      this.keysPressed.add(event.code)
    }

    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault()
      this.triggerInteract()
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed.delete(event.code)
  }

  private handleBlur = (): void => {
    this.keysPressed.clear()
  }

  private handleLock = (): void => {
    this.callbacks.onPointerLockChange(true)
  }

  private handleUnlock = (): void => {
    this.keysPressed.clear()
    this.callbacks.onPointerLockChange(false)
  }

  private handleCanvasClick = (): void => {
    if (this.movementEnabled && !this.controls.isLocked) {
      void this.audio.unlock()
      this.requestPointerLock()
    }
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.callbacks.onContextLost()
  }

  private handleContextRestored = (): void => {
    this.callbacks.onContextRestored()
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    this.controls.addEventListener('lock', this.handleLock)
    this.controls.addEventListener('unlock', this.handleUnlock)
    this.renderer.domElement.addEventListener('click', this.handleCanvasClick)
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost
    )
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored
    )
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.controls.removeEventListener('lock', this.handleLock)
    this.controls.removeEventListener('unlock', this.handleUnlock)
    this.renderer.domElement.removeEventListener(
      'click',
      this.handleCanvasClick
    )
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLost
    )
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored
    )
  }
}
