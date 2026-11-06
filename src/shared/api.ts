// The only surface the renderer can reach. It sends keys and ids, never URLs or
// arbitrary paths: the main process looks the repo up in its own cache.
import type {
  AccountInput,
  Account,
  Cached,
  CommitDetail,
  DiffRequest,
  FileDiff,
  GraphCommit,
  LocalInfo,
  Project,
  Repo,
  RepoStatus,
  RepoSummary,
  VerifiedUser
} from './types'

export type CloneProtocol = 'https' | 'ssh'

export interface CloneProgress {
  repoKey: string
  /** Last line git printed, for example `Receiving objects: 42% (21/50)`. */
  line: string
  /** 0 to 100 when the line carries a percentage, else `null`. */
  percent: number | null
}

export interface ProjectCreateInput {
  name: string
  icon?: string
  color?: string
  repoKeys?: string[]
}

export interface ProjectPatchInput {
  name?: string
  icon?: string
  color?: string
}

export interface Api {
  secureStorageAvailable(): Promise<boolean>
  accounts: {
    list(): Promise<Account[]>
    test(input: AccountInput): Promise<VerifiedUser>
    add(input: AccountInput): Promise<Account>
    remove(id: string): Promise<void>
  }
  /** Stale-while-revalidate pair: show `cached`, then replace it with `fetch`. */
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
    /** Folder picker. `null` when cancelled or declined. */
    link(repoKey: string): Promise<string | null>
    unlink(repoKey: string): Promise<void>
    /** Folder picker for the parent. `null` when cancelled. */
    clone(repoKey: string, protocol: CloneProtocol): Promise<string | null>
    info(path: string): Promise<LocalInfo>
    graph(path: string, skip: number, limit: number): Promise<GraphCommit[]>
    commit(path: string, hash: string): Promise<CommitDetail>
    fetch(path: string): Promise<void>
    reveal(path: string): Promise<void>
    /** Staged, unstaged, untracked and conflicted files. */
    status(path: string): Promise<RepoStatus>
    diff(path: string, request: DiffRequest): Promise<FileDiff>
    stage(path: string, files: string[]): Promise<void>
    unstage(path: string, files: string[]): Promise<void>
    stageAll(path: string): Promise<void>
    /** Asks first. Resolves `false` when the user declines. */
    discard(path: string, files: string[]): Promise<boolean>
    createCommit(path: string, message: string, amend: boolean): Promise<void>
    /** Repositories opened from a folder, without an account. */
    repos(): Promise<Repo[]>
    /** Folder picker. `null` when cancelled. Opening the same folder twice gives one entry. */
    open(): Promise<Repo | null>
    /** Forgets a local repository. The folder is not touched. */
    remove(repoKey: string): Promise<void>
    /** Returns the function that stops listening. */
    onCloneProgress(cb: (progress: CloneProgress) => void): () => void
  }
  openExternal(url: string): Promise<void>
  projects: {
    list(): Promise<Project[]>
    create(input: ProjectCreateInput): Promise<Project>
    update(id: string, patch: ProjectPatchInput): Promise<Project>
    remove(id: string): Promise<void>
    addRepos(id: string, repoKeys: string[]): Promise<Project>
    removeRepos(id: string, repoKeys: string[]): Promise<Project>
  }
}

/** Channel names, shared so main and preload cannot drift apart. */
export const IPC = {
  secureStorageAvailable: 'secureStorageAvailable',
  accountsList: 'accounts:list',
  accountsTest: 'accounts:test',
  accountsAdd: 'accounts:add',
  accountsRemove: 'accounts:remove',
  reposCached: 'repos:cached',
  reposFetch: 'repos:fetch',
  summaryCached: 'summary:cached',
  summaryFetch: 'summary:fetch',
  localLinks: 'local:links',
  localLink: 'local:link',
  localUnlink: 'local:unlink',
  localClone: 'local:clone',
  localInfo: 'local:info',
  localGraph: 'local:graph',
  localCommit: 'local:commit',
  localFetch: 'local:fetch',
  localReveal: 'local:reveal',
  localStatus: 'local:status',
  localDiff: 'local:diff',
  localStage: 'local:stage',
  localUnstage: 'local:unstage',
  localStageAll: 'local:stageAll',
  localDiscard: 'local:discard',
  localCreateCommit: 'local:createCommit',
  localRepos: 'local:repos',
  localOpen: 'local:open',
  localRemove: 'local:remove',
  openExternal: 'openExternal',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsRemove: 'projects:remove',
  projectsAddRepos: 'projects:addRepos',
  projectsRemoveRepos: 'projects:removeRepos',
  /** Main to renderer event, not a request. */
  cloneProgress: 'clone:progress'
} as const

/**
 * What a handler returns over IPC. Electron prefixes thrown errors with
 * "Error invoking remote method", so errors travel as data and preload rethrows.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
