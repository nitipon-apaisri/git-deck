import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, test } from 'node:test'
import { HttpError } from '../src/main/http'
import { GitHubProvider, normalizeChecks, worstState } from '../src/main/providers/github'
import { GitLabProvider, normalizeMr, pipelineState } from '../src/main/providers/gitlab'
import { CHANGES_STALE_MS, changesStale, createUrl } from '../src/renderer/src/lib/changeView'
import type { Repo } from '../src/shared/types'

const TOKEN = 'test-token-abc'
let server: Server
let base = ''
let seen: string[] = []

const ghRepo = { fullName: 'octo/hello', remoteId: '1' } as Repo
const glRepo = { fullName: 'team/full', remoteId: '10' } as Repo
const ghPull = (n: number, extra: Record<string, unknown> = {}): unknown => ({
  number: n,
  title: `PR ${n}`,
  state: 'open',
  draft: false,
  merged_at: null,
  user: { login: 'ann' },
  requested_reviewers: [{ login: 'bob' }],
  labels: [{ name: 'bug' }],
  head: { ref: `feat-${n}`, sha: `sha${n}` },
  base: { ref: 'main' },
  html_url: `https://gh.example/octo/hello/pull/${n}`,
  updated_at: '2026-01-01T00:00:00Z',
  ...extra
})

function route(url: URL, send: (code: number, body?: unknown, h?: Record<string, string>) => void) {
  const p = url.pathname
  const page = url.searchParams.get('page')
  switch (p) {
    case '/api/v3/repos/octo/hello/pulls':
      return page === '2'
        ? send(200, [
            ghPull(3, { state: 'closed', merged_at: '2026-01-02T00:00:00Z' }),
            ghPull(4, { state: 'closed' })
          ])
        : send(200, [ghPull(1), ghPull(2, { draft: true })], {
            link: `<${base}/api/v3/repos/octo/hello/pulls?page=2>; rel="next"`
          })
    case '/api/v3/repos/octo/evil/pulls':
      return send(200, [ghPull(1)], {
        link: `<${base.replace('127.0.0.1', 'localhost')}/steal?page=2>; rel="next"`
      })
    case '/api/v3/repos/octo/hello/commits/sha1/check-runs':
      return send(200, {
        check_runs: [
          { name: 'build', status: 'completed', conclusion: 'success', html_url: 'u1' },
          { name: 'lint', status: 'in_progress', conclusion: null, html_url: null }
        ]
      })
    case '/api/v3/repos/octo/hello/commits/sha1/status':
      return send(200, { statuses: [{ context: 'ci/x', state: 'success', target_url: null }] })
    case '/gitlab/api/v4/projects/10/merge_requests':
      return send(200, [
        {
          iid: 7,
          title: 'Fix',
          state: 'opened',
          draft: true,
          author: { username: 'ann' },
          reviewers: [{ username: 'bob' }],
          labels: ['bug'],
          source_branch: 'fix',
          target_branch: 'main',
          web_url: 'https://gl.example/team/full/-/merge_requests/7',
          updated_at: '2026-01-01T00:00:00Z'
        },
        {
          iid: 6,
          title: 'Old',
          state: 'merged',
          author: null,
          source_branch: 'a',
          target_branch: 'main',
          web_url: 'w',
          updated_at: 'u'
        }
      ])
    case '/gitlab/api/v4/projects/10/pipelines':
      return url.searchParams.get('ref') === 'fix'
        ? send(200, [{ id: 99, status: 'running', web_url: 'https://gl.example/p/99' }])
        : send(200, [])
    default:
      // Everything else, including checks of an unknown ref or CI disabled, is a 404.
      return send(404, { message: 'Not Found' })
  }
}

