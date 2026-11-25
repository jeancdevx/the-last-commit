import type { AchievementSpec } from '@/helpers/achievements.helpers'
import { assetUrl } from '@/helpers/assets.helpers'

export interface AchievementToastProps {
  achievement: AchievementSpec
}

export default function AchievementToast({
  achievement
}: AchievementToastProps) {
  return (
    <output
      aria-live='polite'
      class='pointer-events-none fixed top-6 left-1/2 z-50 flex w-[min(390px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3.5 rounded border border-tlc-amber/60 bg-[#0d1412]/95 p-2.5 pr-4 shadow-[0_12px_36px_rgba(0,0,0,0.88)] backdrop-blur-sm'
    >
      <div class='h-12 w-12 shrink-0 overflow-hidden rounded-xs border border-tlc-text/15 bg-black'>
        <img
          src={assetUrl(achievement.art)}
          alt=''
          aria-hidden='true'
          class='h-full w-full object-cover'
        />
      </div>
      <div class='min-w-0 flex-1'>
        <p class='font-console text-[10px] tracking-[0.2em] text-tlc-amber uppercase'>
          Logro desbloqueado
        </p>
        <p class='truncate font-serif text-lg leading-tight text-tlc-text'>
          {achievement.title}
        </p>
        <p class='truncate text-xs text-tlc-secondary'>
          {achievement.description}
        </p>
      </div>
    </output>
  )
}
