import assert from 'node:assert/strict'
import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadLoginPath, parsePath } from '../src/main/shellPath'
import { tempDir } from './helpers'

test('parsePath ignores rc-file noise around the markers', () => {
  assert.equal(parsePath('hello\n__GITDECK_PATH__/a:/b__GITDECK_PATH__\nbye'), '/a:/b')
  assert.equal(parsePath('no markers'), null)
  assert.equal(parsePath('__GITDECK_PATH____GITDECK_PATH__'), null)
})

test('loadLoginPath takes PATH from the login shell and skips Windows', async () => {
  const dir = tempDir()
  const fake = join(dir, 'fakesh')
  // Runs the -c command in a real sh with a known PATH, as a login shell would.
  writeFileSync(fake, '#!/bin/sh\nPATH=/fake/bin:/other exec /bin/sh -c "$2"\n')
  chmodSync(fake, 0o755)
  const env: NodeJS.ProcessEnv = { SHELL: fake, PATH: '/usr/bin' }
  await loadLoginPath(env, 'win32')
  assert.equal(env['PATH'], '/usr/bin')
  await loadLoginPath(env, 'darwin')
  assert.equal(env['PATH'], '/fake/bin:/other')
})
