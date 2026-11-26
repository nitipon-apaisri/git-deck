// The only surface the renderer can reach. It sends keys and ids, never URLs or
// arbitrary paths: the main process looks the repo up in its own cache.
import type { InboxItem } from './inbox'
import type {
  UpdateCheck,
  ProfileInfo,
  AccountInput,
  Account,
  BranchDeleteItem,
  BranchDeleteResult,
  BranchList,
  Cached,
  CheckoutTarget,
  CommitDetail,
  DiffRequest,
  FileBlame,
  FileDiff,
  FileHistoryPage,
  GraphCommit,
  HunkRequest,
  LocalInfo,
  LocalRemote,
  ConflictAction,
  ConflictFile,
  ConflictRequest,
  ConflictSaveResult,
  OperationResult,
  RebasePlan,
  RebaseTodoItem,
  BisectMark,
  BisectState,
  OperationState,
  NotifyEvent,
  Project,
  PullMode,
  Repo,
  RepoStatus,
  RepoSummary,
  ChangeRequest,
  CreateChangeRequestInput,
  ChecksInfo,
  ResetMode,
  StashEntry,
  WorktreeEntry,
  TagEntry,
  ReleaseNote,
  VerifiedUser
} from './types'
import type { AiConfig, AiProviderId } from './ai'

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
  notify?: NotifyEvent[]
}

