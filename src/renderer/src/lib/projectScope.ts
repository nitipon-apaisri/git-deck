// Which repositories a project scope shows, as pure functions with no DOM.
import type { Project, Repo } from '../../../shared/types'

export const SCOPE_KEY = 'gitdeck.scope'
export const ALL_SCOPE = 'all'

/** The stored scope: `all` or a project id. Anything unreadable is `all`. */
export function parseScope(raw: string | null): string {
  const value = raw?.trim() ?? ''
  return value === '' ? ALL_SCOPE : value
}

/** The project for a scope id, or `null` for "all" and for a project that is gone. */
export function resolveScope(scope: string, projects: readonly Project[]): Project | null {
  if (scope === ALL_SCOPE) return null
  return projects.find((p) => p.id === scope) ?? null
}

/** `accountId:remoteId` -> `accountId`. */
export function accountIdOf(repoKey: string): string {
  const colon = repoKey.indexOf(':')
  return colon < 0 ? repoKey : repoKey.slice(0, colon)
}

export interface AccountLoad {
  /** The list has loaded, or failed: either way it has been tried. */
  settled: boolean
}

export interface ProjectView {
  /** The project's repositories that are in a loaded list, by account. */
  reposByAccount: Record<string, Repo[]>
  /** Keys with no repository behind them, in project order. */
  unavailable: string[]
  /** Keys whose account is still loading: shown neither way yet. */
  pending: string[]
}

/**
 * Splits a project's keys into repositories that can be shown and keys that cannot.
 * A key is unavailable when its account was removed, or its list has been tried and the
 * repository is not in it (access lost, deleted, or the list failed). While an account's
 * first list is still on its way the key is `pending`, so it does not flash as unavailable.
 * Before the accounts are known (`ready` false) every key is pending.
 */
export function projectView(
  project: Project,
  reposByAccount: Readonly<Record<string, readonly Repo[]>>,
  accounts: Readonly<Record<string, AccountLoad | undefined>>,
  ready: boolean
): ProjectView {
  const wanted = new Set(project.repoKeys)
  const found = new Set<string>()
  const grouped: Record<string, Repo[]> = {}
  for (const [accountId, repos] of Object.entries(reposByAccount)) {
    const members = repos.filter((r) => wanted.has(r.key))
    if (members.length === 0) continue
    grouped[accountId] = members
    for (const r of members) found.add(r.key)
  }
  const unavailable: string[] = []
  const pending: string[] = []
  for (const key of project.repoKeys) {
    if (found.has(key)) continue
    const account = accounts[accountIdOf(key)]
    if (!ready || (account !== undefined && !account.settled)) pending.push(key)
    else unavailable.push(key)
  }
  return { reposByAccount: grouped, unavailable, pending }
}

/** How many projects hold a repository, for a menu hint. */
export function projectsHolding(projects: readonly Project[], repoKey: string): Project[] {
  return projects.filter((p) => p.repoKeys.includes(repoKey))
}
