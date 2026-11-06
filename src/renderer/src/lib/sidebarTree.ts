// Pure sidebar tree: account -> namespace -> repos, with search and collapse.
import type { Account, Repo } from '../../../shared/types'
import { LOCAL_ACCOUNT_ID } from './localRepos'

export interface NamespaceNode {
  key: string
  name: string
  repos: Repo[]
}

export interface AccountNode {
  account: Account
  namespaces: NamespaceNode[]
  /** Repositories the account has, ignoring the search. */
  total: number
  /** Repositories that match the search (equals `total` without one). */
  matched: number
}

export type TreeRow =
  | { kind: 'host'; key: string; node: AccountNode; expanded: boolean }
  | { kind: 'namespace'; key: string; node: NamespaceNode; expanded: boolean }
  /** `flat` repositories sit straight under their host, with no group row between. */
  | { kind: 'repo'; key: string; repo: Repo; flat: boolean }

const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' })

export function matchesQuery(repo: Repo, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    repo.name.toLowerCase().includes(q) ||
    repo.fullName.toLowerCase().includes(q) ||
    repo.description.toLowerCase().includes(q)
  )
}

/** A local repository keeps its folder path in `description`; group by the folder it lives in. */
const parentFolder = (path: string): string => path.replace(/[\\/]+[^\\/]*[\\/]*$/, '') || path
const folderName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path

export const namespaceKey = (accountId: string, namespace: string): string =>
  `${accountId}\u0000${namespace}`

/** The account's own namespace first, the rest alphabetically. */
export function buildTree(
  accounts: readonly Account[],
  reposByAccount: Readonly<Record<string, readonly Repo[]>>,
  query: string
): AccountNode[] {
  const searching = query.trim() !== ''
  const nodes: AccountNode[] = []
  for (const account of accounts) {
    const all = reposByAccount[account.id] ?? []
    const visible = all.filter((r) => matchesQuery(r, query))
    // While searching, hosts with nothing to show would only be noise.
    if (searching && visible.length === 0) continue
    const local = account.id === LOCAL_ACCOUNT_ID
    const groups = new Map<string, Repo[]>()
    for (const repo of visible) {
      const group = local ? parentFolder(repo.description) : repo.namespace
      const list = groups.get(group)
      if (list) list.push(repo)
      else groups.set(group, [repo])
    }
    const own = account.username.toLowerCase()
    const namespaces = [...groups.entries()]
      .sort(([a], [b]) => {
        const aOwn = a.toLowerCase() === own
        const bOwn = b.toLowerCase() === own
        if (aOwn !== bOwn) return aOwn ? -1 : 1
        return byName(a, b)
      })
      .map(([group, repos]) => ({
        key: namespaceKey(account.id, group),
        name: local ? folderName(group) : group,
        repos: [...repos].sort((a, b) => byName(a.name, b.name))
      }))
    nodes.push({ account, namespaces, total: all.length, matched: visible.length })
  }
  return nodes
}

/** Rows in display order. A search expands every group, whatever was collapsed. */
export function flattenTree(
  nodes: readonly AccountNode[],
  collapsed: ReadonlySet<string>,
  searching: boolean
): TreeRow[] {
  const rows: TreeRow[] = []
  for (const node of nodes) {
    const hostOpen = searching || !collapsed.has(node.account.id)
    rows.push({ kind: 'host', key: node.account.id, node, expanded: hostOpen })
    if (!hostOpen) continue
    if (node.account.id === LOCAL_ACCOUNT_ID) {
      // Local repositories are listed by name alone: their parent folder is no group.
      const repos = node.namespaces.flatMap((ns) => ns.repos).sort((a, b) => byName(a.name, b.name))
      for (const repo of repos) rows.push({ kind: 'repo', key: repo.key, repo, flat: true })
      continue
    }
    for (const ns of node.namespaces) {
      const nsOpen = searching || !collapsed.has(ns.key)
      rows.push({ kind: 'namespace', key: ns.key, node: ns, expanded: nsOpen })
      if (!nsOpen) continue
      for (const repo of ns.repos) rows.push({ kind: 'repo', key: repo.key, repo, flat: false })
    }
  }
  return rows
}
