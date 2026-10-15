import type { Account, AccountInput, Cached, CommitDetail, GraphCommit, LocalInfo, LocalStatus, Repo, RepoSummary } from './types'

export interface CloneProgress {
  repoKey: string
  line: string
  /** 0-100 when git reported a percentage on this line */
  percent: number | null
}

/**
 * IPC contract. The renderer only sends keys and ids, never URLs;
 * every `path` must equal a stored link value or the main process throws.
 */
export interface Api {
  secureStorageAvailable(): Promise<boolean>
  accounts: {
    list(): Promise<Account[]>
    /** Verifies the token without saving anything. */
    test(input: AccountInput): Promise<{ username: string; avatarUrl?: string }>
    add(input: AccountInput): Promise<Account>
    remove(id: string): Promise<void>
  }
  repos: {
    cached(accountId: string): Promise<Cached<Repo[]> | null>
    fetch(accountId: string): Promise<Cached<Repo[]>>
  }
  summary: {
    cached(repoKey: string): Promise<Cached<RepoSummary> | null>
    fetch(repoKey: string): Promise<Cached<RepoSummary>>
  }
  local: {
    links(): Promise<Record<string, string>>
    /** Folder picker; null if cancelled. */
    link(repoKey: string): Promise<string | null>
    unlink(repoKey: string): Promise<void>
    clone(repoKey: string, protocol: 'https' | 'ssh'): Promise<string | null>
    info(path: string): Promise<LocalInfo>
    /** Status of every linked folder, read in parallel. Never throws for a single bad folder. */
    statusAll(): Promise<LocalStatus[]>
    graph(path: string, skip: number, limit: number): Promise<GraphCommit[]>
    commit(path: string, hash: string): Promise<CommitDetail>
    fetch(path: string): Promise<void>
    reveal(path: string): Promise<void>
    onCloneProgress(cb: (p: CloneProgress) => void): () => void
  }
  /** http/https only. */
  openExternal(url: string): Promise<void>
}
