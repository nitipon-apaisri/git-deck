import type { ChangeRequest, ChecksInfo, Repo, RepoSummary, VerifiedUser } from '../../shared/types'

export type { VerifiedUser }

export interface GitProvider {
  /** Checks the token and returns who it belongs to. Throws `HttpError` on failure. */
  verify(): Promise<VerifiedUser>
  listRepos(): Promise<Repo[]>
  /** Never throws for a single failed piece: it becomes null or empty. */
  getSummary(repo: Repo): Promise<RepoSummary>
  /** The most recently updated pull/merge requests, any state. */
  listChangeRequests(repo: Repo): Promise<ChangeRequest[]>
  /** CI for a ref. A host or version without the endpoint answers `none`, not an error. */
  getChecks(repo: Repo, ref: string): Promise<ChecksInfo>
}

export const MAX_CONTRIBUTORS = 25
export const MAX_LANGUAGES = 8
