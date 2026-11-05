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

test('GIT_SSL_NO_VERIFY is set only when the account allows insecure TLS', () => {
  const base = { type: 'gitlab', baseUrl: 'https://x.test', token: 't' } as const
  assert.equal(gitAuthEnv({ ...base, allowInsecureTls: false })['GIT_SSL_NO_VERIFY'], undefined)
  assert.equal(gitAuthEnv({ ...base, allowInsecureTls: true })['GIT_SSL_NO_VERIFY'], 'true')
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
