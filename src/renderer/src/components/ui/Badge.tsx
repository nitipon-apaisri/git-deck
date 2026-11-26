import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const TONE = {
  neutral: 'bg-secondary text-muted-foreground',
  warning: 'bg-(--warning-bg) text-(--warning-text)',
  success: 'bg-(--success-bg) text-(--success-text)',
  danger: 'bg-(--danger-bg) text-(--danger-text)',
  merged: 'bg-(--merged-bg) text-(--merged-text)'
} as const

interface BadgeProps {
  /** `warning` is for states that need a second look, such as an archived repository. */
  tone?: keyof typeof TONE
  children: ReactNode
}

/** A small word label. Always text, so the state never rests on colour alone. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-(--radius-xs) px-2 text-[11.5px] leading-4.5 font-medium whitespace-nowrap',
        TONE[tone]
      )}
    >
      {children}
    </span>
  )
}
