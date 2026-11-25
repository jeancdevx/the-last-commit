import * as THREE from 'three'

import { assetUrl } from '@/helpers/assets.helpers'

export interface SetDressingRig {
  root: THREE.Group
  dustPoints: THREE.Points
  a07Shaft: THREE.Mesh
  treeShaft: THREE.Mesh
  update: (
    dt: number,
    a07Visible: boolean,
    traceVisible: boolean,
    treeIntensity: number,
    reducedMotion: boolean
  ) => void
  dispose: () => void
}

function createMicroNoiseBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')

  canvas.width = 128
  canvas.height = 128

  const ctx = canvas.getContext('2d')

  if (ctx) {
    const img = ctx.createImageData(128, 128)

    for (let i = 0; i < img.data.length; i += 4) {
      const v = 112 + Math.floor(Math.random() * 32)

      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }

    ctx.putImageData(img, 0, 0)
  }

  const tex = new THREE.CanvasTexture(canvas)

  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 8)

  return tex
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')

  canvas.width = 32
  canvas.height = 32

  const ctx = canvas.getContext('2d')

  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)

    grad.addColorStop(0, 'rgba(255, 240, 210, 0.95)')
    grad.addColorStop(0.45, 'rgba(235, 210, 170, 0.35)')
    grad.addColorStop(1, 'rgba(235, 210, 170, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
  }

  return new THREE.CanvasTexture(canvas)
}

function createWhiteboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')

  canvas.width = 512
  canvas.height = 320

  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#8b938e'
    ctx.fillRect(0, 0, 512, 320)

    ctx.fillStyle = 'rgba(35, 44, 41, 0.14)'
    ctx.fillRect(30, 88, 430, 26)
    ctx.fillRect(42, 165, 360, 20)

    ctx.strokeStyle = 'rgba(28, 38, 34, 0.32)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(24, 62)
    ctx.lineTo(488, 62)
    ctx.moveTo(24, 130)
    ctx.lineTo(488, 130)
    ctx.moveTo(24, 198)
    ctx.lineTo(488, 198)
    ctx.stroke()

    ctx.fillStyle = '#18211e'
    ctx.font = 'bold 21px monospace'
    ctx.fillText('GUARDIAS · NOCHEBUENA · PLANTA 04', 28, 44)

    ctx.font = '17px monospace'
    ctx.fillStyle = '#212d29'
    ctx.fillText('FOLIO 07   A-07   I. SALAS    [VER BITÁCORA]', 30, 102)
    ctx.fillText('FOLIO 19   B-02   M. ROJAS    [VER BITÁCORA]', 30, 170)
    ctx.fillText('FOLIO 26   A-06   TURNO ACT.  [VER NOTA A-06]', 30, 238)

    ctx.fillStyle = '#8f2920'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('! CIERRE AUTOMÁTICO 00:00 — REVISAR ADORNOS', 30, 282)
    ctx.fillText('  DEL ÁRBOL Y CONFIRMAR EN CONSOLA A-06', 30, 304)
  }

  const tex = new THREE.CanvasTexture(canvas)

  tex.colorSpace = THREE.SRGBColorSpace

  return tex
}

