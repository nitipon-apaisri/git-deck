// The project form's rules, built on the shared helpers. A pure module: no DOM.
import {
  MAX_NAME_LENGTH,
  PROJECT_COLORS,
  PROJECT_ICONS,
  isValidIcon,
  validateName
} from '../../../shared/projects'
import type { Project, Repo } from '../../../shared/types'
import { accountIdOf } from './projectScope'

export interface ProjectFormValue {
  name: string
  icon: string
  color: string
  repoKeys: string[]
}

export const NAME_LIMIT = MAX_NAME_LENGTH

/** Plain label for a built-in icon id: `bar-chart` -> `bar chart`. */
export const iconLabel = (id: string): string => id.replace(/-/g, ' ')

export const COLOR_LABELS: Record<(typeof PROJECT_COLORS)[number], string> = {
  blue: 'Blue',
  teal: 'Teal',
  violet: 'Violet',
  amber: 'Amber',
  rose: 'Rose',
  green: 'Green',
  pink: 'Pink',
  gray: 'Gray'
}

/**
 * The name's problem in words, or `null` when it is fine. Uses the same check as main, so
 * the form and the store never disagree. Nothing is said about an empty field until the
 * user has touched it (`showEmpty`).
 */
export function nameProblem(
  name: string,
  others: readonly Project[],
  selfId: string | undefined,
  showEmpty: boolean
): string | null {
  if (name.trim() === '' && !showEmpty) return null
  try {
    validateName(name, others, selfId)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid name'
  }
}

/** Built-in icons that match a search, by id or label. */
export function filterIcons(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...PROJECT_ICONS]
  return PROJECT_ICONS.filter((id) => id.includes(q) || iconLabel(id).includes(q))
}

export type EmojiState = { kind: 'empty' } | { kind: 'ok'; icon: string } | { kind: 'invalid' }

/** What the free-text icon field holds: nothing, one emoji, or something else. */
export function readEmojiField(text: string): EmojiState {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  return isValidIcon(trimmed) && !(PROJECT_ICONS as readonly string[]).includes(trimmed)
    ? { kind: 'ok', icon: trimmed }
    : { kind: 'invalid' }
}

export const isBuiltInIcon = (icon: string): boolean =>
  (PROJECT_ICONS as readonly string[]).includes(icon)

/** Which keys to add to and remove from a project to reach `next`. */
export function diffRepoKeys(
  current: readonly string[],
  next: readonly string[]
): { add: string[]; remove: string[] } {
  const have = new Set(current)
  const want = new Set(next)
  return {
    add: [...want].filter((k) => !have.has(k)),
    remove: [...have].filter((k) => !want.has(k))
  }
}

export function replaceProject(list: readonly Project[], project: Project): Project[] {
  return list.some((p) => p.id === project.id)
    ? list.map((p) => (p.id === project.id ? project : p))
    : [...list, project]
}

export interface RepoGroup {
  accountId: string
  repos: Repo[]
}

/**
 * The repositories a form offers, grouped by account in the given account order, and
 * filtered by a search over name, full name and description. Keys already chosen that no
 * list has any more come back as `missing`, so they can still be unticked.
 */
export function pickerGroups(
  accountIds: readonly string[],
  reposByAccount: Readonly<Record<string, readonly Repo[]>>,
  chosen: ReadonlySet<string>,
  query: string
): { groups: RepoGroup[]; missing: string[] } {
  const q = query.trim().toLowerCase()
  const known = new Set<string>()
  const groups: RepoGroup[] = []
  for (const accountId of accountIds) {
    const all = reposByAccount[accountId] ?? []
    for (const r of all) known.add(r.key)
    const repos = all
      .filter(
        (r) =>
          q === '' ||
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }))
    if (repos.length > 0) groups.push({ accountId, repos })
  }
  const missing = [...chosen].filter(
    (k) => !known.has(k) && (q === '' || k.toLowerCase().includes(q))
  )
  return { groups, missing }
}

/** The part of a key after the account: the remote id, shown when nothing better is known. */
export const remoteIdOf = (repoKey: string): string =>
  repoKey.slice(accountIdOf(repoKey).length + 1)
