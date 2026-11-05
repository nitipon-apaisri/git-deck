import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorMessage } from '../src/renderer/src/lib/errors'
import { avatarIndex, initialsOf, timeAgo, truncateMiddle } from '../src/renderer/src/lib/format'
import { PRESETS, hostTileOf, tokenUrl, tryNormalize } from '../src/renderer/src/lib/presets'
import {
  buildTree,
  flattenTree,
  matchesQuery,
  namespaceKey
} from '../src/renderer/src/lib/sidebarTree'
import {
  parseThemeSetting,
  readThemeSetting,
  resolveTheme,
  writeThemeSetting,
  THEME_KEY
} from '../src/renderer/src/lib/theme'
import { initial, reducer } from '../src/renderer/src/lib/workspaceReducer'
import type { Account, Repo } from '../src/shared/types'

const account = (id: string, username: string, extra: Partial<Account> = {}): Account => ({
  id,
  type: 'gitlab',
  label: id,
  baseUrl: 'https://gitlab.com',
  host: 'gitlab.com',
  username,
  allowInsecureTls: false,
  ...extra
})

const repo = (
  accountId: string,
  id: string,
  namespace: string,
  name: string,
  extra: Partial<Repo> = {}
): Repo => ({
  key: `${accountId}:${id}`,
  accountId,
  remoteId: id,
  name,
  fullName: `${namespace}/${name}`,
  namespace,
  description: '',
  visibility: 'private',
  defaultBranch: 'main',
  webUrl: '',
  httpUrl: '',
  sshUrl: '',
  stars: 0,
  forks: 0,
  openIssues: 0,
  updatedAt: '',
  archived: false,
  fork: false,
  ...extra
})

// errors

test('errorMessage strips the Electron prefix and Error labels', () => {
  assert.equal(
    errorMessage(
      new Error("Error invoking remote method 'accounts:add': Error: This account is already added")
    ),
    'This account is already added'
  )
  assert.equal(errorMessage(new Error('TypeError: Error: nope')), 'nope')
  assert.equal(errorMessage(new Error('Plain message')), 'Plain message')
  assert.equal(errorMessage('text'), 'text')
  assert.equal(errorMessage(undefined), 'Something went wrong')
  assert.equal(errorMessage(new Error('   ')), 'Something went wrong')
})

test('errorMessage says network and HTTP failures plainly', () => {
  assert.match(errorMessage(new Error('net::ERR_CONNECTION_REFUSED')), /refused the connection/)
  assert.match(errorMessage(new Error('net::ERR_NAME_NOT_RESOLVED')), /address could not be found/)
  assert.match(
    errorMessage(new Error('net::ERR_CERT_AUTHORITY_INVALID')),
    /self-signed certificate/
  )
  assert.match(errorMessage(new Error('net::ERR_SSL_PROTOCOL_ERROR')), /certificate is not trusted/)
  assert.match(errorMessage(new Error('Request timed out')), /did not answer in time/)
  assert.match(
    errorMessage(new Error('Request failed: 401 Unauthorized')),
    /rejected the token \(401\)/
  )
  assert.match(errorMessage(new Error('Request failed: 403 Forbidden')), /scopes/)
  assert.match(errorMessage(new Error('Request failed: 404 Not Found')), /base URL/)
  assert.match(errorMessage(new Error('Request failed: 503 Service Unavailable')), /\(503\)/)
  assert.equal(
    errorMessage(new Error('net::ERR_UNSAFE_PORT')),
    'Could not reach the server (ERR_UNSAFE_PORT).'
  )
  // Messages the service already made plain pass through unchanged.
  assert.equal(
    errorMessage(new Error('This account is already added')),
    'This account is already added'
  )
})

// theme

test('theme: parse, resolve and storage that may throw', () => {
  assert.equal(parseThemeSetting('dark'), 'dark')
  assert.equal(parseThemeSetting('purple'), 'system')
  assert.equal(parseThemeSetting(null), 'system')
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')

  const data = new Map<string, string>()
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v)
  }
  assert.equal(readThemeSetting(store), 'system')
  writeThemeSetting(store, 'light')
  assert.equal(data.get(THEME_KEY), 'light')
  assert.equal(readThemeSetting(store), 'light')

  const blocked = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    }
  }
  assert.equal(readThemeSetting(blocked), 'system')
  assert.doesNotThrow(() => writeThemeSetting(blocked, 'dark'))
  assert.equal(readThemeSetting(null), 'system')
})

// format

