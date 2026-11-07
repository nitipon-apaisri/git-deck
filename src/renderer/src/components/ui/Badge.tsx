import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps {
  /** `warning` is for states that need a second look, such as an archived repository. */
  tone?: 'neutral' | 'warning'
  children: ReactNode
}

/** A small word label. Always text, so the state never rests on colour alone. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-(--radius-xs) border px-2 text-[11.5px] leading-4.5 font-medium whitespace-nowrap',
        tone === 'warning'
          ? 'border-transparent bg-(--warning-bg) text-(--warning-text)'
          : 'border-border text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}
