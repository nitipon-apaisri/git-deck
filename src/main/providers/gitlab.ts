import { countItems, getJson, getPage, HttpError, paginate, postJson } from '../http'
import type {
  ChangeRequest,
  CheckState,
  ChecksInfo,
  Contributor,
  CreateChangeRequestInput,
  LanguageShare,
  ProfileInfo,
  Repo,
  RepoSummary,
  Visibility
} from '../../shared/types'
import { MAX_CONTRIBUTORS, MAX_LANGUAGES, type GitProvider, type VerifiedUser } from './types'
import { ok, required, sameOrigin, throwIfAllFailed } from './util'

interface GlUser {
  id: number
  username: string
  avatar_url?: string | null
  name?: string | null
  bio?: string | null
  web_url?: string
  followers?: number
  following?: number
}

interface GlEvent {
  action_name: string
  target_type?: string | null
  target_title?: string | null
  created_at: string
  push_data?: { commit_count?: number; ref?: string } | null
}

/** One short line for a user event. GitLab events carry no project name, only a target. */
export function glEventText(e: GlEvent): string {
  const verb = e.action_name.replace(/\b\w/, (c) => c.toUpperCase())
  if (e.push_data?.ref) return `${verb} ${e.push_data.ref}`
  const target = [e.target_type?.toLowerCase(), e.target_title].filter(Boolean).join(' ')
  return target ? `${verb} ${target}` : verb
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

interface GlMr {
  iid: number
  title: string
  state: string
  draft?: boolean
  work_in_progress?: boolean
  author: { username: string } | null
  reviewers?: { username: string }[]
  labels?: string[]
  source_branch: string
  target_branch: string
  web_url: string
  updated_at: string
}

interface GlPipeline {
  id: number
  status: string
  web_url: string
}

export function normalizeMr(m: GlMr): ChangeRequest {
  return {
    number: m.iid,
    title: m.title,
    state: m.state === 'merged' ? 'merged' : m.state === 'opened' ? 'open' : 'closed',
    draft: m.draft ?? m.work_in_progress ?? false,
    author: m.author?.username ?? '',
    reviewers: (m.reviewers ?? []).map((u) => u.username),
    labels: m.labels ?? [],
    sourceBranch: m.source_branch,
    targetBranch: m.target_branch,
    webUrl: m.web_url,
    updatedAt: m.updated_at,
    checksRef: m.source_branch
  }
}

export function pipelineState(status: string): CheckState {
  if (status === 'success') return 'success'
  if (['failed', 'canceled', 'canceling'].includes(status)) return 'failure'
  // skipped and manual pipelines did not run, so they say nothing.
  return ['skipped', 'manual'].includes(status) ? 'none' : 'pending'
}

export function normalizePipeline(p: GlPipeline | undefined): ChecksInfo {
  if (!p) return { state: 'none', items: [] }
  const state = pipelineState(p.status)
  return { state, items: [{ name: `Pipeline #${p.id}`, state, url: p.web_url }] }
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

  async getProfile(): Promise<ProfileInfo> {
    const h = this.headers
    const user = required(await getJson<GlUser>(`${this.root}/user`, h), 'GitLab')
    const settled = await Promise.allSettled([
      getJson<{ full_path: string; avatar_url?: string | null }[]>(
        `${this.root}/groups?min_access_level=10&per_page=30`,
        h
      ),
      getJson<GlEvent[]>(`${this.root}/users/${user.id}/events?per_page=30`, h),
      getJson<GlProject[]>(
        `${this.root}/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=6`,
        h
      )
    ])
    throwIfAllFailed(settled)
    const [groups, events, projects] = settled
    return {
      username: user.username,
      name: user.name ?? '',
      bio: user.bio ?? '',
      avatarUrl: this.absolute(user.avatar_url) ?? '',
      webUrl: user.web_url ?? '',
      followers: typeof user.followers === 'number' ? user.followers : null,
      following: typeof user.following === 'number' ? user.following : null,
      orgs: (ok(groups, null) ?? []).map((g) => ({
        name: g.full_path,
        avatarUrl: this.absolute(g.avatar_url) ?? ''
      })),
      repoKind: 'recent',
      repos: (ok(projects, null) ?? []).map((p) => ({
        fullName: p.path_with_namespace,
        description: p.description ?? '',
        language: '',
        updatedAt: p.last_activity_at,
        webUrl: p.web_url
      })),
      events: (ok(events, null) ?? [])
        .slice(0, 10)
        .map((e) => ({ text: glEventText(e), at: e.created_at })),
      heatmap: null
    }
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

  async listChangeRequests(repo: Repo): Promise<ChangeRequest[]> {
    const url = `${this.root}/projects/${encodeURIComponent(repo.remoteId)}/merge_requests?state=all&order_by=updated_at&sort=desc&per_page=50`
    return (await paginate<GlMr>(url, this.headers, 2)).map(normalizeMr)
  }

  async createChangeRequest(repo: Repo, input: CreateChangeRequestInput): Promise<ChangeRequest> {
    const url = `${this.root}/projects/${encodeURIComponent(repo.remoteId)}/merge_requests`
    const payload = {
      title: input.draft ? `Draft: ${input.title}` : input.title,
      description: input.body,
      source_branch: input.head,
      target_branch: input.base
    }
    const mr = required(await postJson<GlMr>(url, this.headers, payload), 'GitLab')
    return sameOrigin(normalizeMr(mr), this.root)
  }

  async getChecks(repo: Repo, ref: string): Promise<ChecksInfo> {
    const url = `${this.root}/projects/${encodeURIComponent(repo.remoteId)}/pipelines?ref=${encodeURIComponent(ref)}&order_by=id&sort=desc&per_page=1`
    try {
      const list = await getJson<GlPipeline[]>(url, this.headers)
      return normalizePipeline(Array.isArray(list) ? list[0] : undefined)
    } catch (err) {
      // Pipelines disabled (403/404) or an old version: no CI info. A bad token still throws.
      if (err instanceof HttpError && err.status !== 401 && err.status < 500) {
        return { state: 'none', items: [] }
      }
      throw err
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
