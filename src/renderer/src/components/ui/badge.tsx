import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center rounded-full px-1.5 text-[10px] leading-4 whitespace-nowrap', {
  variants: {
    variant: {
      default: 'bg-accent text-accent-foreground',
      outline: 'border border-border-strong text-muted-foreground'
    }
  },
  defaultVariants: { variant: 'outline' }
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>): React.JSX.Element {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
