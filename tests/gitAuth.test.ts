import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gitAuthEnv } from '../src/main/gitAuth'
import { setInsecureHosts, verifyResultFor, allowHostTemporarily } from '../src/main/tls'

const basic = (user: string, token: string): string =>
  `Authorization: Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`

test('github uses x-access-token and scopes the header to the origin', () => {
  const env = gitAuthEnv({
    type: 'github',
    baseUrl: 'https://github.com/some/path',
    token: 'tok',
    allowInsecureTls: false
  })
  assert.deepEqual(env, {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
    GIT_CONFIG_VALUE_0: basic('x-access-token', 'tok')
  })
})

test('gitlab uses oauth2 and keeps a custom port in the scope', () => {
  const env = gitAuthEnv({
    type: 'gitlab',
    baseUrl: 'https://git.corp.example:8443',
    token: 'glpat',
    allowInsecureTls: false
  })
  assert.equal(env['GIT_CONFIG_KEY_0'], 'http.https://git.corp.example:8443/.extraHeader')
  assert.equal(env['GIT_CONFIG_VALUE_0'], basic('oauth2', 'glpat'))
})

test('sslVerify is disabled for the account origin only when it allows insecure TLS', () => {
  const base = { type: 'gitlab', baseUrl: 'https://x.test', token: 't' } as const
  const off = gitAuthEnv({ ...base, allowInsecureTls: false })
  assert.equal(off['GIT_CONFIG_COUNT'], '1')
  assert.equal(off['GIT_SSL_NO_VERIFY'], undefined)
  const on = gitAuthEnv({ ...base, allowInsecureTls: true })
  assert.equal(on['GIT_CONFIG_COUNT'], '2')
  assert.equal(on['GIT_CONFIG_KEY_1'], 'http.https://x.test/.sslVerify')
  assert.equal(on['GIT_CONFIG_VALUE_1'], 'false')
  assert.equal(on['GIT_SSL_NO_VERIFY'], undefined)
})

test('tls allowlist accepts listed hosts case-insensitively, defers otherwise', () => {
  setInsecureHosts(['Git.Internal'])
  assert.equal(verifyResultFor('git.internal'), 0)
  assert.equal(verifyResultFor('github.com'), -3)
  const undo = allowHostTemporarily('temp.host')
  assert.equal(verifyResultFor('TEMP.host'), 0)
  undo()
  assert.equal(verifyResultFor('temp.host'), -3)
  const undoKnown = allowHostTemporarily('git.internal')
  undoKnown()
  assert.equal(verifyResultFor('git.internal'), 0, 'a saved host stays allowed')
  setInsecureHosts([])
})
