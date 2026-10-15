import { Tabs as TabsPrimitive } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn('flex items-center gap-0.5', className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'cursor-pointer rounded-xl px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-accent-foreground',
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
