import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, test } from 'node:test'
import { HttpError } from '../src/main/http'
import { createProvider, normalizeBaseUrl } from '../src/main/providers'
import { GitHubProvider, githubApiRoot } from '../src/main/providers/github'
import { GitLabProvider, eventHeatmap } from '../src/main/providers/gitlab'
import type { Repo } from '../src/shared/types'

const TOKEN = 'test-token-abc'
let server: Server
let base = ''
let seen: { url: string; headers: IncomingMessage['headers'] }[] = []

type Send = (code: number, body?: unknown, headers?: Record<string, string>) => void

function ghRepo(id: number, full: string, extra: Record<string, unknown> = {}): unknown {
  const [owner, name] = full.split('/')
  return {
    id,
    name,
    full_name: full,
    owner: { login: owner },
    description: null,
    private: true,
    default_branch: 'main',
    html_url: `https://gh.example/${full}`,
    clone_url: `https://gh.example/${full}.git`,
    ssh_url: `git@gh.example:${full}.git`,
    stargazers_count: 3,
    forks_count: 1,
    open_issues_count: 2,
    updated_at: '2026-01-02T00:00:00Z',
    pushed_at: '2026-01-03T00:00:00Z',
    created_at: '2020-01-01T00:00:00Z',
    archived: false,
    fork: false,
    size: 1234,
    topics: ['git'],
    license: { spdx_id: 'MIT', name: 'MIT License' },
    ...extra
  }
}

function lastPage(path: string, n: number): Record<string, string> {
  return { link: `<${base}${path}?per_page=1&page=${n}>; rel="last"` }
}

function github(url: URL, send: Send): void {
  const p = url.pathname.replace('/api/v3', '')
  const perPage = url.searchParams.get('per_page')
  switch (p) {
    case '/user':
      return send(200, { login: 'octo', avatar_url: 'https://gh.example/octo.png' })
    case '/user/orgs':
      return send(200, [{ login: 'acme', avatar_url: 'https://gh.example/acme.png' }])
    case '/users/octo/events':
      return send(200, [
        {
          type: 'PushEvent',
          created_at: '2026-03-01T00:00:00Z',
          repo: { name: 'octo/hello' },
          payload: { size: 3 }
        },
        {
          type: 'WatchEvent',
          created_at: '2026-02-28T00:00:00Z',
          repo: { name: 'acme/kit' },
          payload: {}
        }
      ])
    case '/user/repos':
      if (perPage === '6') return send(200, [ghRepo(1, 'octo/hello')])
      return url.searchParams.get('page') === '2'
        ? send(200, [ghRepo(3, 'octo/third', { private: false, visibility: 'public' })])
        : send(200, [ghRepo(1, 'octo/hello'), ghRepo(2, 'octo/empty')], {
            link: `<${base}/api/v3/user/repos?per_page=100&page=2>; rel="next"`
          })
    case '/repos/octo/hello':
      return send(200, ghRepo(1, 'octo/hello'))
    case '/repos/octo/hello/commits':
      return send(200, [{}], lastPage('/api/v3/repos/octo/hello/commits', 57))
    case '/repos/octo/hello/contributors':
      return perPage === '1'
        ? send(200, [{}], lastPage('/api/v3/repos/octo/hello/contributors', 2))
        : send(200, [
            { login: 'a', avatar_url: 'https://gh.example/a.png', contributions: 40 },
            { login: 'b', avatar_url: 'https://gh.example/b.png', contributions: 17 }
          ])
    case '/repos/octo/hello/languages':
      return send(200, { TypeScript: 3000, CSS: 1000 })
    case '/repos/octo/hello/branches':
      return send(200, [{}], lastPage('/api/v3/repos/octo/hello/branches', 5))
    case '/repos/octo/hello/tags':
      return send(200, [])
    case '/repos/octo/hello/pulls':
      return send(200, [{}], lastPage('/api/v3/repos/octo/hello/pulls', 3))
    // Empty repository: 409 on commits, 403 on contributors.
    case '/repos/octo/empty':
      return send(200, ghRepo(2, 'octo/empty'))
    case '/repos/octo/empty/commits':
      return send(409, { message: 'Git Repository is empty.' })
    case '/repos/octo/empty/contributors':
      return send(403, { message: 'too large' })
    case '/repos/octo/empty/languages':
      return send(200, {})
    case '/repos/octo/empty/branches':
    case '/repos/octo/empty/tags':
    case '/repos/octo/empty/pulls':
      return send(200, [])
    default:
      return send(404, { message: 'Not Found' })
  }
}

