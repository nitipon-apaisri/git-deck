import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { createPoller, MAX_BACKOFF_MS, POLL_MS, type Notice } from '../src/main/notifyPoller'
import { GitHubProvider } from '../src/main/providers/github'
import {
  ALL_NOTIFY_EVENTS,
  allNotifyOn,
  diffChangeRequests,
  noticeBody,
  repoNotifyState
} from '../src/shared/notify'
import type { ChangeRequest, ChecksInfo, NotifyEvent, Project, Repo } from '../src/shared/types'

const cr = (number: number, over: Partial<ChangeRequest> = {}): ChangeRequest => ({
  number,
  title: `PR ${number}`,
  state: 'open',
  draft: false,
  author: 'ann',
  reviewers: [],
  labels: [],
  sourceBranch: `b${number}`,
  targetBranch: 'main',
  webUrl: `https://gh.example/o/r/pull/${number}`,
  updatedAt: '2026-01-01T00:00:00Z',
  checksRef: `sha${number}`,
  ...over
})
const kinds = (prev: ChangeRequest[] | null, next: ChangeRequest[]): [string, number][] =>
  diffChangeRequests(prev, next).map((e) => [e.kind, e.cr.number])

// Differ

test('differ: the first load is the baseline and emits nothing', () => {
  assert.deepEqual(kinds(null, [cr(1), cr(2, { state: 'merged' })]), [])
})

test('differ: no change emits nothing', () => {
  assert.deepEqual(kinds([cr(1)], [cr(1)]), [])
})

test('differ: new, merged, closed and reviewer requested', () => {
  const prev = [cr(1), cr(2), cr(3, { reviewers: ['bob'] })]
  const next = [
    cr(4),
    cr(1, { state: 'merged' }),
    cr(2, { state: 'closed' }),
    cr(3, { reviewers: ['bob', 'cy'] })
  ]
  assert.deepEqual(kinds(prev, next), [
    ['created', 4],
    ['merged', 1],
    ['closed', 2],
    ['review', 3]
  ])
})

test('differ: reopened, a removed reviewer and an old request re-entering the window emit nothing', () => {
  const prev = [cr(5, { state: 'closed' }), cr(6, { reviewers: ['bob'] })]
  const next = [cr(5), cr(6), cr(2)]
  assert.deepEqual(kinds(prev, next), [])
})

test('noticeBody has the number, the event and the title only', () => {
  assert.equal(noticeBody('merged', cr(7)), '#7 merged: PR 7')
})

// Poller, against a mock GitHub API

const TOKEN = 'test-token-xyz'
let server: Server
let base = ''
let pulls: unknown[] = []
let pullStatus = 200
let checkRuns: Record<string, string> = {}
let hits: string[] = []

const ghPull = (n: number, state = 'open', merged = false): unknown => ({
  number: n,
  title: `PR ${n}`,
  state,
  draft: false,
  merged_at: merged ? '2026-01-02T00:00:00Z' : null,
  user: { login: 'ann' },
  requested_reviewers: [],
  labels: [],
  head: { ref: `b${n}`, sha: `sha${n}` },
  base: { ref: 'main' },
  html_url: `https://gh.example/octo/hello/pull/${n}`,
  updated_at: '2026-01-01T00:00:00Z'
})

