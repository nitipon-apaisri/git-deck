import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadLoginPath, parsePath } from '../src/main/shellPath'

test('parsePath ignores rc-file noise around the markers', () => {
  assert.equal(parsePath('hello\n__GITDECK_PATH__/a:/b__GITDECK_PATH__\nbye'), '/a:/b')
  assert.equal(parsePath('no markers'), null)
  assert.equal(parsePath('__GITDECK_PATH____GITDECK_PATH__'), null)
})

test('loadLoginPath sets PATH from the login shell and skips Windows', async () => {
  const env: NodeJS.ProcessEnv = { SHELL: '/bin/sh', PATH: '/usr/bin' }
  await loadLoginPath(env, 'win32')
  assert.equal(env['PATH'], '/usr/bin')
  await loadLoginPath(env, 'darwin')
  assert.ok(env['PATH'] && env['PATH'].length > 0)
})
