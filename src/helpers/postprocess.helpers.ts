import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

const HorrorCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.032 },
    uChromatic: { value: 0.0011 },
    uVignette: { value: 0.48 },
    uExposure: { value: 1.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uExposure;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);

      // Subtle radial chromatic aberration stronger near screen edges
      vec2 caOffset = centered * uChromatic * (0.35 + dist * 1.45);
      float r = texture2D(tDiffuse, vUv + caOffset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - caOffset).b;
      vec3 color = vec3(r, g, b) * uExposure;

      // Subtle organic film grain
      if (uGrain > 0.0005) {
        float n = hash12(gl_FragCoord.xy + vec2(fract(uTime * 17.3) * 113.0, fract(uTime * 11.7) * 71.0));
        color += (n - 0.5) * uGrain;
      }

      // Soft cinematic vignette
      float vig = 1.0 - smoothstep(0.32, 0.88, dist) * uVignette;
      color *= vig;

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `
}

export class PostProcessPipeline {
  private composer: EffectComposer

  private bloomPass: UnrealBloomPass

  private compositePass: ShaderPass

  private reducedMotion = false

  private bloomEnabled = true

  private frameTimeEma = 16.6

  private slowFrameStreak = 0

  private elapsed = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    isSoftwareGpu: boolean
  ) {
    this.composer = new EffectComposer(renderer)

    const renderPass = new RenderPass(scene, camera)

    this.composer.addPass(renderPass)

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.38,
      0.55,
      0.78
    )

    // On software GPUs (SwiftShader/llvmpipe), skip multi-pass blur bloom so main thread stays crisp
    if (isSoftwareGpu) {
      this.bloomEnabled = false
      this.bloomPass.enabled = false
    }

    this.composer.addPass(this.bloomPass)

    this.compositePass = new ShaderPass(HorrorCompositeShader)
    this.composer.addPass(this.compositePass)

    const outputPass = new OutputPass()

    this.composer.addPass(outputPass)
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
    this.bloomPass.setSize(width, height)
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
    this.compositePass.uniforms.uGrain.value = reduced ? 0.01 : 0.032
    this.compositePass.uniforms.uChromatic.value = reduced ? 0.0 : 0.0011
  }

  public setMood(options: {
    exposure: number
    chromaticBoost?: number
    vignette?: number
    bloomStrength?: number
  }): void {
    this.compositePass.uniforms.uExposure.value = options.exposure
    this.compositePass.uniforms.uVignette.value = options.vignette ?? 0.48

    const baseCa = this.reducedMotion ? 0 : 0.0011

    this.compositePass.uniforms.uChromatic.value =
      baseCa + (this.reducedMotion ? 0 : (options.chromaticBoost ?? 0))

    if (typeof options.bloomStrength === 'number' && this.bloomEnabled) {
      this.bloomPass.strength = options.bloomStrength
    }
  }

  public render(dt: number): void {
    this.elapsed += dt

    if (!this.reducedMotion) {
      this.compositePass.uniforms.uTime.value = this.elapsed
    }

    // Adaptive quality guard for slow GPUs (inspired by halloween.dev)
    const frameMs = dt * 1000

    this.frameTimeEma = this.frameTimeEma * 0.92 + frameMs * 0.08

    if (this.bloomEnabled && this.frameTimeEma > 55) {
      this.slowFrameStreak += 1

      if (this.slowFrameStreak > 45) {
        this.bloomEnabled = false
        this.bloomPass.enabled = false
      }
    } else {
      this.slowFrameStreak = 0
    }

    this.composer.render()
  }

  public dispose(): void {
    this.bloomPass.dispose()
    this.composer.dispose()
  }
}
