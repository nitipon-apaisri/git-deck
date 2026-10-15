import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { buildGitAuthEnv } from '../src/main/gitAuth'
import { Store, type SecretBox } from '../src/main/store'
import type { Account } from '../src/shared/types'
import { rm, tmpDir } from './helpers'

const box = (available: boolean): SecretBox => ({
  isEncryptionAvailable: () => available,
  encryptString: (s) => Buffer.from(s.split('').reverse().join('')),
  decryptString: (b) => b.toString().split('').reverse().join('')
})

const account: Account = {
  id: 'a1', type: 'gitlab', label: 'L', baseUrl: 'https://gl.example.com/sub', host: 'gl.example.com',
  username: 'u', allowInsecureTls: true
}

const dir = tmpDir()
after(() => rm(dir))

describe('Store', () => {
  it('stores tokens encrypted and removes everything with the account', () => {
    const s = new Store(dir, box(true))
    s.addAccount(account, 'glpat-secret')
    s.setLink('a1:7', '/tmp/x')
    s.setRepos('a1', [])
    assert.equal(s.getToken('a1'), 'glpat-secret')
    assert.ok(!readFileSync(join(dir, 'config.json'), 'utf8').includes('glpat-secret'))
    assert.equal(new Store(dir, box(true)).listAccounts().length, 1)
    s.removeAccount('a1')
    assert.equal(s.getToken('a1'), null)
    assert.deepEqual(s.getLinks(), {})
    assert.equal(s.getRepos('a1'), null)
  })
  it('refuses to store a token without encryption', () => {
    const s = new Store(tmpDir(), box(false))
    assert.throws(() => s.addAccount(account, 't'), /Secure storage/)
    assert.equal(s.listAccounts().length, 0)
  })
})

describe('buildGitAuthEnv', () => {
  it('scopes the header to the account origin', () => {
    const env = buildGitAuthEnv(account, 'tok')
    assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://gl.example.com/.extraHeader')
    assert.equal(env.GIT_CONFIG_VALUE_0, `Authorization: Basic ${Buffer.from('oauth2:tok').toString('base64')}`)
    assert.equal(env.GIT_SSL_NO_VERIFY, 'true')
    assert.equal(buildGitAuthEnv({ ...account, allowInsecureTls: false }, 't').GIT_SSL_NO_VERIFY, undefined)
  })
})