function createRainyCityWindowMaterial(
  cityTexture: THREE.Texture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: cityTexture },
      uTime: { value: 0 },
      uRainStrength: { value: 1 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uRainStrength;
      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float rainLayer(vec2 uv, float t, float scale) {
        vec2 grid = vec2(scale * 2.2, scale);
        vec2 st = uv * grid;
        float colSeed = hash21(vec2(floor(st.x), 1.0));
        st.y += t * (0.35 + colSeed * 0.45) + colSeed * 6.28;
        vec2 cell = floor(st);
        vec2 f = fract(st) - 0.5;
        float n = hash21(cell);
        float dropY = sin(t * 1.2 + n * 6.28) * 0.14;
        vec2 p = vec2(f.x * 1.35, (f.y - dropY) * 0.42);
        float d = length(p);
        float drop = smoothstep(0.11, 0.02, d) * step(0.68, n);
        float trail = smoothstep(0.045, 0.0, abs(f.x)) * smoothstep(-0.46, 0.35, f.y) * smoothstep(0.42, 0.22, f.y) * step(0.68, n) * 0.28;
        return drop + trail;
      }

      void main() {
        float r1 = rainLayer(vUv, uTime, 22.0);
        float r2 = rainLayer(vUv + vec2(0.37, 0.19), uTime * 1.25, 38.0);
        float rain = (r1 + r2 * 0.55) * uRainStrength;

        // Subtle refractive distortion from raindrops
        vec2 refractUv = vUv + vec2(rain * 0.005, -rain * 0.01);
        vec3 city = texture2D(uMap, clamp(refractUv, 0.002, 0.998)).rgb;

        // Deep nocturnal glass tint + vertical wet sheen
        city *= vec3(0.84, 0.92, 0.98) * 0.92;
        float glassSheen = smoothstep(0.0, 0.9, vUv.y) * 0.04;
        vec3 dropHighlight = vec3(0.68, 0.82, 0.92) * rain * 0.16;

        // Subtle dark frame edge vignette on each window pane
        float edgeX = smoothstep(0.0, 0.035, vUv.x) * smoothstep(1.0, 0.965, vUv.x);
        float edgeY = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
        float edge = mix(0.62, 1.0, edgeX * edgeY);

        vec3 finalColor = (city + dropHighlight + glassSheen) * edge;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  })
}

function buildPanoramicWindowBay(
  width: number,
  height: number,
  panes: number,
  windowMat: THREE.ShaderMaterial,
  frameMat: THREE.MeshStandardMaterial,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group()

  // Main glowing rainy city glass surface
  const glassGeo = new THREE.PlaneGeometry(width, height)
  const glass = new THREE.Mesh(glassGeo, windowMat)

  group.add(glass)
  disposables.push(glassGeo)

  // Outer anodized aluminum casing (top header, bottom sill, left & right jambs)
  const headerGeo = new THREE.BoxGeometry(width + 0.14, 0.1, 0.14)
  const header = new THREE.Mesh(headerGeo, frameMat)

  header.position.set(0, height / 2 + 0.02, 0.04)
  group.add(header)

  const sillGeo = new THREE.BoxGeometry(width + 0.16, 0.07, 0.18)
  const sill = new THREE.Mesh(sillGeo, frameMat)

  sill.position.set(0, -height / 2 - 0.02, 0.06)
  sill.receiveShadow = true
  group.add(sill)

  // Vertical mullions dividing the panoramic bay into architectural office panes
  const mullionGeo = new THREE.BoxGeometry(0.055, height + 0.06, 0.11)

  for (let i = 0; i <= panes; i += 1) {
    const mx = -width / 2 + (width * i) / panes
    const mullion = new THREE.Mesh(mullionGeo, frameMat)

    mullion.position.set(mx, 0, 0.035)
    mullion.castShadow = true
    group.add(mullion)
  }

  // Subtle upper transom crossbar
  const transomGeo = new THREE.BoxGeometry(width, 0.04, 0.09)
  const transom = new THREE.Mesh(transomGeo, frameMat)

  transom.position.set(0, height * 0.28, 0.035)
  group.add(transom)

  disposables.push(headerGeo, sillGeo, mullionGeo, transomGeo)

  return group
}

