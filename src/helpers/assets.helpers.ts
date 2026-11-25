import type {
  AudioManifest,
  ManifestBundle,
  SceneManifest,
  StoryManifest
} from '@/types'

export function getBaseUrl(): string {
  const raw = import.meta.env.BASE_URL || '/'

  return raw.endsWith('/') ? raw : `${raw}/`
}

export function withBase(path: string): string {
  const clean = path.replace(/^\/+/, '')

  return `${getBaseUrl()}${clean}`
}

export function assetUrl(relativeToAssets: string): string {
  const clean = relativeToAssets.replace(/^\/+/, '')

  return withBase(`assets/${clean}`)
}

export function audioUrl(relativeToAudio: string): string {
  const clean = relativeToAudio.replace(/^\/+/, '')

  return withBase(`assets/audio/${clean}`)
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${label} (${response.status})`)
  }

  return (await response.json()) as T
}

export async function loadManifests(): Promise<ManifestBundle> {
  const [scene, story, audio] = await Promise.all([
    fetchJson<SceneManifest>(assetUrl('scene.json'), 'scene.json'),
    fetchJson<StoryManifest>(assetUrl('story.es.json'), 'story.es.json'),
    fetchJson<AudioManifest>(
      assetUrl('audio/manifest.json'),
      'audio/manifest.json'
    )
  ])

  return { scene, story, audio }
}
