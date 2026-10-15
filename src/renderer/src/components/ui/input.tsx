import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-border-strong bg-background px-2.5 text-[13px] text-foreground transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export { Input }