before(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    seen.push(req.url ?? '')
    const url = new URL(req.url ?? '/', base)
    const send = (code: number, body?: unknown, headers: Record<string, string> = {}): void => {
      res.writeHead(code, { 'content-type': 'application/json', ...headers })
      res.end(body === undefined ? undefined : JSON.stringify(body))
    }
    const ok = url.pathname.startsWith('/gitlab/')
      ? req.headers['private-token'] === TOKEN
      : req.headers['authorization'] === `Bearer ${TOKEN}`
    if (!ok) return send(401, { message: 'bad credentials' })
    route(url, send)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
beforeEach(() => {
  seen = []
})
after(() => server.close())

test('GitHub: pull requests across pages, with open, draft, merged and closed states', async () => {
  const list = await new GitHubProvider('a', base, TOKEN).listChangeRequests(ghRepo)
  assert.deepEqual(
    list.map((c) => [c.number, c.state, c.draft]),
    [
      [1, 'open', false],
      [2, 'open', true],
      [3, 'merged', false],
      [4, 'closed', false]
    ]
  )
  assert.deepEqual(list[0], {
    number: 1,
    title: 'PR 1',
    state: 'open',
    draft: false,
    author: 'ann',
    reviewers: ['bob'],
    labels: ['bug'],
    sourceBranch: 'feat-1',
    targetBranch: 'main',
    webUrl: 'https://gh.example/octo/hello/pull/1',
    updatedAt: '2026-01-01T00:00:00Z',
    checksRef: 'sha1'
  })
})

test('GitHub: a Link to another origin is dropped, so the token is not sent there', async () => {
  const evil = { fullName: 'octo/evil', remoteId: '2' } as Repo
  const list = await new GitHubProvider('a', base, TOKEN).listChangeRequests(evil)
  assert.equal(list.length, 1)
  assert.ok(!seen.some((u) => u.startsWith('/steal')))
})

test('GitHub: check runs and statuses merge; the worst one sets the state', async () => {
  const info = await new GitHubProvider('a', base, TOKEN).getChecks(ghRepo, 'sha1')
  assert.equal(info.state, 'pending')
  assert.deepEqual(
    info.items.map((i) => [i.name, i.state]),
    [
      ['build', 'success'],
      ['lint', 'pending'],
      ['ci/x', 'success']
    ]
  )
})

test('GitHub: a ref with no CI endpoint answers none, a bad token still rejects', async () => {
  const p = new GitHubProvider('a', base, TOKEN)
  assert.deepEqual(await p.getChecks(ghRepo, 'nope'), { state: 'none', items: [] })
  await assert.rejects(
    new GitHubProvider('a', base, 'wrong').getChecks(ghRepo, 'sha1'),
    (e: unknown) => e instanceof HttpError && e.status === 401 && !e.message.includes('wrong')
  )
  await assert.rejects(new GitHubProvider('a', base, 'wrong').listChangeRequests(ghRepo), HttpError)
})

test('GitLab: merge requests map state, draft and a missing author', async () => {
  const list = await new GitLabProvider('a', `${base}/gitlab`, TOKEN).listChangeRequests(glRepo)
  assert.deepEqual(
    list.map((c) => [c.number, c.state, c.draft, c.author]),
    [
      [7, 'open', true, 'ann'],
      [6, 'merged', false, '']
    ]
  )
  assert.equal(list[0].checksRef, 'fix')
})

test('GitLab: latest pipeline for a ref; none for no pipeline, 404 or a bad token', async () => {
  const p = new GitLabProvider('a', `${base}/gitlab`, TOKEN)
  const info = await p.getChecks(glRepo, 'fix')
  assert.equal(info.state, 'pending')
  assert.equal(info.items[0].url, 'https://gl.example/p/99')
  assert.equal((await p.getChecks(glRepo, 'other')).state, 'none')
  assert.equal((await p.getChecks({ remoteId: '404' } as Repo, 'x')).state, 'none')
  await assert.rejects(
    new GitLabProvider('a', `${base}/gitlab`, 'wrong').getChecks(glRepo, 'fix'),
    HttpError
  )
})

test('normalisers: states', () => {
  assert.equal(worstState([]), 'none')
  assert.equal(worstState(['success', 'failure', 'pending']), 'failure')
  assert.equal(normalizeChecks([], []).state, 'none')
  assert.equal(
    normalizeChecks(
      [{ name: 'a', status: 'completed', conclusion: 'cancelled', html_url: null }],
      []
    ).state,
    'failure'
  )
  assert.equal(pipelineState('failed'), 'failure')
  assert.equal(pipelineState('manual'), 'none')
  assert.equal(pipelineState('created'), 'pending')
  assert.equal(
    normalizeMr({
      iid: 1,
      title: 't',
      state: 'closed',
      work_in_progress: true,
      author: null,
      source_branch: 's',
      target_branch: 't',
      web_url: 'w',
      updated_at: 'u'
    }).draft,
    true
  )
})

test('changesStale: unread or older than 60s', () => {
  assert.equal(changesStale(null, 1000), true)
  assert.equal(changesStale(1000, 1000 + CHANGES_STALE_MS), false)
  assert.equal(changesStale(1000, 1001 + CHANGES_STALE_MS), true)
})

test('createUrl: the host compare page, no trailing slash', () => {
  assert.equal(createUrl('github', 'https://gh.example/o/r/'), 'https://gh.example/o/r/compare')
  assert.equal(
    createUrl('gitlab', 'https://gl.example/g/p'),
    'https://gl.example/g/p/-/merge_requests/new'
  )
})
