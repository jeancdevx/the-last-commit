import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

const EVIDENCE_DIR = resolve('evidence')

mkdirSync(EVIDENCE_DIR, { recursive: true })

test.describe('The Last Commit · Full E2E QA', () => {
  test('Milestone 1 & 2: A-07 before/after, full 3-folio investigation, reload persistence and ending', async ({
    page
  }) => {
    test.setTimeout(180_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })
    page.on('response', res => {
      if (res.status() >= 400) {
        failedRequests.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto('/')

    // Verify Spanish menu & editorial cover art
    await expect(
      page.getByRole('heading', { name: 'The Last Commit' })
    ).toBeAttached()
    await expect(
      page.getByText(
        'El sistema dice que la oficina está vacía. Tú sigues dentro.'
      )
    ).toBeVisible()
    const coverLoaded = await page.evaluate(() => {
      const img = document.querySelector(
        'img[src*="cover.webp"]'
      ) as HTMLImageElement | null

      return Boolean(img && img.complete && img.naturalWidth > 0)
    })

    expect(coverLoaded).toBe(true)

    // Wait for live 3D title scene to finish loading and show editorial menu
    const playButton = page.getByRole('button', { name: /Jugar/i })

    await expect(playButton).toBeVisible({ timeout: 25_000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'title-live.png') })

    // Start new game
    await playButton.click()

    await page.waitForFunction(
      () => window.__TLC_QA__?.getPhase() === 'playing',
      undefined,
      { timeout: 25_000 }
    )

    // Snap cleanly to spawn for crisp before screenshot
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook([-0.8, 1.65, 4.75], [1.55, 1.14, 2.0])
    })

    // Verify all 9 GLBs and 10 instances loaded with WebGL 2
    const initialDiag = await page.evaluate(() =>
      window.__TLC_QA__?.getDiagnostics()
    )

    expect(initialDiag?.webgl2).toBe(true)
    expect(initialDiag?.loadedModels).toBe(9)
    expect(initialDiag?.instanceCount).toBe(10)
    expect(initialDiag?.worldFlags.stationA07Visible).toBe(true)
    expect(initialDiag?.worldFlags.traceA07Visible).toBe(false)

    // Render and capture BEFORE screenshot of A-07 from spawn
    await page.evaluate(() => window.__TLC_QA__?.renderFrame())
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'a07-before.png') })

    // Verify WASD movement actually moves the player in 3D space
    const posBeforeMove = await page.evaluate(
      () => window.__TLC_QA__?.getDiagnostics()?.playerPosition
    )

    await page.keyboard.down('KeyW')
    await page.waitForFunction(
      initial => {
        const pos = window.__TLC_QA__?.getDiagnostics()?.playerPosition

        if (!pos) {
          return false
        }

        return (
          Math.abs(pos[0] - initial[0]) > 0.05 ||
          Math.abs(pos[2] - initial[2]) > 0.05
        )
      },
      posBeforeMove!,
      { timeout: 8_000 }
    )
    await page.keyboard.up('KeyW')

    const posAfterMove = await page.evaluate(
      () => window.__TLC_QA__?.getDiagnostics()?.playerPosition
    )

    expect(posAfterMove).not.toEqual(posBeforeMove)

    // Open A-06 panel via real raycast + KeyE
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-2.58, 1.65, 2.75],
        [-2.58, 1.09, 1.71]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await expect(
      page.getByText('A-07 · Puesto vacío. Cierre iniciado.')
    ).toBeVisible()
    await expect(page.getByText('[Tintineo tenue en recepción]')).toBeVisible()

    // Close panel with Escape
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('heading', { name: 'Consola de cierre anual' })
    ).toBeHidden()

    // Move to reception tree (beyond z <= -7.55 gate) and inspect TAG_FACE_07
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [1.22, 1.65, -9.2],
        [1.22, 1.26, -10.26]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await expect(
      page.getByRole('heading', { name: 'Adorno · Folio 07' })
    ).toBeVisible()
    await expect(
      page.getByText('I. Salas · 24 DIC 2023 · Folio 07')
    ).toBeVisible()

    // Close clue reader -> triggers off-screen A-07 disappearance once
    await page.keyboard.press('Escape')

    const afterVanishDiag = await page.evaluate(() =>
      window.__TLC_QA__?.getDiagnostics()
    )

    expect(afterVanishDiag?.worldFlags.stationA07Visible).toBe(false)
    expect(afterVanishDiag?.worldFlags.traceA07Visible).toBe(true)
    expect(afterVanishDiag?.worldFlags.a07AudioActive).toBe(false)
    await expect(
      page.getByText('[Se apaga el fluorescente del A-07]')
    ).toBeVisible()

    // Return to spawn looking at A-07 -> marks absence seen & capture AFTER screenshot
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook([-0.8, 1.65, 4.75], [1.55, 1.14, 2.0])
      window.__TLC_QA__?.renderFrame()
    })
    await page.waitForTimeout(300)
    await expect(
      page.getByText('La lámpara estaba encendida hace un momento.')
    ).toBeVisible()
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'a07-after.png') })

    // Inspect reception ledger and save both Folio 07 and Folio 19
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-1.86, 1.65, -7.8],
        [-1.86, 1.11, -8.57]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await expect(
      page.getByRole('heading', { name: 'Bitácora de Nochebuena' })
    ).toBeVisible()
    await page
      .getByRole('button', { name: /Guardar Bitácora · Folio 07/i })
      .click()
    await page.getByRole('tab', { name: /Folio 19/i }).click()
    await page
      .getByRole('button', { name: /Guardar Bitácora · Folio 19/i })
      .click()
    await page.keyboard.press('Escape')

    // Return to A-06 panel -> test wrong answer hint, then solve Folio 07
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-2.58, 1.65, 2.75],
        [-2.58, 1.09, 1.71]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await page.getByLabel('24/12/2023 · 00:10').check()
    await page.getByRole('button', { name: 'Validar folio 07' }).click()
    await expect(
      page.getByText(/El turno empezó antes de medianoche/i)
    ).toBeVisible()

    // Check Corporate OS apps: Mail (ElevenLabs voicemail + transcript), Chat (#planta-04), Terminal Git, and 3-cam CCTV
    await page.getByRole('button', { name: /Correo/i }).click()
    await page.getByRole('button', { name: /I\. Salas/i }).click()
    await expect(
      page.getByRole('button', { name: /Escuchar nota de voz/i })
    ).toBeVisible()
    await expect(
      page.getByText(/El cierre acaba de borrar mi turno/i)
    ).toBeVisible()
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'console-mail.png') })

    await page.getByRole('button', { name: /Chat #planta-04/i }).click()
    await expect(page.getByText(/Acaba de apagarse mi lámpara/i)).toBeVisible()

    await page.getByRole('button', { name: /Terminal Git/i }).click()
    await page.getByRole('button', { name: 'git status' }).click()
    await expect(page.getByText(/ELIMINADO DEL PLANO/i)).toBeVisible()

    await page.getByRole('button', { name: /Cámaras CCTV/i }).click()
    await expect(page.getByText(/ALERTA · ANOMALÍA EN A-07/i)).toBeVisible()
    await expect(page.getByText(/CAM-03/i)).toBeVisible()
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'console-cctv.png') })
    await page.getByRole('button', { name: 'Cierre anual' }).click()

    await page.getByLabel('25/12/2023 · 00:10').check()
    await page.getByRole('button', { name: 'Validar folio 07' }).click()
    await expect(
      page
        .getByText('Folio 07 restaurado. I. Salas figura otra vez en A-07.')
        .first()
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Verify A-07 restored and Tag 19 now visible
    const after07 = await page.evaluate(() =>
      window.__TLC_QA__?.getDiagnostics()
    )

    expect(after07?.worldFlags.stationA07Visible).toBe(true)
    expect(after07?.worldFlags.tag19Visible).toBe(true)

    // Inspect Tag 19 on tree
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [1.72, 1.65, -9.3],
        [1.72, 1.56, -10.42]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')
    await expect(
      page.getByRole('heading', { name: 'Adorno · Folio 19' })
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Solve Folio 19 on A-06 panel
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-2.58, 1.65, 2.75],
        [-2.58, 1.09, 1.71]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await page.getByRole('tab', { name: /Folio 19/i }).click()
    await page.getByLabel('Folio 19 · B-02 · 25/12/2025 · 00:20').check()
    await page.getByRole('button', { name: 'Validar folio 19' }).click()
    await expect(
      page
        .getByText('Folio 19 restaurado. B-02 vuelve a figurar en la planta.')
        .first()
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Verify B-02 and Tag 26 visible
    const after19 = await page.evaluate(() =>
      window.__TLC_QA__?.getDiagnostics()
    )

    expect(after19?.worldFlags.stationB02Visible).toBe(true)
    expect(after19?.worldFlags.tag26Visible).toBe(true)

    // Inspect Tag 26 on tree
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [1.34, 1.65, -9.4],
        [1.34, 1.79, -10.55]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')
    await expect(
      page.getByRole('heading', { name: 'Adorno · Folio 26' })
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Inspect current note on A-06 desk
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-3.01, 1.65, 2.55],
        [-3.01, 0.79, 2.0]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')
    await expect(
      page.getByRole('heading', { name: 'Nota del turno actual' })
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Solve Folio 26 and Confirm restoration on A-06 panel
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook(
        [-2.58, 1.65, 2.75],
        [-2.58, 1.09, 1.71]
      )
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await page.getByRole('tab', { name: /Folio 26/i }).click()
    await page.getByLabel('Folio 26 · A-06 · 25/12/2026 · 00:15').check()
    await page.getByRole('button', { name: 'Validar folio 26' }).click()
    await expect(
      page
        .getByText('Folio 26 recuperado. Queda confirmar la restauración.')
        .first()
    ).toBeVisible()

    await page.getByRole('button', { name: 'Confirmar restauración' }).click()
    await expect(
      page.getByText(/Commit confirmado\. Tres guardias conservadas\./i).first()
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Reload browser and verify Continue preserves open door state
    await page.reload()
    const continueBtn = page.getByRole('button', { name: /Continuar/i })

    await expect(continueBtn).toBeVisible({ timeout: 25_000 })
    await continueBtn.click()

    await page.waitForFunction(
      () => window.__TLC_QA__?.getPhase() === 'playing',
      undefined,
      { timeout: 25_000 }
    )

    const afterReload = await page.evaluate(() =>
      window.__TLC_QA__?.getDiagnostics()
    )

    expect(afterReload?.worldFlags.exitOpen).toBe(true)

    // Interact with open exit door -> Ending
    await page.evaluate(() => {
      window.__TLC_QA__?.teleportAndLook([0, 1.65, -11.9], [-0.4, 1.1, -13.1])
    })
    await page.waitForTimeout(120)
    await page.keyboard.press('KeyE')

    await expect(
      page.getByText('La oficina ya sabe que estuviste aquí.')
    ).toBeVisible()
    await expect(
      page.getByText('Tres guardias de Nochebuena conservadas.')
    ).toBeVisible()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'ending.png') })

    // Verify Return to Menu -> Achievements gallery & Chapters unlocked
    await page.getByRole('button', { name: 'Volver al menú' }).click()
    await expect(page.getByRole('button', { name: /Logros/i })).toBeVisible()
    await page.getByRole('button', { name: /Logros/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Logros descubiertos' })
    ).toBeVisible()
    await expect(page.getByText('La oficina te recuerda')).toBeVisible()
    await page.waitForTimeout(200)
    await page.screenshot({ path: resolve(EVIDENCE_DIR, 'achievements.png') })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /Capítulos/i }).click()
    await expect(page.getByText('El último commit')).toBeVisible()

    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })

  test('Milestone 3: nested Escape, mute controls, corrupt save recovery, WebGL fallback, and diagnostics', async ({
    page
  }) => {
    test.setTimeout(120_000)

    const failedRequests: string[] = []

    page.on('response', res => {
      if (res.status() >= 400) {
        failedRequests.push(`${res.status()} ${res.url()}`)
      }
    })

    // 1. Corrupt save recovery
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.setItem('tlc_save_v1', '{corrupt-json')
    })
    await page.reload()

    await expect(page.getByText('Partida guardada dañada')).toBeVisible()
    await page.getByRole('button', { name: 'Descartar datos dañados' }).click()
    await expect(page.getByText('Partida guardada dañada')).toBeHidden()

    // 2. WebGL 2 failure fallback UI
    await page.goto('/?forceWebglError=1')
    const playFallback = page.getByRole('button', { name: /Jugar/i })

    await expect(playFallback).toBeVisible({ timeout: 15_000 })
    await playFallback.click()
    await expect(
      page.getByRole('heading', { name: 'No se pudo iniciar la escena 3D' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Volver al menú' }).click()

    // 3. Nested Escape & Mute control
    await page.goto('/')
    const playBtn2 = page.getByRole('button', { name: /Jugar/i })

    await expect(playBtn2).toBeVisible({ timeout: 25_000 })
    await playBtn2.click()
    await page.waitForFunction(
      () => window.__TLC_QA__?.getPhase() === 'playing',
      undefined,
      { timeout: 25_000 }
    )

    await page.getByRole('button', { name: 'Silenciar audio' }).click()
    await expect(
      page.getByRole('button', { name: 'Activar audio' })
    ).toBeVisible()

    // Playing -> Esc (Pause) -> Settings -> Esc (Pause) -> Esc (Playing)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible()

    await page.getByRole('button', { name: 'Ajustes' }).click()
    await expect(
      page.getByRole('heading', { name: 'Ajustes y accesibilidad' })
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Pausa' })).toBeHidden()

    // 4. Diagnostics route
    await page.goto('/diagnostico/')
    await expect(
      page.getByText('Diagnóstico completado correctamente.')
    ).toBeVisible({ timeout: 25_000 })
    await expect(page.getByText('✓ Disponible')).toBeVisible()

    expect(failedRequests).toEqual([])
  })
})
