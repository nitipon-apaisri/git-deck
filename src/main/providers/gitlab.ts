import type { Contributor, Repo, RepoSummary, Visibility } from '../../shared/types'
import { countItems, getJson, getJsonWithHeaders, paginate } from '../http'
import type { GitProvider, ProviderUser } from './types'
import { emptySummary, int, settled, str, topLanguages } from './util'

interface GlProject {
  id: number
  name: string
  path_with_namespace: string
  namespace?: { full_path?: string }
  description?: string | null
  visibility?: string
  default_branch?: string | null
  web_url?: string
  http_url_to_repo?: string
  ssh_url_to_repo?: string
  star_count?: number
  forks_count?: number
  open_issues_count?: number
  last_activity_at?: string
  archived?: boolean
  forked_from_project?: unknown
  created_at?: string
  topics?: string[]
  tag_list?: string[]
  license?: { name?: string; nickname?: string } | null
  statistics?: { commit_count?: number; repository_size?: number } | null
}

interface GlContributor {
  name?: string
  email?: string
  commits?: number
}

export class GitLabProvider implements GitProvider {
  private readonly api: string
  private readonly origin: string
  private readonly headers: Record<string, string>

  constructor(
    private readonly accountId: string,
    baseUrl: string,
    token: string
  ) {
    this.api = `${baseUrl}/api/v4`
    this.origin = new URL(baseUrl).origin
    this.headers = { 'PRIVATE-TOKEN': token }
  }

  private absolute(url: string | undefined | null): string | undefined {
    if (!url) return undefined
    try {
      return new URL(url, this.origin).toString()
    } catch {
      return undefined
    }
  }

  async verify(): Promise<ProviderUser> {
    const u = await getJson<{ username: string; avatar_url?: string | null }>(`${this.api}/user`, this.headers)
    return { username: u.username, avatarUrl: this.absolute(u.avatar_url) }
  }

  async listRepos(): Promise<Repo[]> {
    const items = await paginate<GlProject>(
      `${this.api}/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`,
      this.headers
    )
    return items.map((p) => this.toRepo(p))
  }

  private toRepo(p: GlProject): Repo {
    const visibility: Visibility =
      p.visibility === 'public' ? 'public' : p.visibility === 'internal' ? 'internal' : 'private'
    return {
      key: `${this.accountId}:${p.id}`,
      accountId: this.accountId,
      remoteId: String(p.id),
      name: p.name,
      fullName: p.path_with_namespace,
      namespace: p.namespace?.full_path ?? p.path_with_namespace.split('/').slice(0, -1).join('/'),
      description: str(p.description),
      visibility,
      defaultBranch: str(p.default_branch),
      webUrl: str(p.web_url),
      httpUrl: str(p.http_url_to_repo),
      sshUrl: str(p.ssh_url_to_repo),
      stars: int(p.star_count),
      forks: int(p.forks_count),
      openIssues: int(p.open_issues_count),
      updatedAt: str(p.last_activity_at),
      archived: p.archived === true,
      fork: p.forked_from_project != null
    }
  }

  async getSummary(repo: Repo): Promise<RepoSummary> {
    const base = `${this.api}/projects/${encodeURIComponent(repo.remoteId)}`
    const h = this.headers
    const [meta, contribs, langs, branches, tags, mrs] = await Promise.allSettled([
      getJson<GlProject>(`${base}?statistics=true&license=true`, h),
      getJsonWithHeaders<GlContributor[]>(
        `${base}/repository/contributors?order_by=commits&sort=desc&per_page=100`,
        h
      ),
      getJson<Record<string, number>>(`${base}/languages`, h),
      countItems(`${base}/repository/branches`, h),
      countItems(`${base}/repository/tags`, h),
      countItems(`${base}/merge_requests?state=opened`, h)
    ])

    const s = emptySummary()
    const m = settled(meta, null)
    if (m) {
      s.createdAt = m.created_at ?? null
      s.lastActivityAt = m.last_activity_at ?? null
      s.license = m.license?.nickname ?? m.license?.name ?? null
      s.topics = m.topics ?? m.tag_list ?? []
      const stats = m.statistics
      s.commitCount = typeof stats?.commit_count === 'number' ? stats.commit_count : null
      s.sizeKb = typeof stats?.repository_size === 'number' ? Math.round(stats.repository_size / 1024) : null
    }
    if (s.commitCount === null) {
      // Statistics need Reporter access; fall back to counting commits directly.
      s.commitCount = await countItems(`${base}/repository/commits`, h).catch(() => null)
    }

    const c = settled(contribs, null)
    if (c) {
      const list = c.data ?? []
      const total = Number.parseInt(c.headers.get('x-total') ?? '', 10)
      s.contributorCount = Number.isFinite(total) ? total : list.length
      s.contributors = list.slice(0, 25).map(
        (x): Contributor => ({
          name: str(x.name),
          login: '',
          email: str(x.email),
          avatarUrl: '',
          commits: int(x.commits)
        })
      )
    }
    s.languages = topLanguages(settled(langs, {}) ?? {})
    s.branchCount = settled(branches, null)
    s.tagCount = settled(tags, null)
    s.openChangeRequests = settled(mrs, null)
    return s
  }
}
