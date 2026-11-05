import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import styles from './Menu.module.css'

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

const MARGIN = 8

/**
 * A menu at a point. Arrow keys, Home and End move, Enter and Space choose, Escape and
 * Tab close, and a click outside closes. Focus goes to the first item and back to the
 * opener when the menu goes. It renders into `document.body`, so it is not clipped by the
 * island it was opened from. It must not be opened from inside a modal dialog.
 */
export function Menu({ label, at, entries, minWidth, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  const [position, setPosition] = useState<CSSProperties>({ left: at.x, top: at.y })

  // Measure, then keep the whole menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(MARGIN, Math.min(at.x, window.innerWidth - width - MARGIN))
    const top = Math.max(MARGIN, Math.min(at.y, window.innerHeight - height - MARGIN))
    setPosition({ left, top })
  }, [at.x, at.y, entries.length])

  useLayoutEffect(() => {
    const el = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    el?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const close = (): void => closeRef.current()
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      onClose()
      return
    }
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])
    ]
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = (current + 1) % items.length
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={minWidth ? { ...position, minWidth } : position}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry) => {
        if (entry.kind === 'separator') {
          return <div key={entry.id} role="separator" className={styles.separator} />
        }
        if (entry.kind === 'heading') {
          return (
            <div key={entry.id} role="presentation" className={styles.heading}>
              {entry.label}
            </div>
          )
        }
        const checkable = entry.checked !== undefined
        return (
          <button
            key={entry.id}
            type="button"
            role={checkable ? (entry.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'}
            aria-checked={checkable ? entry.checked : undefined}
            disabled={entry.disabled}
            className={`${styles.item} ${entry.danger ? styles.danger : ''}`}
            onClick={() => {
              entry.onSelect()
              if (!entry.keepOpen) onClose()
            }}
          >
            {checkable ? (
              <span className={styles.check} aria-hidden="true">
                {entry.checked ? <Icon name="check" size="sm" /> : null}
              </span>
            ) : null}
            {entry.leading}
            <span className={styles.itemLabel}>{entry.label}</span>
            {entry.trailing ? <span className={styles.trailing}>{entry.trailing}</span> : null}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