test('timeAgo', () => {
  const now = 1_000_000_000
  assert.equal(timeAgo(now - 10_000, now), 'just now')
  assert.equal(timeAgo(now - 120_000, now), '2 min ago')
  assert.equal(timeAgo(now - 3 * 3_600_000, now), '3 h ago')
  assert.equal(timeAgo(now - 5 * 86_400_000, now), '5 d ago')
  assert.equal(timeAgo(now + 5_000, now), 'just now')
})

test('initialsOf and avatarIndex', () => {
  assert.equal(initialsOf('nitipon'), 'NI')
  assert.equal(initialsOf('Ada Lovelace'), 'AL')
  assert.equal(initialsOf('acme-dev_team'), 'AD')
  assert.equal(initialsOf('   '), '?')
  assert.equal(avatarIndex('octo'), avatarIndex('octo'))
  for (const seed of ['a', 'octo', 'nitipon', 'ผู้ใช้', ''])
    assert.ok([1, 2, 3, 4].includes(avatarIndex(seed)))
})

test('truncateMiddle keeps both ends', () => {
  assert.equal(truncateMiddle('main', 28), 'main')
  const long = 'feature/very-long-branch-name-for-testing-ellipsis'
  const out = truncateMiddle(long, 20)
  assert.equal([...out].length, 20)
  assert.ok(out.startsWith('feature/'))
  assert.ok(out.endsWith('llipsis'))
  assert.ok(out.includes('…'))
})

// presets

test('presets: fixed URLs for the .com hosts, free URL for the others', () => {
  const fixed = Object.fromEntries(PRESETS.map((p) => [p.id, p.fixedBaseUrl]))
  assert.deepEqual(fixed, {
    github: 'https://github.com',
    gitlab: 'https://gitlab.com',
    'gitlab-self': null,
    'github-enterprise': null
  })
})

test('tryNormalize returns null instead of throwing', () => {
  assert.equal(tryNormalize('gitlab', ''), null)
  assert.equal(tryNormalize('gitlab', 'ftp://x'), null)
  assert.equal(tryNormalize('gitlab', 'git.acme.dev/'), 'https://git.acme.dev')
})

test('hostTileOf names the tile and colour for an account', () => {
  assert.deepEqual(hostTileOf('github', 'https://github.com'), { tile: 'GH', host: 'github' })
  assert.deepEqual(hostTileOf('github', 'https://ghe.acme.dev'), { tile: 'GE', host: 'selfhosted' })
  assert.deepEqual(hostTileOf('gitlab', 'https://gitlab.com'), { tile: 'GL', host: 'gitlab' })
  assert.deepEqual(hostTileOf('gitlab', 'https://git.acme.dev/gitlab'), {
    tile: 'SH',
    host: 'selfhosted'
  })
})

test('tokenUrl pre-fills the scopes for each host', () => {
  const gl = new URL(tokenUrl('gitlab', 'https://git.acme.dev/gitlab'))
  assert.equal(
    gl.origin + gl.pathname,
    'https://git.acme.dev/gitlab/-/user_settings/personal_access_tokens'
  )
  assert.equal(gl.searchParams.get('scopes'), 'read_api,read_repository')
  assert.equal(gl.searchParams.get('name'), 'GitDeck')
  const gh = new URL(tokenUrl('github', 'https://github.com'))
  assert.equal(gh.origin + gh.pathname, 'https://github.com/settings/tokens/new')
  assert.equal(gh.searchParams.get('scopes'), 'repo,read:org')
})

// sidebar tree

test('buildTree: own namespace first, the rest alphabetical, repos by name', () => {
  const a = account('a', 'nitipon')
  const tree = buildTree(
    [a],
    {
      a: [
        repo('a', '1', 'zeta', 'one'),
        repo('a', '2', 'Alpha', 'two'),
        repo('a', '3', 'nitipon', 'Beta'),
        repo('a', '4', 'nitipon', 'alpha')
      ]
    },
    ''
  )
  assert.deepEqual(
    tree[0].namespaces.map((n) => n.name),
    ['nitipon', 'Alpha', 'zeta']
  )
  assert.deepEqual(
    tree[0].namespaces[0].repos.map((r) => r.name),
    ['alpha', 'Beta']
  )
  assert.equal(tree[0].total, 4)
  assert.equal(tree[0].matched, 4)
})

