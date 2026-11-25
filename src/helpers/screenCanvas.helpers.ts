import * as THREE from 'three'

import type { StageId, WorldFlags } from '@/types'

export class LiveScreenTextures {
  private monitorCanvas: HTMLCanvasElement

  private monitorCtx: CanvasRenderingContext2D | null

  public readonly monitorTexture: THREE.CanvasTexture

  private clockCanvas: HTMLCanvasElement

  private clockCtx: CanvasRenderingContext2D | null

  public readonly clockTexture: THREE.CanvasTexture

  private lastSignature = ''

  constructor() {
    this.monitorCanvas = document.createElement('canvas')
    this.monitorCanvas.width = 512
    this.monitorCanvas.height = 288
    this.monitorCtx = this.monitorCanvas.getContext('2d')
    this.monitorTexture = new THREE.CanvasTexture(this.monitorCanvas)
    this.monitorTexture.colorSpace = THREE.SRGBColorSpace
    this.monitorTexture.flipY = true

    this.clockCanvas = document.createElement('canvas')
    this.clockCanvas.width = 256
    this.clockCanvas.height = 96
    this.clockCtx = this.clockCanvas.getContext('2d')
    this.clockTexture = new THREE.CanvasTexture(this.clockCanvas)
    this.clockTexture.colorSpace = THREE.SRGBColorSpace

    this.update('opening', '23:52', {
      stationA07Visible: true,
      traceA07Visible: false,
      stationB02Visible: false,
      tag07Visible: true,
      tag07Interactable: false,
      tag19Visible: false,
      tag26Visible: false,
      exitOpen: false,
      bulbs07Intensity: 0.25,
      bulbs19Intensity: 0.1,
      bulbs26Intensity: 0.1,
      treeLightIntensity: 0.7,
      a07LightIntensity: 1.55,
      a07AudioActive: true
    })
  }

  public update(stageId: StageId, timeText: string, flags: WorldFlags): void {
    const sig = `${stageId}|${timeText}|${flags.stationA07Visible}|${flags.stationB02Visible}|${flags.exitOpen}`

    if (sig === this.lastSignature) {
      return
    }

    this.lastSignature = sig
    this.drawMonitor(stageId, timeText, flags)
    this.drawWallClock(timeText, flags.exitOpen)
  }

  public dispose(): void {
    this.monitorTexture.dispose()
    this.clockTexture.dispose()
  }

  private drawMonitor(
    stageId: StageId,
    timeText: string,
    flags: WorldFlags
  ): void {
    const ctx = this.monitorCtx

    if (!ctx) return

    const w = this.monitorCanvas.width
    const h = this.monitorCanvas.height

    ctx.fillStyle = '#0c1513'
    ctx.fillRect(0, 0, w, h)

    // Subtle terminal scanlines
    ctx.fillStyle = 'rgba(141, 222, 156, 0.035)'

    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1)
    }

    // Header bar
    ctx.fillStyle = '#15231f'
    ctx.fillRect(0, 0, w, 38)
    ctx.fillStyle = '#8dde9c'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('PLANTA 04 · CIERRE ANUAL', 18, 24)
    ctx.fillStyle = '#e2ac65'
    ctx.textAlign = 'right'
    ctx.fillText(`24/12/2026  ${timeText}`, w - 18, 24)
    ctx.textAlign = 'left'

    // Main status alert
    const a07Missing = flags.traceA07Visible
    const confirmed = flags.exitOpen

    ctx.fillStyle = confirmed
      ? 'rgba(141, 222, 156, 0.14)'
      : a07Missing
        ? 'rgba(238, 153, 128, 0.16)'
        : 'rgba(226, 172, 101, 0.14)'
    ctx.fillRect(18, 54, w - 36, 46)
    ctx.strokeStyle = confirmed ? '#8dde9c' : a07Missing ? '#ee9980' : '#e2ac65'
    ctx.lineWidth = 1.5
    ctx.strokeRect(18, 54, w - 36, 46)

    ctx.fillStyle = confirmed ? '#8dde9c' : a07Missing ? '#ee9980' : '#f1ede2'
    ctx.font = 'bold 16px monospace'
    ctx.fillText(
      confirmed
        ? '✓ COMMIT CONFIRMADO · SALIDA ABIERTA'
        : a07Missing
          ? '! A-07 · PUESTO VACÍO. CIERRE INICIADO.'
          : '● CONSOLA ACTIVA · REVISAR GUARDIAS',
      30,
      82
    )

    // Three shift rows
    const f07Ok =
      stageId === 'folio-19' ||
      stageId === 'folio-26' ||
      stageId === 'confirmed' ||
      stageId === 'ending'
    const f19Ok =
      stageId === 'folio-26' || stageId === 'confirmed' || stageId === 'ending'
    const f26Ok = stageId === 'confirmed' || stageId === 'ending'

    const rows = [
      { label: 'FOLIO 07  ·  A-07  ·  I. SALAS', ok: f07Ok },
      { label: 'FOLIO 19  ·  B-02  ·  M. ROJAS', ok: f19Ok },
      { label: 'FOLIO 26  ·  A-06  ·  TURNO ACTUAL', ok: f26Ok }
    ]

    ctx.font = '14px monospace'

    rows.forEach((row, index) => {
      const y = 132 + index * 38

      ctx.fillStyle = '#121d1a'
      ctx.fillRect(18, y - 20, w - 36, 30)
      ctx.fillStyle = row.ok ? '#8dde9c' : '#adb7ae'
      ctx.fillText(row.ok ? '✓' : '○', 28, y)
      ctx.fillStyle = row.ok ? '#f1ede2' : '#8a968e'
      ctx.fillText(row.label, 52, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = row.ok ? '#8dde9c' : '#e2ac65'
      ctx.fillText(row.ok ? 'RESTAURADO' : 'PENDIENTE', w - 28, y)
      ctx.textAlign = 'left'
    })

    // Footer prompt
    ctx.fillStyle = '#6f8076'
    ctx.font = '12px monospace'
    ctx.fillText('PULSA [E] PARA OPERAR LA CONSOLA', 18, h - 18)

    this.monitorTexture.needsUpdate = true
  }

  private drawWallClock(timeText: string, exitOpen: boolean): void {
    const ctx = this.clockCtx

    if (!ctx) return

    const w = this.clockCanvas.width
    const h = this.clockCanvas.height

    ctx.fillStyle = '#090b0a'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#242c29'
    ctx.lineWidth = 4
    ctx.strokeRect(4, 4, w - 8, h - 8)

    ctx.fillStyle = exitOpen ? '#8dde9c' : '#e05a47'
    ctx.shadowColor = exitOpen
      ? 'rgba(141, 222, 156, 0.7)'
      : 'rgba(224, 90, 71, 0.7)'
    ctx.shadowBlur = 12
    ctx.font = 'bold 54px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(timeText, w / 2, h / 2 + 2)
    ctx.shadowBlur = 0

    this.clockTexture.needsUpdate = true
  }
}
