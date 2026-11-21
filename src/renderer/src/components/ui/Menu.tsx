import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
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
  | {
      /** An item that opens a nested menu on hover, Right arrow or Enter. */
      kind: 'submenu'
      id: string
      label: string
      leading?: ReactNode
      /** A count or hint before the chevron. */
      trailing?: ReactNode
      disabled?: boolean
      entries: readonly MenuEntry[]
    }

interface MenuProps {
  /** Names the menu for screen readers. */
  label: string
  /** Where the top-left corner goes, in viewport pixels. It is moved to stay on screen. */
  at: { x: number; y: number }
  entries: readonly MenuEntry[]
  /** At least this wide, for a menu that hangs under a button. */
  minWidth?: number
  /** A filter box on top that narrows the items by label, for a long list. */
  searchable?: boolean
  /** Entries kept at the bottom while the list scrolls; the filter leaves them be. */
  pinned?: readonly MenuEntry[]
  onClose: () => void
}

/** Keeps the entries whose label has `query` (looking inside submenus), with the heading of each group that still has any. */
function filterEntries(entries: readonly MenuEntry[], query: string): readonly MenuEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  const out: MenuEntry[] = []
  let heading: MenuEntry | null = null
  for (const entry of entries) {
    if (entry.kind === 'separator') continue
    if (entry.kind === 'heading') {
      heading = entry
      continue
    }
    let kept: MenuEntry = entry
    if (!entry.label.toLowerCase().includes(needle)) {
      // A submenu whose own label misses stays if something inside matches, narrowed to that.
      if (entry.kind !== 'submenu') continue
      const inside = filterEntries(entry.entries, query)
      if (inside.length === 0) continue
      kept = { ...entry, entries: inside }
    }
    if (heading) out.push(heading)
    heading = null
    out.push(kept)
  }
  return out
}

const itemClass =
  'flex min-h-7.5 cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left transition-[background-color,color] duration-(--motion-fast) ease-(--ease-out) data-[highlighted]:bg-accent data-[disabled]:cursor-default data-[disabled]:text-muted-foreground data-[disabled]:data-[highlighted]:bg-transparent'

const subContentClass =
  'animate-in fade-in-0 z-50 flex max-h-(--radix-dropdown-menu-content-available-height) min-w-50 max-w-95 origin-(--radix-dropdown-menu-content-transform-origin) flex-col overflow-y-auto rounded-lg bg-popover p-1.5 text-[13px] text-popover-foreground shadow-(--shadow-menu) duration-(--motion-fast) ease-(--ease-out)'

function renderEntries(entries: readonly MenuEntry[]): ReactNode {
  return entries.map((entry) => {
    if (entry.kind === 'separator') {
      return <DropdownMenu.Separator key={entry.id} className="-mx-1.5 my-1.5 h-px bg-border" />
    }
    if (entry.kind === 'submenu') {
      return (
        <DropdownMenu.Sub key={entry.id}>
          <DropdownMenu.SubTrigger disabled={entry.disabled} className={itemClass}>
            {entry.leading}
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.trailing ? (
              <span className="flex-none text-[12px] text-muted-foreground">{entry.trailing}</span>
            ) : null}
            <Icon name="chevron-right" size="sm" />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent
              aria-label={entry.label}
              sideOffset={4}
              collisionPadding={8}
              loop
              className={subContentClass}
            >
              {renderEntries(entry.entries)}
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      )
    }
    if (entry.kind === 'heading') {
      return (
        <DropdownMenu.Label
          key={entry.id}
          title={entry.label}
          className="truncate px-2.5 pt-1.5 pb-1 text-[12px] text-muted-foreground"
        >
          {entry.label}
        </DropdownMenu.Label>
      )
    }
    const itemContent = (
      <>
        {entry.leading}
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
        {entry.trailing ? (
          <span className="flex-none text-[12px] text-muted-foreground">{entry.trailing}</span>
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
          title={entry.label}
          className={className}
          onSelect={onSelect}
        >
          {itemContent}
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
          className="grid w-3.5 flex-none place-items-center text-(--accent-text)"
          aria-hidden="true"
        >
          {entry.checked ? <Icon name="check" size="sm" /> : null}
        </span>
        {itemContent}
      </DropdownMenu.CheckboxItem>
    )
  })
}

/**
 * shadcn's dropdown menu on Radix, opened at a point: arrow keys, Home and End move, Enter and
 * Space choose, Escape and Tab close, and a click outside closes. Mount it to open it, unmount
 * it to close it. Focus goes back to the opener when it goes. It renders into `document.body`,
 * so the island it was opened from does not clip it.
 */
export function Menu({ label, at, entries, minWidth, searchable, pinned, onClose }: MenuProps) {
  const [query, setQuery] = useState('')
  // The input stays instant; the list catches up when React is idle.
  const deferredQuery = useDeferredValue(query)
  const shown = useMemo(
    () => (searchable ? filterEntries(entries, deferredQuery) : entries),
    [searchable, entries, deferredQuery]
  )
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
        searchable ? 'input' : '[role^="menuitem"]:not([data-disabled])'
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
          className="animate-in fade-in-0 zoom-in-[0.97] z-50 flex max-h-[min(var(--radix-dropdown-menu-content-available-height),calc(100vh-16px),26rem)] min-w-55 max-w-95 origin-(--radix-dropdown-menu-content-transform-origin) flex-col overflow-y-auto rounded-lg bg-popover p-1.5 text-[13px] text-popover-foreground shadow-(--shadow-menu) duration-(--motion-fast) ease-(--ease-out)"
          {...openAutoFocus}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Not if something else took focus meanwhile: a dialog this menu opened has it now.
            if (document.activeElement !== document.body) return
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
          }}
          onKeyDown={(event: KeyboardEvent) => {
            // Tab leaves a menu: close it rather than let focus wander.
            if (event.key === 'Tab') onClose()
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {searchable ? (
            <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 border-b border-border bg-popover px-1.5 pt-1.5 pb-1.5">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search…"
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-8 w-full rounded-md border border-transparent bg-muted px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-(--accent-text)"
                onKeyDown={(event) => {
                  // Typing must not reach Radix's typeahead; only Esc and Tab keep their meaning.
                  if (event.key === 'Escape' || event.key === 'Tab') return
                  event.stopPropagation()
                  if (event.key !== 'ArrowDown') return
                  event.preventDefault()
                  content.current
                    ?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
                    ?.focus()
                }}
              />
            </div>
          ) : null}
          {renderEntries(shown)}
          {searchable && shown.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No match</p>
          ) : null}
          {pinned?.length ? (
            <div className="sticky -bottom-1.5 z-10 -mx-1.5 -mb-1.5 mt-1 border-t border-border bg-popover p-1.5">
              {renderEntries(pinned)}
            </div>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
