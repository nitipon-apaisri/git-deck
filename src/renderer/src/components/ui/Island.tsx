import type { HTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/cn'

interface IslandProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>
  as?: 'div' | 'aside' | 'main' | 'section'
  /** Adds the `space-5` padding. Lists that run edge to edge leave it off. */
  padded?: boolean
}

/** The panel that holds a working area. One level only: never inside another island. */
export function Island({
  as: Tag = 'div',
  padded = false,
  ref,
  className,
  children,
  ...rest
}: IslandProps) {
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-(--shadow-island)',
        padded && 'p-4',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
