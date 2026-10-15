import type { ProviderType, Repo, RepoSummary } from '../../shared/types'

export interface ProviderUser {
  username: string
  avatarUrl?: string
}

export interface GitProvider {
  verify(): Promise<ProviderUser>
  listRepos(): Promise<Repo[]>
  getSummary(repo: Repo): Promise<RepoSummary>
}

export const DEFAULT_BASE_URL: Record<ProviderType, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com'
}
