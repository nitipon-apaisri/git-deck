export type AccountType = 'github' | 'gitlab'
export type Visibility = 'public' | 'private' | 'internal'

export interface Account {
  id: string
  type: AccountType
  label: string
  baseUrl: string
  host: string
  username: string
  avatarUrl?: string
  allowInsecureTls: boolean
}

export interface AccountInput {
  type: AccountType
  label: string
  baseUrl: string
  token: string
  allowInsecureTls: boolean
}

/** Who a token belongs to, as reported by the host. */
export interface VerifiedUser {
  username: string
  avatarUrl?: string
}

/** One account's profile for the Home screen. A piece the host would not give is null or empty. */
export interface ProfileInfo {
  username: string
  name: string
  bio: string
  avatarUrl: string
  webUrl: string
  followers: number | null
  following: number | null
  orgs: { name: string; avatarUrl: string }[]
  /** `pinned` when the host has pins (GitHub), else the most recently active. */
  repoKind: 'pinned' | 'recent'
  repos: {
    fullName: string
    description: string
    language: string
    updatedAt: string
    webUrl: string
  }[]
  events: { text: string; at: string }[]
  /** GitHub only (GraphQL). Null when the host has no calendar or the call failed. */
  heatmap: {
    total: number
    days: { date: string; count: number }[]
    /** `events`: counted from the user's events, so an estimate (GitLab has no calendar API). */
    source: 'calendar' | 'events'
  } | null
}

export interface Repo {
  /** `accountId:remoteId` */
  key: string
  accountId: string
  remoteId: string
  name: string
  fullName: string
  namespace: string
  description: string
  visibility: Visibility
  defaultBranch: string
  webUrl: string
  httpUrl: string
  sshUrl: string
  stars: number
  forks: number
  openIssues: number
  updatedAt: string
  archived: boolean
  fork: boolean
  /** Local worktree entries only: the key of the repository it was added from. */
  parentKey?: string
}

export interface Contributor {
  name: string
  login: string
  email: string
  avatarUrl: string
  commits: number
}

export interface LanguageShare {
  name: string
  percent: number
}

/** Counts are `null` when unknown (a failed or unsupported API call). */
export interface RepoSummary {
  commitCount: number | null
  contributorCount: number | null
  contributors: Contributor[]
  branchCount: number | null
  tagCount: number | null
  openChangeRequests: number | null
  languages: LanguageShare[]
  license: string | null
  createdAt: string | null
  lastActivityAt: string | null
  sizeKb: number | null
  topics: string[]
}

/** Where an Overview card's data came from: the linked clone or the host API. */
export type DataSource = 'local' | 'host'

export interface RepoReadme {
  /** File name as found, such as `README.md`. */
  name: string
  markdown: string
  source: DataSource
  /** Cut at the size cap. */
  truncated: boolean
}

export interface ActivityDay {
  /** `YYYY-MM-DD`. */
  date: string
  count: number
}

/** Commits per day for the last 12 months, oldest first, every day present. */
export interface RepoActivity {
  days: ActivityDay[]
  source: DataSource
  /** The host capped the commit list, so counts are a floor. */
  truncated: boolean
  /** GitHub is still computing its statistics (202): show a loading state. */
  computing: boolean
}

export interface RepoTags {
  /** Newest first, at most a handful. */
  names: string[]
  source: DataSource
}

export interface Cached<T> {
  data: T
  fetchedAt: number
}

export type GraphRefKind = 'head' | 'branch' | 'remote' | 'tag'

export interface GraphRef {
  name: string
  kind: GraphRefKind
  current?: boolean
}

export interface GraphCommit {
  hash: string
  parents: string[]
  author: string
  email: string
  /** Unix seconds. */
  date: number
  refs: GraphRef[]
  subject: string
}

export interface CommitFile {
  path: string
  /** `null` for binary files. */
  additions: number | null
  deletions: number | null
}

export interface CommitDetail {
  hash: string
  body: string
  files: CommitFile[]
}

/** What happened to a path, as `git status` reports it for the index or the work tree. */
export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechange'

