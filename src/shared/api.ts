// The only surface the renderer can reach. It sends keys and ids, never URLs or
// arbitrary paths: the main process looks the repo up in its own cache.
import type {
  AccountInput,
  Account,
  BranchList,
  Cached,
  CheckoutTarget,
  CommitDetail,
  DiffRequest,
  FileDiff,
  GraphCommit,
  LocalInfo,
  LocalRemote,
  OperationResult,
  OperationState,
  Project,
  PullMode,
  Repo,
  RepoStatus,
  RepoSummary,
  ResetMode,
  StashEntry,
  TagEntry,
  VerifiedUser
} from './types'

export type CloneProtocol = 'https' | 'ssh'

export type GitProgressOp = 'clone' | 'pull' | 'push'

export interface GitProgress {
  repoKey: string
  op: GitProgressOp
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
    /** Local and remote branches, with ahead and behind for each tracking branch. */
    branches(path: string): Promise<BranchList>
    checkout(path: string, target: CheckoutTarget): Promise<void>
    /** `startPoint` is a branch or commit; `null` branches from HEAD. */
    createBranch(
      path: string,
      name: string,
      startPoint: string | null,
      checkout: boolean
    ): Promise<void>
    renameBranch(path: string, from: string, to: string): Promise<void>
    /** Asks first. Resolves `false` when the user declines. Never the current branch. */
    deleteBranch(path: string, name: string): Promise<boolean>
    pull(path: string, mode: PullMode): Promise<void>
    /** Sets the upstream when there is none. A forced push asks first: `false` when declined. */
    push(path: string, force: boolean): Promise<boolean>
    stashes(path: string): Promise<StashEntry[]>
    stashPush(path: string, message: string, includeUntracked: boolean): Promise<void>
    /** `hash` is the entry's hash, so a list that changed since it was read is refused. */
    stashApply(path: string, index: number, hash: string): Promise<void>
    stashPop(path: string, index: number, hash: string): Promise<void>
    /** Asks first. Resolves `false` when the user declines. */
    stashDrop(path: string, index: number, hash: string): Promise<boolean>
    /** `conflicted` means it stopped: read `operation`, then continue or abort. */
    cherryPick(path: string, hash: string): Promise<OperationResult>
    /** `branch` is local or remote (`origin/x`). `noFf` always makes a merge commit. */
    merge(path: string, branch: string, noFf: boolean): Promise<OperationResult>
    tags(path: string): Promise<TagEntry[]>
    /** `hash` is a commit, or `null` for HEAD. A message makes an annotated tag. */
    createTag(
      path: string,
      name: string,
      hash: string | null,
      message: string | null
    ): Promise<void>
    /** Asks first. Deletes the local tag only. Resolves `false` when declined. */
    deleteTag(path: string, name: string): Promise<boolean>
    pushTag(path: string, name: string): Promise<void>
    /** Asks first. Resolves `false` when declined. */
    deleteRemoteTag(path: string, name: string): Promise<boolean>
    /** `conflicted` means it stopped: read `operation`, then continue or abort. */
    revert(path: string, hash: string): Promise<OperationResult>
    /** A hard reset asks first. Resolves `false` when declined. */
    reset(path: string, hash: string, mode: ResetMode): Promise<boolean>
    remotes(path: string): Promise<LocalRemote[]>
    addRemote(path: string, name: string, url: string): Promise<void>
    renameRemote(path: string, from: string, to: string): Promise<void>
    /** Asks first. Resolves `false` when declined. */
    removeRemote(path: string, name: string): Promise<boolean>
    /** The merge, cherry-pick or revert waiting for the user, or `null`. */
    operation(path: string): Promise<OperationState | null>
    /** Stages the fixed files and finishes the operation. */
    continueOperation(path: string): Promise<void>
    /** Asks first. Resolves `false` when the user declines. */
    abortOperation(path: string): Promise<boolean>
    /** Repositories opened from a folder, without an account. */
    repos(): Promise<Repo[]>
    /** Folder picker. `null` when cancelled. Opening the same folder twice gives one entry. */
    open(): Promise<Repo | null>
    /** Forgets a local repository. The folder is not touched. */
    remove(repoKey: string): Promise<void>
    /** Returns the function that stops listening. */
    onGitProgress(cb: (progress: GitProgress) => void): () => void
    /** Start telling the page when files or refs of this linked folder change on disk. */
    watch(path: string): Promise<void>
    unwatch(path: string): Promise<void>
    /** Fires with the folder path after its files or refs changed. Returns the unsubscribe. */
    onRepoChanged(cb: (path: string) => void): () => void
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
  localBranches: 'local:branches',
  localCheckout: 'local:checkout',
  localCreateBranch: 'local:createBranch',
  localRenameBranch: 'local:renameBranch',
  localDeleteBranch: 'local:deleteBranch',
  localPull: 'local:pull',
  localPush: 'local:push',
  localStashes: 'local:stashes',
  localStashPush: 'local:stashPush',
  localStashApply: 'local:stashApply',
  localStashPop: 'local:stashPop',
  localStashDrop: 'local:stashDrop',
  localCherryPick: 'local:cherryPick',
  localMerge: 'local:merge',
  localTags: 'local:tags',
  localCreateTag: 'local:createTag',
  localDeleteTag: 'local:deleteTag',
  localPushTag: 'local:pushTag',
  localDeleteRemoteTag: 'local:deleteRemoteTag',
  localRevert: 'local:revert',
  localReset: 'local:reset',
  localRemotes: 'local:remotes',
  localAddRemote: 'local:addRemote',
  localRenameRemote: 'local:renameRemote',
  localRemoveRemote: 'local:removeRemote',
  localOperation: 'local:operation',
  localContinueOperation: 'local:continueOperation',
  localAbortOperation: 'local:abortOperation',
  localRepos: 'local:repos',
  localOpen: 'local:open',
  localRemove: 'local:remove',
  localWatch: 'local:watch',
  localUnwatch: 'local:unwatch',
  openExternal: 'openExternal',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsRemove: 'projects:remove',
  projectsAddRepos: 'projects:addRepos',
  projectsRemoveRepos: 'projects:removeRepos',
  /** Main to renderer event, not a request. */
  gitProgress: 'git:progress',
  /** Main to renderer event, not a request. */
  repoChanged: 'repo:changed'
} as const

/**
 * What a handler returns over IPC. Electron prefixes thrown errors with
 * "Error invoking remote method", so errors travel as data and preload rethrows.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
