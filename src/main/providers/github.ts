import { countItems, getJson, HttpError, paginate } from '../http'
import type {
  ChangeRequest,
  CheckState,
  ChecksInfo,
  Contributor,
  LanguageShare,
  Repo,
  RepoSummary,
  Visibility
} from '../../shared/types'
import { MAX_CONTRIBUTORS, MAX_LANGUAGES, type GitProvider, type VerifiedUser } from './types'
import { encodePath, ok, percent, required, throwIfAllFailed } from './util'

interface GhUser {
  login: string
  avatar_url?: string
}

interface GhRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  private: boolean
  visibility?: string
  default_branch: string
  html_url: string
  clone_url: string
  ssh_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  updated_at: string
  pushed_at: string | null
  created_at: string
  archived: boolean
  fork: boolean
  size: number
  topics?: string[]
  license?: { spdx_id: string | null; name: string } | null
}

interface GhContributor {
  login?: string
  avatar_url?: string
  contributions: number
}

interface GhPull {
  number: number
  title: string
  state: string
  draft?: boolean
  merged_at: string | null
  user: { login: string } | null
  requested_reviewers?: { login: string }[]
  labels?: { name: string }[]
  head: { ref: string; sha: string }
  base: { ref: string }
  html_url: string
  updated_at: string
}

interface GhCheckRun {
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
}

interface GhStatus {
  context: string
  state: string
  target_url: string | null
}

export function normalizePull(p: GhPull): ChangeRequest {
  return {
    number: p.number,
    title: p.title,
    state: p.merged_at ? 'merged' : p.state === 'open' ? 'open' : 'closed',
    draft: p.draft ?? false,
    author: p.user?.login ?? '',
    reviewers: (p.requested_reviewers ?? []).map((u) => u.login),
    labels: (p.labels ?? []).map((l) => l.name),
    sourceBranch: p.head.ref,
    targetBranch: p.base.ref,
    webUrl: p.html_url,
    updatedAt: p.updated_at,
    checksRef: p.head.sha
  }
}

function runState(r: GhCheckRun): CheckState {
  if (r.status !== 'completed') return 'pending'
  if (r.conclusion === 'success' || r.conclusion === 'neutral' || r.conclusion === 'skipped') {
    return 'success'
  }
  return 'failure'
}

function statusState(state: string): CheckState {
  if (state === 'success') return 'success'
  return state === 'pending' ? 'pending' : 'failure'
}

/** Check runs and legacy commit statuses as one list; the worst item sets the state. */
export function normalizeChecks(runs: GhCheckRun[], statuses: GhStatus[]): ChecksInfo {
  const items = [
    ...runs.map((r) => ({ name: r.name, state: runState(r), url: r.html_url })),
    ...statuses.map((s) => ({ name: s.context, state: statusState(s.state), url: s.target_url }))
  ]
  return { state: worstState(items.map((i) => i.state)), items }
}

export function worstState(states: readonly CheckState[]): CheckState {
  if (states.includes('failure')) return 'failure'
  if (states.includes('pending')) return 'pending'
  return states.includes('success') ? 'success' : 'none'
}

function visibilityOf(r: GhRepo): Visibility {
  if (r.visibility === 'public' || r.visibility === 'private' || r.visibility === 'internal') {
    return r.visibility
  }
  return r.private ? 'private' : 'public'
}

/** `github.com` uses `api.github.com`; Enterprise uses `<origin>/api/v3`. */
export function githubApiRoot(baseUrl: string): string {
  const host = new URL(baseUrl).hostname.toLowerCase()
  if (host === 'github.com' || host === 'www.github.com') return 'https://api.github.com'
  return `${baseUrl.replace(/\/+$/, '')}/api/v3`
}

export class GitHubProvider implements GitProvider {
  private readonly root: string
  private readonly headers: Record<string, string>