before(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '')
    const url = new URL(req.url ?? '/', base)
    const send = (code: number, body: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.headers['authorization'] !== `Bearer ${TOKEN}`) return send(401, {})
    if (url.pathname === '/api/v3/repos/octo/hello/pulls') {
      return send(pullStatus, pullStatus === 200 ? pulls : { message: 'nope' })
    }
    const m = /\/commits\/([^/]+)\/check-runs$/.exec(url.pathname)
    if (m) {
      const s = checkRuns[m[1]] ?? 'success'
      return send(200, {
        check_runs: [
          {
            name: 'ci',
            status: s === 'pending' ? 'in_progress' : 'completed',
            conclusion: s === 'pending' ? null : s,
            html_url: null
          }
        ]
      })
    }
    if (url.pathname.endsWith('/status')) return send(200, { statuses: [] })
    send(404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

const repo = { key: 'acc:1', fullName: 'octo/hello', remoteId: '1' } as Repo
const project = (notify: NotifyEvent[], repoKeys = ['acc:1', 'local:x']): Project => ({
  id: 'p1',
  name: 'P',
  icon: 'folder',
  color: 'blue',
  repoKeys,
  createdAt: 0,
  updatedAt: 0,
  notify
})

function setup(notify: NotifyEvent[], repoKeys?: string[]) {
  pulls = []
  pullStatus = 200
  checkRuns = {}
  hits = []
  const gh = new GitHubProvider('acc', base, TOKEN)
  const notices: Notice[] = []
  const clock = { t: 0 }
  const timers: { fn: () => void; ms: number }[] = []
  const poller = createPoller({
    projects: () => [project(notify, repoKeys)],
    list: async (key) => {
      assert.equal(key, 'acc:1', 'a local repository is never polled')
      return gh.listChangeRequests(repo)
    },
    checks: (_key, ref): Promise<ChecksInfo> => gh.getChecks(repo, ref),
    notify: (n) => notices.push(n),
    now: () => clock.t,
    every: (fn, ms) => {
      timers.push({ fn, ms })
      return () => {}
    }
  })
  return { poller, notices, clock, timers }
}
const summary = (notices: Notice[]): string[] =>
  notices.map((n) => `${n.kind}${n.cr ? ` #${n.cr.number}` : ''}`)

test('poller: runs every 2 minutes, first poll silent, then watched events only', async () => {
  const { poller, notices, timers } = setup(['merged'])
  pulls = [ghPull(1), ghPull(2)]
  poller.start()
  await poller.tick()
  assert.deepEqual(
    timers.map((t) => t.ms),
    [POLL_MS]
  )
  assert.ok(POLL_MS >= 60_000)
  assert.equal(notices.length, 0)
  pulls = [ghPull(3), ghPull(1, 'closed', true), ghPull(2, 'closed')]
  await poller.tick()
  assert.deepEqual(summary(notices), ['merged #1'])
  assert.equal(notices[0].projectId, 'p1')
  assert.ok(!hits.some((h) => h.includes('check-runs')), 'checks not asked when not watched')
})

test('poller: a project with notifications off polls nothing', async () => {
  const { poller } = setup([])
  await poller.tick()
  assert.deepEqual(hits, [])
})

test('poller: 429 backs off, doubling, and resets after a success', async () => {
  const { poller, clock } = setup(['created'])
  pullStatus = 429
  await poller.tick()
  assert.equal(hits.length, 1)
  clock.t = POLL_MS
  await poller.tick()
  assert.equal(hits.length, 1, 'still backing off for 2 * POLL_MS')
  clock.t = 2 * POLL_MS
  await poller.tick()
  assert.equal(hits.length, 2)
  clock.t = 3 * POLL_MS
  await poller.tick()
  assert.equal(hits.length, 2, 'the second 429 doubles to 4 * POLL_MS')
  clock.t = 6 * POLL_MS
  pullStatus = 200
  await poller.tick()
  assert.equal(hits.length, 3)
  await poller.tick()
  assert.equal(hits.length, 4, 'a success clears the backoff')
  assert.ok(MAX_BACKOFF_MS >= POLL_MS)
})

test('poller: 401 stops the repository with one notice, restart tries again', async () => {
  const { poller, notices } = setup(['created'])
  pullStatus = 401
  await poller.tick()
  await poller.tick()
  assert.equal(hits.length, 1)
  assert.deepEqual(summary(notices), ['stopped'])
  pullStatus = 200
  poller.restart()
  await poller.tick()
  assert.equal(hits.length, 2)
})

test('poller: checks failed only on a move to failure, and finished checks are not re-read', async () => {
  const { poller, notices } = setup(['checksFailed'])
  pulls = [ghPull(1), ghPull(2)]
  checkRuns = { sha1: 'pending', sha2: 'success' }
  await poller.tick()
  assert.equal(notices.length, 0, 'first sighting is the baseline')
  hits = []
  checkRuns = { sha1: 'failure', sha2: 'failure' }
  await poller.tick()
  assert.deepEqual(summary(notices), ['checksFailed #1'])
  assert.ok(!hits.some((h) => h.includes('sha2')), 'a finished head is not asked again')
  await poller.tick()
  assert.deepEqual(summary(notices), ['checksFailed #1'], 'still failing: no repeat')
})

// Phase 37: all-events toggle and the repository bell state.
test('all events: on, off, partial', () => {
  assert.equal(allNotifyOn(ALL_NOTIFY_EVENTS), true)
  assert.equal(allNotifyOn([]), false)
  assert.equal(allNotifyOn(undefined), false)
  assert.equal(allNotifyOn(['merged']), false)
})

test('repo bell state is the union across owning projects', () => {
  const projects = [
    { id: 'a', name: 'A', repoKeys: ['r'], notify: [] },
    { id: 'b', name: 'B', repoKeys: ['r', 's'], notify: ['merged' as const] },
    { id: 'c', name: 'C', repoKeys: ['s'], notify: ALL_NOTIFY_EVENTS }
  ]
  const r = repoNotifyState(projects, 'r')
  assert.deepEqual(
    r.owners.map((p) => p.id),
    ['a', 'b']
  )
  assert.equal(r.on, true)
  assert.equal(repoNotifyState(projects.slice(0, 1), 'r').on, false)
  assert.deepEqual(repoNotifyState(projects, 'none'), { owners: [], on: false })
})
