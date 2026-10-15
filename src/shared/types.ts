export type ProviderType = 'github' | 'gitlab'
export type Visibility = 'public' | 'private' | 'internal'

export interface Account {
  id: string
  type: ProviderType
  label: string
  baseUrl: string
  host: string
  username: string
  avatarUrl?: string
  allowInsecureTls: boolean
}

export interface AccountInput {
  type: ProviderType
  label: string
  baseUrl: string
  token: string
  allowInsecureTls: boolean
}

export interface Repo {
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

export interface RepoSummary {
  commitCount: number | null
  contributorCount: number | null
  contributors: Contributor[]
  branchCount: number | null
  tagCount: number | null
  openChangeRequests: number | null
  languages: { name: string; percent: number }[]
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

export interface GraphRef {
  name: string
  kind: 'head' | 'branch' | 'remote' | 'tag'
  current?: boolean
}

export interface GraphCommit {
  hash: string
  parents: string[]
  author: string
  email: string
  /** unix seconds */
  date: number
  refs: GraphRef[]
  subject: string
}

export interface CommitDetail {
  hash: string
  body: string
  /** additions/deletions are null for binary files */
  files: { path: string; additions: number | null; deletions: number | null }[]
}

export interface LocalInfo {
  path: string
  currentBranch: string | null
  headHash: string | null
  detached: boolean
  remotes: { name: string; url: string }[]
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

/** Local state of one linked repository, for the dashboard. `info` is null when it could not be read. */
export interface LocalStatus {
  repoKey: string
  path: string
  info: LocalInfo | null
  error: string | null
}