  constructor(
    private readonly accountId: string,
    baseUrl: string,
    token: string
  ) {
    this.root = githubApiRoot(baseUrl)
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  async verify(): Promise<VerifiedUser> {
    const user = required(await getJson<GhUser>(`${this.root}/user`, this.headers), 'GitHub')
    return { username: user.login, avatarUrl: user.avatar_url }
  }

  async listRepos(): Promise<Repo[]> {
    const raw = await paginate<GhRepo>(
      `${this.root}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      this.headers
    )
    return raw.map((r) => ({
      key: `${this.accountId}:${r.id}`,
      accountId: this.accountId,
      remoteId: String(r.id),
      name: r.name,
      fullName: r.full_name,
      namespace: r.owner.login,
      description: r.description ?? '',
      visibility: visibilityOf(r),
      defaultBranch: r.default_branch ?? '',
      webUrl: r.html_url,
      httpUrl: r.clone_url,
      sshUrl: r.ssh_url,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
      updatedAt: r.pushed_at ?? r.updated_at,
      archived: r.archived,
      fork: r.fork
    }))
  }

  async getSummary(repo: Repo): Promise<RepoSummary> {
    const base = `${this.root}/repos/${encodePath(repo.fullName)}`
    const h = this.headers
    const settled = await Promise.allSettled([
      getJson<GhRepo>(base, h),
      // 409 means an empty repository, which has zero commits.
      countItems(`${base}/commits`, h).catch((err: unknown) => {
        if (err instanceof HttpError && err.status === 409) return 0
        throw err
      }),
      getJson<GhContributor[]>(`${base}/contributors?per_page=${MAX_CONTRIBUTORS}`, h),
      countItems(`${base}/contributors`, h),
      getJson<Record<string, number>>(`${base}/languages`, h),
      countItems(`${base}/branches`, h),
      countItems(`${base}/tags`, h),
      countItems(`${base}/pulls?state=open`, h)
    ])
    throwIfAllFailed(settled)
    const [info, commits, contribList, contribCount, langs, branches, tags, prs] = settled

    const meta = ok(info, null)
    const list = ok(contribList, null)
    const contributors: Contributor[] = (Array.isArray(list) ? list : [])
      .slice(0, MAX_CONTRIBUTORS)
      .map((c) => ({
        name: c.login ?? '',
        login: c.login ?? '',
        email: '',
        avatarUrl: c.avatar_url ?? '',
        commits: c.contributions
      }))

    let contributorCount = ok(contribCount, null)
    // A short list is the whole list, so its length is the count.
    if (contributorCount === null && Array.isArray(list) && list.length < MAX_CONTRIBUTORS) {
      contributorCount = list.length
    }

    return {
      commitCount: ok(commits, null),
      contributorCount,
      contributors,
      branchCount: ok(branches, null),
      tagCount: ok(tags, null),
      openChangeRequests: ok(prs, null),
      languages: languageShares(ok(langs, null)),
      license: meta?.license ? licenseName(meta.license) : null,
      createdAt: meta?.created_at ?? null,
      lastActivityAt: meta ? (meta.pushed_at ?? meta.updated_at ?? null) : null,
      sizeKb: typeof meta?.size === 'number' ? meta.size : null,
      topics: meta?.topics ?? []
    }
  }

  async listChangeRequests(repo: Repo): Promise<ChangeRequest[]> {
    const url = `${this.root}/repos/${encodePath(repo.fullName)}/pulls?state=all&sort=updated&direction=desc&per_page=50`
    return (await paginate<GhPull>(url, this.headers, 2)).map(normalizePull)
  }

  async getChecks(repo: Repo, ref: string): Promise<ChecksInfo> {
    const base = `${this.root}/repos/${encodePath(repo.fullName)}/commits/${encodeURIComponent(ref)}`
    const settled = await Promise.allSettled([
      getJson<{ check_runs?: GhCheckRun[] }>(`${base}/check-runs?per_page=100`, this.headers),
      getJson<{ statuses?: GhStatus[] }>(`${base}/status?per_page=100`, this.headers)
    ])
    // A bad token must surface; a missing endpoint or disabled CI is just "no CI info".
    for (const r of settled) {
      if (r.status === 'rejected' && r.reason instanceof HttpError && r.reason.status === 401) {
        throw r.reason
      }
    }
    return normalizeChecks(
      ok(settled[0], null)?.check_runs ?? [],
      ok(settled[1], null)?.statuses ?? []
    )
  }
}

function licenseName(l: { spdx_id: string | null; name: string }): string {
  return l.spdx_id && l.spdx_id !== 'NOASSERTION' ? l.spdx_id : l.name
}

function languageShares(bytes: Record<string, number> | null): LanguageShare[] {
  if (!bytes) return []
  const entries = Object.entries(bytes).filter(([, n]) => typeof n === 'number' && n > 0)
  const total = entries.reduce((sum, [, n]) => sum + n, 0)
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LANGUAGES)
    .map(([name, n]) => ({ name, percent: percent(n, total) }))
}
