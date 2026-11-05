import type { KeyboardEvent, ReactNode } from 'react'
import styles from './Tabs.module.css'

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

/** Tab strip. The consumer renders the panel with `tabId` and `panelId` on it. */
export function Tabs({ tabs, value, onChange, label, idPrefix, trailing }: TabsProps) {
  function targetIndex(key: string, index: number): number | null {
    if (key === 'ArrowRight') return (index + 1) % tabs.length
    if (key === 'ArrowLeft') return (index - 1 + tabs.length) % tabs.length
    if (key === 'Home') return 0
    if (key === 'End') return tabs.length - 1
    return null
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const next = targetIndex(
      event.key,
      tabs.findIndex((t) => t.id === value)
    )
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    document.getElementById(tabId(idPrefix, tabs[next].id))?.focus()
  }

  return (
    <div className={styles.bar}>
      <div className={styles.strip} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(idPrefix, tab.id)}
              aria-selected={selected}
              aria-controls={panelId(idPrefix, tab.id)}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {trailing}
    </div>
  )
}
