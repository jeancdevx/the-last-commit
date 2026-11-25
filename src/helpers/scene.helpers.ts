import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

import { assetUrl } from '@/helpers/assets.helpers'
import type { GameAudioEngine } from '@/helpers/audio.helpers'
import {
  buildActiveColliders,
  resolveMovementXZ
} from '@/helpers/collision.helpers'
import { PostProcessPipeline } from '@/helpers/postprocess.helpers'
import { LiveScreenTextures } from '@/helpers/screenCanvas.helpers'
import {
  buildOfficeSetDressing,
  enhancePbrMaterials
} from '@/helpers/setdressing.helpers'
import type { SetDressingRig } from '@/helpers/setdressing.helpers'
import type {
  AabbXZ,
  CctvFeed,
  DiagnosticSnapshot,
  GameSettings,
  InteractableHover,
  InteractableKind,
  ProjectedMarker,
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
  markerOffsetY?: number
  isVisible: () => boolean
  getBlockedReason: () => string | undefined
}

export interface SceneEngineCallbacks {
  onLoadProgress: (percent: number, detail: string) => void
  onHoverChange: (hover: InteractableHover | null) => void
  onMarkersChange?: (markers: ProjectedMarker[]) => void
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

  private fog: THREE.FogExp2

  private camera: THREE.PerspectiveCamera

  private controls: PointerLockControls

  private postProcess: PostProcessPipeline

  private liveScreens: LiveScreenTextures

  private setDressing: SetDressingRig | null = null

  private envTexture: THREE.Texture | null = null

  private microBumpTexture: THREE.Texture | null = null

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

  private a07SpotLight: THREE.SpotLight | null = null

  private a07BounceLight: THREE.PointLight | null = null

  private corridorLight: THREE.PointLight | null = null

  private exitSignLight: THREE.PointLight | null = null

  private keysPressed = new Set<string>()

  private settings: GameSettings

  private worldFlags: WorldFlags

  private stageId: StageId = 'opening'

  private timeText = '23:52'

  private movementEnabled = false

  private titleMode = false

  private endingMode = false

  private checkAbsenceSight = false

  private loadedModelCount = 0

  private gpuRenderer = 'WebGL 2'

  private gpuVendor = 'unknown'

  private isSoftwareGpu = false

  private currentHoverKey = ''

  private currentHover: InteractableHover | null = null

  private lastMarkersSig = ''

  private lastRaycastAt = 0

  private lastOverlayRenderAt = 0

  private walkDistanceAccum = 0

  private bobPhase = 0

  private idleElapsed = 0

  private velX = 0

  private velZ = 0

  private tensionFlash = 0

  private introSweep = {
    active: false,
    elapsed: 0,
    duration: 1.05,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    toLook: new THREE.Vector3(),
    fromFov: 44,
    toFov: 50
  }

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

  private markerWorldVec = new THREE.Vector3()

  private markerBox = new THREE.Box3()

  private a07WorldPos = new THREE.Vector3(1.55, 0.95, 2.0)

  private titleBasePos = new THREE.Vector3(-1.32, 1.58, 5.02)

