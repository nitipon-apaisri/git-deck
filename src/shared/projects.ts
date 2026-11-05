// Pure helpers: no electron, no I/O. Callers persist the returned values.
import type { Project, ProjectSummary, RepoSummary } from './types'

export const PROJECT_COLORS = [
  'blue',
  'teal',
  'violet',
  'amber',
  'rose',
  'green',
  'pink',
  'gray'
] as const

// Feather-style line icons drawn for GitDeck (renderer maps each id to a glyph).
export const PROJECT_ICONS = [
  'folder',
  'rocket',
  'server',
  'layers',
  'box',
  'package',
  'code',
  'terminal',
  'database',
  'cloud',
  'globe',
  'cpu',
  'shield',
  'lock',
  'key',
  'zap',
  'star',
  'heart',
  'flag',
  'bookmark',
  'book',
  'briefcase',
  'home',
  'users',
  'tool',
  'settings',
  'activity',
  'bar-chart',
  'smartphone',
  'monitor'
] as const

export const DEFAULT_ICON = 'folder'
export const DEFAULT_COLOR = PROJECT_COLORS[0]
export const MAX_NAME_LENGTH = 60
const MAX_TOP_CONTRIBUTORS = 25

export interface ProjectInput {
  name: string
  icon?: string
  color?: string
  repoKeys?: string[]
}

export interface ProjectPatch {
  name?: string
  icon?: string
  color?: string
}

export interface Clock {
  now(): number
  newId(): string
}

const systemClock: Clock = { now: () => Date.now(), newId: () => crypto.randomUUID() }

const unique = (keys: readonly string[]): string[] => [...new Set(keys)]

function isSingleEmoji(value: string): boolean {
  if (!/\p{Extended_Pictographic}/u.test(value)) return false
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
  return segments.length === 1
}

export function isValidIcon(icon: string): boolean {
  return (PROJECT_ICONS as readonly string[]).includes(icon) || isSingleEmoji(icon)
}

export function isValidColor(color: string): boolean {
  return (PROJECT_COLORS as readonly string[]).includes(color)
}

export function validateName(name: string, others: readonly Project[], selfId?: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1) throw new Error('Project name is required')
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Project name must be at most ${MAX_NAME_LENGTH} characters`)
  }
  const lower = trimmed.toLowerCase()
  if (others.some((p) => p.id !== selfId && p.name.toLowerCase() === lower)) {
    throw new Error('A project with this name already exists')
  }
  return trimmed
}

export function createProject(
  existing: readonly Project[],
  input: ProjectInput,
  clock: Clock = systemClock
): Project {
  const name = validateName(input.name, existing)
  const icon = input.icon ?? DEFAULT_ICON
  const color = input.color ?? DEFAULT_COLOR
  if (!isValidIcon(icon)) throw new Error('Unknown project icon')
  if (!isValidColor(color)) throw new Error('Unknown project color')
  const now = clock.now()
  return {
    id: clock.newId(),
    name,
    icon,
    color,
    repoKeys: unique(input.repoKeys ?? []),
    createdAt: now,
    updatedAt: now
  }
}

export function updateProject(
  existing: readonly Project[],
  id: string,
  patch: ProjectPatch,
  clock: Clock = systemClock
): Project {
  const current = existing.find((p) => p.id === id)
  if (!current) throw new Error('Project not found')
  const name = patch.name === undefined ? current.name : validateName(patch.name, existing, id)
  const icon = patch.icon ?? current.icon
  const color = patch.color ?? current.color
  if (!isValidIcon(icon)) throw new Error('Unknown project icon')
  if (!isValidColor(color)) throw new Error('Unknown project color')
  return { ...current, name, icon, color, updatedAt: clock.now() }
}

export function addRepos(
  project: Project,
  repoKeys: readonly string[],
  clock: Clock = systemClock
): Project {
  return {
    ...project,
    repoKeys: unique([...project.repoKeys, ...repoKeys]),
    updatedAt: clock.now()
  }
}

export function removeRepos(
  project: Project,
  repoKeys: readonly string[],
  clock: Clock = systemClock
): Project {
  const drop = new Set(repoKeys)
  return {
    ...project,
    repoKeys: project.repoKeys.filter((k) => !drop.has(k)),
    updatedAt: clock.now()
  }
}

/** Remove every repo of a deleted account from all projects. Projects themselves stay. */
export function pruneAccount(projects: readonly Project[], accountId: string): Project[] {
  const prefix = `${accountId}:`
  return projects.map((p) => {
    const repoKeys = p.repoKeys.filter((k) => !k.startsWith(prefix))
    return repoKeys.length === p.repoKeys.length ? p : { ...p, repoKeys }
  })
}

export function aggregateProject(
  repoKeys: readonly string[],
  summaries: Readonly<Record<string, RepoSummary | undefined>>
): ProjectSummary {
  let loadedCount = 0
  let commits = 0
  let openChangeRequests = 0
  let lastMs: number | null = null
  let lastActivityAt: string | null = null
  let partial = false
  const people = new Set<string>()

  for (const key of repoKeys) {
    const s = summaries[key]
    if (!s) {
      partial = true
      continue
    }
    loadedCount++
    if (s.commitCount === null || s.contributorCount === null || s.openChangeRequests === null) {
      partial = true
    }
    commits += s.commitCount ?? 0
    openChangeRequests += s.openChangeRequests ?? 0
    for (const c of s.contributors.slice(0, MAX_TOP_CONTRIBUTORS)) {
      const id = c.email.trim().toLowerCase() || c.login.trim().toLowerCase()
      if (id) people.add(id)
    }
    if (s.lastActivityAt) {
      const ms = Date.parse(s.lastActivityAt)
      if (!Number.isNaN(ms) && (lastMs === null || ms > lastMs)) {
        lastMs = ms
        lastActivityAt = s.lastActivityAt
      }
    }
  }

  return {
    repoCount: repoKeys.length,
    loadedCount,
    commits,
    contributors: people.size,
    openChangeRequests,
    lastActivityAt,
    partial
  }
}
