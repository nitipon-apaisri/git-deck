import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90',
        outline: 'border border-border-strong bg-background shadow-xs hover:border-primary hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5',
        icon: 'size-8'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }): React.JSX.Element {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
