import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxItem } from '@shared/inbox'
import { timeAgo } from '../lib/format'
import { Icon, Menu, type MenuEntry } from './ui'

interface NotificationBellProps {
  /** Opens the repository's PR/MR tab, as clicking an OS notification does. */
  onOpen: (target: { repoKey: string; projectId: string }) => void
}

/** The bell in the top bar: unread count and the inbox list. */
export function NotificationBell({ onOpen }: NotificationBellProps) {
  const button = useRef<HTMLButtonElement>(null)
  const [items, setItems] = useState<InboxItem[]>([])
  const [at, setAt] = useState<{ x: number; y: number; width: number; now: number } | null>(null)

  const refresh = useCallback(() => {
    window.api.inbox.list().then(setItems, () => {})
  }, [])
  useEffect(() => {
    refresh()
    return window.api.inbox.onChanged(refresh)
  }, [refresh])

  const unread = items.filter((i) => !i.read).length

  function open(): void {
    const rect = button.current?.getBoundingClientRect()
    if (rect)
      setAt({ x: Math.max(8, rect.right - 340), y: rect.bottom + 4, width: 340, now: Date.now() })
  }

  const entries: MenuEntry[] = [
    {
      kind: 'item',
      id: 'mark-all',
      label: 'Mark all read',
      disabled: unread === 0,
      onSelect: () => void window.api.inbox.markAllRead().catch(() => {})
    },
    { kind: 'separator', id: 'sep' },
    ...(items.length === 0
      ? [{ kind: 'heading', id: 'empty', label: 'No notifications yet' } satisfies MenuEntry]
      : items.map((i): MenuEntry => ({
          kind: 'item',
          id: i.id,
          label: `${i.read ? '' : '● '}${i.title}: ${i.body}`,
          trailing: timeAgo(i.at, at?.now ?? i.at),
          onSelect: () => {
            void window.api.inbox.markRead(i.id).catch(() => {})
            onOpen({ repoKey: i.repoKey, projectId: i.projectId })
          }
        })))
  ]

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        aria-haspopup="menu"
        onClick={open}
        className="relative inline-grid size-8 flex-none cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Icon name="bell" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {at ? (
        <Menu
          label="Notifications"
          at={at}
          minWidth={at.width}
          entries={entries}
          onClose={() => setAt(null)}
        />
      ) : null}
    </>
  )
}
