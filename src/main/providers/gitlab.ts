import { countItems, getJson, getPage, paginate } from '../http'
import type { Contributor, LanguageShare, Repo, RepoSummary, Visibility } from '../../shared/types'
import { MAX_CONTRIBUTORS, MAX_LANGUAGES, type GitProvider, type VerifiedUser } from './types'
import { ok, required, throwIfAllFailed } from './util'

interface GlUser {
  username: string
  avatar_url?: string | null
}

interface GlProject {
  id: number
  name: string
  path_with_namespace: string
  namespace?: { full_path?: string }
  description: string | null
  visibility: string
  default_branch?: string | null
  web_url: string
  http_url_to_repo: string
  ssh_url_to_repo: string
  star_count: number
  forks_count: number
  open_issues_count?: number
  last_activity_at: string
  created_at?: string
  archived?: boolean
  forked_from_project?: unknown
  topics?: string[]
  tag_list?: string[]
  license?: { nickname?: string | null; name?: string } | null
  statistics?: { commit_count?: number; repository_size?: number } | null
}

interface GlContributor {
  name: string
  email: string
  commits: number
}

function visibilityOf(v: string): Visibility {
  return v === 'public' || v === 'internal' ? v : 'private'
}

export class GitLabProvider implements GitProvider {
  private readonly baseUrl: string
  private readonly root: string
  private readonly headers: Record<string, string>

  constructor(
    private readonly accountId: string,
    baseUrl: string,
    token: string
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.root = `${this.baseUrl}/api/v4`
    this.headers = { 'PRIVATE-TOKEN': token }
  }

  /** Relative avatar URLs (self-hosted) become absolute against the base URL. */
  private absolute(url: string | null | undefined): string | undefined {
    if (!url) return undefined
    try {
      return new URL(url, `${this.baseUrl}/`).toString()
    } catch {
      return undefined
    }
  }

  async verify(): Promise<VerifiedUser> {
    const user = required(await getJson<GlUser>(`${this.root}/user`, this.headers), 'GitLab')
    return { username: user.username, avatarUrl: this.absolute(user.avatar_url) }
  }

  async listRepos(): Promise<Repo[]> {
    const raw = await paginate<GlProject>(
      `${this.root}/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`,
      this.headers
    )
    return raw.map((p) => ({
      key: `${this.accountId}:${p.id}`,
      accountId: this.accountId,
      remoteId: String(p.id),
      name: p.name,
      fullName: p.path_with_namespace,
      namespace: p.namespace?.full_path ?? p.path_with_namespace.split('/').slice(0, -1).join('/'),
      description: p.description ?? '',
      visibility: visibilityOf(p.visibility),
      defaultBranch: p.default_branch ?? '',
      webUrl: p.web_url,
      httpUrl: p.http_url_to_repo,
      sshUrl: p.ssh_url_to_repo,
      stars: p.star_count ?? 0,
      forks: p.forks_count ?? 0,
      openIssues: p.open_issues_count ?? 0,
      updatedAt: p.last_activity_at,
      archived: p.archived ?? false,
      fork: p.forked_from_project != null
    }))
  }

  async getSummary(repo: Repo): Promise<RepoSummary> {
    const base = `${this.root}/projects/${encodeURIComponent(repo.remoteId)}`
    const h = this.headers
    const settled = await Promise.allSettled([
      getJson<GlProject>(`${base}?statistics=true&license=true`, h),
      getPage<GlContributor>(
        `${base}/repository/contributors?order_by=commits&sort=desc&per_page=100`,
        h
      ),
      getJson<Record<string, number>>(`${base}/languages`, h),
      countItems(`${base}/repository/branches`, h),
      countItems(`${base}/repository/tags`, h),
      countItems(`${base}/merge_requests?state=opened`, h)
    ])
    throwIfAllFailed(settled)
    const [info, contribs, langs, branches, tags, mrs] = settled

    const meta = ok(info, null)
    let commitCount: number | null = meta?.statistics?.commit_count ?? null
    if (commitCount === null) {
      // Low permission: no statistics. Count through the commits endpoint instead.
      try {
        commitCount = await countItems(`${base}/repository/commits`, h)
      } catch {
        commitCount = null
      }
    }

    const page = ok(contribs, null)
    const contributors: Contributor[] = (page?.items ?? []).slice(0, MAX_CONTRIBUTORS).map((c) => ({
      name: c.name,
      login: '',
      email: c.email,
      avatarUrl: '',
      commits: c.commits
    }))

    const repoSize = meta?.statistics?.repository_size
    return {
      commitCount,
      contributorCount: page ? (page.total ?? page.items.length) : null,
      contributors,
      branchCount: ok(branches, null),
      tagCount: ok(tags, null),
      openChangeRequests: ok(mrs, null),
      languages: languageShares(ok(langs, null)),
      license: meta?.license ? (meta.license.nickname ?? meta.license.name ?? null) : null,
      createdAt: meta?.created_at ?? null,
      lastActivityAt: meta?.last_activity_at ?? null,
      sizeKb: typeof repoSize === 'number' ? Math.round(repoSize / 1024) : null,
      topics: meta?.topics ?? meta?.tag_list ?? []
    }
  }
}

function languageShares(percents: Record<string, number> | null): LanguageShare[] {
  if (!percents) return []
  return Object.entries(percents)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LANGUAGES)
    .map(([name, n]) => ({ name, percent: Math.round(n * 10) / 10 }))
}
