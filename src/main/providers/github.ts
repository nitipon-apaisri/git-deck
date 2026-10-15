import type { Contributor, Repo, RepoSummary, Visibility } from '../../shared/types'
import { countItems, getJson, paginate } from '../http'
import type { GitProvider, ProviderUser } from './types'
import { emptySummary, int, isStatus, settled, str, topLanguages } from './util'

interface GhRepo {
  id: number
  name: string
  full_name: string
  owner?: { login?: string }
  description?: string | null
  private?: boolean
  visibility?: string
  default_branch?: string
  html_url?: string
  clone_url?: string
  ssh_url?: string
  stargazers_count?: number
  forks_count?: number
  open_issues_count?: number
  updated_at?: string
  pushed_at?: string
  archived?: boolean
  fork?: boolean
  license?: { spdx_id?: string | null; name?: string } | null
  created_at?: string
  size?: number
  topics?: string[]
}

interface GhContributor {
  login?: string
  avatar_url?: string
  contributions?: number
}

export function githubApiBase(baseUrl: string): string {
  return new URL(baseUrl).host.toLowerCase() === 'github.com' ? 'https://api.github.com' : `${baseUrl}/api/v3`
}

export class GitHubProvider implements GitProvider {
  private readonly api: string
  private readonly headers: Record<string, string>

  constructor(
    private readonly accountId: string,
    baseUrl: string,
    token: string
  ) {
    this.api = githubApiBase(baseUrl)
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  async verify(): Promise<ProviderUser> {
    const u = await getJson<{ login: string; avatar_url?: string }>(`${this.api}/user`, this.headers)
    return { username: u.login, avatarUrl: u.avatar_url }
  }

  async listRepos(): Promise<Repo[]> {
    const items = await paginate<GhRepo>(
      `${this.api}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      this.headers
    )
    return items.map((r) => this.toRepo(r))
  }

  private toRepo(r: GhRepo): Repo {
    const visibility: Visibility =
      r.visibility === 'internal' ? 'internal' : r.private || r.visibility === 'private' ? 'private' : 'public'
    return {
      key: `${this.accountId}:${r.id}`,
      accountId: this.accountId,
      remoteId: String(r.id),
      name: r.name,
      fullName: r.full_name,
      namespace: r.owner?.login ?? r.full_name.split('/')[0],
      description: str(r.description),
      visibility,
      defaultBranch: str(r.default_branch),
      webUrl: str(r.html_url),
      httpUrl: str(r.clone_url),
      sshUrl: str(r.ssh_url),
      stars: int(r.stargazers_count),
      forks: int(r.forks_count),
      openIssues: int(r.open_issues_count),
      updatedAt: str(r.pushed_at ?? r.updated_at),
      archived: r.archived === true,
      fork: r.fork === true
    }
  }

  async getSummary(repo: Repo): Promise<RepoSummary> {
    const base = `${this.api}/repos/${repo.fullName}`
    const h = this.headers
    const [meta, commits, contribs, contribCount, langs, branches, tags, pulls] = await Promise.allSettled([
      getJson<GhRepo>(base, h),
      countItems(`${base}/commits`, h),
      getJson<GhContributor[]>(`${base}/contributors?per_page=25`, h),
      countItems(`${base}/contributors`, h),
      getJson<Record<string, number>>(`${base}/languages`, h),
      countItems(`${base}/branches`, h),
      countItems(`${base}/tags`, h),
      countItems(`${base}/pulls?state=open`, h)
    ])

    const s = emptySummary()
    const m = settled(meta, null)
    if (m) {
      s.license = m.license?.spdx_id && m.license.spdx_id !== 'NOASSERTION' ? m.license.spdx_id : (m.license?.name ?? null)
      s.createdAt = m.created_at ?? null
      s.lastActivityAt = m.pushed_at ?? m.updated_at ?? null
      s.sizeKb = typeof m.size === 'number' ? m.size : null
      s.topics = m.topics ?? []
    }
    // 409 means the repository is empty.
    s.commitCount = isStatus(commits, 409) ? 0 : settled(commits, null)
    s.contributors = (settled(contribs, null) ?? []).map(
      (c): Contributor => ({
        name: str(c.login),
        login: str(c.login),
        email: '',
        avatarUrl: str(c.avatar_url),
        commits: int(c.contributions)
      })
    )
    s.contributorCount = isStatus(contribs, 204) ? 0 : settled(contribCount, null)
    const bytes = settled(langs, {}) ?? {}
    const total = Object.values(bytes).reduce((a, b) => a + b, 0)
    if (total > 0) {
      s.languages = topLanguages(Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, (v / total) * 100])))
    }
    s.branchCount = settled(branches, null)
    s.tagCount = settled(tags, null)
    s.openChangeRequests = settled(pulls, null)
    return s
  }
}