let pins = true
/** A test's own answers, tried before the shared ones. Returns true when it answered. */
let route: ((url: URL, send: Send) => boolean) | null = null
let graphqlDown = false

function graphql(send: Send): void {
  if (graphqlDown) return send(502, { message: 'bad gateway' })
  send(200, {
    data: {
      viewer: {
        pinnedItems: {
          nodes: pins
            ? [
                {
                  nameWithOwner: 'octo/hello',
                  description: 'Hi',
                  url: 'https://gh.example/octo/hello',
                  updatedAt: '2026-03-01T00:00:00Z',
                  primaryLanguage: { name: 'TypeScript' }
                }
              ]
            : []
        },
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 5,
            weeks: [
              {
                contributionDays: [
                  { date: '2026-03-01', contributionCount: 2 },
                  { date: '2026-03-02', contributionCount: 3 }
                ]
              }
            ]
          }
        }
      }
    }
  })
}

const glProject = (id: number, path: string, extra: Record<string, unknown> = {}): unknown => ({
  id,
  name: path.split('/').pop(),
  path_with_namespace: path,
  namespace: { full_path: path.split('/').slice(0, -1).join('/') },
  description: 'desc',
  visibility: 'internal',
  default_branch: 'main',
  web_url: `https://gl.example/${path}`,
  http_url_to_repo: `https://gl.example/${path}.git`,
  ssh_url_to_repo: `git@gl.example:${path}.git`,
  star_count: 1,
  forks_count: 0,
  open_issues_count: 4,
  last_activity_at: '2026-02-01T00:00:00Z',
  created_at: '2021-01-01T00:00:00Z',
  topics: ['ops'],
  ...extra
})

function gitlab(url: URL, send: Send): void {
  const p = url.pathname.replace('/gitlab/api/v4', '')
  switch (p) {
    case '/user':
      return send(200, {
        id: 7,
        username: 'gl',
        name: 'Gil Lab',
        bio: 'Ops',
        web_url: 'https://gl.example/gl',
        followers: 4,
        following: 2,
        avatar_url: '/gitlab/uploads/a.png'
      })
    case '/groups':
      return send(200, [{ full_path: 'team', avatar_url: null }])
    case '/users/7/events': {
      // Honour the date window: today's events in the newest window, one 100 days ago in the fourth.
      const before = url.searchParams.get('before') ?? ''
      const at = (offset: number): string =>
        new Date(Date.now() + offset * 86_400_000).toISOString()
      if (before === at(1).slice(0, 10))
        return send(200, [
          { action_name: 'pushed to', created_at: at(0), push_data: { ref: 'main' } },
          {
            action_name: 'opened',
            target_type: 'MergeRequest',
            target_title: 'Fix CI',
            created_at: at(0)
          }
        ])
      if (before === at(1 - 3 * 31).slice(0, 10))
        return send(200, [{ action_name: 'commented on', created_at: at(-100) }])
      return send(200, [])
    }
    case '/projects':
      if (url.searchParams.get('per_page') === '6') return send(200, [glProject(10, 'team/full')])
      // Relative next link on a path-prefixed install.
      return url.searchParams.get('page') === '2'
        ? send(200, [glProject(12, 'team/sub/locked', { forked_from_project: { id: 1 } })])
        : send(200, [glProject(10, 'team/full'), glProject(11, 'team/nostats')], {
            link: '</gitlab/api/v4/projects?membership=true&page=2>; rel="next"'
          })
    case '/projects/10':
      return send(
        200,
        glProject(10, 'team/full', {
          statistics: { commit_count: 120, repository_size: 2048 * 1024 },
          license: { nickname: 'MIT', name: 'MIT License' }
        })
      )
    case '/projects/10/repository/contributors':
      return send(200, [{ name: 'A', email: 'a@x', commits: 9 }], { 'x-total': '31' })
    case '/projects/10/languages':
      return send(200, { Ruby: 80.55, Shell: 19.45 })
    case '/projects/10/repository/branches':
      return send(200, [{}], { 'x-total': '4' })
    case '/projects/10/repository/tags':
      return send(200, [], { 'x-total': '0' })
    case '/projects/10/merge_requests':
      return send(200, [{}], { 'x-total': '2' })
    // No statistics (low permission): fall back to counting commits.
    case '/projects/11':
      return send(200, glProject(11, 'team/nostats'))
    case '/projects/11/repository/commits':
      return send(200, [{}], { 'x-total': '9' })
    case '/projects/11/repository/contributors':
      return send(200, [
        { name: 'A', email: 'a@x', commits: 5 },
        { name: 'B', email: 'b@x', commits: 4 }
      ])
    case '/projects/12':
      return send(200, glProject(12, 'team/sub/locked'))
    default:
      return send(p.startsWith('/projects/12/') ? 403 : 404, { message: 'nope' })
  }
}

