import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { createProvider, normalizeBaseUrl } from '../src/main/providers'

let server: http.Server
let base = ''
const seenAuth: Record<string, string | undefined> = {}

const ghRepo = (id: number, extra: object = {}): object => ({
  id, name: `r${id}`, full_name: `org/r${id}`, owner: { login: 'org' }, description: null, private: id % 2 === 0,
  default_branch: 'main', html_url: `https://gh/org/r${id}`, clone_url: `https://gh/org/r${id}.git`,
  ssh_url: `git@gh:org/r${id}.git`, stargazers_count: 3, forks_count: 1, open_issues_count: 2,
  pushed_at: '2024-01-01T00:00:00Z', archived: false, fork: false, ...extra
})

before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x')
    const p = u.pathname
    const page = Number(u.searchParams.get('page') ?? '1')
    const json = (body: unknown, headers: Record<string, string> = {}, status = 200): void => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(JSON.stringify(body))
    }
    const kind = p.startsWith('/ghe/api/v3') ? 'gh' : p.startsWith('/lab/sub/api/v4') ? 'gl' : ''
    seenAuth[kind] = String(req.headers.authorization ?? req.headers['private-token'])

    // ---- GitHub Enterprise under /ghe ----
    if (p === '/ghe/api/v3/user') return json({ login: 'octo', avatar_url: 'https://a/octo.png' })
    if (p === '/ghe/api/v3/user/repos') {
      return json(page === 1 ? [ghRepo(1), ghRepo(2)] : [ghRepo(3)],
        page === 1 ? { link: `<${base}/ghe/api/v3/user/repos?page=2>; rel="next"` } : {})
    }
    if (p === '/ghe/api/v3/repos/org/r1') {
      return json({ license: { spdx_id: 'MIT' }, created_at: '2020-01-01T00:00:00Z', pushed_at: '2024-02-02T00:00:00Z',
        size: 123, topics: ['a', 'b'] })
    }
    if (p === '/ghe/api/v3/repos/org/r1/commits') {
      return json([{}], { link: `<${base}/x?page=2>; rel="next", <${base}/x?page=77>; rel="last"` })
    }
    if (p === '/ghe/api/v3/repos/org/r1/contributors') {
      if (u.searchParams.get('per_page') === '25') return json([{ login: 'alice', avatar_url: 'av', contributions: 9 }])
      return json({ message: 'The history or contributor list is too large' }, {}, 403)
    }
    if (p === '/ghe/api/v3/repos/org/r1/languages') return json({ TypeScript: 750, CSS: 250 })
    if (p === '/ghe/api/v3/repos/org/r1/branches') return json([{}], { link: `<${base}/x?page=4>; rel="last"` })
    if (p === '/ghe/api/v3/repos/org/r1/tags') return json([])
    if (p === '/ghe/api/v3/repos/org/r1/pulls') return json([{}, {}][0] ? [{}] : [], { link: `<${base}/x?page=5>; rel="last"` })
    if (p === '/ghe/api/v3/repos/org/r2') return json({}, {}, 500)
    if (p === '/ghe/api/v3/repos/org/r2/commits') return json({ message: 'Git Repository is empty.' }, {}, 409)
    if (p.startsWith('/ghe/api/v3/repos/org/r2/')) return json({ message: 'boom' }, {}, 500)

    // ---- GitLab under /lab/sub ----
    if (p === '/lab/sub/api/v4/user') return json({ username: 'gl', avatar_url: '/uploads/avatar.png' })
    if (p === '/lab/sub/api/v4/projects') {
      return json(page === 1
        ? [{ id: 7, name: 'proj', path_with_namespace: 'grp/sub/proj', namespace: { full_path: 'grp/sub' },
            description: 'd', visibility: 'internal', default_branch: 'main', web_url: 'w', http_url_to_repo: 'h',
            ssh_url_to_repo: 's', star_count: 1, forks_count: 2, open_issues_count: 3, last_activity_at: 'now',
            forked_from_project: { id: 1 } }]
        : [{ id: 8, name: 'p2', path_with_namespace: 'me/p2', visibility: 'private' }],
      page === 1 ? { link: `<${base}/lab/sub/api/v4/projects?page=2>; rel="next"` } : {})
    }
    if (p === '/lab/sub/api/v4/projects/7') {
      return json({ id: 7, created_at: 'c', last_activity_at: 'l', topics: ['t'], license: { nickname: 'MIT' },
        statistics: { commit_count: 55, repository_size: 2048 } })
    }
    if (p === '/lab/sub/api/v4/projects/8') return json({ id: 8, statistics: null })
    if (p === '/lab/sub/api/v4/projects/8/repository/commits') return json([{}], { 'x-total': '12' })
    if (p.endsWith('/repository/contributors')) {
      if (p.includes('/projects/8/')) return json({ message: 'forbidden' }, {}, 403)
      const list = Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, email: `e${i}`, commits: 30 - i }))
      return json(list, { 'x-total': '30' })
    }
    if (p.endsWith('/languages')) return json({ Ruby: 80.55, Go: 19.45 })
    if (p.endsWith('/repository/branches')) return json([{}], { 'x-total': '3' })
    if (p.endsWith('/repository/tags')) return json([], { 'x-total': '0' })
    if (p.endsWith('/merge_requests')) return json([{}], { 'x-total': '4' })
    json({ message: 'not found' }, {}, 404)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.closeAllConnections()
  server.close()
})