export interface StatusEntry {
  /** Relative to the repository root, with `/` separators. */
  path: string
  /** The old path of a rename or copy. */
  origPath: string | null
  /** Change staged in the index, `null` when none. */
  index: ChangeKind | null
  /** Change in the work tree not yet staged, `null` when none. */
  worktree: ChangeKind | null
  untracked: boolean
  /** Unmerged: the path has a merge conflict. */
  conflicted: boolean
  /** How the two sides disagree, `null` unless `conflicted`. */
  conflict: ConflictKind | null
}

export interface RepoStatus {
  /** `null` when HEAD is detached. */
  branch: string | null
  /** Hash of HEAD, `null` before the first commit. */
  head: string | null
  entries: StatusEntry[]
}

export type DiffSource = 'worktree' | 'staged' | 'commit'

export interface DiffRequest {
  source: DiffSource
  path: string
  /** Required when `source` is `commit`. */
  hash?: string
}

/**
 * One hunk of a file's staged or unstaged diff. Main rebuilds the patch from the file itself,
 * so a hunk the renderer saw is only named here, never sent back as text.
 */
export interface HunkRequest {
  path: string
  /** Where the hunk was read: `worktree` to stage it, `staged` to unstage it. */
  source: 'worktree' | 'staged'
  /** Position of the hunk in the file's diff. */
  index: number
  /** `hunkFingerprint` of its lines: a diff that changed since it was read is refused. */
  fingerprint: string
  /**
   * Positions in the hunk's `lines` of the added or removed lines to stage or unstage. Absent
   * means the whole hunk.
   */
  lines?: number[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'note'
  text: string
  /** Line number in the old file, `null` for added lines and notes. */
  oldNo: number | null
  /** Line number in the new file, `null` for deleted lines and notes. */
  newNo: number | null
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface FileDiff {
  path: string
  binary: boolean
  /** The patch is too large to show. `hunks` is empty and the counts are zero. */
  tooLarge: boolean
  additions: number
  deletions: number
  /** The diff creates or deletes the file. Such a file is staged as a whole. */
  change: 'created' | 'deleted' | null
  hunks: DiffHunk[]
}

export interface LocalRemote {
  name: string
  /** Credentials already stripped. */
  url: string
}

export interface LocalBranch {
  name: string
  /** `origin/main`, or `null` when the branch tracks nothing. */
  upstream: string | null
  /** The upstream branch was deleted on the remote. */
  gone: boolean
  ahead: number
  behind: number
  current: boolean
}

export interface BranchList {
  /** `null` while HEAD is detached. */
  current: string | null
  detached: boolean
  local: LocalBranch[]
  /** `origin/feature`, without the symbolic `origin/HEAD`. */
  remote: string[]
  remotes: string[]
  /** The remote's HEAD, else `main` or `master`; `null` when none exists. */
  defaultBranch: string | null
}

export interface BranchDeleteItem {
  /** Local `topic`, or remote `origin/topic`. */
  name: string
  remote: boolean
}

export interface BranchDeleteResult extends BranchDeleteItem {
  ok: boolean
  /** Why it was kept, when `ok` is false. */
  error?: string
}

export type CheckoutTarget =
  | { kind: 'branch'; name: string }
  /** `origin/feature`: checked out as a local branch that tracks it. */
  | { kind: 'remote'; name: string }
  | { kind: 'commit'; hash: string }

export type PullMode = 'ff-only' | 'merge'

/** One record of `git worktree list --porcelain`. */
export interface WorktreeEntry {
  path: string
  head: string
  /** Short branch name, null when detached or bare. */
  branch: string | null
  detached: boolean
  bare: boolean
  /** The lock reason ('' when none was given), null when not locked. */
  locked: string | null
  /** Why git would prune it (its folder is gone), null when it is fine. */
  prunable: string | null
  /** The first record: the main working tree. */
  isMain: boolean
  /** Key of the sidebar entry for this folder, when it is open in the app. */
  repoKey: string | null
}

export interface StashEntry {
  /** Position in the stash list, 0 is the newest. */
  index: number
  /** Full hash of the stash commit. Sent back so a list that moved on is noticed. */
  hash: string
  message: string
  /** Branch the stash was made on, when git recorded one. */
  branch: string | null
  /** Unix seconds. */
  createdAt: number
}

export type OperationKind = 'merge' | 'cherry-pick' | 'revert' | 'rebase'

/** A merge, cherry-pick, revert or rebase that stopped and waits for the user. */
export interface OperationState {
  kind: OperationKind
  /** Short hash of the commit being merged, picked or reverted. */
  target: string | null
  /** Paths git could not combine and the user has not staged yet. */
  conflicted: string[]
  /** How each of those paths conflicts. */
  conflictKinds: Record<string, ConflictKind>
  /** Rebase only: the commit it stopped on and how many it replays. `null` otherwise. */
  step: { current: number; total: number } | null
}

export type ResetMode = 'soft' | 'mixed' | 'hard'

/** What a hard reset to a commit would throw away. Shown in the confirm. */
export interface ResetImpact {
  /** Commits on the current branch that the commit does not contain. */
  commits: number
  /** Tracked files with staged or unstaged changes. Untracked files are never touched. */
  files: number
}

export interface TagEntry {
  name: string
  /** The commit the tag points at (an annotated tag is followed to its commit). */
  hash: string
  annotated: boolean
  /** First line of an annotated tag's message. */
  message: string | null
  /** Unix seconds: when the tag was made, or its commit's date for a lightweight tag. */
  createdAt: number
}

/** The `XY` of an unmerged path: "us" is the current side, "them" the incoming one. */
export type ConflictKind =
  | 'both-modified'
  | 'both-added'
  | 'deleted-by-us'
  | 'deleted-by-them'
  | 'added-by-us'
  | 'added-by-them'
  | 'both-deleted'

/** Whole-file ways out. `ours` and `theirs` are git's sides (see `sideLabels`). */
export type ConflictAction = 'ours' | 'theirs' | 'keep' | 'delete' | 'mark-resolved'

export interface SideLabels {
  ours: string
  theirs: string
}

/** One `<<<<<<<` block. Lines keep their own trailing `\r`, so a CRLF file is written back as read. */
export interface ConflictRegion {
  type: 'conflict'
  ours: string[]
  /** The common ancestor, only in `diff3` and `zdiff3` files. */
  base: string[] | null
  theirs: string[]
  oursLabel: string
  baseLabel: string | null
  theirsLabel: string
  /** The marker lines as read, so a region left open is written back unchanged. */
  marks: { start: string; base: string | null; sep: string; end: string }
}

export interface ConflictText {
  type: 'text'
  lines: string[]
}

export type ConflictSegment = ConflictText | ConflictRegion

/** What replaces one region. `null` leaves it open. `both` is ours, then theirs. */
export type ConflictChoice = 'ours' | 'theirs' | 'both' | 'base' | { text: string } | null

export type ConflictUnsupported =
  /** No markers to edit: use the whole-file actions. */
  'whole-file' | 'binary' | 'too-large' | 'submodule' | 'symlink' | 'unparseable'

export interface ConflictFile {
  path: string
  kind: ConflictKind
  /** Why there are no regions, `null` when `segments` is set. */
  unsupported: ConflictUnsupported | null
  /** Say what is wrong when `unsupported` is `unparseable`. */
  detail: string | null
  /** `null` unless `segments` is set. */
  eol: '\n' | '\r\n' | null
  finalNewline: boolean
  segments: ConflictSegment[] | null
  /** Names the content that `segments` came from. Send it back with the choices. */
  fingerprint: string | null
  actions: ConflictAction[]
  /** The merge, cherry-pick, revert or rebase the conflict belongs to, `null` for a stash. */
  operation: OperationKind | null
  labels: SideLabels
}

export interface ConflictRequest {
  path: string
  fingerprint: string
  /** One entry per region, in file order. */
  choices: ConflictChoice[]
}

export interface ConflictSaveResult {
  /** No region is left open and the file is staged, so it left the conflict list. */
  staged: boolean
  /** Regions still holding markers. */
  open: number
  fingerprint: string
}

/** `ff` may fast-forward, `no-ff` always makes a merge commit, `squash` makes one plain commit. */
export type MergeMode = 'ff' | 'no-ff' | 'squash'

export interface OperationResult {
  /** The run stopped on conflicts. Abort or continue through `local.operation`. */
  conflicted: boolean
}

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'

export interface RebaseTodoItem {
  action: RebaseAction
  hash: string
  /** The new message of a `reword`. Never part of the todo text or a command line. */
  message?: string
}

export interface RebasePlan {
  /** The commits to replay, oldest first. */
  commits: { hash: string; subject: string; message: string }[]
  /** Hashes of those commits that a remote-tracking branch already has. */
  pushed: string[]
}

export interface LocalInfo {
  path: string
  currentBranch: string | null
  headHash: string | null
  detached: boolean
  remotes: LocalRemote[]
  localBranches: number | null
  remoteBranches: number | null
  tags: number | null
  latestTags: string[]
  commitCount: number | null
  firstCommitAt: number | null
  lastCommitAt: number | null
  dirtyFiles: number | null
  ahead: number | null
  behind: number | null
  sizeKb: number | null
}

export interface Project {
  id: string
  name: string
  /** Built-in icon id or a single emoji. */
  icon: string
  /** One of the palette ids. */
  color: string
  /** `accountId:remoteId` */
  repoKeys: string[]
  createdAt: number
  updatedAt: number
  /** PR/MR events to show as notifications. Missing or empty: off (the default). */
  notify?: NotifyEvent[]
}

/** `review`: a reviewer was requested, not a review submitted (the list has no reviews). */
export type NotifyEvent = 'created' | 'merged' | 'closed' | 'review' | 'checksFailed'

/** Computed in the renderer, never stored. */
export interface ProjectSummary {
  repoCount: number
  loadedCount: number
  commits: number
  contributors: number
  openChangeRequests: number
  lastActivityAt: string | null
  partial: boolean
}

export type CheckState = 'success' | 'failure' | 'pending' | 'none'

/** One pull request (GitHub) or merge request (GitLab), as the host reports it. */
export interface ChangeRequest {
  number: number
  title: string
  state: 'open' | 'merged' | 'closed'
  draft: boolean
  author: string
  reviewers: string[]
  labels: string[]
  sourceBranch: string
  targetBranch: string
  webUrl: string
  updatedAt: string
  /** What `getChecks` takes: the head commit (GitHub) or the source branch (GitLab). */
  checksRef: string
}

/** What "Create PR/MR" sends. `head` and `base` are branch names in the same repository. */
export interface CreateChangeRequestInput {
  title: string
  body: string
  head: string
  base: string
  draft: boolean
}

/** CI for one ref. `none` is "no CI info": no CI, or a host without the endpoint. */
export interface ChecksInfo {
  state: CheckState
  items: { name: string; state: CheckState; url: string | null }[]
}

/** One commit that touched a file. `path` is the file's name at that commit (renames). */
export interface FileHistoryEntry {
  hash: string
  author: string
  /** Unix seconds. */
  date: number
  subject: string
  path: string
}

export interface FileHistoryPage {
  entries: FileHistoryEntry[]
  hasMore: boolean
}

export interface BlameLine {
  /** 1-based line number in the blamed version. */
  line: number
  text: string
  hash: string
  author: string
  /** Unix seconds. */
  date: number
  /** Not committed yet: the line is only in the work tree. */
  uncommitted: boolean
  /** The root commit of a shallow or ordinary history: the line is older than we can see. */
  boundary: boolean
}

export interface FileBlame {
  /** A binary file has no lines to blame. */
  binary: boolean
  lines: BlameLine[]
}

/** A `git bisect` in progress, read from the git dir. */
export interface BisectState {
  /** The commit marked bad, `null` until one is. */
  bad: string | null
  good: string[]
  skipped: string[]
  /** The commit checked out for testing (HEAD). */
  current: string | null
  /** Set when git found the first bad commit. */
  result: { hash: string; subject: string } | null
}

export type BisectMark = 'good' | 'bad' | 'skip'

/** A GitHub release newer than the installed version; `body` is its Markdown notes. */
export interface ReleaseNote {
  version: string
  url: string
  body: string
}

/** Result of the manual update check. `latest` is null when nothing newer exists. */
export interface UpdateCheck {
  current: string
  latest: { version: string; url: string } | null
}