export interface Api {
  secureStorageAvailable(): Promise<boolean>
  terminal: {
    /** Starts a shell in a linked folder and returns its session id. */
    create(path: string, cols: number, rows: number): Promise<string>
    write(id: string, data: string): Promise<void>
    resize(id: string, cols: number, rows: number): Promise<void>
    kill(id: string): Promise<void>
    onData(cb: (id: string, data: string) => void): () => void
    onExit(cb: (id: string, exitCode: number) => void): () => void
  }
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
  /** The Home profile of one account, read with its token. Nothing is cached. */
  profile: {
    get(accountId: string): Promise<ProfileInfo>
  }
  /** Read-only pull/merge requests and CI. Empty for a local-only repository. */
  changes: {
    list(repoKey: string): Promise<ChangeRequest[]>
    checks(repoKey: string, ref: string): Promise<ChecksInfo>
    /** Opens a pull/merge request on the host. Needs write access; a local-only repo throws. */
    create(repoKey: string, input: CreateChangeRequestInput): Promise<ChangeRequest>
  }
  local: {
    links(): Promise<Record<string, string>>
    /** Folder picker. `null` when cancelled or declined. */
    link(repoKey: string): Promise<string | null>
    unlink(repoKey: string): Promise<void>
    /** Folder picker for the parent. `null` when cancelled. */
    clone(repoKey: string, protocol: CloneProtocol): Promise<string | null>
    info(path: string): Promise<LocalInfo>
    /** `hidden`: full names of refs left out of the graph. */
    graph(path: string, skip: number, limit: number, hidden?: string[]): Promise<GraphCommit[]>
    commit(path: string, hash: string): Promise<CommitDetail>
    /** Commits that touched a file, following renames. `page` is 0-based. */
    fileHistory(path: string, file: string, page: number): Promise<FileHistoryPage>
    /** `rev` is a commit hash, or `null` for the work tree file. */
    blame(path: string, file: string, rev: string | null): Promise<FileBlame>
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
    /** `origin/topic`. Asks first; `false` when declined. */
    deleteRemoteBranch(path: string, name: string): Promise<boolean>
    /**
     * Deletes one branch at a time and returns a result for each, so one failure stops nothing.
     * `force` applies to local branches. Never the checked-out or default branch. Remote deletes
     * ask first with the count; `null` when declined.
     */
    deleteBranches(
      path: string,
      items: BranchDeleteItem[],
      force: boolean
    ): Promise<BranchDeleteResult[] | null>
    /** Pushes a local branch to its upstream, setting the upstream when it has none. */
    pushBranch(path: string, name: string): Promise<void>
    /** Moves a local branch up to its upstream without checking it out. Refused unless it fast-forwards. */
    fastForwardBranch(path: string, name: string): Promise<void>
    pull(path: string, mode: PullMode): Promise<void>
    /** Sets the upstream when there is none. A forced push asks first: `false` when declined. */
    push(path: string, force: boolean): Promise<boolean>
    /** Asks the chosen AI provider for a message for the staged changes. Never commits. */
    suggestCommitMessage(path: string, config: AiConfig): Promise<string>
    worktrees(path: string): Promise<WorktreeEntry[]>
    /** Asks for a folder. `create` makes `branch` new, otherwise it must exist. Null when cancelled. */
    worktreeAdd(path: string, branch: string, create: boolean): Promise<Repo | null>
    /** Adds an existing worktree folder to the sidebar under this repository. */
    worktreeOpen(path: string, folder: string): Promise<Repo>
    /** Asks first (and again with `force` for a dirty one). `false` when declined. */
    worktreeRemove(path: string, folder: string, force: boolean): Promise<boolean>
    worktreeLock(path: string, folder: string, lock: boolean): Promise<void>
    worktreePrune(path: string): Promise<void>
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
    /** `onto` is a local or remote branch (`origin/x`) or a commit hash. Non-interactive. */
    rebase(path: string, onto: string): Promise<OperationResult>
    /** The commits `rebaseRun` would replay onto `base`, a commit of this branch. Throws when it cannot. */
    rebasePlan(path: string, base: string): Promise<RebasePlan>
    /**
     * `git rebase -i` with this todo. Pushed commits ask first. `null` means the user declined;
     * `conflicted` means it stopped: continue, skip or abort through `local.operation`.
     */
    rebaseRun(path: string, base: string, todo: RebaseTodoItem[]): Promise<OperationResult | null>
    /** Rebase only. Asks first, resolves `false` when declined. */
    skipOperation(path: string): Promise<boolean>
    /** Stage one hunk of a tracked file. Main rebuilds the patch, so a stale diff is refused. */
    stageHunk(path: string, hunk: HunkRequest): Promise<void>
    unstageHunk(path: string, hunk: HunkRequest): Promise<void>
    /** Discard selected unstaged lines. Asks first, resolves `false` when declined. */
    discardLines(path: string, hunk: HunkRequest): Promise<boolean>
    /**
     * One conflicted file: its regions, or why it has none, and the whole-file actions that apply.
     * `file` must be a path `status` lists as conflicted.
     */
    conflictFile(path: string, file: string): Promise<ConflictFile>
    /**
     * Writes the chosen text for each region. Main re-reads the file, refuses a changed one and
     * builds the result itself. Stages the file once no region is left open.
     */
    resolveConflict(path: string, request: ConflictRequest): Promise<ConflictSaveResult>
    /** Resolves a whole file. `delete` asks first, so `false` means the user declined. */
    resolveConflictFile(path: string, file: string, action: ConflictAction): Promise<boolean>
    /** The merge, cherry-pick, revert or rebase waiting for the user, or `null`. */
    operation(path: string): Promise<OperationState | null>
    /** The running bisect, or `null`. */
    bisect(path: string): Promise<BisectState | null>
    bisectStart(path: string, bad: string, good: string): Promise<BisectState>
    bisectMark(path: string, mark: BisectMark): Promise<BisectState>
    /** Asks first unless the bisect has its result. `false` means the user declined. */
    bisectReset(path: string): Promise<boolean>
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
  /** API keys go in and never come back: the page only learns whether one is saved. */
  ai: {
    saveKey(provider: AiProviderId, key: string): Promise<void>
    removeKey(provider: AiProviderId): Promise<void>
    hasKey(provider: AiProviderId): Promise<boolean>
    /** Sends a tiny fixed prompt (no repository data) and returns the reply. */
    test(config: AiConfig): Promise<string>
  }
  openExternal(url: string): Promise<void>
  /** The installed version and, when GitHub has a newer release, its version and page. */
  checkForUpdate(): Promise<UpdateCheck>
  /** Notes of releases newer than the installed version, from GitHub. Only when asked. */
  releaseNotes(): Promise<ReleaseNote[]>
  notify: {
    /** The app-wide switch in Settings. On unless turned off. */
    enabled(): Promise<boolean>
    setEnabled(on: boolean): Promise<void>
    /** Shows a fixed notification. `null` when shown, else why it was not. */
    test(): Promise<string | null>
  }
  inbox: {
    list(): Promise<InboxItem[]>
    markRead(id: string): Promise<void>
    markAllRead(): Promise<void>
    /** The inbox changed (a notice arrived or was read): fetch the list again. */
    onChanged(cb: () => void): () => void
  }
  projects: {
    list(): Promise<Project[]>
    create(input: ProjectCreateInput): Promise<Project>
    update(id: string, patch: ProjectPatchInput): Promise<Project>
    remove(id: string): Promise<void>
    addRepos(id: string, repoKeys: string[]): Promise<Project>
    removeRepos(id: string, repoKeys: string[]): Promise<Project>
    /** A notification was clicked: show that repository's PR/MR tab. */
    onNotifyOpen(cb: (target: NotifyTarget) => void): () => void
  }
}

/** What a clicked notification opens. `projectId` is the project that asked for it. */
export interface NotifyTarget {
  repoKey: string
  projectId: string
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
  profileGet: 'profile:get',
  changesList: 'changes:list',
  changesChecks: 'changes:checks',
  changesCreate: 'changes:create',
  localLinks: 'local:links',
  localLink: 'local:link',
  localUnlink: 'local:unlink',
  localClone: 'local:clone',
  localInfo: 'local:info',
  localGraph: 'local:graph',
  localCommit: 'local:commit',
  localFileHistory: 'local:fileHistory',
  localBlame: 'local:blame',
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
  localDeleteRemoteBranch: 'local:deleteRemoteBranch',
  localDeleteBranches: 'local:deleteBranches',
  localPushBranch: 'local:pushBranch',
  localFastForwardBranch: 'local:fastForwardBranch',
  localPull: 'local:pull',
  localPush: 'local:push',
  localSuggestCommitMessage: 'local:suggestCommitMessage',
  localWorktrees: 'local:worktrees',
  localWorktreeAdd: 'local:worktreeAdd',
  localWorktreeOpen: 'local:worktreeOpen',
  localWorktreeRemove: 'local:worktreeRemove',
  localWorktreeLock: 'local:worktreeLock',
  localWorktreePrune: 'local:worktreePrune',
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
  localRebase: 'local:rebase',
  localRebasePlan: 'local:rebase-plan',
  localRebaseRun: 'local:rebase-run',
  localSkipOperation: 'local:skipOperation',
  localStageHunk: 'local:stageHunk',
  localUnstageHunk: 'local:unstageHunk',
  localDiscardLines: 'local:discardLines',
  localConflictFile: 'local:conflictFile',
  localResolveConflict: 'local:resolveConflict',
  localResolveConflictFile: 'local:resolveConflictFile',
  localOperation: 'local:operation',
  localBisect: 'local:bisect',
  localBisectStart: 'local:bisectStart',
  localBisectMark: 'local:bisectMark',
  localBisectReset: 'local:bisectReset',
  localContinueOperation: 'local:continueOperation',
  localAbortOperation: 'local:abortOperation',
  localRepos: 'local:repos',
  localOpen: 'local:open',
  localRemove: 'local:remove',
  localWatch: 'local:watch',
  localUnwatch: 'local:unwatch',
  aiSaveKey: 'ai:saveKey',
  aiRemoveKey: 'ai:removeKey',
  aiHasKey: 'ai:hasKey',
  aiTest: 'ai:test',
  openExternal: 'openExternal',
  checkForUpdate: 'checkForUpdate',
  releaseNotes: 'releaseNotes',
  notifyEnabled: 'notify:enabled',
  notifySetEnabled: 'notify:setEnabled',
  notifyTest: 'notify:test',
  inboxList: 'inbox:list',
  inboxMarkRead: 'inbox:markRead',
  inboxMarkAllRead: 'inbox:markAllRead',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsRemove: 'projects:remove',
  projectsAddRepos: 'projects:addRepos',
  projectsRemoveRepos: 'projects:removeRepos',
  /** Main to renderer event, not a request. */
  gitProgress: 'git:progress',
  /** Main to renderer event, not a request. */
  repoChanged: 'repo:changed',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  /** Main to renderer event, not a request. */
  terminalData: 'terminal:data',
  /** Main to renderer event, not a request. */
  notifyOpen: 'notify:open',
  /** Main to renderer event, not a request. */
  inboxChanged: 'inbox:changed',
  /** Main to renderer event, not a request. */
  terminalExit: 'terminal:exit'
} as const

/**
 * What a handler returns over IPC. Electron prefixes thrown errors with
 * "Error invoking remote method", so errors travel as data and preload rethrows.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
