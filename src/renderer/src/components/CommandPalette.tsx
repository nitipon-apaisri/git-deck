import { useDeferredValue, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import {
  buildPaletteItems,
  filterPaletteItems,
  type PaletteInput,
  type PaneCommands
} from '../lib/paletteItems'
import { cn } from '../lib/cn'
import { Modal } from './ui/Dialog'
import { TextInput } from './ui/Field'

interface CommandPaletteProps extends Omit<PaletteInput, 'pane' | 'tags'> {
  /** The pane that had focus when the palette opened. */
  pane: PaneCommands | null
  onClose: () => void
}

/** Mod+Shift+P: type to filter, arrows move, Enter runs, Escape closes. */
export function CommandPalette({
  pane,
  onClose,
  repos,
  openRepo,
  openSettings,
  switchTheme,
  themeLabel
}: CommandPaletteProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [tags, setTags] = useState<PaletteInput['tags']>([])
  const deferred = useDeferredValue(query)

  useEffect(() => {
    if (!pane?.linked) return
    let cancelled = false
    pane
      .loadTags()
      .then((loaded) => !cancelled && setTags(loaded))
      .catch(() => undefined) // no tags is a fine answer; the rest of the palette still works
    return () => {
      cancelled = true
    }
  }, [pane])

  // The callbacks come from the opener at open time, so the list builds again only for tags.
  const items = useMemo(
    () => buildPaletteItems({ repos, pane, tags, openRepo, openSettings, switchTheme, themeLabel }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repos, pane, tags, themeLabel]
  )
  const shown = useMemo(() => filterPaletteItems(items, deferred), [items, deferred])
  const active = Math.min(index, shown.length - 1)

  function run(at: number): void {
    const item = shown[at]
    if (!item) return
    onClose() // first, so focus is back in the pane before the action runs
    item.run()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setIndex((active + step + shown.length) % Math.max(shown.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(active)
    }
  }

  return (
    <Modal onClose={onClose} label="Command palette" className="w-140">
      <div className="p-3">
        <TextInput
          data-autofocus
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-activedescendant={shown.length > 0 ? `${id}-${active}` : undefined}
          aria-label="Type a command, repository, branch or tag"
          placeholder="Type a command, repository, branch or tag"
          className="w-full"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Results"
        className="m-0 max-h-80 list-none overflow-y-auto px-1.5 pb-1.5"
      >
        {shown.map((item, at) => (
          <li
            key={item.id}
            id={`${id}-${at}`}
            role="option"
            aria-selected={at === active}
            ref={(el) => {
              if (at === active) el?.scrollIntoView({ block: 'nearest' })
            }}
            onMouseMove={() => setIndex(at)}
            onClick={() => run(at)}
            className={cn(
              'flex min-h-7.5 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 text-[13px]',
              'aria-selected:bg-(--selection) aria-selected:font-medium'
            )}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            {item.hint ? (
              <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p
        aria-live="polite"
        className={cn(
          'm-0 px-4 pb-3 text-[13px] text-muted-foreground',
          shown.length > 0 && 'sr-only'
        )}
      >
        {shown.length === 0 ? 'Nothing matches.' : ''}
      </p>
    </Modal>
  )
}
