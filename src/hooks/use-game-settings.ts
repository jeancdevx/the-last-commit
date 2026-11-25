import { useEffect, useState } from 'preact/hooks'

import { loadSettings, saveSettings } from '@/helpers/storage.helpers'
import type { GameSettings } from '@/types'

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  return [settings, setSettings] as const
}