before(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    seen.push({ url: req.url ?? '', headers: req.headers })
    const url = new URL(req.url ?? '/', base)
    const send: Send = (code, body, headers = {}) => {
      res.writeHead(code, { 'content-type': 'application/json', ...headers })
      res.end(body === undefined ? undefined : JSON.stringify(body))
    }
    const wrongAuth = url.pathname.startsWith('/gitlab/')
      ? req.headers['private-token'] !== TOKEN
      : req.headers['authorization'] !== `Bearer ${TOKEN}`
    if (wrongAuth) return send(401, { message: 'bad credentials' })
    if (route?.(url, send)) return
    if (url.pathname === '/api/graphql') return graphql(send)
    if (url.pathname.startsWith('/api/v3/')) return github(url, send)
    if (url.pathname.startsWith('/gitlab/api/v4/')) return gitlab(url, send)
    return send(404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

beforeEach(() => {
  seen = []
  route = null
})

after(() => server.close())

test('normalizeBaseUrl: defaults, scheme, protocol, slash, path prefix', () => {
  assert.equal(normalizeBaseUrl('github', ''), 'https://github.com')
  assert.equal(normalizeBaseUrl('gitlab', '  '), 'https://gitlab.com')
  assert.equal(normalizeBaseUrl('gitlab', 'git.corp.example'), 'https://git.corp.example')
  assert.equal(normalizeBaseUrl('gitlab', 'http://git.corp.example/'), 'http://git.corp.example')
  assert.equal(
    normalizeBaseUrl('gitlab', 'https://corp.example/gitlab///?x=1#top'),
    'https://corp.example/gitlab'
  )
  assert.throws(() => normalizeBaseUrl('gitlab', 'ftp://corp.example'))
  assert.throws(() => normalizeBaseUrl('gitlab', 'https://user:pw@corp.example'))
  assert.throws(() => normalizeBaseUrl('gitlab', 'https://'))
})

test('githubApiRoot: github.com vs Enterprise', () => {
  assert.equal(githubApiRoot('https://github.com'), 'https://api.github.com')
  assert.equal(githubApiRoot('https://ghe.corp.example'), 'https://ghe.corp.example/api/v3')
  assert.equal(githubApiRoot('https://corp.example/ghe'), 'https://corp.example/ghe/api/v3')
})

test('GitHub: verify sends the documented headers', async () => {
  const user = await new GitHubProvider('acc', base, TOKEN).verify()
  assert.deepEqual(user, { username: 'octo', avatarUrl: 'https://gh.example/octo.png' })
  const h = seen[0].headers
  assert.equal(h['authorization'], `Bearer ${TOKEN}`)
  assert.equal(h['accept'], 'application/vnd.github+json')
  assert.equal(h['x-github-api-version'], '2022-11-28')
})

test('GitHub: listRepos follows Link pages and maps every field', async () => {
  const repos = await new GitHubProvider('acc', base, TOKEN).listRepos()
  assert.deepEqual(
    repos.map((r) => r.key),
    ['acc:1', 'acc:2', 'acc:3']
  )
  assert.deepEqual(repos[0], {
    key: 'acc:1',
    accountId: 'acc',
    remoteId: '1',
    name: 'hello',
    fullName: 'octo/hello',
    namespace: 'octo',
    description: '',
    visibility: 'private',
    defaultBranch: 'main',
    webUrl: 'https://gh.example/octo/hello',
    httpUrl: 'https://gh.example/octo/hello.git',
    sshUrl: 'git@gh.example:octo/hello.git',
    stars: 3,
    forks: 1,
    openIssues: 2,
    updatedAt: '2026-01-03T00:00:00Z',
    archived: false,
    fork: false
  })
  assert.equal(repos[2].visibility, 'public')
  assert.match(seen[0].url, /affiliation=owner,collaborator,organization_member/)
})

test('GitHub: getSummary fills every field', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  const repo = (await p.listRepos())[0]
  const s = await p.getSummary(repo)
  assert.equal(s.commitCount, 57)
  assert.equal(s.contributorCount, 2)
  assert.deepEqual(
    s.contributors.map((c) => [c.login, c.commits]),
    [
      ['a', 40],
      ['b', 17]
    ]
  )
  assert.deepEqual(s.languages, [
    { name: 'TypeScript', percent: 75 },
    { name: 'CSS', percent: 25 }
  ])
  assert.equal(s.branchCount, 5)
  assert.equal(s.tagCount, 0)
  assert.equal(s.openChangeRequests, 3)
  assert.equal(s.license, 'MIT')
  assert.equal(s.createdAt, '2020-01-01T00:00:00Z')
  assert.equal(s.lastActivityAt, '2026-01-03T00:00:00Z')
  assert.equal(s.sizeKb, 1234)
  assert.deepEqual(s.topics, ['git'])
})

test('GitHub: a 409 on commits means an empty repo (0), a 403 on contributors only nulls that piece', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  const repo = (await p.listRepos())[1]
  const s = await p.getSummary(repo)
  assert.equal(s.commitCount, 0)
  assert.equal(s.contributorCount, null)
  assert.deepEqual(s.contributors, [])
  assert.equal(s.branchCount, 0)
  assert.equal(s.openChangeRequests, 0)
  assert.deepEqual(s.languages, [])
  assert.equal(s.license, 'MIT')
})

