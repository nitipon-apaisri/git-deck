// Pure notification-inbox logic: no electron, no I/O. Entries hold text only, never a token or diff.
export const INBOX_CAP = 100

export interface InboxItem {
  id: string
  title: string
  body: string
  repoKey: string
  projectId: string
  /** ms since epoch */
  at: number
  read: boolean
}

/** Newest first, oldest dropped past the cap. */
export function appendItem(list: readonly InboxItem[], item: InboxItem): InboxItem[] {
  return [item, ...list].slice(0, INBOX_CAP)
}

export function markItemRead(list: readonly InboxItem[], id: string): InboxItem[] {
  return list.map((i) => (i.id === id ? { ...i, read: true } : i))
}

export function markAllItemsRead(list: readonly InboxItem[]): InboxItem[] {
  return list.map((i) => (i.read ? i : { ...i, read: true }))
}
