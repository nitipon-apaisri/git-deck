import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

export interface TabItem {
  id: string
  label: string
}

export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`
export const panelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`

interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  label: string
  /** Unique per instance (use `useId`), so two panes never share element ids. */
  idPrefix: string
  /** Shown at the right end of the strip, for example a status and a reload button. */
  trailing?: ReactNode
}

/**
 * shadcn's tabs on Radix, as a strip only: the consumer renders the panel and puts `tabId` and
 * `panelId` on it. Arrow keys, Home and End move and select, as before.
 */
export function Tabs({ tabs, value, onChange, label, idPrefix, trailing }: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onChange}
      className="flex items-end justify-between gap-3 border-b border-border"
    >
      <TabsPrimitive.List aria-label={label} className="flex gap-1">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            id={tabId(idPrefix, tab.id)}
            aria-controls={panelId(idPrefix, tab.id)}
            className="relative h-9 cursor-pointer rounded-t-sm border-0 bg-transparent px-3 text-[13px] font-medium text-muted-foreground transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-accent hover:text-foreground data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-[1px] data-[state=active]:after:bg-[var(--accent)] data-[state=active]:after:content-['']"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {trailing}
    </TabsPrimitive.Root>
  )
}