test('GitHub: a repository the host cannot find (every request 404s) is an error, not an empty summary', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  const repo = { ...(await p.listRepos())[0], fullName: 'octo/missing' }
  await assert.rejects(
    p.getSummary(repo),
    (err: unknown) => err instanceof HttpError && err.status === 404
  )
})

test('GitLab: verify uses PRIVATE-TOKEN and makes a relative avatar absolute', async () => {
  const user = await new GitLabProvider('acc', `${base}/gitlab`, TOKEN).verify()
  assert.deepEqual(user, { username: 'gl', avatarUrl: `${base}/gitlab/uploads/a.png` })
  assert.equal(seen[0].headers['private-token'], TOKEN)
  assert.equal(seen[0].headers['authorization'], undefined)
  assert.equal(seen[0].url, '/gitlab/api/v4/user')
})

test('GitLab: listRepos follows a relative Link on a path-prefixed install', async () => {
  const repos = await new GitLabProvider('acc', `${base}/gitlab`, TOKEN).listRepos()
  assert.deepEqual(
    repos.map((r) => [r.key, r.fullName, r.namespace, r.fork]),
    [
      ['acc:10', 'team/full', 'team', false],
      ['acc:11', 'team/nostats', 'team', false],
      ['acc:12', 'team/sub/locked', 'team/sub', true]
    ]
  )
  assert.equal(repos[0].visibility, 'internal')
  assert.equal(repos[0].httpUrl, 'https://gl.example/team/full.git')
  assert.match(seen[0].url, /order_by=last_activity_at&sort=desc/)
})

