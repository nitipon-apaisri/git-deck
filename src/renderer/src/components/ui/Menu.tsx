import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

export type MenuEntry =
  | {
      kind: 'item'
      id: string
      label: string
      /** A glyph or tile before the label. */
      leading?: ReactNode
      /** A count or hint after it. */
      trailing?: ReactNode
      /** Set for a checkable item: it is then a `menuitemcheckbox`. */
      checked?: boolean
      /** With `checked`: one choice out of several, so a `menuitemradio`. */
      radio?: boolean
      /** Several toggles in a row: the menu stays open after this one. */
      keepOpen?: boolean
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { kind: 'separator'; id: string }
  | { kind: 'heading'; id: string; label: string }

interface MenuProps {
  /** Names the menu for screen readers. */
  label: string
  /** Where the top-left corner goes, in viewport pixels. It is moved to stay on screen. */
  at: { x: number; y: number }
  entries: readonly MenuEntry[]
  /** At least this wide, for a menu that hangs under a button. */
  minWidth?: number
  onClose: () => void
}

const itemClass =
  'flex min-h-[30px] cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] data-[highlighted]:bg-accent data-[disabled]:cursor-default data-[disabled]:text-muted-foreground data-[disabled]:data-[highlighted]:bg-transparent'

/**
 * shadcn's dropdown menu on Radix, opened at a point: arrow keys, Home and End move, Enter and
 * Space choose, Escape and Tab close, and a click outside closes. Mount it to open it, unmount
 * it to close it. Focus goes back to the opener when it goes. It renders into `document.body`,
 * so the island it was opened from does not clip it.
 */
export function Menu({ label, at, entries, minWidth, onClose }: MenuProps) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  const [opener] = useState(() => document.activeElement)
  const content = useRef<HTMLDivElement>(null)
  // Radix's menu content takes `onOpenAutoFocus`, but the dropdown wrapper's types leave it out.
  // The first item gets focus, so Enter chooses it at once (Radix would focus the menu itself).
  const openAutoFocus = {
    onOpenAutoFocus: (event: Event) => {
      const first = content.current?.querySelector<HTMLElement>(
        '[role^="menuitem"]:not([data-disabled])'
      )
      if (!first) return
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    const close = (): void => closeRef.current()
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [])

  return (
    <DropdownMenu.Root open modal={false} onOpenChange={(open) => !open && onClose()}>
      {/* Radix positions against a trigger: an empty box at the requested point stands in. */}
      <DropdownMenu.Trigger asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed size-0"
          style={{ left: at.x, top: at.y }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          ref={content}
          aria-label={label}
          side="bottom"
          align="start"
          sideOffset={0}
          collisionPadding={8}
          loop
          style={minWidth ? { minWidth } : undefined}
          className="animate-in fade-in-0 zoom-in-[0.97] z-50 flex max-h-[min(var(--radix-dropdown-menu-content-available-height),calc(100vh-16px))] min-w-[220px] max-w-[320px] origin-[var(--radix-dropdown-menu-content-transform-origin)] flex-col overflow-y-auto rounded-lg bg-popover p-1.5 text-[13px] text-popover-foreground shadow-[var(--shadow-menu)] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
          {...openAutoFocus}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
          }}
          onKeyDown={(event: KeyboardEvent) => {
            // Tab leaves a menu: close it rather than let focus wander.
            if (event.key === 'Tab') onClose()
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {entries.map((entry) => {
            if (entry.kind === 'separator') {
              return (
                <DropdownMenu.Separator key={entry.id} className="-mx-1.5 my-1.5 h-px bg-border" />
              )
            }
            if (entry.kind === 'heading') {
              return (
                <DropdownMenu.Label
                  key={entry.id}
                  className="px-2.5 pt-1.5 pb-1 text-[12px] text-muted-foreground"
                >
                  {entry.label}
                </DropdownMenu.Label>
              )
            }
            const content = (
              <>
                {entry.leading}
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.trailing ? (
                  <span className="flex-none text-[12px] text-muted-foreground">
                    {entry.trailing}
                  </span>
                ) : null}
              </>
            )
            const onSelect = (event: Event): void => {
              if (entry.keepOpen) event.preventDefault()
              entry.onSelect()
            }
            const className = cn(itemClass, entry.danger && 'text-destructive')
            if (entry.checked === undefined) {
              return (
                <DropdownMenu.Item
                  key={entry.id}
                  disabled={entry.disabled}
                  className={className}
                  onSelect={onSelect}
                >
                  {content}
                </DropdownMenu.Item>
              )
            }
            return (
              <DropdownMenu.CheckboxItem
                key={entry.id}
                role={entry.radio ? 'menuitemradio' : 'menuitemcheckbox'}
                checked={entry.checked}
                disabled={entry.disabled}
                className={className}
                onSelect={onSelect}
              >
                <span
                  className="grid w-3.5 flex-none place-items-center text-[var(--accent-text)]"
                  aria-hidden="true"
                >
                  {entry.checked ? <Icon name="check" size="sm" /> : null}
                </span>
                {content}
              </DropdownMenu.CheckboxItem>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
