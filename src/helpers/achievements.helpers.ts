import type { GameProgress } from '@/types'
import { isRecord } from '@/utils'

export type AchievementId =
  | 'first_login'
  | 'cache_invalidation'
  | 'voice_from_past'
  | 'cctv_watcher'
  | 'git_archaeologist'
  | 'folio_07'
  | 'folio_19'
  | 'archivist'
  | 'true_ending'
  | 'force_push'

export type EndingId = 'true' | 'force' | 'loop'

export type ChapterId = 'prologue' | 'absence' | 'second_shift' | 'last_commit'

export interface AchievementSpec {
  id: AchievementId
  title: string
  description: string
  art: string
  secret?: boolean
}

export interface ChapterSpec {
  id: ChapterId
  kicker: string
  title: string
  time: string
  description: string
  buildProgress: () => GameProgress
}

export interface MetaProgress {
  achievements: AchievementId[]
  chapters: ChapterId[]
  endings: EndingId[]
  emailsRead: string[]
}

export const META_STORAGE_KEY = 'tlc_meta_v2'

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  {
    id: 'first_login',
    title: 'Turno de Nochebuena',
    description: 'Abrir la consola de cierre anual en el puesto A-06.',
    art: 'art/ach-terminal.jpg'
  },
  {
    id: 'cache_invalidation',
    title: 'Invalidación de caché',
    description: 'Un puesto que estaba ahí hace un momento ya no existe.',
    art: 'art/ach-vanished.jpg'
  },
  {
    id: 'voice_from_past',
    title: 'Mensaje en el buzón',
    description: 'Escuchar una grabación de una guardia anterior en el correo.',
    art: 'art/ach-terminal.jpg'
  },
  {
    id: 'cctv_watcher',
    title: 'Ojo en el circuito',
    description: 'Revisar las cámaras CCTV de la Planta 04.',
    art: 'art/ach-vanished.jpg'
  },
  {
    id: 'git_archaeologist',
    title: 'Arqueología de commits',
    description: 'Inspeccionar el historial en la terminal Git de A-06.',
    art: 'art/ach-terminal.jpg'
  },
  {
    id: 'folio_07',
    title: 'Archivo 2023',
    description: 'Devolver a I. Salas y el puesto A-07 a la planta.',
    art: 'art/ach-vanished.jpg'
  },
  {
    id: 'folio_19',
    title: 'Archivo 2025',
    description: 'Recuperar el turno de M. Rojas en el puesto B-02.',
    art: 'art/ach-tree.jpg'
  },
  {
    id: 'archivist',
    title: 'Archivista de Planta 04',
    description: 'Reunir las seis evidencias físicas de Nochebuena.',
    art: 'art/ach-tree.jpg'
  },
  {
    id: 'true_ending',
    title: 'La oficina te recuerda',
    description: 'Completar el Final I: restaurar los tres turnos y salir.',
    art: 'art/ach-exit.jpg'
  },
  {
    id: 'force_push',
    title: 'git push --force',
    description:
      'Completar el Final II: forzar el cierre dejando los turnos atrás.',
    art: 'art/ach-exit.jpg',
    secret: true
  }
]

export const CHAPTERS: readonly ChapterSpec[] = [
  {
    id: 'prologue',
    kicker: 'CAP. 01',
    title: 'Guardia de Nochebuena',
    time: '23:52',
    description: 'La noche desde el principio. A-06 y A-07 siguen encendidos.',
    buildProgress: () => ({
      panelRead: false,
      clues: [],
      a07Disappeared: false,
      a07AbsenceSeen: false,
      restored: { 'folio-07': false, 'folio-19': false, 'folio-26': false },
      commitConfirmed: false,
      exitUsed: false
    })
  },
  {
    id: 'absence',
    kicker: 'CAP. 02',
    title: 'La ausencia',
    time: '23:54',
    description: 'A-07 ha desaparecido. Solo queda la huella en la alfombra.',
    buildProgress: () => ({
      panelRead: true,
      clues: ['tag_07'],
      a07Disappeared: true,
      a07AbsenceSeen: true,
      restored: { 'folio-07': false, 'folio-19': false, 'folio-26': false },
      commitConfirmed: false,
      exitUsed: false
    })
  },
  {
    id: 'second_shift',
    kicker: 'CAP. 03',
    title: 'El segundo tramo',
    time: '23:57',
    description: 'A-07 ha vuelto. El árbol enciende las luces del folio 19.',
    buildProgress: () => ({
      panelRead: true,
      clues: ['tag_07', 'ledger_07'],
      a07Disappeared: true,
      a07AbsenceSeen: true,
      restored: { 'folio-07': true, 'folio-19': false, 'folio-26': false },
      commitConfirmed: false,
      exitUsed: false
    })
  },
  {
    id: 'last_commit',
    kicker: 'CAP. 04',
    title: 'El último commit',
    time: '23:59',
    description: 'B-02 figura otra vez. Solo queda recuperar tu propio turno.',
    buildProgress: () => ({
      panelRead: true,
      clues: ['tag_07', 'ledger_07', 'tag_19', 'ledger_19'],
      a07Disappeared: true,
      a07AbsenceSeen: true,
      restored: { 'folio-07': true, 'folio-19': true, 'folio-26': false },
      commitConfirmed: false,
      exitUsed: false
    })
  }
]

export function createDefaultMeta(): MetaProgress {
  return {
    achievements: [],
    chapters: ['prologue'],
    endings: [],
    emailsRead: []
  }
}

export function loadMetaProgress(): MetaProgress {
  const defaults = createDefaultMeta()

  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY)

    if (!raw) return defaults

    const parsed = JSON.parse(raw) as unknown

    if (!isRecord(parsed)) return defaults

    const validAchIds = new Set(ACHIEVEMENTS.map(item => item.id))
    const validChapIds = new Set(CHAPTERS.map(item => item.id))
    const validEndingIds = new Set<EndingId>(['true', 'force', 'loop'])

    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter(
          (id): id is AchievementId =>
            typeof id === 'string' && validAchIds.has(id as AchievementId)
        )
      : []

    const chapters: ChapterId[] = Array.isArray(parsed.chapters)
      ? parsed.chapters.filter(
          (id): id is ChapterId =>
            typeof id === 'string' && validChapIds.has(id as ChapterId)
        )
      : ['prologue']

    if (!chapters.includes('prologue')) {
      chapters.unshift('prologue')
    }

    const endings = Array.isArray(parsed.endings)
      ? parsed.endings.filter(
          (id): id is EndingId =>
            typeof id === 'string' && validEndingIds.has(id as EndingId)
        )
      : []

    const emailsRead = Array.isArray(parsed.emailsRead)
      ? parsed.emailsRead.filter((id): id is string => typeof id === 'string')
      : []

    return { achievements, chapters, endings, emailsRead }
  } catch {
    return defaults
  }
}

export function saveMetaProgress(meta: MetaProgress): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta))
  } catch {
    // Ignore storage quota errors
  }
}