test('GitLab: getSummary uses statistics and x-total', async () => {
  const p = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  const s = await p.getSummary((await p.listRepos())[0])
  assert.equal(s.commitCount, 120)
  assert.equal(s.contributorCount, 31)
  assert.equal(s.contributors.length, 1)
  assert.equal(s.sizeKb, 2048)
  assert.equal(s.license, 'MIT')
  assert.deepEqual(s.languages, [
    { name: 'Ruby', percent: 80.6 },
    { name: 'Shell', percent: 19.5 }
  ])
  assert.equal(s.branchCount, 4)
  assert.equal(s.tagCount, 0)
  assert.equal(s.openChangeRequests, 2)
  assert.deepEqual(s.topics, ['ops'])
  assert.ok(
    seen.every((r) => !r.url.includes('/commits')),
    'no fallback needed'
  )
})

test('GitLab: missing statistics falls back to counting commits; contributor count falls back to the array length', async () => {
  const p = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  const s = await p.getSummary((await p.listRepos())[1])
  assert.equal(s.commitCount, 9)
  assert.equal(s.contributorCount, 2)
  assert.equal(s.sizeKb, null)
})

test('GitLab: a 403 on every sub-resource leaves nulls and empties, not an error', async () => {
  const p = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  const s = await p.getSummary((await p.listRepos())[2])
  assert.equal(s.commitCount, null)
  assert.equal(s.contributorCount, null)
  assert.deepEqual(s.contributors, [])
  assert.deepEqual(s.languages, [])
  assert.equal(s.branchCount, null)
  assert.equal(s.openChangeRequests, null)
  assert.deepEqual(s.topics, ['ops'])
})

test('GitHub and GitLab: a summary where every piece failed rejects, so it is not cached as empty', async () => {
  const good = new GitHubProvider('acc', base, TOKEN)
  const ghRepoRow = (await good.listRepos())[0]
  const glGood = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  const glRepoRow = (await glGood.listRepos())[0]
  // A refused token fails every request.
  const bad = 'wrong-token-xyz'
  await assert.rejects(
    new GitHubProvider('acc', base, bad).getSummary(ghRepoRow),
    (err: unknown) => {
      assert.ok(err instanceof HttpError)
      assert.equal(err.status, 401)
      assert.ok(!err.message.includes(bad))
      return true
    }
  )
  await assert.rejects(
    new GitLabProvider('acc', `${base}/gitlab`, bad).getSummary(glRepoRow),
    (err: unknown) => err instanceof HttpError && err.status === 401
  )
  // A host that is not there at all.
  await assert.rejects(new GitHubProvider('acc', 'http://127.0.0.1:1', TOKEN).getSummary(ghRepoRow))
  await assert.rejects(
    new GitLabProvider('acc', 'http://127.0.0.1:1/gitlab', TOKEN).getSummary(glRepoRow)
  )
})

test('createProvider normalises the base URL and picks the provider', async () => {
  const gl = createProvider({ id: 'a', type: 'gitlab', baseUrl: `${base}/gitlab/` }, TOKEN)
  assert.equal((await gl.verify()).username, 'gl')
  assert.ok(gl instanceof GitLabProvider)
  const gh = createProvider({ id: 'a', type: 'github', baseUrl: '' }, TOKEN)
  assert.ok(gh instanceof GitHubProvider)
  assert.throws(() => createProvider({ id: 'a', type: 'gitlab', baseUrl: 'ftp://x' }, TOKEN))
})

test('the token is only ever sent in a header, and never appears in an error', async () => {
  const bad = 'wrong-token-xyz'
  for (const provider of [
    new GitHubProvider('a', base, bad),
    new GitLabProvider('a', `${base}/gitlab`, bad)
  ]) {
    await assert.rejects(provider.verify(), (err: unknown) => {
      assert.ok(err instanceof HttpError)
      assert.equal(err.status, 401)
      assert.ok(!err.message.includes(bad) && !String(err.stack).includes(bad))
      return true
    })
  }
  await new GitHubProvider('a', base, TOKEN).listRepos()
  await new GitLabProvider('a', `${base}/gitlab`, TOKEN).listRepos()
  assert.ok(seen.every((r) => !r.url.includes(TOKEN) && !r.url.includes(bad)))
})

