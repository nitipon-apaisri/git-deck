// Pure: words for the Tags and Remotes dialogs and the history operations.
import type { TagEntry } from '../../../shared/types'

/** `annotated` or `lightweight`, for the small label on a tag row. */
export function tagKind(tag: Pick<TagEntry, 'annotated'>): string {
  return tag.annotated ? 'annotated' : 'lightweight'
}

/** Under a tag's name: its kind, the commit it points at, and the message of an annotated tag. */
export function tagDetail(tag: Pick<TagEntry, 'annotated' | 'hash' | 'message'>): string {
  const parts = [tagKind(tag), tag.hash.slice(0, 7)]
  if (tag.message) parts.push(tag.message)
  return parts.join(' · ')
}

/** Where a new tag points, in words for the dialog description. */
export function tagStartLabel(hash: string | null): string {
  return hash ? hash.slice(0, 7) : 'the current commit'
}

/** The words for a reset in the graph menu and in messages. */
export function resetModeHint(mode: 'soft' | 'mixed' | 'hard'): string {
  switch (mode) {
    case 'soft':
      return 'Moves the branch. Your changes stay staged.'
    case 'mixed':
      return 'Moves the branch. Your changes stay in the files, unstaged.'
    case 'hard':
      return 'Moves the branch and discards every change to tracked files.'
  }
}

/**
 * A quick check before the round trip, so an obvious slip shows beside the field. Git and main
 * have the last word: they reject anything this lets through.
 */
export function remoteFormProblem(name: string, url: string): string | null {
  const n = name.trim()
  const u = url.trim()
  if (!n) return 'Give the remote a name, for example origin.'
  if (/\s/.test(n)) return 'A remote name cannot contain spaces.'
  if (!u) return 'Enter the remote URL.'
  if (/^https?:\/\/[^/]*@/i.test(u)) {
    return 'Leave the username and token out of the URL. Sign in with an account instead.'
  }
  return null
}