export function enhancePbrMaterials(root: THREE.Object3D): THREE.Texture {
  const microBump = createMicroNoiseBumpTexture()

  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return

    const name = node.name
    const isLightMesh =
      name.includes('Fluorescent_diffuser') ||
      name.includes('LAMP_EMITTER') ||
      name.includes('BULBS_') ||
      name.includes('EXIT_SIGN') ||
      name.includes('SCREEN_SURFACE')

    if (!isLightMesh) {
      node.receiveShadow = true

      if (
        !name.startsWith('Floor_') &&
        !name.startsWith('Ceiling_') &&
        !name.startsWith('TGrid') &&
        !name.startsWith('FLOOR_TRACE')
      ) {
        node.castShadow = true
      }
    }

    const mats = Array.isArray(node.material) ? node.material : [node.material]

    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue

      if (
        mat.name.includes('Carpet') ||
        mat.name.includes('Wall') ||
        mat.name.includes('Ceiling')
      ) {
        mat.bumpMap = microBump
        mat.bumpScale = mat.name.includes('Carpet') ? 0.012 : 0.006
        mat.roughness = Math.min(0.96, mat.roughness + 0.06)
      }

      if (mat.name.includes('Frosted glass')) {
        mat.roughness = 0.24
        mat.metalness = 0.32
      }

      if (mat.name.includes('Cool fluorescent')) {
        mat.emissiveIntensity = 2.6
      }

      if (mat.name.includes('Exit sign')) {
        mat.emissiveIntensity = 1.65
      }
    }
  })

  return microBump
}

