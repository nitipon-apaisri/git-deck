import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { HttpError } from '../src/main/http'
import { GitHubProvider } from '../src/main/providers/github'
import { GitLabProvider } from '../src/main/providers/gitlab'
import type { CreateChangeRequestInput, Repo } from '../src/shared/types'

const TOKEN = 'test-token-abc'
const input: CreateChangeRequestInput = {
  title: 'Add x',
  body: 'why',
  head: 'feat',
  base: 'main',
  draft: false
}
const ghRepo = { fullName: 'octo/hello', remoteId: '1' } as Repo
const glRepo = { fullName: 'team/full', remoteId: '10' } as Repo

let server: Server
let base = ''
let sent: { url: string; body: Record<string, unknown> } | null = null
// What the next POST answers; the tests set it.
let reply: { code: number; body: unknown } = { code: 201, body: {} }

before(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      sent = { url: req.url ?? '', body: JSON.parse(raw || '{}') }
      res.writeHead(reply.code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply.body))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

const gh = (): GitHubProvider => new GitHubProvider('a', base, TOKEN)
const gl = (): GitLabProvider => new GitLabProvider('a', `${base}/gitlab`, TOKEN)
const ghPull = (extra: Record<string, unknown> = {}): unknown => ({
  number: 5,
  title: 'Add x',
  state: 'open',
  merged_at: null,
  user: { login: 'ann' },
  head: { ref: 'feat', sha: 's' },
  base: { ref: 'main' },
  html_url: `${base}/octo/hello/pull/5`,
  updated_at: '2026-01-01T00:00:00Z',
  ...extra
})
const glMr = (extra: Record<string, unknown> = {}): unknown => ({
  iid: 8,
  title: 'Add x',
  state: 'opened',
  author: { username: 'ann' },
  source_branch: 'feat',
  target_branch: 'main',
  web_url: `${base}/team/full/-/merge_requests/8`,
  updated_at: '2026-01-01T00:00:00Z',
  ...extra
})

test('GitHub: created, sends head/base/draft', async () => {
  reply = { code: 201, body: ghPull({ draft: true }) }
  const cr = await gh().createChangeRequest(ghRepo, { ...input, draft: true })
  assert.equal(sent?.url, '/api/v3/repos/octo/hello/pulls')
  assert.deepEqual(sent?.body, {
    title: 'Add x',
    body: 'why',
    head: 'feat',
    base: 'main',
    draft: true
  })
  assert.equal(cr.number, 5)
  assert.equal(cr.draft, true)
})

test('GitLab: created; a draft becomes the "Draft: " title prefix', async () => {
  reply = { code: 201, body: glMr({ draft: true }) }
  const cr = await gl().createChangeRequest(glRepo, { ...input, draft: true })
  assert.equal(sent?.url, '/gitlab/api/v4/projects/10/merge_requests')
  assert.deepEqual(sent?.body, {
    title: 'Draft: Add x',
    description: 'why',
    source_branch: 'feat',
    target_branch: 'main'
  })
  assert.equal(cr.number, 8)
  await gl().createChangeRequest(glRepo, input)
  assert.equal(sent?.body.title, 'Add x')
})

test('errors: 403 and 422 carry the host reason, 401 stays short, no token in any message', async () => {
  const cases: [number, unknown, RegExp][] = [
    [
      403,
      { message: 'Resource not accessible by personal access token' },
      /Resource not accessible/
    ],
    [
      422,
      { message: 'Validation Failed', errors: [{ message: 'A pull request already exists' }] },
      /already exists/
    ],
    [401, { message: 'bad credentials' }, /401/]
  ]
  for (const [code, body, re] of cases) {
    reply = { code, body }
    for (const p of [
      gh().createChangeRequest(ghRepo, input),
      gl().createChangeRequest(glRepo, input)
    ]) {
      await assert.rejects(p, (e: unknown) => {
        assert.ok(e instanceof HttpError)
        assert.equal(e.status, code)
        assert.match(e.message, re)
        assert.ok(!e.message.includes(TOKEN))
        return true
      })
    }
  }
  // GitLab reports its reason as an array.
  reply = { code: 409, body: { message: ['Another open merge request already exists'] } }
  await assert.rejects(gl().createChangeRequest(glRepo, input), /already exists/)
})

test('a result link to another origin is blanked', async () => {
  reply = { code: 201, body: ghPull({ html_url: 'https://evil.example/x' }) }
  assert.equal((await gh().createChangeRequest(ghRepo, input)).webUrl, '')
  reply = { code: 201, body: glMr({ web_url: 'https://evil.example/x' }) }
  assert.equal((await gl().createChangeRequest(glRepo, input)).webUrl, '')
})

test('a 422 whose errors have no message still says which field failed', async () => {
  reply = {
    code: 422,
    body: {
      message: 'Validation Failed',
      errors: [{ resource: 'PullRequest', field: 'head', code: 'invalid' }]
    }
  }
  await assert.rejects(gh().createChangeRequest(ghRepo, input), /PullRequest head invalid/)
})