test('GitHub: getProfile reads pins and the contribution calendar through GraphQL', async () => {
  pins = true
  graphqlDown = false
  const p = await new GitHubProvider('acc', base, TOKEN).getProfile()
  assert.equal(p.username, 'octo')
  assert.deepEqual(p.orgs, [{ name: 'acme', avatarUrl: 'https://gh.example/acme.png' }])
  assert.equal(p.repoKind, 'pinned')
  assert.equal(p.repos[0].language, 'TypeScript')
  assert.deepEqual(p.heatmap, {
    source: 'calendar',
    total: 5,
    days: [
      { date: '2026-03-01', count: 2 },
      { date: '2026-03-02', count: 3 }
    ]
  })
  assert.deepEqual(
    p.events.map((e) => e.text),
    ['Pushed 3 commits to octo/hello', 'Starred acme/kit']
  )
})

test('GitHub: without pins the profile lists recent repos, and a GraphQL outage only drops the heatmap', async () => {
  pins = false
  graphqlDown = true
  const p = await new GitHubProvider('acc', base, TOKEN).getProfile()
  graphqlDown = false
  pins = true
  assert.equal(p.heatmap, null)
  assert.equal(p.repoKind, 'recent')
  assert.equal(p.repos[0].fullName, 'octo/hello')
  assert.equal(p.orgs.length, 1)
})

test('GitLab: getProfile counts events into a heatmap, lists recent projects and makes avatars absolute', async () => {
  const p = await new GitLabProvider('acc', `${base}/gitlab`, TOKEN).getProfile()
  assert.equal(p.name, 'Gil Lab')
  assert.equal(p.followers, 4)
  assert.equal(p.avatarUrl, `${base}/gitlab/uploads/a.png`)
  assert.equal(p.heatmap?.source, 'events')
  assert.equal(p.heatmap?.days.length, 365)
  assert.equal(p.heatmap?.total, 3) // two today, one 100 days ago from another window
  assert.equal(p.repoKind, 'recent')
  assert.deepEqual(p.orgs, [{ name: 'team', avatarUrl: '' }])
  assert.deepEqual(
    p.events.map((e) => e.text),
    ['Pushed to main', 'Opened mergerequest Fix CI', 'Commented on']
  )
})

test('getProfile: a refused token rejects without leaking it, and sends it only in a header', async () => {
  const bad = 'wrong-token-xyz'
  for (const provider of [
    new GitHubProvider('a', base, bad),
    new GitLabProvider('a', `${base}/gitlab`, bad)
  ]) {
    await assert.rejects(provider.getProfile(), (err: unknown) => {
      assert.ok(err instanceof HttpError && err.status === 401)
      assert.ok(!err.message.includes(bad))
      return true
    })
  }
  seen = []
  await new GitHubProvider('a', base, TOKEN).getProfile()
  await new GitLabProvider('a', `${base}/gitlab`, TOKEN).getProfile()
  assert.ok(seen.every((r) => !r.url.includes(TOKEN)))
})

test('eventHeatmap: 365 days ending today, events counted by UTC day', () => {
  const h = eventHeatmap(
    [
      { created_at: '2026-03-10T23:59:00Z' },
      { created_at: '2026-03-10T01:00:00Z' },
      { created_at: '2020-01-01T00:00:00Z' }
    ],
    new Date('2026-03-10T12:00:00Z')
  )
  assert.equal(h.days.length, 365)
  assert.deepEqual(h.days[364], { date: '2026-03-10', count: 2 })
  assert.equal(h.days[0].date, '2025-03-11')
  assert.equal(h.total, 2)
})

// Overview cards

const ghHello = { fullName: 'octo/hello', remoteId: '1', defaultBranch: 'main' } as Repo
const glFull = { fullName: 'team/full', remoteId: '10', defaultBranch: 'main' } as Repo

test('GitHub: readme decodes base64, keeps a plain body, and a 404 is no README', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  let body: unknown = {
    name: 'Readme.md',
    encoding: 'base64',
    content: Buffer.from('# Hi \u00e9').toString('base64')
  }
  route = (url, send) => {
    if (url.pathname !== '/api/v3/repos/octo/hello/readme') return false
    if (body === null) send(404, { message: 'Not Found' })
    else send(200, body)
    return true
  }
  assert.deepEqual(await p.readme(ghHello), {
    name: 'Readme.md',
    markdown: '# Hi \u00e9',
    truncated: false
  })
  body = { name: 'README', content: 'plain' }
  assert.equal((await p.readme(ghHello))?.markdown, 'plain')
  body = {
    name: 'README.md',
    encoding: 'base64',
    content: Buffer.from('x'.repeat(600_000)).toString('base64')
  }
  const big = await p.readme(ghHello)
  assert.equal(big?.truncated, true)
  assert.equal(big?.markdown.length, 512 * 1024)
  body = null
  assert.equal(await p.readme(ghHello), null)
})