describe('normalizeBaseUrl', () => {
  it('applies defaults, https, and trims slashes', () => {
    assert.equal(normalizeBaseUrl('github', ''), 'https://github.com')
    assert.equal(normalizeBaseUrl('gitlab', ''), 'https://gitlab.com')
    assert.equal(normalizeBaseUrl('gitlab', 'git.corp.local/'), 'https://git.corp.local')
    assert.equal(normalizeBaseUrl('gitlab', 'http://h:8080/sub//'), 'http://h:8080/sub')
  })
  it('rejects non-http schemes and credentials', () => {
    assert.throws(() => normalizeBaseUrl('gitlab', 'ftp://x'), /http/)
    assert.throws(() => normalizeBaseUrl('gitlab', 'file:///etc'), /http/)
    assert.throws(() => normalizeBaseUrl('gitlab', 'https://u:p@x'), /credentials/)
  })
})

describe('GitHub provider (Enterprise base URL)', () => {
  const mk = (): ReturnType<typeof createProvider> =>
    createProvider({ id: 'acc', type: 'github', baseUrl: `${base}/ghe/` }, 'tok123')

  it('verifies the token with a Bearer header', async () => {
    assert.deepEqual(await mk().verify(), { username: 'octo', avatarUrl: 'https://a/octo.png' })
    assert.equal(seenAuth.gh, 'Bearer tok123')
  })

  it('lists repos across pages and maps fields', async () => {
    const repos = await mk().listRepos()
    assert.equal(repos.length, 3)
    assert.equal(repos[0].key, 'acc:1')
    assert.equal(repos[0].visibility, 'public')
    assert.equal(repos[1].visibility, 'private')
    assert.equal(repos[0].namespace, 'org')
    assert.equal(repos[0].description, '')
    assert.equal(repos[0].sshUrl, 'git@gh:org/r1.git')
  })

  it('builds a summary and tolerates a 403 on contributors', async () => {
    const p = mk()
    const [r1] = await p.listRepos()
    const s = await p.getSummary(r1)
    assert.equal(s.license, 'MIT')
    assert.equal(s.sizeKb, 123)
    assert.deepEqual(s.topics, ['a', 'b'])
    assert.equal(s.commitCount, 77)
    assert.equal(s.contributors[0].login, 'alice')
    assert.equal(s.contributorCount, null)
    assert.deepEqual(s.languages, [{ name: 'TypeScript', percent: 75 }, { name: 'CSS', percent: 25 }])
    assert.equal(s.branchCount, 4)
    assert.equal(s.tagCount, 0)
    assert.equal(s.openChangeRequests, 5)
  })

  it('treats 409 as an empty repo and other failures as null', async () => {
    const p = mk()
    const repos = await p.listRepos()
    const s = await p.getSummary(repos[1])
    assert.equal(s.commitCount, 0)
    assert.equal(s.branchCount, null)
    assert.equal(s.license, null)
    assert.deepEqual(s.contributors, [])
  })
})

describe('GitLab provider (path prefix base URL)', () => {
  const mk = (): ReturnType<typeof createProvider> =>
    createProvider({ id: 'gl1', type: 'gitlab', baseUrl: `${base}/lab/sub` }, 'glpat-x')

  it('verifies and makes the avatar URL absolute', async () => {
    const u = await mk().verify()
    assert.equal(u.username, 'gl')
    assert.equal(u.avatarUrl, `${base}/uploads/avatar.png`)
    assert.equal(seenAuth.gl, 'glpat-x')
  })

  it('lists projects across pages', async () => {
    const repos = await mk().listRepos()
    assert.equal(repos.length, 2)
    assert.equal(repos[0].fullName, 'grp/sub/proj')
    assert.equal(repos[0].namespace, 'grp/sub')
    assert.equal(repos[0].visibility, 'internal')
    assert.equal(repos[0].fork, true)
    assert.equal(repos[1].namespace, 'me')
    assert.equal(repos[1].fork, false)
  })

  it('builds a summary with statistics', async () => {
    const p = mk()
    const s = await p.getSummary((await p.listRepos())[0])
    assert.equal(s.commitCount, 55)
    assert.equal(s.sizeKb, 2)
    assert.equal(s.license, 'MIT')
    assert.equal(s.contributorCount, 30)
    assert.equal(s.contributors.length, 25)
    assert.equal(s.contributors[0].commits, 30)
    assert.deepEqual(s.languages, [{ name: 'Ruby', percent: 80.6 }, { name: 'Go', percent: 19.5 }])
    assert.equal(s.branchCount, 3)
    assert.equal(s.tagCount, 0)
    assert.equal(s.openChangeRequests, 4)
  })

  it('falls back to counting commits and survives a 403 on contributors', async () => {
    const p = mk()
    const s = await p.getSummary((await p.listRepos())[1])
    assert.equal(s.commitCount, 12)
    assert.equal(s.contributorCount, null)
    assert.deepEqual(s.contributors, [])
  })
})
