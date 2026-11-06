import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

interface SkeletonProps {
  /** CSS width, for example `120` (px) or `'60%'`. Defaults to the full width. */
  width?: number | string
  /** CSS height in px. Defaults to a line of text. */
  height?: number
  /** Round: an avatar or a dot. */
  circle?: boolean
  /**
   * Set on the first skeleton of a group so a screen reader hears that something is
   * loading. The rest stay hidden.
   */
  label?: string
  className?: string
}

/** A grey placeholder in the shape of what is loading. It pulses, or sits still when motion is reduced. */
export function Skeleton({ width, height = 14, circle = false, label, className }: SkeletonProps) {
  const style: CSSProperties = { width, height }
  return (
    <span
      className={cn(
        'block max-w-full animate-skeleton bg-border motion-reduce:animate-none',
        circle ? 'rounded-full' : 'rounded-sm',
        className
      )}
      style={style}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
