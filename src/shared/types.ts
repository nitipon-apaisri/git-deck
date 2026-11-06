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
}

export interface RepoStatus {
  /** `null` when HEAD is detached. */
  branch: string | null
  entries: StatusEntry[]
}

export type DiffSource = 'worktree' | 'staged' | 'commit'

export interface DiffRequest {
  source: DiffSource
  path: string
  /** Required when `source` is `commit`. */
  hash?: string
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
