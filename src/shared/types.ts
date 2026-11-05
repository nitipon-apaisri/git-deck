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
