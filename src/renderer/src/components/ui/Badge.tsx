import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const TONE = {
  neutral: 'border-border text-muted-foreground',
  warning: 'border-transparent bg-(--warning-bg) text-(--warning-text)',
  success: 'border-transparent bg-(--success-bg) text-(--success-text)',
  danger: 'border-transparent bg-(--danger-bg) text-(--danger-text)',
  merged: 'border-transparent bg-(--merged-bg) text-(--merged-text)'
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
        'inline-flex items-center gap-1 rounded-(--radius-xs) border px-2 text-[11.5px] leading-4.5 font-medium whitespace-nowrap',
        TONE[tone]
      )}
    >
      {children}
    </span>
  )
}