test('buildTree: own namespace matches ignoring case, accounts keep their order, empty accounts stay', () => {
  const a = account('a', 'Nitipon')
  const b = account('b', 'other')
  const tree = buildTree(
    [b, a],
    { a: [repo('a', '1', 'aaa', 'x'), repo('a', '2', 'nitipon', 'y')] },
    ''
  )
  assert.deepEqual(
    tree.map((n) => n.account.id),
    ['b', 'a']
  )
  assert.deepEqual(tree[0].namespaces, [])
  assert.equal(tree[1].namespaces[0].name, 'nitipon')
})

test('search matches name, full name and description, and hides empty hosts', () => {
  const a = account('a', 'me')
  const b = account('b', 'you')
  const repos = {
    a: [
      repo('a', '1', 'team', 'api', { description: 'Payments service' }),
      repo('a', '2', 'team', 'web')
    ],
    b: [repo('b', '3', 'other', 'docs')]
  }
  assert.ok(matchesQuery(repos.a[0], 'PAYMENTS'))
  assert.ok(matchesQuery(repos.a[1], 'team/we'))
  assert.ok(matchesQuery(repos.a[1], '  '))
  const byDescription = buildTree([a, b], repos, 'payments')
  assert.deepEqual(
    byDescription.map((n) => n.account.id),
    ['a']
  )
  assert.equal(byDescription[0].matched, 1)
  assert.equal(byDescription[0].total, 2)
  assert.deepEqual(buildTree([a, b], repos, 'nomatch'), [])
})

test('flattenTree honours collapse, and a search expands everything', () => {
  const a = account('a', 'me')
  const nodes = buildTree([a], { a: [repo('a', '1', 'me', 'x'), repo('a', '2', 'team', 'y')] }, '')
  const kinds = (rows: ReturnType<typeof flattenTree>): string[] => rows.map((r) => r.kind)
  assert.deepEqual(kinds(flattenTree(nodes, new Set(), false)), [
    'host',
    'namespace',
    'repo',
    'namespace',
    'repo'
  ])
  assert.deepEqual(kinds(flattenTree(nodes, new Set(['a']), false)), ['host'])
  assert.deepEqual(kinds(flattenTree(nodes, new Set([namespaceKey('a', 'team')]), false)), [
    'host',
    'namespace',
    'repo',
    'namespace'
  ])
  const searching = flattenTree(nodes, new Set(['a', namespaceKey('a', 'team')]), true)
  assert.deepEqual(kinds(searching), ['host', 'namespace', 'repo', 'namespace', 'repo'])
  assert.ok(searching.every((r) => r.kind === 'repo' || r.expanded))
})

// workspace reducer

test('workspace reducer: loaded, repos, failure keeps cached repos, removal clears the account', () => {
  const a = account('a', 'me')
  const r1 = repo('a', '1', 'me', 'x')
  let s = reducer(initial, {
    type: 'loaded',
    secureStorage: true,
    accounts: [a],
    links: { 'a:1': '/p', 'b:2': '/q' }
  })
  assert.equal(s.ready, true)
  s = reducer(s, { type: 'loading', accountId: 'a' })
  assert.equal(s.byAccount['a'].loading, true)
  s = reducer(s, { type: 'repos', accountId: 'a', repos: [r1], fetchedAt: 5 })
  assert.deepEqual(s.byAccount['a'], { repos: [r1], loading: false, error: null, fetchedAt: 5 })
  s = reducer(s, { type: 'loading', accountId: 'a' })
  s = reducer(s, { type: 'failed', accountId: 'a', error: 'Request failed: 401' })
  assert.equal(s.byAccount['a'].error, 'Request failed: 401')
  assert.deepEqual(s.byAccount['a'].repos, [r1], 'cached repos stay visible')
  assert.equal(s.byAccount['a'].loading, false)
  s = reducer(s, { type: 'repos', accountId: 'a', repos: [r1], fetchedAt: 9 })
  assert.equal(s.byAccount['a'].error, null)
  s = reducer(s, { type: 'accountRemoved', accountId: 'a' })
  assert.deepEqual(s.accounts, [])
  assert.equal(s.byAccount['a'], undefined)
  assert.deepEqual(s.links, { 'b:2': '/q' })
})

test('workspace reducer: adding an account twice keeps one, load failure still marks ready', () => {
  const a = account('a', 'me')
  let s = reducer(initial, { type: 'accountAdded', account: a })
  s = reducer(s, { type: 'accountAdded', account: { ...a, label: 'Renamed' } })
  assert.equal(s.accounts.length, 1)
  assert.equal(s.accounts[0].label, 'Renamed')
  const failed = reducer(initial, { type: 'loadFailed', error: 'boom' })
  assert.equal(failed.ready, true)
  assert.equal(failed.loadError, 'boom')
})
