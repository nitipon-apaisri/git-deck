import type {
  ChangeRequest,
  ChecksInfo,
  CreateChangeRequestInput,
  ProfileInfo,
  Repo,
  RepoActivity,
  RepoReadme,
  RepoSummary,
  VerifiedUser
} from '../../shared/types'

export type { VerifiedUser }

export interface GitProvider {
  /** Checks the token and returns who it belongs to. Throws `HttpError` on failure. */
  verify(): Promise<VerifiedUser>
  listRepos(): Promise<Repo[]>
  /** The Home profile. Never throws for a single failed piece; throws when every piece failed. */
  getProfile(): Promise<ProfileInfo>
  /** Never throws for a single failed piece: it becomes null or empty. */
  getSummary(repo: Repo): Promise<RepoSummary>
  /** The most recently updated pull/merge requests, any state. */
  listChangeRequests(repo: Repo): Promise<ChangeRequest[]>
  /** Opens a pull/merge request. Throws `HttpError` (403: the token cannot write). */
  createChangeRequest(repo: Repo, input: CreateChangeRequestInput): Promise<ChangeRequest>
  /** CI for a ref. A host or version without the endpoint answers `none`, not an error. */
  getChecks(repo: Repo, ref: string): Promise<ChecksInfo>
  /** The README on the default branch, capped. `null` when there is none (404). */
  readme(repo: Repo): Promise<Omit<RepoReadme, 'source'> | null>
  /** Commits per day for the last 12 months. */
  activity(repo: Repo): Promise<Omit<RepoActivity, 'source'>>
  /** The latest tag names, newest first, at most `MAX_TAGS`. */
  latestTags(repo: Repo): Promise<string[]>
}

export const MAX_CONTRIBUTORS = 25
export const MAX_LANGUAGES = 8