export function buildOfficeSetDressing(
  clockTexture: THREE.CanvasTexture
): SetDressingRig {
  const root = new THREE.Group()

  root.name = 'SCENE_set_dressing'

  const disposables: Array<{ dispose: () => void }> = []

  // 0. Panoramic Floor-to-Ceiling Rainy Christmas Eve City Windows (inspired by halloween.dev)
  const texLoader = new THREE.TextureLoader()
  const cityTex = texLoader.load(assetUrl('textures/city-night-panorama.jpg'))

  cityTex.colorSpace = THREE.SRGBColorSpace
  cityTex.wrapS = THREE.ClampToEdgeWrapping
  cityTex.wrapT = THREE.ClampToEdgeWrapping

  const windowMat = createRainyCityWindowMaterial(cityTex)
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#1b2321',
    roughness: 0.38,
    metalness: 0.45
  })

  // Office East Wall panoramic window right behind A-07 (visible from Title Screen & Spawn!)
  const officeWindow = buildPanoramicWindowBay(
    5.1,
    2.18,
    4,
    windowMat,
    frameMat,
    disposables
  )

  officeWindow.position.set(3.92, 1.54, 2.95)
  officeWindow.rotation.y = -Math.PI / 2
  root.add(officeWindow)

  // Reception East Wall panoramic window behind the Christmas Tree
  const receptionWindow = buildPanoramicWindowBay(
    4.6,
    2.18,
    3,
    windowMat,
    frameMat,
    disposables
  )

  receptionWindow.position.set(3.42, 1.54, -10.1)
  receptionWindow.rotation.y = -Math.PI / 2
  root.add(receptionWindow)

  disposables.push(cityTex, windowMat, frameMat)

  // 1. Live Digital Wall Clock above the office-to-corridor portal
  const clockFrameGeo = new THREE.BoxGeometry(0.42, 0.17, 0.04)
  const clockFrameMat = new THREE.MeshStandardMaterial({
    color: '#1b2220',
    roughness: 0.45,
    metalness: 0.35
  })
  const clockFrame = new THREE.Mesh(clockFrameGeo, clockFrameMat)

  clockFrame.position.set(0, 2.58, 0.18)
  clockFrame.castShadow = true
  root.add(clockFrame)

  const clockFaceGeo = new THREE.PlaneGeometry(0.36, 0.12)
  const clockFaceMat = new THREE.MeshStandardMaterial({
    map: clockTexture,
    emissiveMap: clockTexture,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1.35,
    roughness: 0.2
  })
  const clockFace = new THREE.Mesh(clockFaceGeo, clockFaceMat)

  clockFace.position.set(0, 2.58, 0.203)
  root.add(clockFace)
  disposables.push(clockFrameGeo, clockFrameMat, clockFaceGeo, clockFaceMat)

  // 2. Holiday On-Call Whiteboard on the office WEST wall (next to A-06)
  const boardTex = createWhiteboardTexture()
  const boardFrameGeo = new THREE.BoxGeometry(0.04, 0.96, 1.48)
  const boardFrameMat = new THREE.MeshStandardMaterial({
    color: '#2e3835',
    roughness: 0.42,
    metalness: 0.45
  })
  const boardFrame = new THREE.Mesh(boardFrameGeo, boardFrameMat)

  boardFrame.position.set(-3.92, 1.56, 3.45)
  boardFrame.castShadow = true
  boardFrame.receiveShadow = true
  root.add(boardFrame)

  const boardFaceGeo = new THREE.PlaneGeometry(1.4, 0.88)
  const boardFaceMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.35,
    metalness: 0.05
  })
  const boardFace = new THREE.Mesh(boardFaceGeo, boardFaceMat)

  boardFace.position.set(-3.895, 1.56, 3.45)
  boardFace.rotation.y = Math.PI / 2
  boardFace.receiveShadow = true
  root.add(boardFace)
  disposables.push(
    boardTex,
    boardFrameGeo,
    boardFrameMat,
    boardFaceGeo,
    boardFaceMat
  )

  // 3. Sticky notes stuck to A-06 monitor bezel
  const stickyColors = ['#d8b96a', '#c99374', '#8fb698']
  const stickyGeo = new THREE.PlaneGeometry(0.062, 0.062)

  stickyColors.forEach((hex, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.88,
      side: THREE.DoubleSide
    })
    const note = new THREE.Mesh(stickyGeo, mat)

    note.position.set(-2.78 + idx * 0.072, 0.92, 1.72)
    note.rotation.z = (idx - 1) * 0.07
    root.add(note)
    disposables.push(mat)
  })
  disposables.push(stickyGeo)

  // 4. Stacked office folders & binders on A-06 desk corner and reception counter
  const binderGeo = new THREE.BoxGeometry(0.24, 0.045, 0.31)
  const binderMats = ['#2c3f38', '#4d3a30', '#3a4248'].map(
    color =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82
      })
  )

  const stackPositions: Array<[number, number, number, number, number]> = [
    [-1.82, 0.804, 1.66, 0.08, 0],
    [-1.84, 0.85, 1.68, -0.14, 1],
    [-1.42, 1.095, -8.72, 0.22, 2],
    [-1.43, 1.14, -8.7, 0.04, 0]
  ]

  for (const [x, y, z, rotY, matIdx] of stackPositions) {
    const mesh = new THREE.Mesh(binderGeo, binderMats[matIdx] ?? binderMats[0])

    mesh.position.set(x, y, z)
    mesh.rotation.y = rotY
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
  }

  disposables.push(binderGeo, ...binderMats)

  // 5. Power strip with pilot LED under A-06 + eerie faint copper spark glow on cut cable when A-07 vanishes
  const stripGeo = new THREE.BoxGeometry(0.26, 0.032, 0.06)
  const stripMat = new THREE.MeshStandardMaterial({
    color: '#252b29',
    roughness: 0.55
  })
  const strip = new THREE.Mesh(stripGeo, stripMat)

  strip.position.set(-2.22, 0.016, 1.46)
  strip.rotation.y = 0.25
  strip.receiveShadow = true
  root.add(strip)

  const ledGeo = new THREE.SphereGeometry(0.008, 8, 8)
  const ledMat = new THREE.MeshStandardMaterial({
    color: '#ff4238',
    emissive: '#ff4238',
    emissiveIntensity: 3.4
  })
  const led = new THREE.Mesh(ledGeo, ledMat)

  led.position.set(-2.31, 0.035, 1.48)
  root.add(led)

  const cableSparkLight = new THREE.PointLight('#ffaa55', 0, 1.4, 2)

  cableSparkLight.position.set(2.14, 0.07, 1.8)
  root.add(cableSparkLight)

  disposables.push(stripGeo, stripMat, ledGeo, ledMat)

  // 6. Subtle volumetric-feel translucent light shafts beneath A-07 lamp and tree
  const shaftGeo = new THREE.ConeGeometry(0.3, 0.44, 20, 1, true)
  const a07ShaftMat = new THREE.MeshBasicMaterial({
    color: '#f2d39c',
    transparent: true,
    opacity: 0.038,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const a07Shaft = new THREE.Mesh(shaftGeo, a07ShaftMat)

  a07Shaft.position.set(2.14, 1.02, 1.95)
  root.add(a07Shaft)

  const treeShaftGeo = new THREE.ConeGeometry(1.15, 2.25, 24, 1, true)
  const treeShaftMat = new THREE.MeshBasicMaterial({
    color: '#e2ac65',
    transparent: true,
    opacity: 0.032,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const treeShaft = new THREE.Mesh(treeShaftGeo, treeShaftMat)

  treeShaft.position.set(1.44, 1.12, -10.8)
  root.add(treeShaft)
  disposables.push(shaftGeo, a07ShaftMat, treeShaftGeo, treeShaftMat)

  // 7. Ambient floating dust motes in the warm pools
  const dustCount = 96
  const dustPositions = new Float32Array(dustCount * 3)
  const dustSeeds = new Float32Array(dustCount)

  for (let i = 0; i < dustCount; i += 1) {
    const inReception = i >= 48

    if (inReception) {
      dustPositions[i * 3] = 1.44 + (Math.random() - 0.5) * 2.4
      dustPositions[i * 3 + 1] = 0.35 + Math.random() * 2.0
      dustPositions[i * 3 + 2] = -10.6 + (Math.random() - 0.5) * 2.4
    } else {
      dustPositions[i * 3] = (Math.random() - 0.5) * 6.4
      dustPositions[i * 3 + 1] = 0.55 + Math.random() * 1.9
      dustPositions[i * 3 + 2] = 0.6 + Math.random() * 4.4
    }

    dustSeeds[i] = Math.random() * Math.PI * 2
  }

  const dustGeo = new THREE.BufferGeometry()

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))

  const dustTex = createSoftParticleTexture()
  const dustMat = new THREE.PointsMaterial({
    map: dustTex,
    color: '#f2dec0',
    size: 0.03,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const dustPoints = new THREE.Points(dustGeo, dustMat)

  dustPoints.name = 'Ambient_dust'
  root.add(dustPoints)
  disposables.push(dustGeo, dustTex, dustMat)

  let elapsed = 0

  return {
    root,
    dustPoints,
    a07Shaft,
    treeShaft,
    update(dt, a07Visible, traceVisible, treeIntensity, reducedMotion) {
      a07Shaft.visible = a07Visible
      treeShaftMat.opacity = Math.min(0.055, 0.012 + treeIntensity * 0.01)

      if (reducedMotion) {
        windowMat.uniforms.uRainStrength.value = 0.35
        cableSparkLight.intensity = traceVisible ? 0.2 : 0

        return
      }

      elapsed += dt
      windowMat.uniforms.uTime.value = elapsed
      windowMat.uniforms.uRainStrength.value = 1

      // Intermittent subtle electrical glint on the cut copper cable when A-07 is missing
      if (traceVisible) {
        const sparkWave =
          Math.sin(elapsed * 23.1) *
          Math.sin(elapsed * 7.9) *
          Math.sin(elapsed * 3.1)

        cableSparkLight.intensity = sparkWave > 0.72 ? 1.4 : 0.14
      } else {
        cableSparkLight.intensity = 0
      }

      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute

      for (let i = 0; i < dustCount; i += 1) {
        const seed = dustSeeds[i] ?? 0
        const y = posAttr.getY(i) + dt * 0.018

        posAttr.setY(i, y > 2.48 ? 0.38 : y)
        posAttr.setX(
          i,
          posAttr.getX(i) + Math.sin(elapsed * 0.45 + seed) * dt * 0.008
        )
      }

      posAttr.needsUpdate = true
    },
    dispose() {
      for (const item of disposables) {
        item.dispose()
      }
    }
  }
}