test('GitHub: activity retries a 202 once, then reports computing; weeks become days', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  const today = new Date()
  const sunday =
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()) / 1000
  let answers: unknown[] = [{}, [{ week: sunday, total: 3, days: [1, 2, 0, 0, 0, 0, 0] }]]
  route = (url, send) => {
    if (url.pathname !== '/api/v3/repos/octo/hello/stats/commit_activity') return false
    const next = answers.shift()
    if (next && !Array.isArray(next)) send(202, next)
    else send(200, next)
    return true
  }
  const a = await p.activity(ghHello, 0)
  assert.equal(a.computing, false)
  assert.equal(a.days.length, 365)
  assert.equal(
    a.days.reduce((n, d) => n + d.count, 0),
    // Days after today fall outside the window.
    today.getDay() === 0 ? 1 : 3
  )
  answers = [{}, {}]
  const still = await p.activity(ghHello, 0)
  assert.equal(still.computing, true)
  assert.ok(still.days.every((d) => d.count === 0))
})

test('GitHub: latestTags asks for three and keeps at most three names', async () => {
  const p = new GitHubProvider('acc', base, TOKEN)
  route = (url, send) => {
    if (url.pathname !== '/api/v3/repos/octo/hello/tags') return false
    // A host that ignores per_page still yields three.
    send(200, [{ name: 'v4' }, { name: 'v3' }, { name: 'v2' }, { name: 'v1' }])
    return true
  }
  assert.deepEqual(await p.latestTags(ghHello), ['v4', 'v3', 'v2'])
  assert.match(seen.at(-1)?.url ?? '', /per_page=3/)
})

test('GitLab: readme follows readme_url to the raw file on the default branch; a 404 is no README', async () => {
  const p = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  let readmeUrl: string | null = 'https://gl.example/team/full/-/blob/main/ReadMe.markdown'
  route = (url, send) => {
    if (url.pathname === '/gitlab/api/v4/projects/10') {
      send(200, glProject(10, 'team/full', { readme_url: readmeUrl }))
      return true
    }
    if (url.pathname === '/gitlab/api/v4/projects/10/repository/files/ReadMe.markdown/raw') {
      assert.equal(url.searchParams.get('ref'), 'main')
      send(200, '# raw')
      return true
    }
    return false
  }
  const got = await p.readme(glFull)
  assert.equal(got?.name, 'ReadMe.markdown')
  // The mock JSON-encodes bodies, so the raw text arrives quoted.
  assert.equal(got?.markdown, '"# raw"')
  readmeUrl = null
  assert.equal(await p.readme(glFull), null, 'README.md is tried and 404s')
})

test('GitLab: activity pages in sequence and flags the 1,000-commit cap', async () => {
  const p = new GitLabProvider('acc', `${base}/gitlab`, TOKEN)
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T09:00:00+07:00`
  let pages = 2
  route = (url, send) => {
    if (url.pathname !== '/gitlab/api/v4/projects/10/repository/commits') return false
    const page = Number(url.searchParams.get('page') ?? '1')
    if (page === 1) assert.ok(url.searchParams.get('since'))
    const next: Record<string, string> =
      page < pages
        ? { link: `</gitlab/api/v4/projects/10/repository/commits?page=${page + 1}>; rel="next"` }
        : {}
    send(
      200,
      Array.from({ length: 100 }, () => ({ authored_date: iso })),
      next
    )
    return true
  }
  const small = await p.activity(glFull)
  assert.equal(small.truncated, false)
  assert.equal(small.days.at(-1)?.count, 200)
  pages = 50
  seen = []
  const capped = await p.activity(glFull)
  assert.equal(capped.truncated, true)
  assert.equal(seen.filter((r) => r.url.includes('/commits')).length, 10)
})