  private titleLookTarget = new THREE.Vector3(0.85, 1.14, -1.6)

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
    this.isSoftwareGpu = /swiftshader|llvmpipe|software/i.test(this.gpuRenderer)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: !this.isSoftwareGpu,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(
      this.isSoftwareGpu ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    )

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    this.renderer.setSize(width, height)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.AgXToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.shadowMap.enabled = !this.isSoftwareGpu
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.className = 'block h-full w-full outline-none'
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Escena 3D de la oficina en The Last Commit'
    )
    container.replaceChildren(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#090e0d')
    this.fog = new THREE.FogExp2('#090e0d', 0.03)
    this.scene.fog = this.fog

    // Subtle dark PMREM environment so laminate, metal, and frosted glass catch realistic reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const roomEnv = new RoomEnvironment()

    this.envTexture = pmrem.fromScene(roomEnv, 0.06).texture
    this.scene.environment = this.envTexture
    this.scene.environmentIntensity = 0.2
    roomEnv.dispose()
    pmrem.dispose()

    // Cinematic 50° FOV (like halloween.dev)
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.06, 42)
    this.controls = new PointerLockControls(
      this.camera,
      this.renderer.domElement
    )
    this.controls.pointerSpeed = this.settings.sensitivity
    this.scene.add(this.controls.object)

    this.liveScreens = new LiveScreenTextures()
    this.postProcess = new PostProcessPipeline(
      this.renderer,
      this.scene,
      this.camera,
      width,
      height,
      this.isSoftwareGpu
    )
    this.postProcess.setReducedMotion(this.settings.reducedMotion)

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

    this.callbacks.onLoadProgress(5, 'Cargando arquitectura de la planta...')

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

    cloneMaterials(shellRoot)
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

    // Enrich PBR micro-detail & shadow flags across the whole office
    this.microBumpTexture = enhancePbrMaterials(this.scene)

    // Mount lived-in procedural office set dressing (wall clock, whiteboard, sticky notes, dust, shafts)
    this.setDressing = buildOfficeSetDressing(this.liveScreens.clockTexture)
    this.scene.add(this.setDressing.root)

    this.registerInteractables()
    this.applyWorldFlags(
      this.worldFlags,
      this.stageId,
      this.timeText,
      true,
      false
    )

    this.callbacks.onLoadProgress(100, 'Planta 04 lista.')
    this.startLoop()
  }

  public applyWorldFlags(
    flags: WorldFlags,
    stageId: StageId,
    timeText: string,
    immediate = false,
    checkAbsenceSight = false
  ): void {
    const a07JustVanished =
      this.worldFlags.stationA07Visible && !flags.stationA07Visible

    this.worldFlags = { ...flags }
    this.stageId = stageId
    this.timeText = timeText
    this.checkAbsenceSight = checkAbsenceSight
    this.activeColliders = buildActiveColliders(this.manifest, flags)

    if (a07JustVanished) {
      this.tensionFlash = 1
    }

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

    // Update live 3D monitor on A-06 and wall clock
    this.liveScreens.update(stageId, timeText, flags)

    // Audio tension sub-drone swells while A-07 is missing
    this.audio.setA07Active(flags.a07AudioActive, immediate)
    this.audio.setTension(
      flags.traceA07Visible ? 0.85 : flags.exitOpen ? 0 : 0.15
    )

    // Dynamic fog & exit light mood
    this.fog.density = flags.traceA07Visible
      ? 0.042
      : flags.exitOpen
        ? 0.022
        : 0.03

    if (this.exitSignLight) {
      this.exitSignLight.intensity = flags.exitOpen ? 1.55 : 0.55
    }

    if (immediate || this.settings.reducedMotion) {
      this.currentBulbs07 = flags.bulbs07Intensity * 1.65
      this.currentBulbs19 = flags.bulbs19Intensity * 1.65
      this.currentBulbs26 = flags.bulbs26Intensity * 1.65
      this.currentTreeLight = flags.treeLightIntensity * 1.35
      this.currentA07Light = flags.a07LightIntensity
      this.currentDoorAngle = flags.exitOpen ? 1.32 : 0

      setEmissiveIntensity(this.bulbs07, this.currentBulbs07)
      setEmissiveIntensity(this.bulbs19, this.currentBulbs19)
      setEmissiveIntensity(this.bulbs26, this.currentBulbs26)

      if (this.treeLight) this.treeLight.intensity = this.currentTreeLight

      if (this.a07SpotLight)
        this.a07SpotLight.intensity = this.currentA07Light * 5.8

      if (this.a07BounceLight) {
        this.a07BounceLight.intensity = this.currentA07Light * 1.2
      }

      if (this.doorPivot) this.doorPivot.rotation.y = this.currentDoorAngle
    }

    this.updateRaycast(true)
  }

  public setTitleMode(active: boolean): void {
    this.titleMode = active
    this.endingMode = false
    this.introSweep.active = false

    if (active) {
      this.setMovementEnabled(false)
      this.camera.fov = 44
      this.camera.updateProjectionMatrix()
      this.controls.object.position.copy(this.titleBasePos)
      this.camera.lookAt(this.titleLookTarget)
      this.emitMarkers([])
    }
  }

  public startGameplayFromTitle(): void {
    this.titleMode = false
    this.endingMode = false

    const [sx, sy, sz] = this.manifest.spawn.position
    const [lx, ly, lz] = this.manifest.spawn.lookAt

    if (this.settings.reducedMotion) {
      this.camera.fov = 50
      this.camera.updateProjectionMatrix()
      this.resetCameraToSpawn()
      this.setMovementEnabled(true)

      return
    }

    this.introSweep = {
      active: true,
      elapsed: 0,
      duration: 1.05,
      fromPos: this.controls.object.position.clone(),
      toPos: new THREE.Vector3(sx, sy, sz),
      fromLook: this.titleLookTarget.clone(),
      toLook: new THREE.Vector3(lx, ly, lz),
      fromFov: this.camera.fov,
      toFov: 50
    }
    this.setMovementEnabled(true)
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next }
    this.controls.pointerSpeed = next.sensitivity
    this.postProcess.setReducedMotion(next.reducedMotion)

    if (next.reducedMotion) {
      this.controls.object.position.y = this.manifest.avatar.eyeHeight
    }
  }

  public setMovementEnabled(enabled: boolean): void {
    this.movementEnabled = enabled

    if (!enabled) {
      this.keysPressed.clear()
      this.velX = 0
      this.velZ = 0

      if (this.controls.isLocked) {
        this.controls.unlock()
      }

      this.setHover(null)
      this.emitMarkers([])
    } else {
      this.updateRaycast(true)
    }
  }

  public setEndingCamera(active: boolean): void {
    this.endingMode = active
    this.titleMode = false
    this.introSweep.active = false

    if (active) {
      this.setMovementEnabled(false)
      this.camera.fov = 46
      this.camera.updateProjectionMatrix()
      this.controls.object.position.set(-0.73, 1.62, -3.49)
      this.camera.lookAt(0.45, 1.34, -10.4)
    } else {
      this.camera.fov = 50
      this.camera.updateProjectionMatrix()
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

    this.introSweep.active = false
    this.camera.fov = 50
    this.camera.updateProjectionMatrix()
    this.controls.object.position.set(sx, sy, sz)
    this.camera.lookAt(lx, ly, lz)
    this.keysPressed.clear()
    this.velX = 0
    this.velZ = 0
    this.bobPhase = 0
    this.walkDistanceAccum = 0
  }

  public teleportAndLook(position: Vec3Tuple, lookAt: Vec3Tuple): void {
    this.introSweep.active = false
    this.controls.object.position.set(position[0], position[1], position[2])
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
    this.updateRaycast(true)
    this.updateProjectedMarkers()
    this.checkAbsenceVisibility()
    this.postProcess.render(0.016)
  }

  public triggerInteract(): boolean {
    this.updateRaycast(true)

    if (!this.currentHover) {
      return false
    }

    this.callbacks.onInteract(this.currentHover.kind)

    return true
  }

  public captureCctvFeeds(): CctvFeed[] {
    if (this.disposed) {
      return []
    }

    const w = 320
    const h = 180
    const rt = new THREE.WebGLRenderTarget(w, h)
    const pixels = new Uint8Array(w * h * 4)
    const canvas = document.createElement('canvas')

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')

    const specs: Array<{
      id: 'cam-01' | 'cam-02' | 'cam-03'
      label: string
      location: string
      pos: Vec3Tuple
      look: Vec3Tuple
      status: string
    }> = [
      {
        id: 'cam-01',
        label: 'CAM-01',
        location: 'OFICINA · A-07 / A-06',
        pos: [3.2, 2.48, 5.2],
        look: [0.25, 0.92, 1.95],
        status: this.worldFlags.stationA07Visible
          ? 'ACTIVA · A-07 DETECTADO'
          : 'ALERTA · ANOMALÍA EN A-07'
      },
      {
        id: 'cam-02',
        label: 'CAM-02',
        location: 'PASILLO CENTRAL',
        pos: [-1.05, 2.48, -0.4],
        look: [0.15, 1.12, -8.8],
        status: this.worldFlags.traceA07Visible
          ? 'INTERFERENCIA ELÉCTRICA'
          : 'ACTIVA · SIN MOVIMIENTO'
      },
      {
        id: 'cam-03',
        label: 'CAM-03',
        location: 'RECEPCIÓN · ÁRBOL Y SALIDA',
        pos: [-2.85, 2.46, -7.45],
        look: [0.95, 1.25, -11.4],
        status: this.worldFlags.exitOpen
          ? 'ACTIVA · SALIDA LIBERADA'
          : 'ACTIVA · ACCESO BLOQUEADO'
      }
    ]

    const feeds: CctvFeed[] = []
    const prevTarget = this.renderer.getRenderTarget()

    for (const spec of specs) {
      const cam = new THREE.PerspectiveCamera(62, w / h, 0.1, 30)

      cam.position.set(spec.pos[0], spec.pos[1], spec.pos[2])
      cam.lookAt(spec.look[0], spec.look[1], spec.look[2])

      this.renderer.setRenderTarget(rt)
      this.renderer.render(this.scene, cam)
      this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels)

      if (ctx) {
        const imgData = ctx.createImageData(w, h)

        // Flip Y + apply sRGB gamma curve & crisp night-vision CCTV lift
        for (let y = 0; y < h; y += 1) {
          const srcRow = (h - 1 - y) * w * 4
          const dstRow = y * w * 4

          for (let x = 0; x < w; x += 1) {
            const si = srcRow + x * 4
            const di = dstRow + x * 4
            const r = Math.pow((pixels[si] ?? 0) / 255, 1 / 2.2) * 255
            const g = Math.pow((pixels[si + 1] ?? 0) / 255, 1 / 2.2) * 255
            const b = Math.pow((pixels[si + 2] ?? 0) / 255, 1 / 2.2) * 255
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) * 1.48

            imgData.data[di] = Math.min(255, lum * 0.84 + r * 0.16)
            imgData.data[di + 1] = Math.min(255, lum * 1.04 + g * 0.14)
            imgData.data[di + 2] = Math.min(255, lum * 0.9 + b * 0.12)
            imgData.data[di + 3] = 255
          }
        }

        ctx.putImageData(imgData, 0, 0)
        feeds.push({
          id: spec.id,
          label: spec.label,
          location: spec.location,
          dataUrl: canvas.toDataURL('image/jpeg', 0.82),
          status: spec.status
        })
      }
    }

    this.renderer.setRenderTarget(prevTarget)
    rt.dispose()

    return feeds
  }

  public renderSingleFrame(): void {
    if (!this.disposed) {
      this.postProcess.render(0.016)
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
    this.setDressing?.dispose()
    this.liveScreens.dispose()
    this.postProcess.dispose()
    this.envTexture?.dispose()
    this.microBumpTexture?.dispose()
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
        if (screen instanceof THREE.Mesh) {
          screen.material = new THREE.MeshStandardMaterial({
            map: this.liveScreens.monitorTexture,
            emissiveMap: this.liveScreens.monitorTexture,
            emissive: new THREE.Color('#ffffff'),
            emissiveIntensity: 1.15,
            roughness: 0.25,
            metalness: 0.08
          })
        }

        setEmissiveIntensity(lamp, 0.4)
      } else if (id === 'office-a07') {
        setEmissiveIntensity(screen, 0.14)
        setEmissiveIntensity(lamp, 3.2)
      } else {
        setEmissiveIntensity(screen, 0.2)
        setEmissiveIntensity(lamp, 0.9)
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
          markerOffsetY: 0.08,
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
          markerOffsetY: 0.08,
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
          markerOffsetY: 0.14,
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
        markerOffsetY: 0.04,
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
          markerOffsetY: 0.08,
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
    const { cool, tree, a07 } = this.manifest.lighting
    const shadowRes = this.isSoftwareGpu ? 512 : 1024

    // Low atmospheric ambient so practical lamps & tree truly sculpt the dark office
    const hemi = new THREE.HemisphereLight('#7fa2b8', '#0e1513', 0.25)

    this.scene.add(hemi)

    const coolColor = new THREE.Color(cool.color)

    cool.ceilingSources.forEach(([x, y, z], index) => {
      const light = new THREE.PointLight(coolColor, 4.4, 11.5, 1.65)

      light.position.set(x, y, z)
      this.scene.add(light)

      if (index === 1) {
        this.corridorLight = light
      }
    })

    // Subtle cool screen bounce on A-06 desk
    const a06Glow = new THREE.PointLight('#6fb99a', 0.9, 3.2, 1.8)

    a06Glow.position.set(-2.58, 1.15, 2.02)
    this.scene.add(a06Glow)

    // Warm shadow-casting reception tree glow
    this.treeLight = new THREE.PointLight(
      new THREE.Color(tree.color),
      this.currentTreeLight,
      11.5,
      1.48
    )
    this.treeLight.position.set(
      tree.position[0],
      tree.position[1],
      tree.position[2]
    )
    this.treeLight.castShadow = !this.isSoftwareGpu
    this.treeLight.shadow.mapSize.set(shadowRes, shadowRes)
    this.treeLight.shadow.bias = -0.0005
    this.treeLight.shadow.normalBias = 0.018
    this.scene.add(this.treeLight)

    // Warm shadow-casting SpotLight on A-07 desk lamp + soft bounce
    this.a07SpotLight = new THREE.SpotLight(
      new THREE.Color('#f4d299'),
      this.currentA07Light * 5.8,
      6.2,
      0.92,
      0.72,
      1.6
    )
    this.a07SpotLight.position.set(
      a07.position[0],
      a07.position[1],
      a07.position[2]
    )
    this.a07SpotLight.target.position.set(1.88, 0.72, 2.06)
    this.a07SpotLight.castShadow = !this.isSoftwareGpu
    this.a07SpotLight.shadow.mapSize.set(shadowRes, shadowRes)
    this.a07SpotLight.shadow.bias = -0.0002
    this.a07SpotLight.shadow.normalBias = 0.015
    this.a07SpotLight.shadow.radius = 4
    this.scene.add(this.a07SpotLight)
    this.scene.add(this.a07SpotLight.target)

    this.a07BounceLight = new THREE.PointLight(
      new THREE.Color(a07.color),
      this.currentA07Light * 1.2,
      4.8,
      1.7
    )
    this.a07BounceLight.position.set(1.92, 1.05, 2.15)
    this.scene.add(this.a07BounceLight)

    // Green EXIT sign practical glow + cool nocturnal city window spill
    this.exitSignLight = new THREE.PointLight('#6dd491', 0.55, 4.5, 1.7)
    this.exitSignLight.position.set(0, 2.38, -12.7)
    this.scene.add(this.exitSignLight)

    const citySpill = new THREE.PointLight('#4e7594', 1.4, 8.5, 1.6)

    citySpill.position.set(3.25, 1.8, 3.1)
    this.scene.add(citySpill)
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

      // Throttle background 3D frames while a modal covers the viewport,
      // or cap render cadence on CPU/SwiftShader GPUs so software rendering stays responsive.
      const minRenderGap =
        !this.movementEnabled && !this.titleMode && !this.endingMode
          ? 240
          : this.isSoftwareGpu
            ? 100
            : 0

      if (minRenderGap > 0) {
        const now = performance.now()

        if (now - this.lastOverlayRenderAt < minRenderGap) {
          return
        }

        this.lastOverlayRenderAt = now
      }

      this.postProcess.render(dt)
    })
  }

  private stepSimulation(dt: number): void {
    this.idleElapsed += dt

    const smoothRate = this.settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.8)
    const doorRate = this.settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6)

    const targetB07 = this.worldFlags.bulbs07Intensity * 1.65
    const targetB19 = this.worldFlags.bulbs19Intensity * 1.65
    const targetB26 = this.worldFlags.bulbs26Intensity * 1.65
    const targetTree = this.worldFlags.treeLightIntensity * 1.35

    this.currentBulbs07 += (targetB07 - this.currentBulbs07) * smoothRate
    this.currentBulbs19 += (targetB19 - this.currentBulbs19) * smoothRate
    this.currentBulbs26 += (targetB26 - this.currentBulbs26) * smoothRate
    this.currentTreeLight += (targetTree - this.currentTreeLight) * smoothRate
    this.currentA07Light +=
      (this.worldFlags.a07LightIntensity - this.currentA07Light) * smoothRate

    // Subtle organic candle-like twinkle on active tree bulbs
    const twinkle = this.settings.reducedMotion
      ? 1
      : 0.96 + Math.sin(this.idleElapsed * 2.3) * 0.04

    setEmissiveIntensity(this.bulbs07, this.currentBulbs07 * twinkle)
    setEmissiveIntensity(this.bulbs19, this.currentBulbs19 * twinkle)
    setEmissiveIntensity(this.bulbs26, this.currentBulbs26 * twinkle)

    if (this.treeLight) {
      this.treeLight.intensity = this.currentTreeLight * twinkle
    }

    if (this.a07SpotLight) {
      this.a07SpotLight.intensity = this.currentA07Light * 5.8
    }

    if (this.a07BounceLight) {
      this.a07BounceLight.intensity = this.currentA07Light * 1.2
    }

    // Subtle horror-director corridor fluorescent micro-flicker while A-07 is missing
    if (this.corridorLight) {
      if (this.worldFlags.traceA07Visible && !this.settings.reducedMotion) {
        const wave =
          Math.sin(this.idleElapsed * 19.7) * Math.sin(this.idleElapsed * 7.3)
        const dip = wave > 0.86 ? 0.58 : 1

        this.corridorLight.intensity = 4.1 * dip
      } else {
        this.corridorLight.intensity = 4.4
      }
    }

    // Brief post-processing tension pulse on A-07 disappearance
    if (this.tensionFlash > 0) {
      this.tensionFlash = Math.max(0, this.tensionFlash - dt * 1.35)
    }

    const baseExposure = this.worldFlags.traceA07Visible ? 0.96 : 1.05

    this.postProcess.setMood({
      exposure: baseExposure - this.tensionFlash * 0.22,
      chromaticBoost: this.tensionFlash * 0.0028,
      vignette: this.worldFlags.traceA07Visible ? 0.56 : 0.46,
      bloomStrength: this.isSoftwareGpu ? 0.22 : 0.38
    })

    const targetDoorAngle = this.worldFlags.exitOpen ? 1.32 : 0

    this.currentDoorAngle +=
      (targetDoorAngle - this.currentDoorAngle) * doorRate

    if (this.doorPivot) {
      this.doorPivot.rotation.y = this.currentDoorAngle
    }

    this.setDressing?.update(
      dt,
      this.worldFlags.stationA07Visible,
      this.worldFlags.traceA07Visible,
      this.currentTreeLight,
      this.settings.reducedMotion
    )

    // Live title camera gentle drift
    if (this.titleMode) {
      if (!this.settings.reducedMotion) {
        const dx = Math.sin(this.idleElapsed * 0.28) * 0.14
        const dy = Math.cos(this.idleElapsed * 0.42) * 0.03

        this.controls.object.position.set(
          this.titleBasePos.x + dx,
          this.titleBasePos.y + dy,
          this.titleBasePos.z
        )
        this.camera.lookAt(this.titleLookTarget)
      }

      return
    }

    // Smooth cinematic camera sweep from title into player eyes
    if (this.introSweep.active) {
      this.introSweep.elapsed += dt

      const t = Math.min(1, this.introSweep.elapsed / this.introSweep.duration)
      const ease = 1 - Math.pow(1 - t, 3)

      this.controls.object.position.lerpVectors(
        this.introSweep.fromPos,
        this.introSweep.toPos,
        ease
      )
      this.lookTargetVec.lerpVectors(
        this.introSweep.fromLook,
        this.introSweep.toLook,
        ease
      )
      this.camera.lookAt(this.lookTargetVec)
      this.camera.fov =
        this.introSweep.fromFov +
        (this.introSweep.toFov - this.introSweep.fromFov) * ease
      this.camera.updateProjectionMatrix()

      if (t >= 1) {
        this.introSweep.active = false
      }
    }

    if (this.movementEnabled && !this.endingMode) {
      if (!this.introSweep.active) {
        this.stepMovement(dt)
      }

      this.checkAbsenceVisibility()

      const now = performance.now()

      if (now - this.lastRaycastAt >= 55) {
        this.lastRaycastAt = now
        this.updateRaycast(false)
        this.updateProjectedMarkers()
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

    // Weighty movement inertia (smooth accel/decel like halloween.dev)
    const speed = this.manifest.avatar.walkMetersPerSecond
    const targetVx = this.moveVec.x * speed
    const targetVz = this.moveVec.z * speed
    const accel = this.settings.reducedMotion
      ? 1
      : 1 - Math.exp(-dt * (forwardInput !== 0 || strafeInput !== 0 ? 11 : 14))

    this.velX += (targetVx - this.velX) * accel
    this.velZ += (targetVz - this.velZ) * accel

    const baseEyeY = this.manifest.avatar.eyeHeight
    const speedMag = Math.hypot(this.velX, this.velZ)

    if (speedMag < 0.02) {
      this.velX = 0
      this.velZ = 0

      if (!this.settings.reducedMotion) {
        // Gentle idle breathing sway
        const breathY = baseEyeY + Math.sin(this.idleElapsed * 1.45) * 0.008

        this.controls.object.position.y +=
          (breathY - this.controls.object.position.y) * Math.min(1, dt * 6)
      }

      return
    }

    const currentPos = this.controls.object.position
    const result = resolveMovementXZ(
      currentPos.x,
      currentPos.z,
      this.velX * dt,
      this.velZ * dt,
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
        this.bobPhase += stepDist * 4.2
        currentPos.y = baseEyeY + Math.sin(this.bobPhase) * 0.024
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

  private updateProjectedMarkers(): void {
    if (!this.callbacks.onMarkersChange || !this.movementEnabled) {
      return
    }

    const camPos = this.controls.object.position
    const maxMarkerDist = 4.6
    const maxInteractDist = this.manifest.interaction.maxDistance
    const seenKinds = new Set<InteractableKind>()
    const nextMarkers: ProjectedMarker[] = []

    this.camera.getWorldDirection(this.forwardVec)

    for (const entry of this.interactables) {
      if (!entry.isVisible() || seenKinds.has(entry.kind)) {
        continue
      }

      seenKinds.add(entry.kind)
      this.markerBox.setFromObject(entry.object)
      this.markerBox.getCenter(this.markerWorldVec)
      this.markerWorldVec.y += entry.markerOffsetY ?? 0.05

      const dist = camPos.distanceTo(this.markerWorldVec)

      if (dist > maxMarkerDist || dist < 0.25) {
        continue
      }

      // Must be in front of camera
      this.lookTargetVec.copy(this.markerWorldVec).sub(camPos).normalize()

      if (this.forwardVec.dot(this.lookTargetVec) < 0.35) {
        continue
      }

      // Discard markers occluded by walls
      this.raycaster.set(camPos, this.lookTargetVec)
      this.raycaster.far = dist - 0.08

      const wallHits = this.raycaster.intersectObjects(this.wallOccluders, true)

      if (wallHits.length > 0) {
        continue
      }

      const projected = this.markerWorldVec.clone().project(this.camera)
      const x = (projected.x * 0.5 + 0.5) * 100
      const y = (-projected.y * 0.5 + 0.5) * 100

      if (x < 6 || x > 94 || y < 8 || y > 92) {
        continue
      }

      const isActive = this.currentHover?.kind === entry.kind
      const blocked = Boolean(entry.getBlockedReason())

      nextMarkers.push({
        kind: entry.kind,
        label: entry.label,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        inReach: dist <= maxInteractDist,
        isActive,
        blocked
      })
    }

    this.emitMarkers(nextMarkers)
  }

  private emitMarkers(markers: ProjectedMarker[]): void {
    if (!this.callbacks.onMarkersChange) return

    const sig = markers
      .map(
        m =>
          `${m.kind}:${m.x}:${m.y}:${m.inReach ? 1 : 0}:${m.isActive ? 1 : 0}:${m.blocked ? 1 : 0}`
      )
      .join('|')

    if (sig === this.lastMarkersSig) {
      return
    }

    this.lastMarkersSig = sig
    this.callbacks.onMarkersChange(markers)
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
    this.postProcess.setSize(width, height)
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
      if (this.introSweep.active) {
        this.introSweep.active = false
        this.camera.fov = 50
        this.camera.updateProjectionMatrix()
      }

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
    this.velX = 0
    this.velZ = 0
  }

  private handleLock = (): void => {
    this.callbacks.onPointerLockChange(true)
  }

  private handleUnlock = (): void => {
    this.keysPressed.clear()
    this.velX = 0
    this.velZ = 0
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
