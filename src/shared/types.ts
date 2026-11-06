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
}

export type CheckoutTarget =
  | { kind: 'branch'; name: string }
  /** `origin/feature`: checked out as a local branch that tracks it. */
  | { kind: 'remote'; name: string }
  | { kind: 'commit'; hash: string }

export type PullMode = 'ff-only' | 'merge'

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

export interface OperationResult {
  /** The run stopped on conflicts. Abort or continue through `local.operation`. */
  conflicted: boolean
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
}

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
