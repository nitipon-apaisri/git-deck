import type { Repo, RepoSummary, VerifiedUser } from '../../shared/types'

export type { VerifiedUser }

export interface GitProvider {
  /** Checks the token and returns who it belongs to. Throws `HttpError` on failure. */
  verify(): Promise<VerifiedUser>
  listRepos(): Promise<Repo[]>
  /** Never throws for a single failed piece: it becomes null or empty. */
  getSummary(repo: Repo): Promise<RepoSummary>
}

export const MAX_CONTRIBUTORS = 25
export const MAX_LANGUAGES = 8
